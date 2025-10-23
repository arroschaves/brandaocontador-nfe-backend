# Clean and Seed script for production
# Preserves/creates admin and cleans test data

param(
  [string]$ProjectRoot = "",
  [switch]$SkipSetProducao
)

$ErrorActionPreference = "Stop"

Write-Host "== Clean & Seed (Producao) ==" -ForegroundColor Cyan

# Paths
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Split-Path -Parent $scriptDir
$envProducao = Join-Path $backendDir ".env.producao"
$envPath = Join-Path $backendDir ".env"

# 1) Prepare environment (.env)
if (-not $SkipSetProducao) {
  if (Test-Path (Join-Path $backendDir "scripts\set-producao.ps1")) {
    Write-Host "-> Aplicando set-producao.ps1" -ForegroundColor Yellow
    & (Join-Path $backendDir "scripts\set-producao.ps1")
  } else {
    Write-Host "-> Copiando .env.producao para .env" -ForegroundColor Yellow
    Copy-Item $envProducao $envPath -Force
  }
}

# 2) Ensure essential flags
if (Test-Path $envPath) {
  $lines = Get-Content $envPath
  $filterPattern = '^(ENABLE_AUTO_SEED|SIMULATION_MODE|SEED_ADMIN_NOME|SEED_ADMIN_EMAIL|SEED_ADMIN_SENHA)='
  $lines = $lines | Where-Object { $_ -notmatch $filterPattern }
  $append = @(
    'ENABLE_AUTO_SEED=true',
    'SIMULATION_MODE=false',
    'SEED_ADMIN_NOME=Administrador',
    'SEED_ADMIN_EMAIL=admin@brandaocontador.com.br',
    'SEED_ADMIN_SENHA=admin:123'
  )
  foreach ($line in $append) { $lines += $line }
  Set-Content $envPath ($lines -join "`r`n")
  Write-Host "-> Flags essenciais garantidas no .env" -ForegroundColor Green
} else {
  Write-Host "ERROR: .env nao encontrado em $envPath" -ForegroundColor Red
  exit 1
}

# 3) Validate MongoDB URI
$mongoUri = (Get-Content $envPath | Where-Object { $_ -match '^MONGODB_URI=' })
if (-not $mongoUri -or $mongoUri -match 'MONGODB_URI=\s*$') {
  Write-Host "ATENCAO: Defina 'MONGODB_URI' no .env para o banco de producao." -ForegroundColor Red
  Write-Host "Exemplo: MONGODB_URI=mongodb://localhost:27017/brandaocontador_nfe" -ForegroundColor DarkGray
}

# 4) Show DB summary (before)
Write-Host "-> Resumo do banco (antes)" -ForegroundColor Yellow
node (Join-Path $backendDir "scripts\resumo-banco.js")

# 5) Run selective clean preserving admin
Write-Host "-> Limpando seletivo preservando admin" -ForegroundColor Yellow
$env:ADMIN_EMAIL = "admin@brandaocontador.com.br"
node (Join-Path $backendDir "scripts\limpar-seletivo.js")

# 6) Show DB summary (after)
Write-Host "-> Resumo do banco (depois)" -ForegroundColor Yellow
node (Join-Path $backendDir "scripts\resumo-banco.js")

# 7) Optional restart with PM2
try {
  Write-Host "-> Tentando reload PM2 (se estiver em execucao)" -ForegroundColor DarkGray
  pm2 reload brandaocontador-nfe-backend | Out-Null
} catch {
  Write-Host "PM2 nao encontrado ou app nao registrado. Inicie manualmente com 'npm start' ou via PM2." -ForegroundColor DarkGray
}

Write-Host "Concluido: ambiente preparado, admin garantido, dados limpos." -ForegroundColor Cyan