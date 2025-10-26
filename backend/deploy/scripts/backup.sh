#!/bin/bash
# Script de backup automático

BACKUP_DIR="/var/backups/nfe-backend"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="backup_$DATE.tar.gz"

# Criar backup
tar -czf "$BACKUP_DIR/$BACKUP_FILE" \
  --exclude="node_modules" \
  --exclude="logs" \
  --exclude="temp" \
  /opt/nfe-backend

# Manter apenas últimos 30 backups
find "$BACKUP_DIR" -name "backup_*.tar.gz" -mtime +30 -delete

echo "✅ Backup criado: $BACKUP_FILE"
