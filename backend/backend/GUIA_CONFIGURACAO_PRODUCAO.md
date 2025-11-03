# 🚀 GUIA DE CONFIGURAÇÃO PARA PRODUÇÃO

## 📋 Pré-requisitos

Antes de colocar o sistema em produção, certifique-se de ter:

- ✅ **Node.js 18+** instalado
- ✅ **MongoDB** configurado (local ou Atlas)
- ✅ **Certificado Digital A1** válido (.pfx)
- ✅ **Servidor Linux/Windows** com acesso à internet
- ✅ **Domínio** com certificado SSL/TLS

---

## 🔧 1. CONFIGURAÇÃO DO AMBIENTE

### 📁 Estrutura de Diretórios
```
/opt/nfe-backend/          # Diretório principal
├── app.js                 # Aplicação principal
├── package.json           # Dependências
├── .env                   # Variáveis de ambiente
├── certs/                 # Certificados digitais
│   └── certificado.pfx    # Certificado A1
├── logs/                  # Logs do sistema
├── xmls/                  # XMLs das NFe
│   ├── enviadas/          # NFe enviadas com sucesso
│   └── falhas/            # NFe com erro
└── backup/                # Backups automáticos
```

### 🔐 Variáveis de Ambiente (.env)
```env
# ==================== AMBIENTE ====================
NODE_ENV=production
PORT=3000
SIMULATION_MODE=false

# ==================== BANCO DE DADOS ====================
MONGODB_URI=mongodb://localhost:27017/nfe_production
# OU para MongoDB Atlas:
# MONGODB_URI=mongodb+srv://usuario:senha@cluster.mongodb.net/nfe_production

# ==================== CERTIFICADO DIGITAL ====================
CERT_PATH=./certs/certificado-producao.pfx
CERT_PASS=senha_do_certificado

# ==================== EMITENTE ====================
UF=MS
CNPJ_EMITENTE=12345678000199
AMBIENTE=1

# ==================== SEGURANÇA ====================
JWT_SECRET=chave_secreta_muito_forte_aqui
CORS_ORIGIN=https://seudominio.com.br
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100

# ==================== SEFAZ ====================
SEFAZ_TIMEOUT=30000
SEFAZ_RETRY_ATTEMPTS=3

# ==================== LOGS ====================
LOG_LEVEL=info
LOG_FILE=./logs/nfe-backend.log

# ==================== BACKUP ====================
BACKUP_ENABLED=true
BACKUP_INTERVAL=86400000
BACKUP_RETENTION_DAYS=30

# ==================== MONITORAMENTO ====================
HEALTH_CHECK_ENABLED=true
METRICS_ENABLED=true
APM_ENABLED=true

# ==================== EMAIL (OPCIONAL) ====================
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seu-email@gmail.com
SMTP_PASS=sua-senha-app
```

---

## 🗄️ 2. CONFIGURAÇÃO DO MONGODB

### 🐳 Opção 1: MongoDB Local com Docker
```bash
# Criar volume persistente
docker volume create mongodb_data

# Executar MongoDB
docker run -d \
  --name mongodb-nfe \
  --restart unless-stopped \
  -p 27017:27017 \
  -v mongodb_data:/data/db \
  -e MONGO_INITDB_ROOT_USERNAME=admin \
  -e MONGO_INITDB_ROOT_PASSWORD=senha_forte \
  mongo:7.0

# Criar usuário para a aplicação
docker exec -it mongodb-nfe mongosh --eval "
use nfe_production
db.createUser({
  user: 'nfe_user',
  pwd: 'senha_nfe_user',
  roles: [{ role: 'readWrite', db: 'nfe_production' }]
})
"
```

### ☁️ Opção 2: MongoDB Atlas (Recomendado)
1. Acesse [MongoDB Atlas](https://cloud.mongodb.com)
2. Crie um cluster gratuito
3. Configure o usuário e senha
4. Adicione o IP do servidor na whitelist
5. Copie a string de conexão para `MONGODB_URI`

### 🔧 Configuração de Índices
```javascript
// Execute no MongoDB para otimizar performance
use nfe_production

// Índices para coleção de usuários
db.usuarios.createIndex({ "email": 1 }, { unique: true })
db.usuarios.createIndex({ "documento": 1 }, { unique: true })
db.usuarios.createIndex({ "ativo": 1 })

// Índices para coleção de clientes
db.clientes.createIndex({ "documento": 1 }, { unique: true })
db.clientes.createIndex({ "nome": 1 })
db.clientes.createIndex({ "ativo": 1 })
db.clientes.createIndex({ "usuarioId": 1 })

// Índices para coleção de produtos
db.produtos.createIndex({ "codigo": 1 }, { unique: true, sparse: true })
db.produtos.createIndex({ "nome": 1 })
db.produtos.createIndex({ "ativo": 1 })
db.produtos.createIndex({ "usuarioId": 1 })

// Índices para coleção de NFe
db.nfes.createIndex({ "chaveAcesso": 1 }, { unique: true })
db.nfes.createIndex({ "numero": 1, "serie": 1 })
db.nfes.createIndex({ "dataEmissao": -1 })
db.nfes.createIndex({ "status": 1 })
```

---

## 🔐 3. CONFIGURAÇÃO DO CERTIFICADO DIGITAL

### 📋 Requisitos do Certificado
- **Tipo**: A1 (.pfx)
- **Validade**: Mínimo 6 meses
- **Emitido para**: CNPJ do emitente
- **Autoridade**: AC válida (Serasa, Certisign, etc.)

### 📁 Instalação do Certificado
```bash
# Criar diretório para certificados
mkdir -p /opt/nfe-backend/certs

# Copiar certificado (substitua pelo seu arquivo)
cp certificado-producao.pfx /opt/nfe-backend/certs/

# Definir permissões seguras
chmod 600 /opt/nfe-backend/certs/certificado-producao.pfx
chown nfe-user:nfe-user /opt/nfe-backend/certs/certificado-producao.pfx
```

### ✅ Validação do Certificado
```bash
# Testar carregamento do certificado
openssl pkcs12 -in certificado-producao.pfx -noout -info
```

---

## 🚀 4. INSTALAÇÃO E DEPLOY

### 📦 Instalação das Dependências
```bash
# Navegar para o diretório
cd /opt/nfe-backend

# Instalar dependências
npm ci --production

# Verificar instalação
npm audit
```

### 🔧 Configuração do PM2 (Process Manager)
```bash
# Instalar PM2 globalmente
npm install -g pm2

# Criar arquivo de configuração
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'nfe-backend',
    script: 'app.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024',
    watch: false,
    ignore_watch: ['node_modules', 'logs', 'xmls'],
    restart_delay: 5000,
    max_restarts: 10,
    min_uptime: '10s'
  }]
}
EOF

# Iniciar aplicação
pm2 start ecosystem.config.js

# Configurar inicialização automática
pm2 startup
pm2 save
```

---

## 🌐 5. CONFIGURAÇÃO DO NGINX (PROXY REVERSO)

### 📝 Configuração do Nginx
```nginx
# /etc/nginx/sites-available/nfe-backend
server {
    listen 80;
    server_name api.seudominio.com.br;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.seudominio.com.br;

    # Certificado SSL
    ssl_certificate /etc/letsencrypt/live/api.seudominio.com.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.seudominio.com.br/privkey.pem;
    
    # Configurações SSL
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Headers de segurança
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Configurações de proxy
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Tamanho máximo do body
        client_max_body_size 10M;
    }

    # Logs
    access_log /var/log/nginx/nfe-backend-access.log;
    error_log /var/log/nginx/nfe-backend-error.log;
}
```

### 🔧 Ativar Configuração
```bash
# Ativar site
ln -s /etc/nginx/sites-available/nfe-backend /etc/nginx/sites-enabled/

# Testar configuração
nginx -t

# Recarregar Nginx
systemctl reload nginx
```

---

## 🔒 6. CONFIGURAÇÃO DE SEGURANÇA

### 🛡️ Firewall (UFW)
```bash
# Configurar firewall
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

### 👤 Usuário do Sistema
```bash
# Criar usuário específico
useradd -r -s /bin/false nfe-user
chown -R nfe-user:nfe-user /opt/nfe-backend
chmod -R 750 /opt/nfe-backend
```

### 🔐 Backup Automático
```bash
# Script de backup
cat > /opt/nfe-backend/scripts/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/nfe-backend/backup"
DATE=$(date +%Y%m%d_%H%M%S)

# Criar diretório de backup
mkdir -p $BACKUP_DIR

# Backup do MongoDB
mongodump --uri="$MONGODB_URI" --out="$BACKUP_DIR/mongodb_$DATE"

# Backup dos XMLs
tar -czf "$BACKUP_DIR/xmls_$DATE.tar.gz" /opt/nfe-backend/xmls/

# Backup dos logs
tar -czf "$BACKUP_DIR/logs_$DATE.tar.gz" /opt/nfe-backend/logs/

# Remover backups antigos (30 dias)
find $BACKUP_DIR -type f -mtime +30 -delete

echo "Backup concluído: $DATE"
EOF

chmod +x /opt/nfe-backend/scripts/backup.sh

# Configurar cron para backup diário
echo "0 2 * * * /opt/nfe-backend/scripts/backup.sh" | crontab -
```

---

## 📊 7. MONITORAMENTO E LOGS

### 📝 Configuração de Logs
```bash
# Configurar logrotate
cat > /etc/logrotate.d/nfe-backend << 'EOF'
/opt/nfe-backend/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 nfe-user nfe-user
    postrotate
        pm2 reload nfe-backend
    endscript
}
EOF
```

### 📊 Monitoramento com PM2
```bash
# Instalar PM2 Plus (opcional)
pm2 install pm2-server-monit

# Visualizar métricas
pm2 monit

# Logs em tempo real
pm2 logs nfe-backend
```

---

## 🧪 8. TESTES DE PRODUÇÃO

### ✅ Checklist de Validação
```bash
# 1. Verificar status da aplicação
curl -f http://localhost:3000/health

# 2. Testar autenticação
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@teste.com","senha":"admin123"}'

# 3. Verificar conectividade SEFAZ
curl -f http://localhost:3000/api/sefaz/status

# 4. Testar emissão (ambiente de homologação primeiro)
# Configure AMBIENTE=2 no .env para testes

# 5. Verificar logs
tail -f /opt/nfe-backend/logs/nfe-backend.log
```

### 🔍 Monitoramento Contínuo
```bash
# Script de monitoramento
cat > /opt/nfe-backend/scripts/monitor.sh << 'EOF'
#!/bin/bash

# Verificar se a aplicação está rodando
if ! pm2 list | grep -q "nfe-backend.*online"; then
    echo "ALERTA: Aplicação NFe Backend não está rodando!"
    pm2 restart nfe-backend
fi

# Verificar uso de memória
MEMORY_USAGE=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100.0}')
if [ $MEMORY_USAGE -gt 80 ]; then
    echo "ALERTA: Uso de memória alto: ${MEMORY_USAGE}%"
fi

# Verificar espaço em disco
DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
    echo "ALERTA: Espaço em disco baixo: ${DISK_USAGE}%"
fi

# Verificar conectividade MongoDB
if ! mongosh --eval "db.runCommand('ping')" > /dev/null 2>&1; then
    echo "ALERTA: MongoDB não está respondendo!"
fi
EOF

chmod +x /opt/nfe-backend/scripts/monitor.sh

# Executar a cada 5 minutos
echo "*/5 * * * * /opt/nfe-backend/scripts/monitor.sh" | crontab -
```

---

## 🚨 9. TROUBLESHOOTING

### ❌ Problemas Comuns

#### 🔐 Erro de Certificado
```bash
# Verificar certificado
openssl pkcs12 -in certificado.pfx -noout -info

# Verificar permissões
ls -la /opt/nfe-backend/certs/
```

#### 🗄️ Erro de Conexão MongoDB
```bash
# Verificar status
systemctl status mongod

# Testar conexão
mongosh "mongodb://localhost:27017/nfe_production"
```

#### 🌐 Erro de Conectividade SEFAZ
```bash
# Testar conectividade
curl -v https://nfe.sefaz.ms.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx

# Verificar DNS
nslookup nfe.sefaz.ms.gov.br
```

#### 📊 Alto Uso de Memória
```bash
# Verificar processos
pm2 monit

# Reiniciar aplicação
pm2 restart nfe-backend

# Verificar logs
pm2 logs nfe-backend --lines 100
```

---

## 📞 10. SUPORTE E MANUTENÇÃO

### 🔧 Comandos Úteis
```bash
# Status geral
pm2 status
systemctl status nginx
systemctl status mongod

# Logs
pm2 logs nfe-backend
tail -f /var/log/nginx/nfe-backend-error.log
tail -f /opt/nfe-backend/logs/nfe-backend.log

# Reiniciar serviços
pm2 restart nfe-backend
systemctl restart nginx
systemctl restart mongod

# Backup manual
/opt/nfe-backend/scripts/backup.sh

# Monitoramento
pm2 monit
htop
df -h
free -h
```

### 📋 Manutenção Periódica
- **Diária**: Verificar logs e status
- **Semanal**: Verificar backups e espaço em disco
- **Mensal**: Atualizar dependências e certificados
- **Trimestral**: Revisar configurações de segurança

---

## ✅ CHECKLIST FINAL

- [ ] MongoDB configurado e rodando
- [ ] Certificado digital instalado e válido
- [ ] Variáveis de ambiente configuradas
- [ ] PM2 configurado e rodando
- [ ] Nginx configurado com SSL
- [ ] Firewall configurado
- [ ] Backup automático configurado
- [ ] Monitoramento ativo
- [ ] Logs configurados
- [ ] Testes de conectividade realizados
- [ ] Documentação atualizada

**🎯 Status**: ✅ **PRONTO PARA PRODUÇÃO**