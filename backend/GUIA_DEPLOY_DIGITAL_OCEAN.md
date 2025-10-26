# 🚀 Guia Completo de Deploy - Digital Ocean

## ✅ Deploy Preparado com Sucesso!

**Pacote gerado:** `nfe-backend-1.0.0-20251025_154429.zip` (224KB)
**Data:** 25/10/2025 15:44:29

---

## 📋 Pré-requisitos no Servidor Digital Ocean

### Servidor Recomendado
- **Droplet:** Ubuntu 20.04 LTS ou superior
- **Recursos:** 4GB RAM, 2 vCPUs, 50GB SSD
- **IP:** Seu IP público da Digital Ocean
- **Domínio:** Configurado apontando para o IP (opcional)

---

## 🚀 Comandos para Execução Automática

### 1. Upload dos Arquivos para o Servidor

```bash
# Substitua YOUR_SERVER_IP pelo IP do seu droplet
export SERVER_IP="YOUR_SERVER_IP"

# Upload do pacote principal
scp backend/deploy/nfe-backend-1.0.0-20251025_154429.zip root@$SERVER_IP:/tmp/

# Upload dos scripts de instalação
scp backend/deploy/scripts/* root@$SERVER_IP:/tmp/scripts/

# Upload das configurações
scp backend/deploy/nginx.conf root@$SERVER_IP:/tmp/
scp backend/deploy/ecosystem.production.js root@$SERVER_IP:/tmp/
```

### 2. Conectar ao Servidor e Executar Instalação

```bash
# Conectar via SSH
ssh root@$SERVER_IP

# Criar diretório para scripts
mkdir -p /tmp/scripts

# Dar permissões de execução
chmod +x /tmp/scripts/*.sh

# Executar instalação automática
cd /tmp
./scripts/install.sh
```

---

## 🔧 Configuração de Variáveis de Ambiente

### 3. Configurar Variáveis Críticas

```bash
# Editar arquivo de ambiente
sudo -u nfe-app nano /opt/nfe-backend/.env

# Configurar as seguintes variáveis:
```

**Arquivo .env necessário:**
```env
NODE_ENV=production
PORT=3001
DB_TYPE=mongodb
MONGODB_URI=mongodb://localhost:27017/nfe_production
JWT_SECRET=seu-jwt-secret-super-seguro-aqui
ENCRYPTION_KEY=sua-chave-32-caracteres-aqui
SEFAZ_AMBIENTE=producao
SEFAZ_TIMEOUT=30000
LOG_LEVEL=info
LOG_TO_FILE=true
ENABLE_CACHE=true
ENABLE_COMPRESSION=true
RATE_LIMIT_ENABLED=true
ENABLE_METRICS=true
ENABLE_HEALTH_CHECKS=true
HEALTH_CHECK_INTERVAL=60000
BACKUP_ENABLED=true
BACKUP_SCHEDULE=0 2 * * *
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seu-email@gmail.com
SMTP_PASS=sua-senha-app-gmail
DO_SPACES_ENDPOINT=https://nyc3.digitaloceanspaces.com
DO_SPACES_KEY=sua-spaces-key
DO_SPACES_SECRET=sua-spaces-secret
DO_SPACES_BUCKET=seu-bucket-name
```

---

## 🔒 Configuração SSL/TLS (Recomendado)

### 4. Instalar Certificado SSL

```bash
# Instalar Certbot
sudo apt install certbot python3-certbot-nginx -y

# Configurar domínio no nginx (substitua yourdomain.com)
sudo sed -i 's/server_name _;/server_name yourdomain.com;/g' /etc/nginx/sites-available/nfe-backend

# Obter certificado SSL
sudo certbot --nginx -d yourdomain.com

# Testar renovação automática
sudo certbot renew --dry-run
```

---

## 🚀 Inicialização da Aplicação

### 5. Iniciar Serviços

```bash
# Iniciar aplicação
sudo -u nfe-app pm2 start /opt/nfe-backend/ecosystem.config.js

# Salvar configuração PM2
sudo -u nfe-app pm2 save

# Configurar PM2 para iniciar automaticamente
sudo pm2 startup

# Reiniciar nginx
sudo systemctl restart nginx
```

---

## 📊 Verificação e Monitoramento

### 6. Verificar Status

```bash
# Status da aplicação
sudo -u nfe-app pm2 status

# Logs em tempo real
sudo -u nfe-app pm2 logs

# Health check
curl http://localhost:3001/health

# Status do nginx
sudo systemctl status nginx

# Verificar portas
sudo netstat -tlnp | grep :3001
sudo netstat -tlnp | grep :80
sudo netstat -tlnp | grep :443
```

### 7. Comandos de Monitoramento Contínuo

```bash
# Monitoramento PM2
sudo -u nfe-app pm2 monit

# Logs da aplicação
tail -f /var/log/nfe-backend/combined.log

# Logs do nginx
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

---

## 🔧 Comandos de Manutenção

### Restart da Aplicação
```bash
sudo -u nfe-app pm2 restart nfe-backend
```

### Atualização da Aplicação
```bash
# Parar aplicação
sudo -u nfe-app pm2 stop nfe-backend

# Backup atual
sudo cp -r /opt/nfe-backend /var/backups/nfe-backend-$(date +%Y%m%d_%H%M%S)

# Upload novo pacote e extrair
sudo -u nfe-app unzip -o /tmp/nfe-backend-*.zip -d /opt/nfe-backend/

# Instalar dependências
cd /opt/nfe-backend
sudo -u nfe-app npm ci --only=production

# Reiniciar aplicação
sudo -u nfe-app pm2 start ecosystem.config.js
```

### Backup Manual
```bash
# Executar script de backup
sudo -u nfe-app /opt/nfe-backend/scripts/backup.sh
```

---

## 🌐 URLs de Acesso

Após a instalação, sua aplicação estará disponível em:

- **HTTP:** `http://YOUR_SERVER_IP:3001`
- **HTTPS:** `https://yourdomain.com` (se SSL configurado)
- **Health Check:** `http://YOUR_SERVER_IP:3001/health`

---

## 🆘 Solução de Problemas

### Aplicação não inicia
```bash
# Verificar logs
sudo -u nfe-app pm2 logs nfe-backend

# Verificar configurações
sudo -u nfe-app cat /opt/nfe-backend/.env

# Reiniciar PM2
sudo -u nfe-app pm2 kill
sudo -u nfe-app pm2 start ecosystem.config.js
```

### Nginx não funciona
```bash
# Testar configuração
sudo nginx -t

# Verificar status
sudo systemctl status nginx

# Reiniciar nginx
sudo systemctl restart nginx
```

### Problemas de conectividade
```bash
# Verificar firewall
sudo ufw status

# Liberar portas necessárias
sudo ufw allow 80
sudo ufw allow 443
sudo ufw allow 3001
```

---

## 📞 Suporte

Para suporte técnico, verifique:
1. Logs da aplicação em `/var/log/nfe-backend/`
2. Logs do nginx em `/var/log/nginx/`
3. Status dos serviços com `pm2 status` e `systemctl status nginx`

---

**🎉 Deploy concluído com sucesso!**

Sua aplicação NFe está pronta para produção na Digital Ocean!