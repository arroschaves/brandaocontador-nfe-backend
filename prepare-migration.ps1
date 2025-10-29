# Script para preparar migração do sistema NFe para VPS CONTABO
# Execute este script no Windows antes de transferir para o servidor

Write-Host "🚀 Preparando migração do sistema NFe para VPS CONTABO" -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Yellow

# Criar diretório de migração
$migrationDir = "E:\PROJETOS\brandaocontador-nfe\migration"
if (Test-Path $migrationDir) {
    Remove-Item $migrationDir -Recurse -Force
}
New-Item -ItemType Directory -Path $migrationDir -Force

Write-Host "📁 Criando pacote de migração..." -ForegroundColor Cyan

# Copiar arquivos essenciais do backend
$backendDir = "E:\PROJETOS\brandaocontador-nfe\backend"
$migrationBackend = "$migrationDir\backend"
New-Item -ItemType Directory -Path $migrationBackend -Force

# Arquivos principais
Copy-Item "$backendDir\app.js" -Destination $migrationBackend
Copy-Item "$backendDir\package.json" -Destination $migrationBackend
Copy-Item "$backendDir\.env" -Destination $migrationBackend

# Diretórios importantes
$directories = @("routes", "middleware", "utils", "config", "data", "uploads", "certificates")
foreach ($dir in $directories) {
    $sourcePath = "$backendDir\$dir"
    if (Test-Path $sourcePath) {
        Copy-Item $sourcePath -Destination $migrationBackend -Recurse -Force
        Write-Host "✅ Copiado: $dir" -ForegroundColor Green
    }
}

# Criar arquivo .env otimizado para VPS
$envContent = @"
# Configuração para VPS CONTABO
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Base de dados JSON
DB_TYPE=json
DB_PATH=./data

# Logs otimizados
LOG_LEVEL=error
LOG_FILE=./logs/app.log

# Cache otimizado
CACHE_TTL=3600
METRICS_ENABLED=false

# NFe Configuration
NFE_AMBIENTE=1
NFE_UF=35
NFE_CODIGO_MUNICIPIO=3550308

# Certificado A1 (será configurado no servidor)
CERT_PATH=./certificates/certificado.pfx
CERT_PASSWORD=sua_senha_aqui

# URLs para VPS
API_BASE_URL=http://147.93.186.214:3000
FRONTEND_URL=http://147.93.186.214

# Configurações de segurança
JWT_SECRET=seu_jwt_secret_aqui
BCRYPT_ROUNDS=12

# Rate limiting
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=100
"@

Set-Content -Path "$migrationBackend\.env" -Value $envContent -Encoding UTF8

# Criar ecosystem.config.js para PM2
$ecosystemContent = @"
module.exports = {
  apps: [{
    name: 'nfe-api',
    script: 'app.js',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/var/www/nfe/logs/err.log',
    out_file: '/var/www/nfe/logs/out.log',
    log_file: '/var/www/nfe/logs/combined.log',
    time: true,
    max_memory_restart: '500M',
    node_args: '--max-old-space-size=512',
    watch: false,
    ignore_watch: ['node_modules', 'logs', 'uploads'],
    restart_delay: 4000,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
"@

Set-Content -Path "$migrationBackend\ecosystem.config.js" -Value $ecosystemContent -Encoding UTF8

# Criar script de instalação para o servidor
$installScript = @"
#!/bin/bash

# Script de instalação da aplicação NFe no servidor
echo "🚀 Instalando aplicação NFe..."

# Ir para diretório da aplicação
cd /var/www/nfe/backend

# Instalar dependências
echo "📦 Instalando dependências..."
npm install --production

# Criar diretórios necessários
mkdir -p logs uploads

# Configurar permissões
chown -R nfeapp:nfeapp /var/www/nfe
chmod +x app.js

# Iniciar aplicação com PM2
echo "🔄 Iniciando aplicação com PM2..."
sudo -u nfeapp pm2 start ecosystem.config.js
sudo -u nfeapp pm2 save

# Configurar PM2 para iniciar com o sistema
pm2 startup systemd -u nfeapp --hp /home/nfeapp

echo "✅ Aplicação instalada e iniciada!"
echo "🌐 Acesse: http://147.93.186.214:3000"
echo ""
echo "📊 Para monitorar:"
echo "pm2 status"
echo "pm2 logs nfe-api"
echo "pm2 monit"
"@

Set-Content -Path "$migrationDir\install-app.sh" -Value $installScript -Encoding UTF8

# Criar arquivo de comandos para transferência
$transferCommands = @"
# Comandos para transferir arquivos para o servidor CONTABO

# 1. Conectar ao servidor via SSH:
ssh root@147.93.186.214

# 2. Executar script de configuração:
bash setup-server.sh

# 3. Transferir arquivos (execute no Windows):
scp -r migration/backend/* root@147.93.186.214:/var/www/nfe/backend/
scp migration/install-app.sh root@147.93.186.214:/var/www/nfe/

# 4. No servidor, executar instalação:
cd /var/www/nfe
chmod +x install-app.sh
./install-app.sh

# 5. Configurar SSL (no servidor):
certbot --nginx -d api.brandaocontador.com.br

# 6. Testar aplicação:
curl http://147.93.186.214:3000/api/health
"@

Set-Content -Path "$migrationDir\COMANDOS_TRANSFERENCIA.txt" -Value $transferCommands -Encoding UTF8

# Mostrar resumo
Write-Host ""
Write-Host "✅ Preparação da migração concluída!" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "📁 Arquivos preparados em: $migrationDir" -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 Arquivos criados:" -ForegroundColor White
Write-Host "- backend/ (aplicação completa)" -ForegroundColor Gray
Write-Host "- install-app.sh (script de instalação)" -ForegroundColor Gray
Write-Host "- COMANDOS_TRANSFERENCIA.txt (guia de comandos)" -ForegroundColor Gray
Write-Host ""
Write-Host "🔄 Próximos passos:" -ForegroundColor Yellow
Write-Host "1. Conectar ao servidor: ssh root@147.93.186.214" -ForegroundColor White
Write-Host "2. Executar: bash setup-server.sh" -ForegroundColor White
Write-Host "3. Transferir arquivos conforme COMANDOS_TRANSFERENCIA.txt" -ForegroundColor White
Write-Host "4. Executar instalação no servidor" -ForegroundColor White
Write-Host "5. Configurar SSL e DNS" -ForegroundColor White
Write-Host ""
Write-Host "🎉 Sistema pronto para migração!" -ForegroundColor Green