#!/bin/bash

# Script de Deploy Atualizado para DigitalOcean
# brandaocontador-nfe-backend

set -e

# Configurações
APP_NAME="brandaocontador-nfe-backend"
APP_DIR="/var/www/$APP_NAME"
REPO_URL="https://github.com/arroschaves/brandaocontador-nfe-backend.git"
BRANCH="main"

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

echo -e "${BLUE}"
echo "🚀 DEPLOY BRANDÃO CONTADOR NFE BACKEND"
echo "======================================="
echo -e "${NC}"

# Verificar se o diretório existe
if [ ! -d "$APP_DIR" ]; then
    echo_error "Diretório da aplicação não encontrado: $APP_DIR"
    echo_info "Execute primeiro o script de setup inicial"
    exit 1
fi

cd $APP_DIR

# Verificar status atual
echo_info "Verificando status atual..."
if command -v pm2 &> /dev/null; then
    echo "Status atual do PM2:"
    pm2 list | grep $APP_NAME || echo "Aplicação não está rodando no PM2"
fi

# Fazer backup do .env atual
if [ -f ".env" ]; then
    echo_info "Fazendo backup do .env..."
    cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
fi

# Atualizar código
echo_info "Atualizando código do repositório..."
git fetch origin
git reset --hard origin/$BRANCH
echo_success "Código atualizado para o último commit"

# Mostrar últimas alterações
echo_info "Últimas alterações:"
git log --oneline -5

# Instalar/atualizar dependências
echo_info "Instalando dependências..."
npm ci --production --silent

# Verificar se .env existe
if [ ! -f ".env" ]; then
    if [ -f ".env.backup"* ]; then
        echo_warning "Restaurando .env do backup..."
        cp .env.backup.* .env
    else
        echo_warning "Criando .env a partir do template..."
        cp .env.production .env
        echo_error "IMPORTANTE: Configure as variáveis no arquivo .env!"
        echo "Arquivo: $APP_DIR/.env"
    fi
fi

# Criar diretórios necessários
echo_info "Criando diretórios necessários..."
mkdir -p logs xmls/enviadas xmls/falhas certs

# Verificar sintaxe do código
echo_info "Verificando sintaxe do código..."
node -c app.js && echo_success "Sintaxe OK" || { echo_error "Erro de sintaxe!"; exit 1; }

# Parar aplicação atual
echo_info "Parando aplicação atual..."
pm2 stop $APP_NAME 2>/dev/null || echo "Aplicação não estava rodando"

# Aguardar um momento
sleep 2

# Iniciar aplicação
echo_info "Iniciando aplicação..."
pm2 start deploy/ecosystem.production.js --env production

# Aguardar inicialização
sleep 3

# Verificar se a aplicação iniciou corretamente
if pm2 list | grep -q "$APP_NAME.*online"; then
    echo_success "Aplicação iniciada com sucesso!"
else
    echo_error "Falha ao iniciar aplicação!"
    echo "Logs de erro:"
    pm2 logs $APP_NAME --lines 10 --nostream
    exit 1
fi

# Salvar configuração PM2
pm2 save

# Mostrar status final
echo -e "${GREEN}"
echo "✅ DEPLOY CONCLUÍDO COM SUCESSO!"
echo "================================="
echo -e "${NC}"

echo "📊 Status da aplicação:"
pm2 status

echo ""
echo "🔗 URLs importantes:"
echo "- API: https://api.brandaocontador.com.br"
echo "- Frontend: https://www.brandaocontador.com.br"

echo ""
echo "📝 Comandos úteis:"
echo "- Ver logs: pm2 logs $APP_NAME"
echo "- Reiniciar: pm2 restart $APP_NAME"
echo "- Parar: pm2 stop $APP_NAME"
echo "- Status: pm2 status"

echo ""
echo "📋 Próximos passos:"
echo "1. Testar a API: curl https://api.brandaocontador.com.br"
echo "2. Verificar logs: pm2 logs $APP_NAME --lines 20"
echo "3. Testar integração com frontend"

echo ""
echo_success "Deploy finalizado! 🎉"