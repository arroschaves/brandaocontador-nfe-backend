#!/bin/bash

# Script para corrigir CORS em produção
# brandaocontador-nfe-backend

set -e

# Configurações
APP_NAME="brandaocontador-nfe-backend"
APP_DIR="/var/www/$APP_NAME"
SERVER_IP="your_server_ip"  # Substitua pelo IP do seu servidor

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo_success() { echo -e "${GREEN}✅ $1${NC}"; }
echo_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }

echo -e "${BLUE}"
echo "🔧 CORREÇÃO CORS - BRANDÃO CONTADOR NFE"
echo "======================================"
echo -e "${NC}"

echo_info "Este script irá:"
echo "1. Atualizar o código do backend com as correções CORS"
echo "2. Atualizar o arquivo .env.production"
echo "3. Reiniciar o serviço"
echo ""

# Instruções para execução manual
echo_info "INSTRUÇÕES PARA EXECUÇÃO MANUAL:"
echo ""
echo "1. Conecte-se ao servidor:"
echo "   ssh root@$SERVER_IP"
echo ""
echo "2. Navegue até o diretório da aplicação:"
echo "   cd $APP_DIR"
echo ""
echo "3. Faça backup do arquivo atual:"
echo "   cp app.js app.js.backup"
echo "   cp .env .env.backup"
echo ""
echo "4. Atualize o arquivo app.js (linhas 15-21):"
echo "   nano app.js"
echo ""
echo "   Substitua:"
echo "   origin: ['https://brandaocontador.com.br', ...]"
echo ""
echo "   Por:"
echo "   const corsOrigins = process.env.CORS_ORIGINS"
echo "     ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())"
echo "     : ['https://brandaocontador.com.br', 'https://app.brandaocontador.com.br', 'https://nfe.brandaocontador.com.br', 'http://localhost:3000', 'http://localhost:3002'];"
echo ""
echo "   origin: corsOrigins,"
echo ""
echo "5. Atualize o arquivo .env:"
echo "   nano .env"
echo ""
echo "   Adicione/atualize:"
echo "   CORS_ORIGINS=https://brandaocontador.com.br,https://app.brandaocontador.com.br,https://nfe.brandaocontador.com.br"
echo ""
echo "6. Reinicie o serviço:"
echo "   pm2 restart $APP_NAME"
echo ""
echo "7. Verifique os logs:"
echo "   pm2 logs $APP_NAME"
echo ""

echo_success "Instruções geradas! Execute manualmente no servidor."