# 🚀 Guia Completo de Deploy - CONTABO

## 📋 Visão Geral

Este documento fornece um guia completo para deploy do sistema NFe no servidor CONTABO, incluindo configuração inicial, deploy automático e monitoramento.

## 🌐 Informações do Servidor

### Servidor CONTABO
- **IP:** 147.93.186.214
- **Sistema:** Ubuntu 24.04.3 LTS
- **Porta SSH:** 22
- **Usuário:** root
- **RAM:** 4GB
- **Storage:** SSD
- **Localização:** Europa

### URLs de Acesso
- **API Backend:** https://api.brandaocontador.com.br
- **Frontend:** https://brandaocontador.com.br
- **Painel Admin:** https://brandaocontador.com.br/admin

## 🔧 Configuração Inicial do Servidor

### 1. Preparação do Sistema

```bash
# Conectar ao servidor
ssh root@147.93.186.214

# Atualizar sistema
apt update && apt upgrade -y

# Instalar dependências básicas
apt install -y curl wget git nginx certbot python3-certbot-nginx
```

### 2. Instalação do Node.js 22.x

```bash
# Adicionar repositório NodeSource
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -

# Instalar Node.js
apt-get install -y nodejs

# Verificar instalação
node --version  # Deve mostrar v22.x.x
npm --version
```

### 3. Instalação e Configuração do PM2

```bash
# Instalar PM2 globalmente
npm install -g pm2

# Configurar PM2 para iniciar no boot
pm2 startup
# Executar o comando que aparecer na saída

# Salvar configuração atual
pm2 save
```

### 4. Configuração de Diretórios

```bash
# Criar estrutura de diretórios
mkdir -p /var/www/brandaocontador-nfe-backend
mkdir -p /var/backups/brandaocontador-nfe-backend
mkdir -p /var/log/nfe

# Configurar permissões
chmod 755 /var/www/brandaocontador-nfe-backend
chmod 755 /var/backups/brandaocontador-nfe-backend
```

## 🔐 Configuração de Segurança

### 1. Firewall (UFW)

```bash
# Habilitar UFW
ufw enable

# Permitir SSH
ufw allow 22/tcp

# Permitir HTTP e HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# Permitir porta da aplicação (apenas localhost)
ufw allow from 127.0.0.1 to any port 3000

# Verificar status
ufw status
```

### 2. Configuração SSH (Opcional - Melhor Segurança)

```bash
# Editar configuração SSH
nano /etc/ssh/sshd_config

# Adicionar/modificar:
# PermitRootLogin yes
# PasswordAuthentication yes
# Port 22

# Reiniciar SSH
systemctl restart ssh
```

## 🌐 Configuração do Nginx

### 1. Configuração do Site

```bash
# Criar configuração do site
nano /etc/nginx/sites-available/nfe-backend
```

```nginx
server {
    listen 80;
    server_name api.brandaocontador.com.br;

    # Logs
    access_log /var/log/nginx/nfe-backend.access.log;
    error_log /var/log/nginx/nfe-backend.error.log;

    # Proxy para aplicação Node.js
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Arquivos estáticos (se houver)
    location /static/ {
        alias /var/www/brandaocontador-nfe-backend/public/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Health check
    location /health {
        proxy_pass http://127.0.0.1:3000/api/health;
        access_log off;
    }
}
```

### 2. Ativar Site

```bash
# Criar link simbólico
ln -s /etc/nginx/sites-available/nfe-backend /etc/nginx/sites-enabled/

# Remover site padrão
rm /etc/nginx/sites-enabled/default

# Testar configuração
nginx -t

# Reiniciar Nginx
systemctl restart nginx
systemctl enable nginx
```

### 3. Configurar SSL com Let's Encrypt

```bash
# Obter certificado SSL
certbot --nginx -d api.brandaocontador.com.br

# Configurar renovação automática
crontab -e
# Adicionar linha:
# 0 12 * * * /usr/bin/certbot renew --quiet
```

## 📊 Sistema de Database JSON

### Estrutura de Dados

O sistema utiliza 100% arquivos JSON para persistência:

```bash
# Estrutura de dados
/var/www/brandaocontador-nfe-backend/data/
├── clientes.json          # Dados dos clientes
├── configuracoes.json     # Configurações do sistema
├── database.json          # Base de dados principal
├── logs.json             # Logs do sistema
├── nfes.json             # Notas fiscais emitidas
├── produtos.json         # Cadastro de produtos
└── usuarios.json         # Usuários do sistema
```

### Backup Automático dos Dados JSON

```bash
# Criar script de backup
nano /usr/local/bin/backup-nfe-data.sh
```

```bash
#!/bin/bash
# Backup dos dados JSON do sistema NFe

BACKUP_DIR="/var/backups/brandaocontador-nfe-backend"
DATA_DIR="/var/www/brandaocontador-nfe-backend/data"
DATE=$(date +%Y%m%d_%H%M%S)

# Criar diretório de backup
mkdir -p "$BACKUP_DIR/data_$DATE"

# Copiar arquivos JSON
cp -r "$DATA_DIR"/* "$BACKUP_DIR/data_$DATE/"

# Compactar backup
cd "$BACKUP_DIR"
tar -czf "data_backup_$DATE.tar.gz" "data_$DATE"
rm -rf "data_$DATE"

# Manter apenas últimos 30 backups
ls -t data_backup_*.tar.gz | tail -n +31 | xargs -r rm

echo "Backup concluído: data_backup_$DATE.tar.gz"
```

```bash
# Tornar executável
chmod +x /usr/local/bin/backup-nfe-data.sh

# Configurar cron para backup diário
crontab -e
# Adicionar linha:
# 0 2 * * * /usr/local/bin/backup-nfe-data.sh
```

## 🚀 Deploy Manual (Primeira Vez)

### 1. Clone do Repositório

```bash
# Ir para diretório de deploy
cd /var/www

# Clonar repositório
git clone https://github.com/arroschaves/brandaocontador-nfe-backend.git

# Entrar no diretório
cd brandaocontador-nfe-backend
```

### 2. Configuração da Aplicação

```bash
# Instalar dependências
npm install --production

# Criar arquivo .env
cp .env.example .env
nano .env
```

```env
# Configurações de produção
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# JWT
JWT_SECRET=seu_jwt_secret_super_seguro_aqui

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Database
DATABASE_TYPE=json

# NFe
NFE_AMBIENTE=1
NFE_UF=35
NFE_CODIGO_MUNICIPIO=3550308

# Logs
LOG_LEVEL=info

# Admin
ADMIN_EMAIL=admin@brandaocontador.com.br
ADMIN_PASSWORD=senha_super_segura

# CORS
ALLOWED_ORIGINS=https://brandaocontador.com.br,https://www.brandaocontador.com.br

# Monitoring
ENABLE_MONITORING=true

# Cache
CACHE_TTL=3600
```

### 3. Inicialização com PM2

```bash
# Verificar se ecosystem.config.js existe
ls -la ecosystem.config.js

# Iniciar aplicação
pm2 start ecosystem.config.js --env production

# Salvar configuração
pm2 save

# Verificar status
pm2 list
pm2 logs nfe-backend
```

## 🔄 Deploy Automático via GitHub Actions

### Configuração dos Secrets

No repositório GitHub, configure o secret:
- `CONTABO_SSH_PASSWORD`: Senha SSH do servidor

### Processo Automático

O deploy é executado automaticamente quando:
1. Há push na branch `main`
2. Arquivos na pasta `backend/` são modificados
3. O arquivo `ecosystem.config.js` é modificado

### Fluxo do Deploy Automático

1. **Testes e Validação**
   - Verificação de sintaxe
   - Validação dos arquivos JSON
   - Verificação da estrutura

2. **Deploy no Servidor**
   - Backup automático
   - Transferência de arquivos
   - Instalação de dependências
   - Reinício da aplicação

3. **Verificação de Saúde**
   - Teste do PM2
   - Verificação da API
   - Validação da estrutura JSON

## 📊 Monitoramento e Logs

### 1. Monitoramento da Aplicação

```bash
# Status PM2
pm2 list
pm2 monit

# Logs da aplicação
pm2 logs nfe-backend
pm2 logs nfe-backend --lines 100

# Reiniciar aplicação
pm2 restart nfe-backend

# Recarregar aplicação
pm2 reload nfe-backend
```

### 2. Monitoramento do Sistema

```bash
# Uso de recursos
htop
df -h
free -h

# Logs do sistema
journalctl -u nginx
journalctl -f

# Logs do Nginx
tail -f /var/log/nginx/nfe-backend.access.log
tail -f /var/log/nginx/nfe-backend.error.log
```

### 3. Health Checks

```bash
# Teste da API
curl http://localhost:3000/api/health
curl https://api.brandaocontador.com.br/api/health

# Teste de conectividade
netstat -tlnp | grep :3000
ss -tlnp | grep :3000
```

## 🚨 Troubleshooting

### Problemas Comuns

#### 1. Aplicação não inicia
```bash
# Verificar logs
pm2 logs nfe-backend --lines 50

# Verificar dependências
cd /var/www/brandaocontador-nfe-backend
npm install --production

# Verificar arquivo .env
cat .env
```

#### 2. Erro 502 Bad Gateway
```bash
# Verificar se aplicação está rodando
pm2 list

# Verificar porta
netstat -tlnp | grep :3000

# Reiniciar aplicação
pm2 restart nfe-backend

# Verificar logs do Nginx
tail -f /var/log/nginx/nfe-backend.error.log
```

#### 3. Problemas com SSL
```bash
# Verificar certificado
certbot certificates

# Renovar certificado
certbot renew

# Testar configuração Nginx
nginx -t
```

#### 4. Problemas com Arquivos JSON
```bash
# Verificar estrutura de dados
cd /var/www/brandaocontador-nfe-backend
ls -la data/

# Verificar permissões
chmod 644 data/*.json

# Recriar arquivos se necessário
echo "[]" > data/clientes.json
```

### Comandos de Emergência

```bash
# Parar tudo
pm2 stop all

# Reiniciar tudo
pm2 restart all

# Recarregar configuração PM2
pm2 reload ecosystem.config.js

# Limpar logs PM2
pm2 flush

# Restaurar backup
cd /var/backups/brandaocontador-nfe-backend
tar -xzf data_backup_YYYYMMDD_HHMMSS.tar.gz
cp -r data_YYYYMMDD_HHMMSS/* /var/www/brandaocontador-nfe-backend/data/
```

## 📈 Otimizações de Performance

### 1. Configuração do PM2

```javascript
// ecosystem.config.js otimizado
module.exports = {
  apps: [{
    name: 'nfe-backend',
    script: 'app.js',
    instances: 2, // Usar 2 instâncias
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    max_memory_restart: '1G',
    error_file: '/var/log/nfe/error.log',
    out_file: '/var/log/nfe/out.log',
    log_file: '/var/log/nfe/combined.log',
    time: true
  }]
};
```

### 2. Configuração do Nginx

```nginx
# Otimizações no nginx
server {
    # ... configurações anteriores ...
    
    # Compressão
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    
    # Cache de arquivos estáticos
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Limites de upload
    client_max_body_size 10M;
}
```

## 📞 Suporte e Contatos

### Informações Técnicas
- **Desenvolvedor:** arroschaves
- **Email:** professormatms@bo.com.br
- **Repositório:** https://github.com/arroschaves/brandaocontador-nfe-backend

### Servidor CONTABO
- **IP:** 147.93.186.214
- **Sistema:** Ubuntu 24.04.3 LTS
- **Localização:** Europa
- **Suporte CONTABO:** https://contabo.com/support/

---

## ✅ Checklist de Deploy

### Configuração Inicial
- [ ] Servidor CONTABO configurado
- [ ] Node.js 22.x instalado
- [ ] PM2 instalado e configurado
- [ ] Nginx configurado
- [ ] SSL configurado
- [ ] Firewall configurado
- [ ] Diretórios criados

### Deploy
- [ ] Repositório clonado
- [ ] Dependências instaladas
- [ ] Arquivo .env configurado
- [ ] Aplicação iniciada com PM2
- [ ] GitHub Actions configurado
- [ ] Backup automático configurado

### Monitoramento
- [ ] Health checks funcionando
- [ ] Logs configurados
- [ ] Monitoramento ativo
- [ ] Alertas configurados

**🎉 Sistema NFe 100% operacional na CONTABO!**