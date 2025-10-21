# 🚀 Guia Completo de Deploy - Sistema NFe

Este guia fornece instruções detalhadas para fazer deploy do Sistema NFe em GitHub, Vercel e DigitalOcean com automação completa.

## 📋 Pré-requisitos

### Ferramentas Necessárias
- [Node.js](https://nodejs.org/) (v18 ou superior)
- [Git](https://git-scm.com/)
- [Docker](https://www.docker.com/) (para DigitalOcean)
- [Docker Compose](https://docs.docker.com/compose/)

### Contas Necessárias
- [GitHub](https://github.com/) - Para repositório e CI/CD
- [Vercel](https://vercel.com/) - Para deploy do frontend
- [DigitalOcean](https://www.digitalocean.com/) - Para deploy do backend

## 🎯 Deploy One-Click

### Opção 1: Script Automático (Recomendado)

```bash
# Torna o script executável
chmod +x deploy.sh

# Executa o deploy completo
./deploy.sh
```

O script automático irá:
1. ✅ Verificar pré-requisitos
2. ✅ Configurar arquivos de ambiente
3. ✅ Configurar SSL
4. ✅ Executar testes
5. ✅ Fazer push para GitHub
6. ✅ Deploy no Vercel
7. ✅ Configurar DigitalOcean

Observação:
- Instalação de dependências: em produção, preferir `npm ci --omit=dev`; evitar `npm config set jobs` (incompatível em npm moderno).

### Opção 2: Deploy Manual

Siga as seções abaixo para deploy manual passo a passo.

## 🔧 Configuração Inicial

### 1. Configurar Variáveis de Ambiente

```bash
# Copiar arquivo de exemplo
cp .env.example .env

# Editar com suas configurações
nano .env
```

**Variáveis Obrigatórias:**
```env
# Database
DATABASE_URL=postgresql://user:pass@host:5432/db
POSTGRES_PASSWORD=sua_senha_segura

# JWT
JWT_SECRET=sua_chave_jwt_super_secreta_32_chars

# SEFAZ
SEFAZ_AMBIENTE=homologacao
CERT_PASSWORD=senha_do_certificado

# URLs
FRONTEND_URL=https://seu-dominio.vercel.app
BACKEND_URL=https://seu-backend.com
```

### 2. Configurar Certificados SSL

```bash
# Criar diretório
mkdir -p nginx/ssl

# Gerar certificado auto-assinado (desenvolvimento)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/key.pem \
  -out nginx/ssl/cert.pem

# Para produção, use Let's Encrypt
sudo certbot --nginx -d seu-dominio.com
```

## 🐙 GitHub Setup

### 1. Criar Repositório

```bash
# Inicializar git (se necessário)
git init

# Adicionar remote
git remote add origin https://github.com/SEU_USUARIO/nfe-system.git

# Fazer primeiro commit
git add .
git commit -m "feat: initial deployment setup"
git push -u origin main
```

### 2. Configurar GitHub Secrets

Vá para `Settings > Secrets and variables > Actions` e adicione:

```
VERCEL_TOKEN=seu_token_vercel
VERCEL_ORG_ID=seu_org_id
VERCEL_PROJECT_ID=seu_project_id
DO_HOST=ip_do_seu_droplet
DO_USERNAME=usuario_digitalocean
DO_SSH_KEY=sua_chave_ssh_privada
SLACK_WEBHOOK=webhook_slack_opcional
```

### 3. Workflow Automático

O arquivo `.github/workflows/deploy.yml` já está configurado para:
- ✅ Executar testes automaticamente
- ✅ Deploy automático no Vercel (branch main)
- ✅ Build e push de imagens Docker
- ✅ Deploy automático no DigitalOcean
- ✅ Notificações Slack

## ▲ Vercel Deploy (Frontend)

### 1. Instalação da CLI

```bash
npm install -g vercel
```

### 2. Login e Deploy

```bash
# Login
vercel login

# Deploy (na pasta frontend)
cd frontend
vercel --prod
```

### 3. Configurar Variáveis de Ambiente

No dashboard da Vercel, adicione:

```
VITE_API_URL=https://seu-backend.com/api
VITE_APP_NAME=Sistema NFe
VITE_ENVIRONMENT=production
```

### 4. Configurar Domínio Personalizado

1. Acesse o projeto na Vercel
2. Vá para `Settings > Domains`
3. Adicione seu domínio
4. Configure DNS conforme instruções

## 🌊 DigitalOcean Deploy (Backend)

### 1. Criar Droplet

```bash
# Criar droplet Ubuntu 20.04
# Mínimo: 2GB RAM, 1 vCPU, 50GB SSD
```

### 2. Configurar Servidor

```bash
# Conectar via SSH
ssh root@seu_ip

# Atualizar sistema
apt update && apt upgrade -y

# Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Instalar Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Criar usuário para aplicação
useradd -m -s /bin/bash nfeapp
usermod -aG docker nfeapp
```

### 3. Deploy da Aplicação

```bash
# Clonar repositório
git clone https://github.com/SEU_USUARIO/nfe-system.git /opt/nfe-system
cd /opt/nfe-system

# Configurar ambiente
cp .env.example .env
nano .env

# Executar deploy
chmod +x scripts/deploy-digitalocean.sh
./scripts/deploy-digitalocean.sh production
```

### 4. Configurar Nginx e SSL

```bash
# O nginx já está configurado no docker-compose
# Para SSL com Let's Encrypt:
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d seu-dominio.com
```

## 🔄 Automação Completa

### Workflow de Deploy

1. **Push para GitHub** → Trigger automático
2. **GitHub Actions** → Executa testes
3. **Vercel Deploy** → Frontend automático
4. **Docker Build** → Imagem do backend
5. **DigitalOcean Deploy** → Backend automático
6. **Health Checks** → Verificação de saúde
7. **Notificações** → Slack/Email

### Comandos Úteis

```bash
# Ver logs em tempo real
docker-compose logs -f

# Reiniciar serviços
docker-compose restart

# Atualizar aplicação
git pull && docker-compose up -d --build

# Backup do banco
docker-compose exec postgres pg_dump -U nfe_user nfe_system > backup.sql

# Monitoramento
docker-compose ps
docker stats
```

## 📊 Monitoramento

### Prometheus + Grafana

```bash
# Iniciar monitoramento
docker-compose --profile monitoring up -d

# Acessar dashboards
# Prometheus: http://seu-ip:9090
# Grafana: http://seu-ip:3000 (admin/admin)
```

### Health Checks

- **Frontend**: `https://seu-dominio.vercel.app`
- **Backend**: `https://seu-backend.com/health`
- **API**: `https://seu-backend.com/api/health`

## 🔒 Segurança

### Configurações Implementadas

- ✅ HTTPS obrigatório
- ✅ Headers de segurança
- ✅ Rate limiting
- ✅ CORS configurado
- ✅ Validação de entrada
- ✅ JWT com expiração
- ✅ Logs de auditoria

### Boas Práticas: JWT e Seed Admin
- `JWT_SECRET`: utilize segredo forte (32+ chars) gerado com `openssl rand -base64 48`; defina `JWT_EXPIRES_IN` (ex.: `12h`) e rotacione periodicamente. Nunca versione segredos.
- `SEED_ADMIN_*`: altere valores padrão antes do deploy. Use apenas para o primeiro acesso (seed cria admin se não existir). Depois de validar o login, remova/comente `SEED_ADMIN_NOME`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_SENHA` no `.env` e altere a senha do admin.
- `SIMULATION_MODE`: mantenha `false` em produção. Evite dados fictícios.
- `NEXTAUTH_SECRET`: configure segredo exclusivo para o frontend (Vercel) com 32+ chars.

### Firewall DigitalOcean

```bash
# Configurar firewall
ufw enable
ufw allow ssh
ufw allow 80
ufw allow 443
ufw status
```

## 🚨 Troubleshooting

### Problemas Comuns

#### 1. Erro de Conexão com Banco
```bash
# Verificar logs
docker-compose logs postgres

# Testar conexão
docker-compose exec postgres psql -U nfe_user -d nfe_system
```

#### 2. Certificado SSL Inválido
```bash
# Renovar certificado
sudo certbot renew

# Verificar configuração
nginx -t
```

#### 3. Deploy Falhou
```bash
# Ver logs do GitHub Actions
# Verificar secrets configurados
# Testar conexão SSH
ssh -T git@github.com
```

#### 4. Frontend não Carrega
```bash
# Verificar build
cd frontend && npm run build

# Verificar variáveis de ambiente
vercel env ls
```

### Logs Importantes

```bash
# Logs da aplicação
tail -f /var/log/nfe-system-deploy.log

# Logs do nginx
docker-compose logs nginx

# Logs do backend
docker-compose logs nfe-backend
```

## 📞 Suporte

### Comandos de Diagnóstico

```bash
# Status geral
docker-compose ps
docker system df

# Uso de recursos
docker stats
df -h
free -m

# Conectividade
curl -I https://seu-dominio.com/health
ping seu-backend.com
```

### Backup e Restore

```bash
# Backup completo
./scripts/backup.sh

# Restore
./scripts/restore.sh backup-20231201-120000
```

## 🎉 Deploy Concluído!

Após seguir este guia, você terá:

- ✅ Sistema NFe rodando em produção
- ✅ CI/CD automático configurado
- ✅ Monitoramento ativo
- ✅ Backups automáticos
- ✅ SSL/HTTPS configurado
- ✅ Logs centralizados

### URLs Finais

- **Frontend**: https://seu-dominio.vercel.app
- **Backend API**: https://seu-backend.com/api
- **Documentação**: https://seu-backend.com/docs
- **Monitoramento**: https://seu-backend.com:3000

---

**Próximos Passos:**
1. Configurar domínio personalizado
2. Configurar certificados SEFAZ
3. Testar emissão de NFe em homologação
4. Migrar para ambiente de produção
5. Configurar backups automáticos

**Suporte:** Para dúvidas, abra uma issue no GitHub ou consulte a documentação técnica.