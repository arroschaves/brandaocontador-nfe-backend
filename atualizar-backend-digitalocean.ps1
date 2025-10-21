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

# Verificar PM2 (usa JSON e timeout para evitar travas)
$pm2Status = Invoke-SSHCommand "bash -lc 'timeout 5s pm2 jlist || timeout 5s pm2 list || echo PM2 indisponivel'" "Status do PM2"

# Fazer backup do .env
Write-Host ""
Write-Host "Fazendo backup das configuracoes..." -ForegroundColor Yellow
$backupEnv = Invoke-SSHCommand "cd $APP_DIR && cp .env .env.backup" "Backup do arquivo .env"

# Atualizar codigo do repositorio
Write-Host ""
Write-Host "Atualizando codigo do GitHub..." -ForegroundColor Yellow
$gitPull = Invoke-SSHCommand "cd $APP_DIR && git fetch origin && git reset --hard origin/main" "Atualizacao do codigo"

# Instalar/atualizar dependencias
Write-Host ""
Write-Host "Instalando dependencias..." -ForegroundColor Yellow
Write-Host "Adicionando swap temporaria para evitar OOM..." -ForegroundColor Yellow
$addSwap = Invoke-SSHCommand "bash -lc 'if ! swapon --show | grep -q .; then (sudo fallocate -l 1G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=1024); sudo chmod 600 /swapfile; sudo mkswap /swapfile; sudo swapon /swapfile; fi; free -h'" "Criacao de swap temporaria"

$npmInstall = Invoke-SSHCommand "bash -lc 'cd $APP_DIR && npm set progress=false && export NODE_OPTIONS=--max-old-space-size=256 && (npm ci --omit=dev --no-audit --no-fund --prefer-offline --silent || npm ci --production --silent || npm install --omit=dev --no-audit --no-fund --prefer-offline --silent)'" "Instalacao de dependencias"

# Reiniciar aplicacao com PM2 (nome correto do processo em producao)
Write-Host ""
Write-Host "Reiniciando aplicacao..." -ForegroundColor Yellow
# Reiniciar pelo nome; caso não exista, usar ecosystem.config.js como prioridade
$pm2Restart = Invoke-SSHCommand "bash -lc 'if pm2 list | grep -q brandaocontador-nfe-backend; then pm2 restart brandaocontador-nfe-backend; else cd $APP_DIR; if [ -f ecosystem.config.js ]; then pm2 start ecosystem.config.js --env production; elif [ -f backend/deploy/ecosystem.production.js ]; then pm2 start backend/deploy/ecosystem.production.js --env production; elif [ -f app.js ]; then PORT=3001 NODE_ENV=production pm2 start app.js --name brandaocontador-nfe-backend; else echo Nenhum arquivo de entrada encontrado; fi; fi'" "Reinicializacao da aplicacao"

# Verificar se a aplicacao esta rodando
Write-Host ""
Write-Host "Verificando status da aplicacao..." -ForegroundColor Yellow
Start-Sleep -Seconds 5
$pm2Status = Invoke-SSHCommand "bash -lc 'pm2 jlist | grep -i brandaocontador-nfe-backend || pm2 list | grep -i brandaocontador-nfe-backend || true'" "Status final da aplicacao"

# Testar API /health e /api/health
Write-Host ""
Write-Host "Testando conectividade da API (/health)..." -ForegroundColor Yellow
try {
    $healthTest = Invoke-WebRequest -Uri "https://api.brandaocontador.com.br/health" -Method GET -TimeoutSec 10 -ErrorAction SilentlyContinue
    Write-Host "Status /health: $($healthTest.StatusCode)" -ForegroundColor Green
}
catch {
    Write-Host "Falha ao acessar /health" -ForegroundColor Red
}

Write-Host "Testando conectividade da API (/api/health)..." -ForegroundColor Yellow
try {
    $healthTest2 = Invoke-WebRequest -Uri "https://api.brandaocontador.com.br/api/health" -Method GET -TimeoutSec 10 -ErrorAction SilentlyContinue
    Write-Host "Status /api/health: $($healthTest2.StatusCode)" -ForegroundColor Green
}
catch {
    Write-Host "Falha ao acessar /api/health" -ForegroundColor Red
}

# Mostrar logs recentes
Write-Host ""
Write-Host "Logs recentes da aplicacao:" -ForegroundColor Yellow
# Usa o nome do processo configurado no ecosystem
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