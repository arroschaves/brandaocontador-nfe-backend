# Guia de Configuração e Troubleshooting - Sistema NFe

## 1. Configuração Inicial do Ambiente

### 1.1 Variáveis de Ambiente

#### Frontend (.env.local)

```bash
# Autenticação
NEXTAUTH_URL=https://nfe.brandaocontador.com.br
NEXTAUTH_SECRET=sua-chave-secreta-muito-forte-aqui

# Backend API
NEXT_PUBLIC_BACKEND_URL=https://api.brandaocontador.com.br
NEXT_PUBLIC_API_URL=https://api.brandaocontador.com.br/api

# Ambiente
NODE_ENV=production
NEXT_PUBLIC_APP_ENV=production

# Analytics (opcional)
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX

# Sentry (opcional)
NEXT_PUBLIC_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
```

#### Backend (.env)

```bash
# Servidor
PORT=3001
NODE_ENV=production
API_VERSION=v1

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/brandao_contador_nfe
DB_HOST=localhost
DB_PORT=5432
DB_NAME=brandao_contador_nfe
DB_USER=brandao_user
DB_PASSWORD=senha-super-segura

# JWT
JWT_SECRET=sua-chave-jwt-muito-forte-aqui
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# SEFAZ
SEFAZ_AMBIENTE=producao
SEFAZ_TIMEOUT=30000
SEFAZ_RETRY_ATTEMPTS=3

# Certificados
CERTIFICATE_PATH=/var/www/certificates
CERTIFICATE_PASSWORD_ENCRYPTION_KEY=chave-para-criptografar-senhas

# Email (para notificações)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@brandaocontador.com.br
SMTP_PASSWORD=senha-do-email
SMTP_FROM=noreply@brandaocontador.com.br

# Redis (cache)
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=senha-redis

# Logs
LOG_LEVEL=info
LOG_FILE_PATH=/var/log/brandao-contador

# Backup
BACKUP_PATH=/var/backups/brandao-contador
BACKUP_RETENTION_DAYS=30

# Monitoramento
HEALTH_CHECK_INTERVAL=60000
METRICS_ENABLED=true

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS
CORS_ORIGIN=https://nfe.brandaocontador.com.br,https://admin.brandaocontador.com.br

# Sentry (opcional)
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
```

### 1.2 Configuração do Banco de Dados

#### Instalação PostgreSQL (Ubuntu)

```bash
# Instalar PostgreSQL
sudo apt update
sudo apt install postgresql postgresql-contrib

# Configurar usuário
sudo -u postgres createuser --interactive
# Nome: brandao_user
# Superuser: n
# Create databases: y
# Create roles: n

# Criar banco de dados
sudo -u postgres createdb brandao_contador_nfe

# Definir senha
sudo -u postgres psql
\password brandao_user
# Digite a senha
\q

# Configurar acesso
sudo nano /etc/postgresql/14/main/pg_hba.conf
# Adicionar linha:
# local   brandao_contador_nfe   brandao_user   md5

# Reiniciar PostgreSQL
sudo systemctl restart postgresql
```

#### Executar Migrations

```bash
# No diretório do backend
npm run migrate:up

# Ou executar SQL diretamente
psql -U brandao_user -d brandao_contador_nfe -f migrations/001_initial_schema.sql
```

### 1.3 Configuração do Nginx

#### Arquivo de configuração completo

```nginx
# /etc/nginx/sites-available/api.brandaocontador.com.br
server {
    listen 80;
    server_name api.brandaocontador.com.br;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.brandaocontador.com.br;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/api.brandaocontador.com.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.brandaocontador.com.br/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security Headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin";

    # Rate Limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req zone=api burst=20 nodelay;

    # File upload limit
    client_max_body_size 10M;

    # Timeouts
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;

    # Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # Main application
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Health check endpoint
    location /health {
        access_log off;
        proxy_pass http://localhost:3001/health;
    }

    # Static files (se houver)
    location /static/ {
        alias /var/www/brandao-contador-api/public/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Logs
    access_log /var/log/nginx/api.brandaocontador.com.br.access.log;
    error_log /var/log/nginx/api.brandaocontador.com.br.error.log;
}
```

## 2. Troubleshooting Guide

### 2.1 Problemas Comuns do Frontend

#### Erro: "Failed to fetch" ou "Network Error"

**Sintomas**:

- Requests para API falham
- Console mostra erros de CORS
- Páginas não carregam dados

**Diagnóstico**:

```bash
# Verificar se backend está rodando
curl -I https://api.brandaocontador.com.br/health

# Verificar configuração CORS
curl -H "Origin: https://nfe.brandaocontador.com.br" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: X-Requested-With" \
     -X OPTIONS \
     https://api.brandaocontador.com.br/api/nfe/emitir
```

**Soluções**:

1. Verificar variável `NEXT_PUBLIC_BACKEND_URL`
2. Confirmar configuração CORS no backend
3. Verificar certificado SSL
4. Testar conectividade de rede

#### Erro: "Authentication failed"

**Sintomas**:

- Login não funciona
- Sessão expira rapidamente
- Redirecionamentos incorretos

**Diagnóstico**:

```javascript
// Adicionar logs temporários
console.log("NEXTAUTH_URL:", process.env.NEXTAUTH_URL);
console.log(
  "NEXTAUTH_SECRET:",
  process.env.NEXTAUTH_SECRET ? "SET" : "NOT SET",
);
```

**Soluções**:

1. Verificar `NEXTAUTH_URL` e `NEXTAUTH_SECRET`
2. Confirmar configuração de cookies
3. Verificar timezone do servidor
4. Limpar cache do navegador

### 2.2 Problemas Comuns do Backend

#### Erro: "Database connection failed"

**Sintomas**:

- API retorna erro 500
- Logs mostram erro de conexão
- Aplicação não inicia

**Diagnóstico**:

```bash
# Testar conexão direta
psql -U brandao_user -d brandao_contador_nfe -h localhost

# Verificar status do PostgreSQL
sudo systemctl status postgresql

# Verificar logs do PostgreSQL
sudo tail -f /var/log/postgresql/postgresql-14-main.log
```

**Soluções**:

1. Verificar credenciais do banco
2. Confirmar que PostgreSQL está rodando
3. Verificar configuração de firewall
4. Testar string de conexão

#### Erro: "Certificate not found" ou "Invalid certificate"

**Sintomas**:

- Emissão de NFe falha
- Erro de assinatura digital
- SEFAZ rejeita requisições

**Diagnóstico**:

```bash
# Verificar certificados
ls -la /var/www/certificates/

# Testar certificado
openssl pkcs12 -info -in certificado.p12 -noout

# Verificar permissões
ls -la /var/www/certificates/
```

**Soluções**:

1. Verificar caminho do certificado
2. Confirmar senha do certificado
3. Verificar validade do certificado
4. Ajustar permissões de arquivo

### 2.3 Problemas de Performance

#### Frontend lento

**Diagnóstico**:

```bash
# Analisar bundle
npm run analyze

# Lighthouse audit
lighthouse https://nfe.brandaocontador.com.br --output html --output-path ./lighthouse-report.html
```

**Soluções**:

1. Implementar lazy loading
2. Otimizar imagens
3. Reduzir bundle size
4. Implementar cache

#### Backend lento

**Diagnóstico**:

```bash
# Monitorar recursos
top
htop
iostat 1

# Analisar queries lentas
psql -U brandao_user -d brandao_contador_nfe
SELECT query, mean_time, calls FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;
```

**Soluções**:

1. Otimizar queries SQL
2. Adicionar índices
3. Implementar cache
4. Aumentar recursos do servidor

## 3. Scripts de Diagnóstico

### 3.1 Script de Health Check Completo

```bash
#!/bin/bash
# scripts/health-check.sh

echo "=== BRANDÃO CONTADOR NFE - HEALTH CHECK ==="
echo "Data: $(date)"
echo

# Verificar serviços
echo "1. Verificando serviços..."
echo "PostgreSQL: $(systemctl is-active postgresql)"
echo "Nginx: $(systemctl is-active nginx)"
echo "PM2: $(pm2 list | grep brandao-contador-api | awk '{print $10}')"
echo

# Verificar conectividade
echo "2. Verificando conectividade..."
echo "Frontend: $(curl -s -o /dev/null -w "%{http_code}" https://nfe.brandaocontador.com.br)"
echo "Backend: $(curl -s -o /dev/null -w "%{http_code}" https://api.brandaocontador.com.br/health)"
echo "Database: $(pg_isready -h localhost -p 5432 -U brandao_user)"
echo

# Verificar recursos
echo "3. Verificando recursos..."
echo "CPU: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | awk -F'%' '{print $1}')%"
echo "RAM: $(free | grep Mem | awk '{printf "%.1f%%", $3/$2 * 100.0}')"
echo "Disk: $(df -h / | awk 'NR==2{printf "%s", $5}')"
echo

# Verificar logs de erro
echo "4. Últimos erros..."
echo "Nginx errors (últimas 5):"
tail -n 5 /var/log/nginx/api.brandaocontador.com.br.error.log
echo
echo "App errors (últimas 5):"
pm2 logs brandao-contador-api --lines 5 --err
echo

# Verificar certificados
echo "5. Verificando certificados..."
echo "SSL expira em: $(openssl x509 -enddate -noout -in /etc/letsencrypt/live/api.brandaocontador.com.br/cert.pem | cut -d= -f2)"
echo "Certificados A1/A3: $(ls -1 /var/www/certificates/*.p12 2>/dev/null | wc -l) encontrados"
echo

echo "=== FIM DO HEALTH CHECK ==="
```

### 3.2 Script de Backup Manual

```bash
#!/bin/bash
# scripts/backup-manual.sh

BACKUP_DIR="/var/backups/brandao-contador"
DATE=$(date +%Y%m%d_%H%M%S)
APP_DIR="/var/www/brandao-contador-api"

echo "Iniciando backup manual - $DATE"

# Criar diretório
mkdir -p $BACKUP_DIR

# Parar aplicação temporariamente
echo "Parando aplicação..."
pm2 stop brandao-contador-api

# Backup do banco
echo "Fazendo backup do banco de dados..."
pg_dump -U brandao_user -h localhost brandao_contador_nfe > $BACKUP_DIR/db_$DATE.sql

# Backup da aplicação
echo "Fazendo backup da aplicação..."
tar -czf $BACKUP_DIR/app_$DATE.tar.gz -C $APP_DIR .

# Backup dos certificados
echo "Fazendo backup dos certificados..."
tar -czf $BACKUP_DIR/certificates_$DATE.tar.gz /var/www/certificates

# Backup dos logs
echo "Fazendo backup dos logs..."
tar -czf $BACKUP_DIR/logs_$DATE.tar.gz /var/log/nginx /var/www/brandao-contador-api/logs

# Reiniciar aplicação
echo "Reiniciando aplicação..."
pm2 start brandao-contador-api

echo "Backup concluído!"
echo "Arquivos criados:"
ls -lh $BACKUP_DIR/*$DATE*
```

### 3.3 Script de Restore

```bash
#!/bin/bash
# scripts/restore.sh

if [ $# -eq 0 ]; then
    echo "Uso: $0 <data_backup>"
    echo "Exemplo: $0 20241201_143000"
    exit 1
fi

BACKUP_DATE=$1
BACKUP_DIR="/var/backups/brandao-contador"
APP_DIR="/var/www/brandao-contador-api"

echo "Iniciando restore do backup $BACKUP_DATE"

# Verificar se arquivos existem
if [ ! -f "$BACKUP_DIR/db_$BACKUP_DATE.sql" ]; then
    echo "Erro: Backup do banco não encontrado!"
    exit 1
fi

if [ ! -f "$BACKUP_DIR/app_$BACKUP_DATE.tar.gz" ]; then
    echo "Erro: Backup da aplicação não encontrado!"
    exit 1
fi

# Confirmar ação
read -p "ATENÇÃO: Isso irá sobrescrever os dados atuais. Continuar? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Restore cancelado."
    exit 1
fi

# Parar aplicação
echo "Parando aplicação..."
pm2 stop brandao-contador-api

# Backup atual antes do restore
echo "Criando backup de segurança..."
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump -U brandao_user -h localhost brandao_contador_nfe > $BACKUP_DIR/pre_restore_db_$DATE.sql
tar -czf $BACKUP_DIR/pre_restore_app_$DATE.tar.gz -C $APP_DIR .

# Restore do banco
echo "Restaurando banco de dados..."
dropdb -U brandao_user -h localhost brandao_contador_nfe
createdb -U brandao_user -h localhost brandao_contador_nfe
psql -U brandao_user -h localhost brandao_contador_nfe < $BACKUP_DIR/db_$BACKUP_DATE.sql

# Restore da aplicação
echo "Restaurando aplicação..."
rm -rf $APP_DIR/*
tar -xzf $BACKUP_DIR/app_$BACKUP_DATE.tar.gz -C $APP_DIR

# Restore dos certificados
if [ -f "$BACKUP_DIR/certificates_$BACKUP_DATE.tar.gz" ]; then
    echo "Restaurando certificados..."
    tar -xzf $BACKUP_DIR/certificates_$BACKUP_DATE.tar.gz -C /
fi

# Reinstalar dependências
echo "Reinstalando dependências..."
cd $APP_DIR
npm install --production

# Reiniciar aplicação
echo "Reiniciando aplicação..."
pm2 start brandao-contador-api

# Verificar status
sleep 5
echo "Verificando status..."
curl -f http://localhost:3001/health

echo "Restore concluído!"
```

## 4. Monitoramento e Alertas

### 4.1 Script de Monitoramento

```bash
#!/bin/bash
# scripts/monitor.sh

# Configurações
ALERT_EMAIL="admin@brandaocontador.com.br"
SLACK_WEBHOOK="https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK"
CPU_THRESHOLD=80
RAM_THRESHOLD=85
DISK_THRESHOLD=90

# Função para enviar alerta
send_alert() {
    local message="$1"
    local severity="$2"

    echo "[$(date)] ALERT [$severity]: $message"

    # Enviar para Slack
    curl -X POST -H 'Content-type: application/json' \
        --data "{\"text\":\"🚨 [$severity] $message\"}" \
        $SLACK_WEBHOOK

    # Enviar email (se configurado)
    echo "$message" | mail -s "[BRANDÃO CONTADOR] Alert [$severity]" $ALERT_EMAIL
}

# Verificar CPU
CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | awk -F'%' '{print $1}' | cut -d'.' -f1)
if [ $CPU_USAGE -gt $CPU_THRESHOLD ]; then
    send_alert "CPU usage is ${CPU_USAGE}% (threshold: ${CPU_THRESHOLD}%)" "HIGH"
fi

# Verificar RAM
RAM_USAGE=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100.0}')
if [ $RAM_USAGE -gt $RAM_THRESHOLD ]; then
    send_alert "RAM usage is ${RAM_USAGE}% (threshold: ${RAM_THRESHOLD}%)" "HIGH"
fi

# Verificar Disk
DISK_USAGE=$(df -h / | awk 'NR==2{print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt $DISK_THRESHOLD ]; then
    send_alert "Disk usage is ${DISK_USAGE}% (threshold: ${DISK_THRESHOLD}%)" "CRITICAL"
fi

# Verificar serviços
if ! systemctl is-active --quiet postgresql; then
    send_alert "PostgreSQL service is down!" "CRITICAL"
fi

if ! systemctl is-active --quiet nginx; then
    send_alert "Nginx service is down!" "CRITICAL"
fi

if ! pm2 list | grep -q "brandao-contador-api.*online"; then
    send_alert "Application is not running!" "CRITICAL"
fi

# Verificar conectividade
if ! curl -f -s http://localhost:3001/health > /dev/null; then
    send_alert "Application health check failed!" "CRITICAL"
fi

# Verificar certificado SSL
SSL_DAYS=$(openssl x509 -enddate -noout -in /etc/letsencrypt/live/api.brandaocontador.com.br/cert.pem | cut -d= -f2 | xargs -I {} date -d "{}" +%s)
CURRENT_DAYS=$(date +%s)
DAYS_LEFT=$(( (SSL_DAYS - CURRENT_DAYS) / 86400 ))

if [ $DAYS_LEFT -lt 30 ]; then
    send_alert "SSL certificate expires in $DAYS_LEFT days!" "HIGH"
fi
```

### 4.2 Configuração de Cron Jobs

```bash
# Editar crontab
crontab -e

# Adicionar as seguintes linhas:

# Backup diário às 2:00 AM
0 2 * * * /var/www/brandao-contador-api/scripts/backup.sh

# Monitoramento a cada 5 minutos
*/5 * * * * /var/www/brandao-contador-api/scripts/monitor.sh

# Health check a cada minuto
* * * * * /var/www/brandao-contador-api/scripts/health-check.sh >> /var/log/health-check.log

# Limpeza de logs antigos (semanal)
0 3 * * 0 find /var/log -name "*.log" -mtime +30 -delete

# Renovação SSL automática
0 12 * * * /usr/bin/certbot renew --quiet

# Restart semanal (domingo às 4:00 AM)
0 4 * * 0 pm2 restart brandao-contador-api
```

Este guia fornece todas as ferramentas necessárias para configurar, monitorar e resolver problemas no sistema NFe de forma eficiente e automatizada.
