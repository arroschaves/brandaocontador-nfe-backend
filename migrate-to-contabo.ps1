# ============================================================================
# SCRIPT DE MIGRAÇÃO DO SISTEMA NFE PARA SERVIDOR CONTABO
# ============================================================================
# Servidor: 147.93.186.214 (Ubuntu 24.04.3 LTS)
# Usuário: root
# Senha: Cont@bo2025!
# ============================================================================

param(
    [switch]$SkipBackup,
    [switch]$SkipTransfer,
    [switch]$SkipDeploy,
    [switch]$TestOnly
)

# Configurações do servidor
$ServerHost = "147.93.186.214"
$ServerUser = "root"
$ServerPassword = "Cont@bo2025!"
$LocalPath = "E:\PROJETOS\brandaocontador-nfe"
$BackendPath = "$LocalPath\backend"
$MigrationPath = "$LocalPath\migration"

Write-Host "🚀 INICIANDO MIGRAÇÃO DO SISTEMA NFE PARA SERVIDOR CONTABO" -ForegroundColor Green
Write-Host "=============================================================" -ForegroundColor Yellow
Write-Host "📊 Servidor: $ServerHost" -ForegroundColor Cyan
Write-Host "👤 Usuário: $ServerUser" -ForegroundColor Cyan
Write-Host "📁 Origem: $LocalPath" -ForegroundColor Cyan
Write-Host "=============================================================" -ForegroundColor Yellow

# Função para executar comandos SSH
function Invoke-SSHCommand {
    param(
        [string]$Command,
        [string]$Description
    )
    
    Write-Host "🔄 $Description..." -ForegroundColor Cyan
    
    # Usar plink se disponível, senão usar ssh
    if (Get-Command plink -ErrorAction SilentlyContinue) {
        $result = echo y | plink -ssh -l $ServerUser -pw $ServerPassword $ServerHost $Command
    } else {
        # Alternativa usando ssh (requer configuração de chave)
        Write-Host "⚠️ Plink não encontrado. Configure SSH com chaves ou instale PuTTY" -ForegroundColor Yellow
        return $false
    }
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ $Description concluído" -ForegroundColor Green
        return $true
    } else {
        Write-Host "❌ Erro em: $Description" -ForegroundColor Red
        return $false
    }
}

# Função para transferir arquivos via SCP
function Copy-ToServer {
    param(
        [string]$LocalFile,
        [string]$RemotePath,
        [string]$Description
    )
    
    Write-Host "📤 $Description..." -ForegroundColor Cyan
    
    if (Get-Command pscp -ErrorAction SilentlyContinue) {
        pscp -r -pw $ServerPassword $LocalFile "${ServerUser}@${ServerHost}:$RemotePath"
    } else {
        Write-Host "⚠️ PSCP não encontrado. Instale PuTTY ou configure SCP" -ForegroundColor Yellow
        return $false
    }
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ $Description concluído" -ForegroundColor Green
        return $true
    } else {
        Write-Host "❌ Erro em: $Description" -ForegroundColor Red
        return $false
    }
}

# 1. CRIAR BACKUP DO SISTEMA ATUAL
if (-not $SkipBackup) {
    Write-Host ""
    Write-Host "📦 ETAPA 1: CRIANDO BACKUP DO SISTEMA ATUAL" -ForegroundColor Yellow
    Write-Host "============================================" -ForegroundColor Yellow
    
    # Criar diretório de backup
    $BackupPath = "$LocalPath\backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    New-Item -ItemType Directory -Path $BackupPath -Force | Out-Null
    
    # Backup do backend
    Write-Host "📁 Criando backup do backend..." -ForegroundColor Cyan
    Copy-Item -Path $BackendPath -Destination "$BackupPath\backend" -Recurse -Force
    
    # Backup dos dados JSON
    Write-Host "💾 Backup dos dados JSON..." -ForegroundColor Cyan
    Copy-Item -Path "$BackendPath\data" -Destination "$BackupPath\data" -Recurse -Force
    
    # Backup dos certificados
    if (Test-Path "$BackendPath\certificates") {
        Write-Host "🔐 Backup dos certificados..." -ForegroundColor Cyan
        Copy-Item -Path "$BackendPath\certificates" -Destination "$BackupPath\certificates" -Recurse -Force
    }
    
    Write-Host "✅ Backup criado em: $BackupPath" -ForegroundColor Green
}

# 2. PREPARAR ARQUIVOS PARA MIGRAÇÃO
Write-Host ""
Write-Host "📋 ETAPA 2: PREPARANDO ARQUIVOS PARA MIGRAÇÃO" -ForegroundColor Yellow
Write-Host "==============================================" -ForegroundColor Yellow

# Limpar diretório de migração anterior
if (Test-Path $MigrationPath) {
    Remove-Item $MigrationPath -Recurse -Force
}
New-Item -ItemType Directory -Path $MigrationPath -Force | Out-Null

# Criar estrutura de migração
$MigrationBackend = "$MigrationPath\backend"
New-Item -ItemType Directory -Path $MigrationBackend -Force | Out-Null

Write-Host "📁 Copiando arquivos essenciais..." -ForegroundColor Cyan

# Arquivos principais
Copy-Item "$BackendPath\app.js" -Destination $MigrationBackend
Copy-Item "$BackendPath\package.json" -Destination $MigrationBackend

# Diretórios importantes
$ImportantDirs = @("routes", "middleware", "utils", "config", "data", "services", "models", "monitoring")
foreach ($dir in $ImportantDirs) {
    $sourcePath = "$BackendPath\$dir"
    if (Test-Path $sourcePath) {
        Copy-Item $sourcePath -Destination $MigrationBackend -Recurse -Force
        Write-Host "✅ Copiado: $dir" -ForegroundColor Green
    }
}

# Certificados (se existirem)
if (Test-Path "$BackendPath\certificates") {
    Copy-Item "$BackendPath\certificates" -Destination $MigrationBackend -Recurse -Force
    Write-Host "✅ Copiado: certificates" -ForegroundColor Green
}

# Criar .env otimizado para produção
Write-Host "⚙️ Criando configuração .env para produção..." -ForegroundColor Cyan
$EnvContent = @"
# Configuração para Servidor CONTABO - Produção
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Base de dados JSON
DB_TYPE=json
DB_PATH=./data

# Logs otimizados para produção
LOG_LEVEL=error
LOG_FILE=/var/log/nfe/app.log

# Cache otimizado
CACHE_TTL=3600
METRICS_ENABLED=false

# NFe Configuration
NFE_AMBIENTE=1
NFE_UF=35
NFE_CODIGO_MUNICIPIO=3550308

# Certificado A1
CERT_PATH=./certificates/certificado.pfx
CERT_PASSWORD=sua_senha_certificado

# URLs para produção
API_BASE_URL=https://api.brandaocontador.com.br
FRONTEND_URL=https://nfe.brandaocontador.com.br

# Configurações de segurança
JWT_SECRET=nfe_jwt_secret_production_2025
BCRYPT_ROUNDS=12

# Rate limiting para produção
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=100

# Configurações do servidor
MAX_FILE_SIZE=10mb
UPLOAD_PATH=./uploads
"@

Set-Content -Path "$MigrationBackend\.env" -Value $EnvContent -Encoding UTF8

# Criar ecosystem.config.js para PM2
Write-Host "🔄 Criando configuração PM2..." -ForegroundColor Cyan
$EcosystemContent = @"
module.exports = {
  apps: [{
    name: 'nfe-api',
    script: 'app.js',
    instances: 2,
    exec_mode: 'cluster',
    cwd: '/var/www/nfe/backend',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/var/log/nfe/err.log',
    out_file: '/var/log/nfe/out.log',
    log_file: '/var/log/nfe/combined.log',
    time: true,
    max_memory_restart: '500M',
    node_args: '--max-old-space-size=512',
    watch: false,
    ignore_watch: ['node_modules', 'logs', 'uploads', 'data'],
    restart_delay: 4000,
    max_restarts: 10,
    min_uptime: '10s',
    kill_timeout: 5000,
    listen_timeout: 3000,
    wait_ready: true
  }]
};
"@

Set-Content -Path "$MigrationBackend\ecosystem.config.js" -Value $EcosystemContent -Encoding UTF8

# 3. TESTAR CONECTIVIDADE COM SERVIDOR
Write-Host ""
Write-Host "🔌 ETAPA 3: TESTANDO CONECTIVIDADE COM SERVIDOR" -ForegroundColor Yellow
Write-Host "===============================================" -ForegroundColor Yellow

Write-Host "🏓 Testando ping para $ServerHost..." -ForegroundColor Cyan
$pingResult = Test-Connection -ComputerName $ServerHost -Count 2 -Quiet
if ($pingResult) {
    Write-Host "✅ Servidor acessível via ping" -ForegroundColor Green
} else {
    Write-Host "❌ Servidor não responde ao ping" -ForegroundColor Red
    exit 1
}

# Verificar se PuTTY está instalado
if (-not (Get-Command plink -ErrorAction SilentlyContinue)) {
    Write-Host "⚠️ PuTTY não encontrado. Instalando..." -ForegroundColor Yellow
    
    # Tentar instalar via Chocolatey
    if (Get-Command choco -ErrorAction SilentlyContinue) {
        choco install putty -y
    } else {
        Write-Host "❌ Para continuar, instale PuTTY manualmente ou configure SSH" -ForegroundColor Red
        Write-Host "💡 Download: https://www.putty.org/" -ForegroundColor Yellow
        exit 1
    }
}

# 4. CONFIGURAR SERVIDOR (se não for apenas teste)
if (-not $TestOnly -and -not $SkipDeploy) {
    Write-Host ""
    Write-Host "⚙️ ETAPA 4: CONFIGURANDO SERVIDOR" -ForegroundColor Yellow
    Write-Host "=================================" -ForegroundColor Yellow
    
    # Transferir script de configuração
    Write-Host "📤 Transferindo script de configuração..." -ForegroundColor Cyan
    Copy-ToServer "$LocalPath\setup-contabo.sh" "/root/" "Transferência do script de configuração"
    
    # Executar configuração do servidor
    Write-Host "🔧 Executando configuração do servidor..." -ForegroundColor Cyan
    Invoke-SSHCommand "chmod +x /root/setup-contabo.sh && /root/setup-contabo.sh" "Configuração do servidor"
}

# 5. TRANSFERIR APLICAÇÃO (se não for apenas teste)
if (-not $TestOnly -and -not $SkipTransfer) {
    Write-Host ""
    Write-Host "📤 ETAPA 5: TRANSFERINDO APLICAÇÃO" -ForegroundColor Yellow
    Write-Host "==================================" -ForegroundColor Yellow
    
    # Transferir backend
    Copy-ToServer "$MigrationBackend\*" "/var/www/nfe/backend/" "Transferência do backend"
    
    # Criar script de deploy
    $DeployScript = @"
#!/bin/bash
cd /var/www/nfe/backend

echo "📦 Instalando dependências..."
npm install --production

echo "📁 Criando diretórios necessários..."
mkdir -p uploads logs

echo "🔧 Configurando permissões..."
chown -R nfeapp:nfeapp /var/www/nfe
chmod +x app.js

echo "🔄 Iniciando aplicação com PM2..."
sudo -u nfeapp pm2 start ecosystem.config.js
sudo -u nfeapp pm2 save

echo "✅ Deploy concluído!"
echo "🌐 Aplicação disponível em: http://$ServerHost:3000"
"@
    
    Set-Content -Path "$MigrationPath\deploy.sh" -Value $DeployScript -Encoding UTF8
    
    # Transferir e executar script de deploy
    Copy-ToServer "$MigrationPath\deploy.sh" "/var/www/nfe/" "Transferência do script de deploy"
    Invoke-SSHCommand "chmod +x /var/www/nfe/deploy.sh && /var/www/nfe/deploy.sh" "Execução do deploy"
}

# 6. VERIFICAR FUNCIONAMENTO
Write-Host ""
Write-Host "🔍 ETAPA 6: VERIFICANDO FUNCIONAMENTO" -ForegroundColor Yellow
Write-Host "=====================================" -ForegroundColor Yellow

if (-not $TestOnly) {
    # Aguardar alguns segundos para a aplicação iniciar
    Write-Host "⏳ Aguardando aplicação iniciar..." -ForegroundColor Cyan
    Start-Sleep -Seconds 10
    
    # Testar health check
    try {
        Write-Host "🏥 Testando health check..." -ForegroundColor Cyan
        $response = Invoke-WebRequest -Uri "http://$ServerHost:3000/api/health" -TimeoutSec 30
        if ($response.StatusCode -eq 200) {
            Write-Host "✅ Health check OK" -ForegroundColor Green
        }
    } catch {
        Write-Host "⚠️ Health check falhou: $($_.Exception.Message)" -ForegroundColor Yellow
    }
    
    # Verificar status PM2
    Invoke-SSHCommand "sudo -u nfeapp pm2 status" "Verificação do status PM2"
    
    # Verificar logs
    Invoke-SSHCommand "sudo -u nfeapp pm2 logs nfe-api --lines 10" "Verificação dos logs"
}

# RESUMO FINAL
Write-Host ""
Write-Host "🎉 MIGRAÇÃO CONCLUÍDA!" -ForegroundColor Green
Write-Host "=====================" -ForegroundColor Yellow
Write-Host ""
Write-Host "📊 INFORMAÇÕES DO SERVIDOR:" -ForegroundColor White
Write-Host "- IP: $ServerHost" -ForegroundColor Gray
Write-Host "- Aplicação: http://$ServerHost:3000" -ForegroundColor Gray
Write-Host "- Health: http://$ServerHost:3000/api/health" -ForegroundColor Gray
Write-Host ""
Write-Host "📁 ARQUIVOS CRIADOS:" -ForegroundColor White
Write-Host "- Backup: $BackupPath" -ForegroundColor Gray
Write-Host "- Migração: $MigrationPath" -ForegroundColor Gray
Write-Host ""
Write-Host "🔄 PRÓXIMOS PASSOS:" -ForegroundColor Yellow
Write-Host "1. Configurar DNS para apontar para $ServerHost" -ForegroundColor White
Write-Host "2. Configurar SSL: ssh root@$ServerHost 'certbot --nginx -d api.brandaocontador.com.br'" -ForegroundColor White
Write-Host "3. Testar todas as funcionalidades" -ForegroundColor White
Write-Host "4. Monitorar logs: ssh root@$ServerHost 'sudo -u nfeapp pm2 logs'" -ForegroundColor White
Write-Host ""
Write-Host "🎯 SISTEMA NFE MIGRADO COM SUCESSO!" -ForegroundColor Green