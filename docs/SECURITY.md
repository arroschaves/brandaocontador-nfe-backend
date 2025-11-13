# Segurança

## SSH
- Autenticação por chaves; desabilitar senha
- Restrição de IPs confiáveis

## Secrets
- Usar GitHub Secrets/HashiCorp Vault para credenciais

## Backups
- Job automático via `BACKUP_CRON`; arquivos em `backups/`

## Firewall
- Configurar UFW/NFT com portas mínimas necessárias
