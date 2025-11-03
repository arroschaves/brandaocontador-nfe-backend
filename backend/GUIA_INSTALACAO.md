# Guia de Instalação e Configuração
## Sistema NFe Brandão Contador - Backend

### 📋 Índice
1. [Pré-requisitos](#pré-requisitos)
2. [Instalação](#instalação)
3. [Configuração](#configuração)
4. [Certificado Digital](#certificado-digital)
5. [Banco de Dados](#banco-de-dados)
6. [Execução](#execução)
7. [Deploy em Produção](#deploy-em-produção)
8. [Troubleshooting](#troubleshooting)

---

## 🔧 Pré-requisitos

### Sistema Operacional
- **Windows**: Windows 10/11 ou Windows Server 2019+
- **Linux**: Ubuntu 20.04+ ou CentOS 8+
- **macOS**: macOS 10.15+

### Software Necessário
- **Node.js**: Versão 18.x ou superior
- **npm**: Versão 8.x ou superior
- **Git**: Para controle de versão
- **MongoDB**: Versão 5.0+ (opcional, pode usar modo JSON)

### Certificado Digital
- **Certificado A1**: Arquivo .p12/.pfx válido
- **Senha do certificado**: Para desbloqueio
- **Validade**: Certificado deve estar dentro da validade

---

## 📦 Instalação

### 1. Clone o Repositório
```bash
git clone https://github.com/seu-usuario/brandaocontador-nfe.git
cd brandaocontador-nfe/backend
```

### 2. Instale as Dependências
```bash
npm install
```

### 3. Verifique a Instalação
```bash
npm run version
node --version
npm --version
```

---

## ⚙️ Configuração

### 1. Arquivo de Ambiente (.env)

#### Para Desenvolvimento
Crie o arquivo `.env` na raiz do projeto:

```env
# Ambiente
NODE_ENV=development
SIMULATION_MODE=true
DEBUG_MODE=true
PORT=3001

# Modo de Operação
APP_MODE=simple
USE_MONGODB=false

# Segurança
JWT_SECRET=seu_jwt_secret_super_seguro_aqui

# Admin Seed
ADMIN_EMAIL=admin@brandaocontador.com.br
ADMIN_PASSWORD=admin123
ADMIN_NAME=Administrador

# NFe - Simulação
NFE_AMBIENTE=homologacao
NFE_UF=SP
NFE_CERT_PATH=./certificados/certificado.p12
NFE_CERT_PASSWORD=senha_do_certificado

# Logs
LOG_LEVEL=debug

# CORS
CORS_ORIGIN=http://localhost:3000
```

#### Para Produção
Crie o arquivo `.env.producao`:

```env
# Ambiente
NODE_ENV=production
SIMULATION_MODE=false
DEBUG_MODE=false
PORT=3001

# Modo de Operação
APP_MODE=full
USE_MONGODB=true

# MongoDB
MONGODB_URI=mongodb://localhost:27017/nfe_brandao
MONGODB_DB_NAME=nfe_brandao

# Segurança
JWT_SECRET=jwt_secret_producao_muito_seguro
JWT_EXPIRES_IN=24h

# Admin
ADMIN_EMAIL=admin@brandaocontador.com.br
ADMIN_PASSWORD=senha_segura_producao
ADMIN_NAME=Administrador Sistema

# NFe - Produção
NFE_AMBIENTE=producao
NFE_UF=SP
NFE_CERT_PATH=/opt/certificados/certificado.p12
NFE_CERT_PASSWORD=senha_certificado_producao

# Logs
LOG_LEVEL=info
LOG_FILE=/var/log/nfe-backend/app.log

# CORS
CORS_ORIGIN=https://nfe.brandaocontador.com.br

# Rate Limiting
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=100

# Health Check
HEALTH_CHECK_ENABLED=true
METRICS_ENABLED=true
```

### 2. Estrutura de Diretórios

Crie os diretórios necessários:

```bash
# Windows
mkdir certificados
mkdir data
mkdir logs
mkdir xmls\enviadas
mkdir xmls\falhas

# Linux/macOS
mkdir -p certificados
mkdir -p data
mkdir -p logs
mkdir -p xmls/{enviadas,falhas}
```

---

## 🔐 Certificado Digital

### 1. Obtenção do Certificado
- Adquira um certificado A1 de uma Autoridade Certificadora credenciada
- Faça o download do arquivo .p12/.pfx
- Anote a senha do certificado

### 2. Instalação do Certificado

#### Método 1: Arquivo Local
```bash
# Copie o certificado para o diretório
cp seu_certificado.p12 ./certificados/certificado.p12
```

#### Método 2: Variável de Ambiente
```env
NFE_CERT_PATH=./certificados/certificado.p12
NFE_CERT_PASSWORD=sua_senha_aqui
```

### 3. Validação do Certificado
```bash
# Teste o certificado
npm run test:certificado
```

---

## 🗄️ Banco de Dados

### Modo Simples (JSON)
Para desenvolvimento ou pequenas operações:

```env
APP_MODE=simple
USE_MONGODB=false
```

### Modo Completo (MongoDB)

#### 1. Instalação do MongoDB

**Windows:**
```bash
# Baixe e instale do site oficial
# https://www.mongodb.com/try/download/community
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install -y mongodb
sudo systemctl start mongodb
sudo systemctl enable mongodb
```

**CentOS/RHEL:**
```bash
sudo yum install -y mongodb-server
sudo systemctl start mongod
sudo systemctl enable mongod
```

#### 2. Configuração do MongoDB
```env
APP_MODE=full
USE_MONGODB=true
MONGODB_URI=mongodb://localhost:27017/nfe_brandao
MONGODB_DB_NAME=nfe_brandao
```

#### 3. Inicialização do Banco
```bash
# Criar usuário admin
npm run seed:users

# Limpar dados (se necessário)
npm run limpar-banco
```

---

## 🚀 Execução

### Desenvolvimento
```bash
# Modo desenvolvimento com hot-reload
npm run dev

# Modo desenvolvimento normal
npm start
```

### Produção
```bash
# Usando PM2
npm install -g pm2
npm run start:prod

# Ou diretamente
NODE_ENV=production npm start
```

### Scripts Disponíveis
```bash
# Desenvolvimento
npm run dev              # Servidor com nodemon
npm start               # Servidor normal
npm run debug           # Modo debug

# Produção
npm run start:prod      # PM2 produção
npm run stop:prod       # Parar PM2
npm run restart:prod    # Reiniciar PM2

# Manutenção
npm run limpar-banco    # Limpar dados
npm run seed:users      # Criar usuários
npm run backup          # Backup dados
npm run restore         # Restaurar backup

# Testes
npm test               # Executar testes
npm run test:coverage  # Cobertura de testes
npm run test:certificado # Testar certificado
```

---

## 🌐 Deploy em Produção

### 1. Preparação do Servidor

#### Instalar Dependências
```bash
# Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# PM2
sudo npm install -g pm2

# Nginx
sudo apt update
sudo apt install nginx

# Certbot (SSL)
sudo apt install certbot python3-certbot-nginx
```

#### Configurar Firewall
```bash
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

### 2. Deploy da Aplicação

#### Clone e Configuração
```bash
cd /opt
sudo git clone https://github.com/seu-usuario/brandaocontador-nfe.git
cd brandaocontador-nfe/backend
sudo npm install --production
```

#### Configurar Ambiente
```bash
sudo cp .env.producao .env
sudo nano .env  # Ajustar configurações
```

#### Iniciar com PM2
```bash
sudo pm2 start ecosystem.production.js
sudo pm2 startup
sudo pm2 save
```

### 3. Configurar Nginx

#### Arquivo de Configuração
```nginx
server {
    listen 80;
    server_name nfe.brandaocontador.com.br;
    
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
}
```

#### Configurar SSL
```bash
sudo certbot --nginx -d nfe.brandaocontador.com.br
```

### 4. Monitoramento

#### Logs
```bash
# PM2 logs
pm2 logs

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Sistema
sudo journalctl -u nginx -f
```

#### Health Check
```bash
curl http://localhost:3001/health
curl https://nfe.brandaocontador.com.br/health
```

---

## 🔧 Troubleshooting

### Problemas Comuns

#### 1. Erro de Certificado
```
Erro: PKCS#12 MAC could not be verified
```
**Solução:**
- Verifique a senha do certificado
- Confirme o caminho do arquivo
- Teste com openssl: `openssl pkcs12 -info -in certificado.p12`

#### 2. Erro de Conexão MongoDB
```
Erro: ECONNREFUSED 127.0.0.1:27017
```
**Solução:**
- Verifique se MongoDB está rodando: `sudo systemctl status mongod`
- Inicie o serviço: `sudo systemctl start mongod`
- Verifique a URI de conexão

#### 3. Porta em Uso
```
Erro: EADDRINUSE :::3001
```
**Solução:**
```bash
# Encontrar processo
netstat -tulpn | grep :3001
# ou
lsof -i :3001

# Matar processo
kill -9 PID
```

#### 4. Permissões de Arquivo
```bash
# Ajustar permissões
sudo chown -R $USER:$USER /opt/brandaocontador-nfe
sudo chmod -R 755 /opt/brandaocontador-nfe
sudo chmod 600 certificados/*
```

### Logs de Debug

#### Habilitar Debug
```env
DEBUG_MODE=true
LOG_LEVEL=debug
```

#### Verificar Logs
```bash
# Logs da aplicação
tail -f logs/app.log

# Logs do PM2
pm2 logs --lines 100

# Logs do sistema
sudo journalctl -f
```

### Comandos Úteis

#### Verificar Status
```bash
# Aplicação
curl http://localhost:3001/health

# PM2
pm2 status

# Nginx
sudo nginx -t
sudo systemctl status nginx

# MongoDB
mongo --eval "db.adminCommand('ismaster')"
```

#### Reiniciar Serviços
```bash
# Aplicação
pm2 restart all

# Nginx
sudo systemctl restart nginx

# MongoDB
sudo systemctl restart mongod
```

---

## 📞 Suporte

### Contatos
- **Email**: suporte@brandaocontador.com.br
- **Telefone**: (11) 99999-9999
- **Documentação**: https://docs.brandaocontador.com.br

### Links Úteis
- [Documentação da API](http://localhost:3001/api-docs)
- [Status do Sistema](http://localhost:3001/health)
- [Métricas](http://localhost:3001/metrics)
- [Receita Federal - NFe](http://www.nfe.fazenda.gov.br/)

---

*Última atualização: 25/10/2024*