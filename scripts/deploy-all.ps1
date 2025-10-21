# Deploy-All: Orquestra backend (DigitalOcean) e frontend (Vercel via GitHub Actions)
# Uso: Execute a partir do Windows PowerShell
#   powershell -ExecutionPolicy Bypass -File .\scripts\deploy-all.ps1

param(
    [string]$Branch = "main"
)

Write-Host "Iniciando Deploy-All (Backend + Frontend)" -ForegroundColor Green

# Localizar raiz do repositório
$RepoRoot = (Resolve-Path "$PSScriptRoot\..").Path
Set-Location $RepoRoot

# 1) Backend: executar script unificado de atualização na DigitalOcean
$backendScript = Join-Path $RepoRoot "atualizar-backend-digitalocean.ps1"
if (Test-Path $backendScript) {
    Write-Host "1/3: Atualizando backend na DigitalOcean..." -ForegroundColor Yellow
    try {
        powershell -ExecutionPolicy Bypass -File $backendScript
        Write-Host "Backend atualizado com sucesso." -ForegroundColor Green
    }
    catch {
        Write-Host "Falha ao atualizar backend: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "Verifique conexões SSH, PM2 e variáveis de ambiente no servidor." -ForegroundColor Yellow
    }
} else {
    Write-Host "Script de backend não encontrado: $backendScript" -ForegroundColor Red
}

# 2) Frontend: disparar deploy via GitHub Actions com commit vazio contendo [deploy-frontend]
Write-Host "2/3: Disparando deploy do frontend via GitHub Actions..." -ForegroundColor Yellow
try {
    # Garantir que estamos na branch desejada
    $currentBranch = (& git rev-parse --abbrev-ref HEAD).Trim()
    if ($currentBranch -ne $Branch) {
        Write-Host "Trocando para branch '$Branch' (atual: '$currentBranch')" -ForegroundColor Cyan
        & git checkout $Branch | Out-Null
    }

    # Commit vazio com tag de trigger e push
    & git commit --allow-empty -m "[deploy-frontend] Disparar deploy do frontend via GitHub Actions" | Out-Null
    & git push origin HEAD | Out-Null
    Write-Host "Trigger enviado. Acompanhe o workflow 'Manual Deploy Frontend' no GitHub → Actions." -ForegroundColor Green
}
catch {
    Write-Host "Falha ao disparar deploy do frontend: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Alternativas: acione manualmente no GitHub → Actions ou configure VERCEL_DEPLOY_HOOK_URL (secret/var)." -ForegroundColor Yellow
}

# 3) Verificações rápidas de saúde
Write-Host "3/3: Validando saúde das URLs de produção..." -ForegroundColor Yellow
$apiUrl = "https://api.brandaocontador.com.br/health"
$feUrl  = "https://nfe.brandaocontador.com.br"

function Test-Url($url) {
    try {
        $resp = Invoke-WebRequest -Uri $url -Method GET -TimeoutSec 20 -ErrorAction Stop
        return @{ ok = $true; status = $resp.StatusCode }
    } catch {
        return @{ ok = $false; status = ($_.Exception.Response.StatusCode.value__ | ForEach-Object { $_ }) }
    }
}

$apiCheck = Test-Url $apiUrl
if ($apiCheck.ok) {
    Write-Host "Backend OK: $apiUrl (status $($apiCheck.status))" -ForegroundColor Green
} else {
    Write-Host "Backend indisponível: $apiUrl (status $($apiCheck.status))" -ForegroundColor Red
}

$feCheck = Test-Url $feUrl
if ($feCheck.ok) {
    Write-Host "Frontend OK: $feUrl (status $($feCheck.status))" -ForegroundColor Green
} else {
    Write-Host "Frontend indisponível (o deploy pode estar em andamento): $feUrl" -ForegroundColor Yellow
}

Write-Host "\nDeploy-All concluído." -ForegroundColor Green
Write-Host "Logs do backend podem ser vistos com PM2 (ssh) e GitHub Actions mostrará o status do frontend." -ForegroundColor Cyan