# Script para configurar ambiente de PRODUÇÃO
Write-Host "Configurando ambiente de PRODUCAO..." -ForegroundColor Red

# Fonte das variáveis de produção (caminhos absolutos)
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Split-Path -Parent $scriptDir
$sourceEnv = Join-Path $backendDir ".env.producao"
$envPath = Join-Path $backendDir ".env"

Write-Host "Backend dir: $backendDir" -ForegroundColor DarkGray
Write-Host "sourceEnv: $sourceEnv" -ForegroundColor DarkGray
Write-Host "envPath: $envPath" -ForegroundColor DarkGray

# Copia configurações de produção (base)
Copy-Item $sourceEnv $envPath -Force

Write-Host "Ambiente configurado para PRODUCAO" -ForegroundColor Green
Write-Host "Configuracoes aplicadas:" -ForegroundColor Cyan
Write-Host "   - AMBIENTE=1 (Producao)" -ForegroundColor White
Write-Host "   - DEBUG_MODE=false" -ForegroundColor White
Write-Host "   - SIMULATION_MODE=false" -ForegroundColor White
Write-Host "   - Rate limit mais restritivo" -ForegroundColor White
Write-Host "" 
Write-Host "ATENCAO: Voce esta em PRODUCAO!" -ForegroundColor Red
Write-Host "Para iniciar o servidor: npm start" -ForegroundColor Green

# Garantir variáveis essenciais sem duplicatas
if (Test-Path $envPath) {
  # Ler conteúdo do .env recém copiado
  $lines = Get-Content $envPath

  # Remove quaisquer linhas pré-existentes das chaves alvo
  $filterPattern = '^(SEED_ADMIN_NOME|SEED_ADMIN_EMAIL|SEED_ADMIN_SENHA|SIMULATION_MODE)='
  $lines = $lines | Where-Object { $_ -notmatch $filterPattern }

  # Acrescenta valores canônicos
  $append = @(
    'SEED_ADMIN_NOME=Administrador',
    'SEED_ADMIN_EMAIL=admin@brandaocontador.com.br',
    'SEED_ADMIN_SENHA=admin123',
    'SIMULATION_MODE=false'
  )
  foreach ($line in $append) {
    $lines += $line
    Write-Host "Definida $line" -ForegroundColor Yellow
  }

  # Reescrever .env com conteúdo normalizado (sem duplicatas)
  Set-Content $envPath ($lines -join "`r`n")

  Write-Host "Resumo das variaveis essenciais no .env:" -ForegroundColor Cyan
  (Get-Content $envPath) | Where-Object { $_ -match '^(SEED_ADMIN_|SIMULATION_MODE)' } | ForEach-Object { $_ }
} else {
  Write-Host "ERROR: Arquivo .env nao encontrado em: $envPath" -ForegroundColor Red
}