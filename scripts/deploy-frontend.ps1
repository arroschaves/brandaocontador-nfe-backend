# Deploy-Frontend: Dispara deploy do frontend via GitHub Actions (commit vazio)
# Uso:
#   powershell -ExecutionPolicy Bypass -File .\scripts\deploy-frontend.ps1 [-Branch main]

param(
    [string]$Branch = "main"
)

$ErrorActionPreference = "Stop"

Write-Host "Iniciando Deploy do Frontend (branch: $Branch)" -ForegroundColor Green

# Localizar raiz do repositório e garantir execução nela
$RepoRoot = (Resolve-Path "$PSScriptRoot\..").Path
Set-Location $RepoRoot

# Verificar Git disponível
try {
    & git --version | Out-Null
} catch {
    Write-Host "Git não encontrado. Instale o Git antes de prosseguir." -ForegroundColor Red
    exit 1
}

# Verificar branch atual
$currentBranch = (& git rev-parse --abbrev-ref HEAD).Trim()
Write-Host "Branch atual: $currentBranch" -ForegroundColor Cyan
if ($currentBranch -ne $Branch) {
    Write-Host "Alterando para branch '$Branch'..." -ForegroundColor Yellow
    & git checkout $Branch
}

# Criar commit vazio com a mensagem padrão
$commitMsg = "[deploy-frontend] Disparar deploy do frontend via GitHub Actions"
Write-Host "Criando commit vazio para acionar workflow..." -ForegroundColor Yellow
& git commit --allow-empty -m $commitMsg

# Push para origin
Write-Host "Enviando para origin ($Branch)..." -ForegroundColor Yellow
& git push origin $Branch

Write-Host "Commit enviado. O GitHub Actions deve iniciar o job 'Manual Deploy Frontend'." -ForegroundColor Green
Write-Host "Acompanhe em: GitHub → Actions → 'Manual Deploy Frontend'" -ForegroundColor Cyan

# Fallback opcional: chamar Vercel Deploy Hook via variável de ambiente
$deployHook = [Environment]::GetEnvironmentVariable("VERCEL_DEPLOY_HOOK_URL", "Process")
if ([string]::IsNullOrWhiteSpace($deployHook) -eq $false) {
    try {
        Write-Host "Acionando Vercel Deploy Hook (fallback)..." -ForegroundColor Yellow
        Invoke-RestMethod -Uri $deployHook -Method Post -Body @{}
        Write-Host "Hook acionado." -ForegroundColor Green
    } catch {
        Write-Host "Falha ao acionar o Vercel Deploy Hook: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Health-check simples do frontend (aguardar alguns segundos e tentar acessar)
$frontendUrl = "https://nfe.brandaocontador.com.br"
Write-Host "Verificando disponibilidade do frontend em $frontendUrl (aguarde 2–4 minutos para o deploy concluir)..." -ForegroundColor Yellow

# Tentar 3 vezes com intervalos
for ($i = 1; $i -le 3; $i++) {
    try {
        Start-Sleep -Seconds 10
        $resp = Invoke-WebRequest -Uri $frontendUrl -Method GET -TimeoutSec 10
        Write-Host "Frontend respondeu com status: $($resp.StatusCode)" -ForegroundColor Green
        break
    } catch {
        Write-Host "Tentativa $i: ainda não disponível. Motivo: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

Write-Host "Deploy do frontend disparado. Caso a página ainda não esteja visível, aguarde mais alguns minutos e recarregue." -ForegroundColor Green