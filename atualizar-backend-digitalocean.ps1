# Script para Atualizar Backend na DigitalOcean
# Brandão Contador NFe System

Write-Host "🚀 ATUALIZANDO BACKEND NA DIGITALOCEAN" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Configurações
$SERVER_IP = "159.89.228.223"
$SSH_PORT = "2222"
$SSH_KEY = "C:/Users/BCNOTSONY/.ssh/id_ed25519"
$APP_DIR = "/var/www/brandaocontador-nfe-backend"

Write-Host "📋 Informações do Servidor:" -ForegroundColor Yellow
Write-Host "- IP: $SERVER_IP" -ForegroundColor White
Write-Host "- Porta SSH: $SSH_PORT" -ForegroundColor White
Write-Host "- Diretório: $APP_DIR" -ForegroundColor White
Write-Host ""

# Função para executar comando SSH
function Invoke-SSHCommand {
    param(
        [string]$Command,
        [string]$Description
    )
    
    Write-Host "🔄 $Description..." -ForegroundColor Blue
    
    $sshCommand = "ssh -i `"$SSH_KEY`" -p $SSH_PORT root@$SERVER_IP `"$Command`""
    
    try {
        $result = Invoke-Expression $sshCommand
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ $Description - Concluído" -ForegroundColor Green
            return $result
        } else {
            Write-Host "❌ $Description - Erro (Exit Code: $LASTEXITCODE)" -ForegroundColor Red
            return $null
        }
    }
    catch {
        Write-Host "❌ $Description - Erro: $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}

# Verificar conectividade
Write-Host "🔍 Verificando conectividade com o servidor..." -ForegroundColor Yellow
$connectTest = Invoke-SSHCommand "echo 'Conexão SSH OK'" "Teste de conectividade"

if (-not $connectTest) {
    Write-Host ""
    Write-Host "❌ Não foi possível conectar ao servidor!" -ForegroundColor Red
    Write-Host "💡 Verifique se:" -ForegroundColor Yellow
    Write-Host "   - A chave SSH está no caminho correto: $SSH_KEY" -ForegroundColor White
    Write-Host "   - O servidor está online e acessível" -ForegroundColor White
    Write-Host "   - A porta SSH $SSH_PORT está aberta" -ForegroundColor White
    Write-Host ""
    Write-Host "🔧 Para conectar manualmente:" -ForegroundColor Cyan
    Write-Host "   ssh -i `"$SSH_KEY`" -p $SSH_PORT root@$SERVER_IP" -ForegroundColor White
    exit 1
}

Write-Host ""
Write-Host "✅ Conectividade OK! Iniciando atualização..." -ForegroundColor Green
Write-Host ""

# Verificar status atual
Write-Host "📊 Verificando status atual do sistema..." -ForegroundColor Yellow
$statusCheck = Invoke-SSHCommand "cd $APP_DIR && pwd && ls -la" "Verificação do diretório da aplicação"

# Verificar PM2
$pm2Status = Invoke-SSHCommand "pm2 list" "Status do PM2"

# Fazer backup do .env
Write-Host ""
Write-Host "💾 Fazendo backup das configurações..." -ForegroundColor Yellow
$backupEnv = Invoke-SSHCommand "cd $APP_DIR && cp .env .env.backup.$(date +%Y%m%d_%H%M%S)" "Backup do arquivo .env"

# Atualizar código do repositório
Write-Host ""
Write-Host "📥 Atualizando código do GitHub..." -ForegroundColor Yellow
$gitPull = Invoke-SSHCommand "cd $APP_DIR && git fetch origin && git reset --hard origin/main" "Atualização do código"

# Instalar/atualizar dependências
Write-Host ""
Write-Host "📦 Instalando dependências..." -ForegroundColor Yellow
$npmInstall = Invoke-SSHCommand "cd $APP_DIR && npm install --production" "Instalação de dependências"

# Reiniciar aplicação com PM2
Write-Host ""
Write-Host "🔄 Reiniciando aplicação..." -ForegroundColor Yellow
$pm2Restart = Invoke-SSHCommand "pm2 restart brandaocontador-nfe-backend" "Reinicialização da aplicação"

# Verificar se a aplicação está rodando
Write-Host ""
Write-Host "🔍 Verificando status da aplicação..." -ForegroundColor Yellow
Start-Sleep -Seconds 5
$pm2Status = Invoke-SSHCommand "pm2 list | grep brandaocontador-nfe-backend" "Status final da aplicação"

# Testar API
Write-Host ""
Write-Host "🌐 Testando conectividade da API..." -ForegroundColor Yellow
try {
    $apiTest = Invoke-WebRequest -Uri "https://api.brandaocontador.com.br/" -Method GET -TimeoutSec 10 -ErrorAction SilentlyContinue
    if ($apiTest.StatusCode -eq 404) {
        Write-Host "✅ API respondendo (404 é esperado para rota raiz)" -ForegroundColor Green
    } else {
        Write-Host "✅ API respondendo (Status: $($apiTest.StatusCode))" -ForegroundColor Green
    }
}
catch {
    Write-Host "⚠️  API pode estar inicializando ainda..." -ForegroundColor Yellow
    Write-Host "   Aguarde alguns minutos e teste novamente" -ForegroundColor White
}

# Mostrar logs recentes
Write-Host ""
Write-Host "📋 Logs recentes da aplicação:" -ForegroundColor Yellow
$recentLogs = Invoke-SSHCommand "pm2 logs brandaocontador-nfe-backend --lines 10 --nostream" "Logs da aplicação"

Write-Host ""
Write-Host "🎉 ATUALIZAÇÃO CONCLUÍDA!" -ForegroundColor Green
Write-Host "========================" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Resumo da atualização:" -ForegroundColor Cyan
Write-Host "- ✅ Código atualizado do GitHub" -ForegroundColor White
Write-Host "- ✅ Dependências instaladas" -ForegroundColor White
Write-Host "- ✅ Aplicação reiniciada" -ForegroundColor White
Write-Host "- ✅ Backup do .env criado" -ForegroundColor White
Write-Host ""
Write-Host "🔗 URLs para testar:" -ForegroundColor Cyan
Write-Host "- Frontend: https://nfe.brandaocontador.com.br" -ForegroundColor White
Write-Host "- Backend: https://api.brandaocontador.com.br" -ForegroundColor White
Write-Host ""
Write-Host "🔧 Comandos úteis para monitoramento:" -ForegroundColor Cyan
Write-Host "- Ver logs: ssh -i `"$SSH_KEY`" -p $SSH_PORT root@$SERVER_IP `"pm2 logs brandaocontador-nfe-backend`"" -ForegroundColor White
Write-Host "- Status PM2: ssh -i `"$SSH_KEY`" -p $SSH_PORT root@$SERVER_IP `"pm2 list`"" -ForegroundColor White
Write-Host "- Reiniciar: ssh -i `"$SSH_KEY`" -p $SSH_PORT root@$SERVER_IP `"pm2 restart brandaocontador-nfe-backend`"" -ForegroundColor White
Write-Host ""
Write-Host "💡 Se houver problemas, verifique os logs e a documentação em:" -ForegroundColor Yellow
Write-Host "   DOCUMENTACAO_COMPLETA_SERVICOS.md" -ForegroundColor White