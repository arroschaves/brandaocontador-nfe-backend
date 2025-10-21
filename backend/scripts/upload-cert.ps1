[CmdletBinding()]
param(
  [string]$BaseUrl = "http://localhost:3002",
  [string]$CertPath = ".\certs\teste-a1.pfx",
  [string]$Senha = "1234",
  [switch]$PreferAdmin
)

# Carregar assembly para HttpClient (necessário no PowerShell 5)
try { Add-Type -AssemblyName System.Net.Http } catch { try { [Reflection.Assembly]::Load("System.Net.Http") | Out-Null } catch {} }

function Write-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Ok($msg) { Write-Host "[OK]   $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Write-Err($msg) { Write-Host "[ERRO] $msg" -ForegroundColor Red }

function Invoke-Json($method, $url, $bodyObj) {
  $json = $null
  if ($null -ne $bodyObj) { $json = $bodyObj | ConvertTo-Json -Depth 5 }
  return Invoke-RestMethod -Uri $url -Method $method -ContentType 'application/json' -Body $json
}

function Try-Login {
  param([string]$Email,[string]$Senha)
  try {
    $resp = Invoke-Json -method Post -url "$BaseUrl/auth/login" -bodyObj @{ email=$Email; senha=$Senha }
    if ($resp -and $resp.sucesso -eq $true -and $resp.token) { return $resp.token }
    return $null
  } catch {
    $msg = $_.Exception.Message
    if ($msg -match 'RATE_LIMIT' -or $msg -match 'Muitas tentativas') {
      Write-Warn "Rate limit ao logar, aguardando 2s e tentando novamente..."
      Start-Sleep -Seconds 2
      try {
        $resp2 = Invoke-Json -method Post -url "$BaseUrl/auth/login" -bodyObj @{ email=$Email; senha=$Senha }
        if ($resp2 -and $resp2.sucesso -eq $true -and $resp2.token) { return $resp2.token }
      } catch {}
    }
    return $null
  }
}

function Try-LoginFromPayload {
  param([string]$PayloadPath)
  if (Test-Path $PayloadPath) {
    try {
      $payload = Get-Content -LiteralPath $PayloadPath -Raw | ConvertFrom-Json
      if ($payload.email -and $payload.senha) {
        return Try-Login -Email $payload.email -Senha $payload.senha
      }
    } catch {}
  }
  return $null
}

function Try-RegisterFromPayload {
  param([string]$PayloadPath)
  if (Test-Path $PayloadPath) {
    try {
      $data = Get-Content -LiteralPath $PayloadPath -Raw | ConvertFrom-Json
      $resp = Invoke-Json -method Post -url "$BaseUrl/auth/register" -bodyObj $data
      return $resp
    } catch {}
  }
  return $null
}

function Get-Token {
  # Em dev, o rate limit permite apenas 1 requisição por minuto.
  # Para garantir sucesso, vamos tentar APENAS um login com o admin configurado no .env real.
  $adminEmail = 'admin@brandaocontador.com.br'
  $adminSenha = 'admin123'
  Write-Info "Tentando login com admin: $adminEmail"
  $token = Try-Login -Email $adminEmail -Senha $adminSenha
  if (-not $token) { throw "Login falhou para $adminEmail devido a rate limit ou credenciais inválidas." }
  Write-Ok "Autenticado com sucesso"
  return $token
}

function Upload-Cert {
  param([string]$Endpoint,[string]$Token,[string]$CertPath,[string]$Senha)
  if (-not (Test-Path $CertPath)) { throw "Arquivo de certificado não encontrado: $CertPath" }
  Write-Info "Enviando certificado para $Endpoint..."
  # Usar HttpClient com MultipartFormDataContent
  $handler = New-Object System.Net.Http.HttpClientHandler
  $client = New-Object System.Net.Http.HttpClient($handler)
  $client.DefaultRequestHeaders.Authorization = New-Object System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", $Token)

  $multipart = New-Object System.Net.Http.MultipartFormDataContent
  $fileStream = [System.IO.File]::OpenRead($CertPath)
  try {
    $fileContent = New-Object System.Net.Http.StreamContent($fileStream)
    $fileContent.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::new("application/x-pkcs12")
    $multipart.Add($fileContent, "certificado", [System.IO.Path]::GetFileName($CertPath))
    $multipart.Add([System.Net.Http.StringContent]::new($Senha), "senha")

    $response = $client.PostAsync("$BaseUrl$Endpoint", $multipart).Result
    $content = $response.Content.ReadAsStringAsync().Result
    $data = $null
    try { $data = $content | ConvertFrom-Json } catch {}
    return $data
  } finally {
    if ($fileStream) { $fileStream.Dispose() }
    if ($client) { $client.Dispose() }
  }
}

function Check-Status {
  param([string]$Token)
  $headers = @{ Authorization = "Bearer $Token" }
  $status = Invoke-RestMethod -Uri "$BaseUrl/nfe/status" -Method Get -Headers $headers
  return $status
}

try {
  Write-Info "BaseUrl: $BaseUrl"
  Write-Info "CertPath: $CertPath"
  $token = Get-Token

  $endpoint = '/me/certificado'
  if ($PreferAdmin) { $endpoint = '/configuracoes/certificado' }

  $result = Upload-Cert -Endpoint $endpoint -Token $token -CertPath $CertPath -Senha $Senha
  if ($null -eq $result) { throw "Resposta inválida do upload." }
  if ($result.sucesso -ne $true) {
    $mensagem = $result.mensagem
    if (-not $mensagem) { $mensagem = 'erro desconhecido' }
    throw "Falha no upload: $mensagem"
  }

  $msg = $null
  if ($result.mensagem) { $msg = $result.mensagem }
  elseif ($result.configuracoes) { $msg = 'Configurações atualizadas' }
  else { $msg = 'Upload concluído' }
  Write-Ok "Upload realizado. Detalhes: $msg"

  $status = Check-Status -Token $token
  $statusData = $null
  if ($status -and ($status.PSObject.Properties.Name -contains 'status')) { $statusData = $status.status } else { $statusData = $status }
  $ambiente = $statusData.sefaz.ambiente
  $carregado = $statusData.certificado.carregado
  $caminho = $statusData.certificado.caminho
  Write-Ok "Status NFe: Ambiente=$ambiente, CertificadoCarregado=$carregado"
  if ($caminho) { Write-Info "Caminho do certificado ativo: $caminho" }

} catch {
  Write-Err $_.Exception.Message
  exit 1
}