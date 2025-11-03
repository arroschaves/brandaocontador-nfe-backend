#!/bin/bash

# ============================================================================
# SCRIPT DE CONFIGURAÇÃO DO SERVIDOR CONTABO PARA SISTEMA NFE
# ============================================================================
# Servidor: 147.93.186.214 (Ubuntu 24.04.3 LTS)
# Usuário: root
# Senha: Cont@bo2025!
# ============================================================================

set -e  # Parar em caso de erro

echo "🚀 INICIANDO CONFIGURAÇÃO DO SERVIDOR CONTABO PARA SISTEMA NFE"
echo "=============================================================="
echo "📊 Servidor: 147.93.186.214"
echo "💻 OS: Ubuntu 24.04.3 LTS"
echo "💾 Disco: 192GB (1% usado)"
echo "🧠 Memória: 2% usado"
echo "=============================================================="

# Atualizar sistema
echo ""
echo "📦 ATUALIZANDO SISTEMA UBUNTU 24.04..."
apt update && apt upgrade -y

# Instalar dependências básicas
echo ""
echo "🔧 INSTALANDO DEPENDÊNCIAS BÁSICAS..."
apt install -y curl wget git unzip software-properties-common build-essential

# Configurar timezone para Brasil
echo ""
echo "🌍 CONFIGURANDO TIMEZONE PARA BRASIL..."
timedatectl set-timezone America/Sao_Paulo

# Instalar Node.js 22.x
echo ""
echo "📦 INSTALANDO NODE.JS 22.x..."
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs

# Verificar instalação do Node.js
echo ""
echo "✅ VERIFICANDO INSTALAÇÃO DO NODE.JS..."
node_version=$(node --version)
npm_version=$(npm --version)
echo "Node.js: $node_version"
echo "NPM: $npm_version"

# Instalar PM2 globalmente
echo ""
echo "🔄 INSTALANDO PM2..."
npm install -g pm2@latest

# Instalar Nginx
echo ""
echo "🌐 INSTALANDO NGINX..."
apt install -y nginx

# Instalar Certbot para SSL
echo ""
echo "🔒 INSTALANDO CERTBOT PARA SSL..."
apt install -y certbot python3-certbot-nginx

# Configurar firewall UFW
echo ""
echo "🔒 CONFIGURANDO FIREWALL UFW..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw allow 3000/tcp  # Node.js App
ufw --force enable

# Criar usuário para aplicação NFe
echo ""
echo "👤 CRIANDO USUÁRIO PARA APLICAÇÃO NFE..."
if ! id "nfeapp" &>/dev/null; then
    useradd -m -s /bin/bash nfeapp
    usermod -aG sudo nfeapp
    echo "✅ Usuário 'nfeapp' criado com sucesso"
else
    echo "ℹ️ Usuário 'nfeapp' já existe"
fi

# Criar estrutura de diretórios
echo ""
echo "📁 CRIANDO ESTRUTURA DE DIRETÓRIOS..."
mkdir -p /var/www/nfe
mkdir -p /var/www/nfe/backend
mkdir -p /var/www/nfe/logs
mkdir -p /var/www/nfe/backups
mkdir -p /var/www/nfe/uploads
mkdir -p /var/www/nfe/certificates
mkdir -p /var/log/nfe

# Configurar permissões
chown -R nfeapp:nfeapp /var/www/nfe
chown -R nfeapp:nfeapp /var/log/nfe
chmod -R 755 /var/www/nfe
chmod -R 750 /var/log/nfe

# Configurar Nginx básico
echo ""
echo "⚙️ CONFIGURANDO NGINX..."
cat > /etc/nginx/sites-available/nfe << 'EOF'
# Configuração Nginx para Sistema NFe
# Servidor: 147.93.186.214

server {
    listen 80;
    server_name api.brandaocontador.com.br nfe.brandaocontador.com.br 147.93.186.214;
    
    # Logs específicos
    access_log /var/log/nginx/nfe_access.log;
    error_log /var/log/nginx/nfe_error.log;
    
    # Configurações de segurança
    server_tokens off;
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    
    # Proxy para aplicação Node.js
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
        
        # Timeouts otimizados
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 300s;
        
        # Buffer otimizado
        proxy_buffering on;
        proxy_buffer_size 128k;
        proxy_buffers 4 256k;
        proxy_busy_buffers_size 256k;
    }
    
    # Arquivos estáticos
    location /uploads/ {
        alias /var/www/nfe/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
    
    # Health check
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
EOF

# Ativar site Nginx
ln -sf /etc/nginx/sites-available/nfe /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Testar configuração Nginx
nginx -t

# Configurar PM2 para inicialização automática
echo ""
echo "🔄 CONFIGURANDO PM2 PARA INICIALIZAÇÃO AUTOMÁTICA..."
pm2 startup systemd -u nfeapp --hp /home/nfeapp

# Configurar logrotate para logs da aplicação
echo ""
echo "📋 CONFIGURANDO LOGROTATE..."
cat > /etc/logrotate.d/nfe << 'EOF'
/var/log/nfe/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 nfeapp nfeapp
    postrotate
        systemctl reload nginx
    endscript
}
EOF

# Configurar swap se necessário (otimização)
echo ""
echo "💾 VERIFICANDO CONFIGURAÇÃO DE SWAP..."
if [ $(free | grep Swap | awk '{print $2}') -eq 0 ]; then
    echo "📝 Criando arquivo de swap de 2GB..."
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    echo "✅ Swap configurado"
else
    echo "ℹ️ Swap já configurado"
fi

# Otimizações do sistema
echo ""
echo "⚡ APLICANDO OTIMIZAÇÕES DO SISTEMA..."
cat >> /etc/sysctl.conf << 'EOF'

# Otimizações para aplicação NFe
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.tcp_fin_timeout = 30
net.ipv4.tcp_keepalive_time = 1200
net.ipv4.tcp_max_tw_buckets = 400000
vm.swappiness = 10
EOF

sysctl -p

# Reiniciar serviços
echo ""
echo "🔄 REINICIANDO SERVIÇOS..."
systemctl restart nginx
systemctl enable nginx

# Mostrar informações finais
echo ""
echo "✅ CONFIGURAÇÃO DO SERVIDOR CONCLUÍDA!"
echo "============================================"
echo ""
echo "📊 INFORMAÇÕES DO SISTEMA:"
echo "Sistema: $(lsb_release -d | cut -f2)"
echo "Node.js: $(node --version)"
echo "NPM: $(npm --version)"
echo "PM2: $(pm2 --version)"
echo "Nginx: $(nginx -v 2>&1)"
echo "Timezone: $(timedatectl show --property=Timezone --value)"
echo ""
echo "📁 DIRETÓRIOS CRIADOS:"
echo "- /var/www/nfe (aplicação principal)"
echo "- /var/www/nfe/backend (código da aplicação)"
echo "- /var/www/nfe/logs (logs da aplicação)"
echo "- /var/www/nfe/backups (backups)"
echo "- /var/www/nfe/uploads (arquivos enviados)"
echo "- /var/www/nfe/certificates (certificados)"
echo "- /var/log/nfe (logs do sistema)"
echo ""
echo "👤 USUÁRIO CRIADO: nfeapp"
echo "🔒 FIREWALL CONFIGURADO:"
echo "- Porta 22 (SSH)"
echo "- Porta 80 (HTTP)"
echo "- Porta 443 (HTTPS)"
echo "- Porta 3000 (Node.js)"
echo ""
echo "🌐 NGINX CONFIGURADO PARA:"
echo "- api.brandaocontador.com.br"
echo "- nfe.brandaocontador.com.br"
echo "- 147.93.186.214"
echo ""
echo "🔄 PRÓXIMOS PASSOS:"
echo "1. Transferir arquivos da aplicação"
echo "2. Configurar variáveis de ambiente"
echo "3. Instalar dependências: npm install"
echo "4. Iniciar aplicação: pm2 start ecosystem.config.js"
echo "5. Configurar SSL: certbot --nginx -d api.brandaocontador.com.br"
echo ""
echo "🎉 SERVIDOR PRONTO PARA RECEBER A APLICAÇÃO NFE!"
echo "============================================"