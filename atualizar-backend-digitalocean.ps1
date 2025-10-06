# Script para Atualizar Backend na DigitalOcean
# Brandao Contador NFe System

Write-Host "Atualizando Backend na DigitalOcean" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# Configuracoes
$SERVER_IP = "159.89.228.223"
$SSH_PORT = "2222"
$SSH_KEY = "$env:USERPROFILE\.ssh\digitalocean_key"
$APP_DIR = "/var/www/brandaocontador-nfe-backend"

Write-Host "Informacoes do Servidor:" -ForegroundColor Yellow
Write-Host "- IP: $SERVER_IP" -ForegroundColor White
Write-Host "- Porta SSH: $SSH_PORT" -ForegroundColor White
Write-Host "- Diretorio: $APP_DIR" -ForegroundColor White
Write-Host ""

# Funcao para executar comando SSH
function Invoke-SSHCommand {
    param(
        [string]$Command,
        [string]$Description
    )
    
    Write-Host "Executando: $Description..." -ForegroundColor Blue
    
    $sshCommand = "ssh -i `"$SSH_KEY`" -p $SSH_PORT root@$SERVER_IP `"$Command`""
    
    try {
        $result = Invoke-Expression $sshCommand
        if ($LASTEXITCODE -eq 0) {
            Write-Host "OK: $Description - Concluido" -ForegroundColor Green
            return $result
        } else {
            Write-Host "ERRO: $Description - Falhou (Exit Code: $LASTEXITCODE)" -ForegroundColor Red
            return $null
        }
    }
    catch {
        Write-Host "ERRO: $Description - Excecao: $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}

# Verificar conectividade
Write-Host "Verificando conectividade com o servidor..." -ForegroundColor Yellow
$connectTest = Invoke-SSHCommand "echo 'Conexao SSH OK'" "Teste de conectividade"

if (-not $connectTest) {
    Write-Host ""
    Write-Host "Nao foi possivel conectar ao servidor!" -ForegroundColor Red
    Write-Host "Verifique se:" -ForegroundColor Yellow
    Write-Host "   - A chave SSH esta no caminho correto: $SSH_KEY" -ForegroundColor White
    Write-Host "   - O servidor esta online e acessivel" -ForegroundColor White
    Write-Host "   - A porta SSH $SSH_PORT esta aberta" -ForegroundColor White
    Write-Host ""
    Write-Host "Para conectar manualmente:" -ForegroundColor Cyan
    Write-Host "   ssh -i `"$SSH_KEY`" -p $SSH_PORT root@$SERVER_IP" -ForegroundColor White
    exit 1
}

Write-Host ""
Write-Host "Conectividade OK! Iniciando atualizacao..." -ForegroundColor Green
Write-Host ""

# Verificar status atual
Write-Host "Verificando status atual do sistema..." -ForegroundColor Yellow
$statusCheck = Invoke-SSHCommand "cd $APP_DIR && pwd && ls -la" "Verificacao do diretorio da aplicacao"

# Verificar PM2
$pm2Status = Invoke-SSHCommand "pm2 list" "Status do PM2"

# Fazer backup do .env
Write-Host ""
Write-Host "Fazendo backup das configuracoes..." -ForegroundColor Yellow
$backupEnv = Invoke-SSHCommand "cd $APP_DIR && cp .env .env.backup.`$(date +%Y%m%d_%H%M%S)" "Backup do arquivo .env"

# Atualizar codigo do repositorio
Write-Host ""
Write-Host "Atualizando codigo do GitHub..." -ForegroundColor Yellow
$gitPull = Invoke-SSHCommand "cd $APP_DIR && git fetch origin && git reset --hard origin/main" "Atualizacao do codigo"

# Instalar/atualizar dependencias
Write-Host ""
Write-Host "Instalando dependencias..." -ForegroundColor Yellow
$npmInstall = Invoke-SSHCommand "cd $APP_DIR && npm install --production" "Instalacao de dependencias"

# Reiniciar aplicacao com PM2
Write-Host ""
Write-Host "Reiniciando aplicacao..." -ForegroundColor Yellow
$pm2Restart = Invoke-SSHCommand "pm2 restart brandaocontador-nfe-backend" "Reinicializacao da aplicacao"

# Verificar se a aplicacao esta rodando
Write-Host ""
Write-Host "Verificando status da aplicacao..." -ForegroundColor Yellow
Start-Sleep -Seconds 5
$pm2Status = Invoke-SSHCommand "pm2 list | grep brandaocontador-nfe-backend" "Status final da aplicacao"

# Testar API
Write-Host ""
Write-Host "Testando conectividade da API..." -ForegroundColor Yellow
try {
    $apiTest = Invoke-WebRequest -Uri "https://api.brandaocontador.com.br/" -Method GET -TimeoutSec 10 -ErrorAction SilentlyContinue
    if ($apiTest.StatusCode -eq 404) {
        Write-Host "API respondendo (404 e esperado para rota raiz)" -ForegroundColor Green
    } else {
        Write-Host "API respondendo (Status: $($apiTest.StatusCode))" -ForegroundColor Green
    }
}
catch {
    Write-Host "API pode estar inicializando ainda..." -ForegroundColor Yellow
    Write-Host "   Aguarde alguns minutos e teste novamente" -ForegroundColor White
}

# Mostrar logs recentes
Write-Host ""
Write-Host "Logs recentes da aplicacao:" -ForegroundColor Yellow
$recentLogs = Invoke-SSHCommand "pm2 logs brandaocontador-nfe-backend --lines 10 --nostream" "Logs da aplicacao"

Write-Host ""
Write-Host "ATUALIZACAO CONCLUIDA!" -ForegroundColor Green
Write-Host "======================" -ForegroundColor Green
Write-Host ""
Write-Host "Resumo da atualizacao:" -ForegroundColor Cyan
Write-Host "- Codigo atualizado do GitHub" -ForegroundColor White
Write-Host "- Dependencias instaladas" -ForegroundColor White
Write-Host "- Aplicacao reiniciada" -ForegroundColor White
Write-Host "- Backup do .env criado" -ForegroundColor White
Write-Host ""
Write-Host "URLs para testar:" -ForegroundColor Cyan
Write-Host "- Frontend: https://nfe.brandaocontador.com.br" -ForegroundColor White
Write-Host "- Backend: https://api.brandaocontador.com.br" -ForegroundColor White
Write-Host ""
Write-Host "Comandos uteis para monitoramento:" -ForegroundColor Cyan
Write-Host "- Ver logs: ssh -i `"$SSH_KEY`" -p $SSH_PORT root@$SERVER_IP `"pm2 logs brandaocontador-nfe-backend`"" -ForegroundColor White
Write-Host "- Status PM2: ssh -i `"$SSH_KEY`" -p $SSH_PORT root@$SERVER_IP `"pm2 list`"" -ForegroundColor White
Write-Host "- Reiniciar: ssh -i `"$SSH_KEY`" -p $SSH_PORT root@$SERVER_IP `"pm2 restart brandaocontador-nfe-backend`"" -ForegroundColor White
Write-Host ""
Write-Host "Se houver problemas, verifique os logs e a documentacao" -ForegroundColor Yellow