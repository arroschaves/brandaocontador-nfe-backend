param(
  [string]$Port = "3002"
)

$baseUrl = "http://localhost:$Port"

function Try-Login {
  param(
    [string]$Email,
    [string]$Senha
  )
  $payload = @{ email = $Email; senha = $Senha } | ConvertTo-Json
  try {
    $resp = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -ContentType "application/json" -Body $payload -ErrorAction Stop
    return $resp.token
  }
  catch {
    $msg = $_.ErrorDetails.Message
    if ($msg -match "RATE_LIMIT") {
      Start-Sleep -Seconds 5
      try { $resp = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -ContentType "application/json" -Body $payload -ErrorAction Stop; return $resp.token } catch {}
    }
    return $null
  }
}

$token = $null

# 1) Tentar admin seed
$token = Try-Login -Email "admin@example.com" -Senha "adminpassword"

# 2) Tentar usuário padrão seed
if (-not $token) { $token = Try-Login -Email "validuser@example.com" -Senha "ValidPassword123!" }

# 3) Se ainda não, tentar payload do arquivo
if (-not $token) {
  $loginPath = Join-Path $PSScriptRoot "..\payloads\login.json"
  if (Test-Path $loginPath) {
    try {
      $json = Get-Content -Raw -Path $loginPath | ConvertFrom-Json
      $token = Try-Login -Email $json.email -Senha $json.senha
    } catch {}
  }
}

if (-not $token) { throw "Falha no login após múltiplas tentativas." }

# Consultar status NFe
$headers = @{ Authorization = "Bearer $token" }
$status = Invoke-RestMethod -Uri "$baseUrl/nfe/status" -Method Get -Headers $headers

$status | ConvertTo-Json -Depth 6