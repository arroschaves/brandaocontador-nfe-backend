#!/bin/bash
# Script de instalação para Digital Ocean

set -e

echo "🚀 Iniciando instalação do NFe Backend..."

# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Instalar PM2
sudo npm install -g pm2

# Instalar Nginx
sudo apt install -y nginx

# Criar usuário para aplicação
sudo useradd -m -s /bin/bash nfe-app || true

# Criar diretórios
sudo mkdir -p /opt/nfe-backend
sudo mkdir -p /var/log/nfe-backend
sudo mkdir -p /var/backups/nfe-backend

# Definir permissões
sudo chown -R nfe-app:nfe-app /opt/nfe-backend
sudo chown -R nfe-app:nfe-app /var/log/nfe-backend
sudo chown -R nfe-app:nfe-app /var/backups/nfe-backend

# Extrair aplicação
sudo -u nfe-app unzip -o nfe-backend-*.zip -d /opt/nfe-backend/

# Instalar dependências
cd /opt/nfe-backend
sudo -u nfe-app npm ci --only=production

# Configurar PM2
sudo -u nfe-app pm2 start ecosystem.config.js
sudo -u nfe-app pm2 save
sudo pm2 startup

# Configurar Nginx
sudo cp nginx.conf /etc/nginx/sites-available/nfe-backend
sudo ln -sf /etc/nginx/sites-available/nfe-backend /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# Configurar firewall
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw --force enable

echo "✅ Instalação concluída!"
echo "📋 Próximos passos:"
echo "   1. Configurar variáveis de ambiente em /opt/nfe-backend/.env"
echo "   2. Configurar SSL/TLS"
echo "   3. Configurar backup automático"
