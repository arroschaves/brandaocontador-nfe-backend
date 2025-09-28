#!/bin/bash

# Script de Configuração Inicial do Servidor DigitalOcean
# brandaocontador-nfe-backend

set -e

echo "🚀 Configurando servidor DigitalOcean para brandaocontador-nfe..."

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo_success() { echo -e "${GREEN}✅ $1${NC}"; }
echo_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
echo_error() { echo -e "${RED}❌ $1${NC}"; }
echo_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }

# Verificar se está rodando como root
if [[ $EUID -ne 0 ]]; then
   echo_error "Este script deve ser executado como root (use sudo)"
   exit 1
fi

echo_info "Iniciando configuração do servidor..."

# 1. Atualizar sistema
echo_info "1. Atualizando sistema..."
apt update && apt upgrade -y

# 2. Instalar dependências básicas
echo_info "2. Instalando dependências básicas..."
apt install -y curl wget git unzip software-properties-common apt-transport-https ca-certificates gnupg lsb-release

# 3. Configurar firewall
echo_info "3. Configurando firewall..."
ufw --force enable
ufw allow ssh
ufw allow 80
ufw allow 443
ufw allow 3001
echo_success "Firewall configurado"

# 4. Instalar Node.js 18
echo_info "4. Instalando Node.js 18..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs
echo_success "Node.js $(node --version) instalado"

# 5. Instalar PM2
echo_info "5. Instalando PM2..."
npm install -g pm2
echo_success "PM2 instalado"

# 6. Instalar Nginx
echo_info "6. Instalando Nginx..."
apt install -y nginx
systemctl enable nginx
systemctl start nginx
echo_success "Nginx instalado e iniciado"

# 7. Configurar SSL com Certbot (Let's Encrypt)
echo_info "7. Instalando Certbot para SSL..."
apt install -y certbot python3-certbot-nginx
echo_success "Certbot instalado"

# 8. Criar usuário para aplicação
echo_info "8. Criando usuário para aplicação..."
if ! id "nfeapp" &>/dev/null; then
    useradd -m -s /bin/bash nfeapp
    usermod -aG sudo nfeapp
    echo_success "Usuário 'nfeapp' criado"
else
    echo_warning "Usuário 'nfeapp' já existe"
fi

# 9. Configurar diretórios
echo_info "9. Configurando diretórios..."
mkdir -p /var/www/brandaocontador-nfe-backend
chown -R nfeapp:nfeapp /var/www/brandaocontador-nfe-backend
mkdir -p /var/log/brandaocontador-nfe
chown -R nfeapp:nfeapp /var/log/brandaocontador-nfe
echo_success "Diretórios configurados"

# 10. Configurar logrotate
echo_info "10. Configurando logrotate..."
cat > /etc/logrotate.d/brandaocontador-nfe << EOF
/var/log/brandaocontador-nfe/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 nfeapp nfeapp
    postrotate
        pm2 reload brandaocontador-nfe-backend
    endscript
}
EOF
echo_success "Logrotate configurado"

# 11. Configurar monitoramento básico
echo_info "11. Instalando htop e iotop..."
apt install -y htop iotop
echo_success "Ferramentas de monitoramento instaladas"

# 12. Configurar timezone
echo_info "12. Configurando timezone para America/Sao_Paulo..."
timedatectl set-timezone America/Sao_Paulo
echo_success "Timezone configurado"

# 13. Otimizações de sistema
echo_info "13. Aplicando otimizações de sistema..."
cat >> /etc/sysctl.conf << EOF

# Otimizações para aplicação NFe
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.tcp_fin_timeout = 30
net.ipv4.tcp_keepalive_time = 1200
net.ipv4.tcp_max_tw_buckets = 400000
EOF
sysctl -p
echo_success "Otimizações aplicadas"

echo ""
echo_success "🎉 Servidor configurado com sucesso!"
echo ""
echo_info "Próximos passos:"
echo "1. Configure o DNS do domínio para apontar para este servidor"
echo "2. Execute: sudo certbot --nginx -d api.brandaocontador.com.br"
echo "3. Clone o repositório como usuário 'nfeapp'"
echo "4. Configure o arquivo .env"
echo "5. Execute o script de deploy"
echo ""
echo_warning "⚠️  Lembre-se de:"
echo "- Configurar as chaves SSH para o usuário 'nfeapp'"
echo "- Fazer backup dos certificados NFe"
echo "- Configurar monitoramento adicional se necessário"