#!/bin/bash

# Script de configuração do servidor CONTABO para sistema NFe
# Execute este script no servidor após conectar via SSH

echo "🚀 Iniciando configuração do servidor CONTABO para sistema NFe"
echo "=================================================="

# Atualizar sistema
echo "📦 Atualizando sistema Ubuntu..."
apt update && apt upgrade -y

# Instalar dependências básicas
echo "🔧 Instalando dependências básicas..."
apt install -y curl wget git unzip software-properties-common

# Instalar Node.js 22.x
echo "📦 Instalando Node.js 22.x..."
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs

# Verificar instalação do Node.js
echo "✅ Verificando instalação do Node.js..."
node --version
npm --version

# Instalar PM2
echo "🔄 Instalando PM2..."
npm install -g pm2

# Instalar Nginx
echo "🌐 Instalando Nginx..."
apt install -y nginx

# Configurar firewall
echo "🔒 Configurando firewall..."
ufw allow 22
ufw allow 80
ufw allow 443
ufw allow 3000
ufw --force enable

# Criar usuário para aplicação
echo "👤 Criando usuário para aplicação..."
useradd -m -s /bin/bash nfeapp
usermod -aG sudo nfeapp

# Criar estrutura de diretórios
echo "📁 Criando estrutura de diretórios..."
mkdir -p /var/www/nfe
mkdir -p /var/www/nfe/backend
mkdir -p /var/www/nfe/logs
chown -R nfeapp:nfeapp /var/www/nfe

# Configurar Nginx básico
echo "⚙️ Configurando Nginx..."
cat > /etc/nginx/sites-available/nfe << 'EOF'
server {
    listen 80;
    server_name api.brandaocontador.com.br;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}
EOF

# Ativar site Nginx
ln -sf /etc/nginx/sites-available/nfe /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# Configurar PM2 para iniciar com o sistema
echo "🔄 Configurando PM2 para inicialização automática..."
pm2 startup
env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u nfeapp --hp /home/nfeapp

# Instalar Certbot para SSL
echo "🔒 Instalando Certbot para SSL..."
apt install -y certbot python3-certbot-nginx

# Mostrar informações do sistema
echo ""
echo "✅ Configuração concluída!"
echo "=================================================="
echo "📊 Informações do sistema:"
echo "Sistema: $(lsb_release -d | cut -f2)"
echo "Node.js: $(node --version)"
echo "NPM: $(npm --version)"
echo "PM2: $(pm2 --version)"
echo "Nginx: $(nginx -v 2>&1)"
echo ""
echo "📁 Diretórios criados:"
echo "- /var/www/nfe (aplicação)"
echo "- /var/www/nfe/backend (backend)"
echo "- /var/www/nfe/logs (logs)"
echo ""
echo "👤 Usuário criado: nfeapp"
echo "🔒 Firewall configurado (portas 22, 80, 443, 3000)"
echo "🌐 Nginx configurado para api.brandaocontador.com.br"
echo ""
echo "🔄 Próximos passos:"
echo "1. Transferir arquivos do backend"
echo "2. Configurar variáveis de ambiente"
echo "3. Instalar dependências: npm install"
echo "4. Iniciar aplicação: pm2 start app.js"
echo "5. Configurar SSL: certbot --nginx -d api.brandaocontador.com.br"
echo ""
echo "🎉 Servidor pronto para receber a aplicação NFe!"