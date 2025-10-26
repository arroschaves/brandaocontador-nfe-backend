#!/bin/bash

# Script de Deploy para Produção
# Brandão Contador NFe Backend

set -e  # Exit on any error

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Funções de log
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Configurações
APP_NAME="brandaocontador-nfe-backend"
APP_DIR="/var/www/brandaocontador-nfe-backend"
BACKUP_DIR="/var/backups/brandaocontador-nfe"
USER="nfeapp"
REPO_URL="https://github.com/seu-usuario/brandaocontador-nfe.git"
BRANCH="main"

# Verificar se está rodando como root
if [[ $EUID -eq 0 ]]; then
   log_error "Este script não deve ser executado como root"
   exit 1
fi

# Verificar se o usuário tem permissões sudo
if ! sudo -n true 2>/dev/null; then
    log_error "Este script requer permissões sudo"
    exit 1
fi

log_info "Iniciando deploy de produção do $APP_NAME..."

# 1. Criar backup antes do deploy
log_info "1. Criando backup..."
BACKUP_NAME="backup-$(date +%Y%m%d-%H%M%S)"
sudo mkdir -p "$BACKUP_DIR/$BACKUP_NAME"

if [ -d "$APP_DIR" ]; then
    sudo cp -r "$APP_DIR" "$BACKUP_DIR/$BACKUP_NAME/"
    log_success "Backup criado em $BACKUP_DIR/$BACKUP_NAME"
else
    log_warning "Diretório da aplicação não existe, pulando backup"
fi

# 2. Parar aplicação
log_info "2. Parando aplicação..."
if pm2 list | grep -q "$APP_NAME"; then
    pm2 stop "$APP_NAME" || true
    log_success "Aplicação parada"
else
    log_warning "Aplicação não estava rodando"
fi

# 3. Atualizar código
log_info "3. Atualizando código..."
if [ -d "$APP_DIR/.git" ]; then
    cd "$APP_DIR"
    git fetch origin
    git reset --hard "origin/$BRANCH"
    log_success "Código atualizado"
else
    log_info "Clonando repositório..."
    sudo rm -rf "$APP_DIR"
    sudo mkdir -p "$APP_DIR"
    sudo chown "$USER:$USER" "$APP_DIR"
    git clone "$REPO_URL" "$APP_DIR"
    cd "$APP_DIR"
    git checkout "$BRANCH"
    log_success "Repositório clonado"
fi

# 4. Instalar dependências
log_info "4. Instalando dependências..."
cd "$APP_DIR/backend"
npm ci --production
log_success "Dependências instaladas"

# 5. Configurar ambiente de produção
log_info "5. Configurando ambiente de produção..."
if [ -f ".env.producao" ]; then
    cp ".env.producao" ".env"
    log_success "Arquivo .env configurado"
else
    log_error "Arquivo .env.producao não encontrado!"
    exit 1
fi

# 6. Executar migrações (se necessário)
log_info "6. Executando migrações..."
if [ -f "scripts/migrate.js" ]; then
    node scripts/migrate.js
    log_success "Migrações executadas"
else
    log_warning "Script de migração não encontrado"
fi

# 7. Validar configuração de produção
log_info "7. Validando configuração..."
if [ -f "scripts/validar-producao.js" ]; then
    node scripts/validar-producao.js
    log_success "Configuração validada"
else
    log_warning "Script de validação não encontrado"
fi

# 8. Configurar PM2
log_info "8. Configurando PM2..."
if [ -f "ecosystem.production.js" ]; then
    pm2 start ecosystem.production.js --env production
    log_success "Aplicação iniciada com PM2"
else
    pm2 start app.js --name "$APP_NAME" --env production
    log_success "Aplicação iniciada com configuração padrão"
fi

# 9. Salvar configuração PM2
pm2 save
pm2 startup | grep -E '^sudo' | bash || true
log_success "Configuração PM2 salva"

# 10. Configurar Nginx (se necessário)
log_info "10. Verificando configuração Nginx..."
NGINX_CONFIG="/etc/nginx/sites-available/$APP_NAME"
if [ ! -f "$NGINX_CONFIG" ]; then
    log_info "Criando configuração Nginx..."
    sudo cp "deploy/nginx.conf" "$NGINX_CONFIG"
    sudo ln -sf "$NGINX_CONFIG" "/etc/nginx/sites-enabled/"
    sudo nginx -t
    sudo systemctl reload nginx
    log_success "Nginx configurado"
else
    log_info "Configuração Nginx já existe"
fi

# 11. Configurar SSL (se necessário)
log_info "11. Verificando SSL..."
if ! sudo certbot certificates | grep -q "api.brandaocontador.com.br"; then
    log_info "Configurando SSL com Let's Encrypt..."
    sudo certbot --nginx -d api.brandaocontador.com.br --non-interactive --agree-tos --email admin@brandaocontador.com.br
    log_success "SSL configurado"
else
    log_info "SSL já configurado"
fi

# 12. Verificar saúde da aplicação
log_info "12. Verificando saúde da aplicação..."
sleep 10  # Aguardar aplicação inicializar

if curl -f http://localhost:3001/health > /dev/null 2>&1; then
    log_success "Aplicação está saudável"
else
    log_error "Aplicação não está respondendo!"
    pm2 logs "$APP_NAME" --lines 20
    exit 1
fi

# 13. Limpeza
log_info "13. Limpeza..."
# Manter apenas os 5 backups mais recentes
sudo find "$BACKUP_DIR" -maxdepth 1 -type d -name "backup-*" | sort -r | tail -n +6 | xargs sudo rm -rf
log_success "Backups antigos removidos"

# 14. Relatório final
log_success "Deploy concluído com sucesso!"
echo ""
echo "=== RELATÓRIO DO DEPLOY ==="
echo "Data: $(date)"
echo "Aplicação: $APP_NAME"
echo "Diretório: $APP_DIR"
echo "Branch: $BRANCH"
echo "Backup: $BACKUP_DIR/$BACKUP_NAME"
echo ""
echo "=== STATUS DOS SERVIÇOS ==="
pm2 list
echo ""
sudo systemctl status nginx --no-pager -l
echo ""
echo "=== LOGS RECENTES ==="
pm2 logs "$APP_NAME" --lines 10

log_info "Deploy finalizado. Aplicação disponível em https://api.brandaocontador.com.br"