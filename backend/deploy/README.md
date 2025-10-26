# Deploy NFe Backend - Digital Ocean

## Informações do Deploy

- **Versão**: 1.0.0
- **Timestamp**: 20251025_154429
- **Ambiente**: production

## Pré-requisitos

- Droplet Digital Ocean (Ubuntu 20.04 LTS ou superior)
- Mínimo 2GB RAM, 2 vCPUs
- 25GB de armazenamento SSD

## Instalação

1. **Upload do pacote**
   ```bash
   scp nfe-backend-*.zip root@your-server:/tmp/
   ```

2. **Conectar ao servidor**
   ```bash
   ssh root@your-server
   ```

3. **Executar instalação**
   ```bash
   cd /tmp
   chmod +x scripts/install.sh
   ./scripts/install.sh
   ```

4. **Configurar variáveis de ambiente**
   ```bash
   sudo -u nfe-app nano /opt/nfe-backend/.env
   ```

5. **Reiniciar aplicação**
   ```bash
   sudo -u nfe-app pm2 restart all
   ```

## Configuração SSL

1. **Instalar Certbot**
   ```bash
   sudo apt install certbot python3-certbot-nginx
   ```

2. **Obter certificado**
   ```bash
   sudo certbot --nginx -d your-domain.com
   ```

## Monitoramento

- **PM2 Dashboard**: `pm2 monit`
- **Logs**: `pm2 logs`
- **Status**: `pm2 status`
- **Health Check**: `curl http://localhost:3001/health`

## Backup

O backup automático está configurado para executar diariamente às 2:00 AM.

**Backup manual**:
```bash
sudo /opt/nfe-backend/scripts/backup.sh
```

## Troubleshooting

### Aplicação não inicia
1. Verificar logs: `pm2 logs`
2. Verificar configurações: `cat /opt/nfe-backend/.env`
3. Verificar permissões: `ls -la /opt/nfe-backend`

### Erro de conexão com banco
1. Verificar string de conexão no .env
2. Verificar conectividade: `ping your-mongodb-host`
3. Verificar firewall: `sudo ufw status`

### Erro 502 Bad Gateway
1. Verificar se aplicação está rodando: `pm2 status`
2. Verificar configuração Nginx: `sudo nginx -t`
3. Verificar logs Nginx: `sudo tail -f /var/log/nginx/error.log`

## Suporte

Para suporte técnico, entre em contato com a equipe de desenvolvimento.
