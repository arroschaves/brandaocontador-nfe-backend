#!/bin/bash

# Script de Deploy para DigitalOcean Ubuntu
# brandaocontador-nfe-backend

set -e

echo "🚀 Iniciando deploy do brandaocontador-nfe-backend..."

# Configurações
APP_NAME="brandaocontador-nfe-backend"
APP_DIR="/var/www/$APP_NAME"
REPO_URL="https://github.com/arroschaves/brandaocontador-nfe-backend.git"
BRANCH="main"

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

echo_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

echo_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Verificar se está rodando como root ou com sudo
if [[ $EUID -eq 0 ]]; then
   echo_error "Este script não deve ser executado como root"
   exit 1
fi

# Atualizar sistema
echo "📦 Atualizando sistema..."
sudo apt update && sudo apt upgrade -y

# Instalar Node.js se não estiver instalado
if ! command -v node &> /dev/null; then
    echo "📦 Instalando Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Instalar PM2 globalmente se não estiver instalado
if ! command -v pm2 &> /dev/null; then
    echo "📦 Instalando PM2..."
    sudo npm install -g pm2
fi

# Instalar Nginx se não estiver instalado
if ! command -v nginx &> /dev/null; then
    echo "📦 Instalando Nginx..."
    sudo apt install -y nginx
fi

# Criar diretório da aplicação
sudo mkdir -p $APP_DIR
sudo chown -R $USER:$USER $APP_DIR

# Clone ou pull do repositório
if [ -d "$APP_DIR/.git" ]; then
    echo "🔄 Atualizando código..."
    cd $APP_DIR
    git pull origin $BRANCH
else
    echo "📥 Clonando repositório..."
    git clone $REPO_URL $APP_DIR
    cd $APP_DIR
    git checkout $BRANCH
fi

# Instalar dependências
echo "📦 Instalando dependências..."
npm ci --omit=dev --no-audit --no-fund --prefer-offline --silent || \
npm ci --production --silent || \
npm install --omit=dev --no-audit --no-fund --prefer-offline --silent

# Criar diretórios necessários
mkdir -p logs
mkdir -p xmls/enviadas
mkdir -p xmls/falhas

# Configurar variáveis de ambiente
if [ ! -f ".env" ]; then
    echo_warning "Arquivo .env não encontrado. Criando template..."
    cp .env.example .env
    echo_warning "⚠️  IMPORTANTE: Configure as variáveis no arquivo .env antes de continuar!"
    echo "Arquivo .env criado em: $APP_DIR/.env"
    read -p "Pressione Enter após configurar o .env..."
fi

# Parar aplicação se estiver rodando
echo "🛑 Parando aplicação..."
pm2 stop $APP_NAME 2>/dev/null || true
pm2 delete $APP_NAME 2>/dev/null || true

# Iniciar aplicação com PM2
echo "🚀 Iniciando aplicação..."
pm2 start deploy/ecosystem.production.js --env production

# Salvar configuração PM2
pm2 save
pm2 startup

echo_success "Deploy concluído com sucesso!"
echo "📊 Status da aplicação:"
pm2 status
echo ""
echo "📝 Logs da aplicação:"
echo "  pm2 logs $APP_NAME"
echo ""
echo "🌐 Aplicação rodando na porta 3001"
echo "🔧 Configure o Nginx para proxy reverso se necessário"