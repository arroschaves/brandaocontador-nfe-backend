# Script de Deploy Manual do Backend para DigitalOcean
# Baseado no GitHub Actions workflow

Write-Host "🚀 INICIANDO DEPLOY DO BACKEND PARA DIGITALOCEAN" -ForegroundColor Green

# Verificar se estamos na branch main
$currentBranch = git branch --show-current
if ($currentBranch -ne "main") {
    Write-Host "❌ Erro: Você deve estar na branch 'main' para fazer deploy" -ForegroundColor Red
    exit 1
}

# Verificar se há mudanças não commitadas
$gitStatus = git status --porcelain
if ($gitStatus) {
    Write-Host "❌ Erro: Há mudanças não commitadas. Faça commit primeiro:" -ForegroundColor Red
    git status
    exit 1
}

# Push das últimas mudanças
Write-Host "📤 Fazendo push das últimas mudanças..." -ForegroundColor Yellow
git push origin main

Write-Host "✅ Deploy preparado! Agora você precisa:" -ForegroundColor Green
Write-Host "1. Acessar: https://github.com/arroschaves/brandaocontador-nfe-backend/actions" -ForegroundColor Cyan
Write-Host "2. Clicar em 'Deploy Backend (PM2 + Nginx + SSL)'" -ForegroundColor Cyan
Write-Host "3. Clicar em 'Run workflow'" -ForegroundColor Cyan
Write-Host "4. Selecionar branch 'main' e clicar em 'Run workflow'" -ForegroundColor Cyan
Write-Host ""
Write-Host "🔗 Link direto: https://github.com/arroschaves/brandaocontador-nfe-backend/actions/workflows/deploy-backend.yml" -ForegroundColor Magenta
Write-Host ""
Write-Host "⏱️ O deploy levará cerca de 3-5 minutos para completar." -ForegroundColor Yellow
Write-Host "📊 Você pode acompanhar o progresso na página do GitHub Actions." -ForegroundColor Yellow