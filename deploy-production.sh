#!/bin/bash
# ============================================================================
# SCRIPT DE DEPLOY - SISTEMA NFE NO SERVIDOR CONTABO
# ============================================================================
# Servidor: 147.93.186.214 (Ubuntu 24.04.3 LTS)
# Usuário: nfeapp
# Aplicação: Sistema NFe em produção
# ============================================================================

set -e  # Parar em caso de erro

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para log
log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[ERRO] $1${NC}"
    exit 1
}

warning() {
    echo -e "${YELLOW}[AVISO] $1${NC}"
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

# ============================================================================
# CONFIGURAÇÕES
# ============================================================================
APP_DIR="/var/www/nfe"
BACKEND_DIR="$APP_DIR/backend"
LOG_DIR="/var/log/nfe"
USER="nfeapp"
SERVICE_NAME="nfe-api"

log "Iniciando deploy do Sistema NFe..."

# ============================================================================
# 1. VERIFICAR USUÁRIO
# ============================================================================
if [ "$EUID" -ne 0 ]; then
    error "Este script deve ser executado como root"
fi

# ============================================================================
# 2. VERIFICAR SE APLICAÇÃO EXISTE
# ============================================================================
if [ ! -d "$BACKEND_DIR" ]; then
    error "Diretório da aplicação não encontrado: $BACKEND_DIR"
fi

log "Verificando estrutura da aplicação..."
cd "$BACKEND_DIR"

# Verificar arquivos essenciais
if [ ! -f "app.js" ]; then
    error "Arquivo app.js não encontrado"
fi

if [ ! -f "package.json" ]; then
    error "Arquivo package.json não encontrado"
fi

# ============================================================================
# 3. PARAR APLICAÇÃO SE ESTIVER RODANDO
# ============================================================================
log "Parando aplicação se estiver rodando..."
sudo -u $USER pm2 stop $SERVICE_NAME 2>/dev/null || true
sudo -u $USER pm2 delete $SERVICE_NAME 2>/dev/null || true

# ============================================================================
# 4. BACKUP DA APLICAÇÃO ATUAL
# ============================================================================
log "Criando backup da aplicação atual..."
BACKUP_DIR="/var/backups/nfe/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

if [ -d "$BACKEND_DIR/data" ]; then
    cp -r "$BACKEND_DIR/data" "$BACKUP_DIR/"
    log "Backup dos dados criado em: $BACKUP_DIR"
fi

# ============================================================================
# 5. INSTALAR DEPENDÊNCIAS
# ============================================================================
log "Instalando dependências do Node.js..."
sudo -u $USER npm install --production --no-audit --no-fund

# ============================================================================
# 6. VERIFICAR ESTRUTURA DE DADOS
# ============================================================================
log "Verificando estrutura de dados JSON..."

# Criar diretórios de dados se não existirem
DATA_DIRS=(
    "$BACKEND_DIR/data"
    "$BACKEND_DIR/data/empresas"
    "$BACKEND_DIR/data/certificados"
    "$BACKEND_DIR/data/nfes"
    "$BACKEND_DIR/data/logs"
    "$BACKEND_DIR/data/backup"
)

for dir in "${DATA_DIRS[@]}"; do
    if [ ! -d "$dir" ]; then
        sudo -u $USER mkdir -p "$dir"
        log "Criado diretório: $dir"
    fi
done

# Verificar arquivos JSON essenciais
JSON_FILES=(
    "$BACKEND_DIR/data/empresas.json"
    "$BACKEND_DIR/data/certificados.json"
    "$BACKEND_DIR/data/nfes.json"
    "$BACKEND_DIR/data/configuracoes.json"
)

for file in "${JSON_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        echo "[]" | sudo -u $USER tee "$file" > /dev/null
        log "Criado arquivo JSON: $file"
    fi
done

# ============================================================================
# 7. CONFIGURAR PERMISSÕES
# ============================================================================
log "Configurando permissões..."
chown -R $USER:$USER "$APP_DIR"
chmod -R 755 "$APP_DIR"
chmod -R 644 "$BACKEND_DIR/data"/*.json

# Permissões especiais para logs
chown -R $USER:$USER "$LOG_DIR"
chmod -R 755 "$LOG_DIR"

# ============================================================================
# 8. VERIFICAR CONFIGURAÇÃO PM2
# ============================================================================
log "Verificando configuração PM2..."
if [ ! -f "$BACKEND_DIR/ecosystem-production.config.js" ]; then
    error "Arquivo ecosystem-production.config.js não encontrado"
fi

# ============================================================================
# 9. INICIAR APLICAÇÃO COM PM2
# ============================================================================
log "Iniciando aplicação com PM2..."
cd "$BACKEND_DIR"

# Iniciar com PM2
sudo -u $USER pm2 start ecosystem-production.config.js --env production

# Salvar configuração PM2
sudo -u $USER pm2 save

# ============================================================================
# 10. VERIFICAR SAÚDE DA APLICAÇÃO
# ============================================================================
log "Verificando saúde da aplicação..."
sleep 5

# Verificar se PM2 está rodando
if ! sudo -u $USER pm2 list | grep -q "$SERVICE_NAME"; then
    error "Aplicação não está rodando no PM2"
fi

# Verificar se porta está escutando
if ! netstat -tlnp | grep -q ":3000"; then
    error "Aplicação não está escutando na porta 3000"
fi

# Teste básico de conectividade
if command -v curl >/dev/null 2>&1; then
    if curl -f -s http://localhost:3000/health >/dev/null 2>&1; then
        log "✓ Aplicação respondendo corretamente"
    else
        warning "Aplicação pode não estar respondendo corretamente"
    fi
fi

# ============================================================================
# 11. CONFIGURAR NGINX (SE NECESSÁRIO)
# ============================================================================
if [ -f "/etc/nginx/sites-available/nfe" ]; then
    log "Recarregando configuração Nginx..."
    nginx -t && systemctl reload nginx
else
    warning "Configuração Nginx não encontrada. Execute a configuração manual."
fi

# ============================================================================
# 12. CONFIGURAR LOGROTATE
# ============================================================================
log "Configurando rotação de logs..."
cat > /etc/logrotate.d/nfe << EOF
$LOG_DIR/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 $USER $USER
    postrotate
        sudo -u $USER pm2 reloadLogs
    endscript
}
EOF

# ============================================================================
# 13. RELATÓRIO FINAL
# ============================================================================
log "============================================================================"
log "DEPLOY CONCLUÍDO COM SUCESSO!"
log "============================================================================"

info "Informações da aplicação:"
echo "  • Diretório: $BACKEND_DIR"
echo "  • Usuário: $USER"
echo "  • Porta: 3000"
echo "  • Logs: $LOG_DIR"

info "Status PM2:"
sudo -u $USER pm2 list

info "Uso de recursos:"
echo "  • Memória: $(free -h | awk 'NR==2{printf "%.1f%%", $3*100/$2 }')"
echo "  • Disco: $(df -h $APP_DIR | awk 'NR==2{print $5}')"

info "Próximos passos:"
echo "  1. Configurar DNS para apontar para 147.93.186.214"
echo "  2. Configurar SSL com certbot"
echo "  3. Testar todas as funcionalidades"

log "Deploy finalizado em $(date)"
log "============================================================================"