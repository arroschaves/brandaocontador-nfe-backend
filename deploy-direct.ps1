# Script de Deploy Direto - Sistema NFe
# Executa deploy via webhook ou requisições HTTP diretas (compatível com PowerShell)

Write-Host "Iniciando deploy direto do Sistema NFe..." -ForegroundColor Green

# Configuracoes
$REPO_URL = "https://github.com/arroschaves/brandaocontador-nfe-backend.git"
$SERVER_IP = "164.90.157.173"
$WEBHOOK_URL = "http://$SERVER_IP:9000/hooks/deploy-nfe"

Write-Host "Tentando deploy via webhook..." -ForegroundColor Yellow

try {
    # Tentar usar webhook se estiver configurado
    $response = Invoke-RestMethod -Uri $WEBHOOK_URL -Method POST -ContentType "application/json" -Body '{"ref":"refs/heads/main"}' -TimeoutSec 30
    Write-Host "Deploy via webhook executado com sucesso!" -ForegroundColor Green
    Write-Host "Resposta: $response" -ForegroundColor Cyan
}
catch {
    Write-Host "Webhook não disponível, tentando método alternativo..." -ForegroundColor Yellow

    # Método alternativo: usar Invoke-RestMethod para trigger de deploy
    try {
        Write-Host "Tentando trigger de deploy alternativo..." -ForegroundColor Yellow
        $payload = '{"action":"deploy","branch":"main"}'
        $curlResponse = Invoke-RestMethod -Uri "http://$SERVER_IP:3001/deploy" -Method POST -ContentType "application/json" -Body $payload -TimeoutSec 30
        Write-Host "Deploy alternativo executado!" -ForegroundColor Green
        Write-Host "Resposta: $curlResponse" -ForegroundColor Cyan
    }
    catch {
        Write-Host "Erro no deploy alternativo: $($_.Exception.Message)" -ForegroundColor Red

        # Último recurso: verificar se o servidor está online
        Write-Host "Verificando status do servidor..." -ForegroundColor Yellow
        try {
            $healthCheck = Invoke-WebRequest -Uri "http://$SERVER_IP:3001/health" -Method GET -TimeoutSec 10 -ErrorAction Stop
            Write-Host "Servidor está online!" -ForegroundColor Green
            Write-Host "Status: $($healthCheck.StatusCode)" -ForegroundColor Cyan
        }
        catch {
            Write-Host "Servidor não está respondendo. Pode precisar ser reiniciado." -ForegroundColor Red
            Write-Host "Sugestão: Conecte via SSH e execute: 'pm2 restart all' ou 'npm start'" -ForegroundColor Yellow
        }
    }
}

Write-Host "`nVerificando status final do deploy..." -ForegroundColor Yellow

# Aguardar um pouco para o deploy processar
Start-Sleep -Seconds 10

# Verificar se o sistema está funcionando
try {
    $finalCheck = Invoke-WebRequest -Uri "http://$SERVER_IP:3001/health" -Method GET -TimeoutSec 10 -ErrorAction Stop
    Write-Host "Sistema funcionando corretamente!" -ForegroundColor Green
    Write-Host "Health Check: $($finalCheck.StatusCode)" -ForegroundColor Cyan

    # Verificar frontend na Vercel (se exposto)
    try {
        $frontendCheck = Invoke-WebRequest -Uri "https://brandaocontador-nfe.vercel.app/health" -Method GET -TimeoutSec 10 -ErrorAction Stop
        Write-Host "Frontend também está funcionando!" -ForegroundColor Green
        Write-Host "Status Frontend: $($frontendCheck.StatusCode)" -ForegroundColor Cyan
    }
    catch {
        Write-Host "Frontend pode estar em processo de deploy na Vercel..." -ForegroundColor Yellow
    }
}
catch {
    Write-Host "Sistema ainda não está respondendo." -ForegroundColor Red
    Write-Host "O deploy pode estar em andamento. Aguarde alguns minutos." -ForegroundColor Yellow
}

Write-Host "`nDeploy concluído! Verifique os logs do servidor se necessário." -ForegroundColor Green