# 🚀 Guia Completo de Deploy - Brandão Contador NFe

## 📋 Visão Geral da Arquitetura

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Cloudflare    │    │     Vercel       │    │  DigitalOcean   │
│   (DNS + CDN)   │────│   (Frontend)     │────│   (Backend)     │
│                 │    │   Next.js        │    │   Node.js       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Componentes:
- **Frontend**: Next.js hospedado no Vercel
- **Backend**: Node.js hospedado no DigitalOcean Ubuntu
- **DNS**: Cloudflare para gerenciamento de domínio
- **SSL**: Let's Encrypt via Certbot

## 🏗️ Configuração Inicial

### 1. Servidor DigitalOcean

#### 1.1 Acesso ao Servidor
```bash
ssh root@159.89.228.223
```

#### 1.2 Configuração Inicial
```bash
# Executar script de configuração
curl -sSL https://raw.githubusercontent.com/arroschaves/brandaocontador-nfe-backend/main/scripts/setup-server.sh | sudo bash
```

#### 1.3 Configurar SSL
```bash
# Após configurar DNS no Cloudflare
sudo certbot --nginx -d api.brandaocontador.com.br
```

### 2. Configuração do DNS (Cloudflare)

#### 2.1 Registros DNS Necessários
```
Tipo    Nome                        Valor               TTL
A       api.brandaocontador.com.br  159.89.228.223     Auto
CNAME   www.brandaocontador.com.br  brandaocontador-nfe-frontend.vercel.app  Auto
A       brandaocontador.com.br      [Vercel IP]        Auto
```

#### 2.2 Configurações SSL/TLS
- **Modo SSL/TLS**: Full (strict)
- **Always Use HTTPS**: Ativado
- **HSTS**: Ativado
- **Min TLS Version**: 1.2

## 🚀 Deploy do Backend

### 1. Preparação
```bash
# Mudar para usuário da aplicação
su - nfeapp

# Clonar repositório
git clone https://github.com/arroschaves/brandaocontador-nfe-backend.git /var/www/brandaocontador-nfe-backend
cd /var/www/brandaocontador-nfe-backend
```

### 2. Configuração
```bash
# Copiar e configurar variáveis de ambiente
cp .env.production .env
nano .env

# Configurar certificados NFe
mkdir -p certs
# Copiar certificados para o diretório certs/
```

#### Variáveis essenciais do .env (Backend)
```
# Seed de administrador (primeiro acesso)
SEED_ADMIN_NOME=Administrador
SEED_ADMIN_EMAIL=admin@brandaocontador.com.br
SEED_ADMIN_SENHA=admin123

# Modo de simulação (deve ser false em produção)
SIMULATION_MODE=false

# Segredo JWT existente
JWT_SECRET=defina_um_segredo_forte_aqui
```

### Autenticação Social
- Backend expõe `POST /auth/social` para login/registro via Google/Facebook
- Frontend envia dados do provedor através do NextAuth
- Campos adicionais no usuário: `socialProvider`, `socialProviderId`, `image`

### 3. Deploy
```bash
# Executar script de deploy
chmod +x deploy/deploy.sh
./deploy/deploy.sh
```

#### Atualização posterior
```
chmod +x deploy/deploy-update.sh
./deploy/deploy-update.sh
```
O script de atualização garante que `.env` mantenha `SEED_ADMIN_*` e `SIMULATION_MODE`.

### 4. Configurar Nginx
```bash
# Copiar configuração do Nginx
sudo cp deploy/nginx.conf /etc/nginx/sites-available/brandaocontador-nfe-backend
sudo ln -s /etc/nginx/sites-available/brandaocontador-nfe-backend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 🌐 Deploy do Frontend

### 1. Configuração no Vercel

#### 1.1 Variáveis de Ambiente
```
NEXT_PUBLIC_API_URL=https://api.brandaocontador.com.br
NEXT_PUBLIC_ENVIRONMENT=production
NEXTAUTH_URL=https://brandaocontador.com.br
NEXTAUTH_SECRET=sua_secret_key_aqui
```

#### 1.2 Domínio Personalizado
- Adicionar domínio: `brandaocontador.com.br`
- Configurar redirecionamento: `www.brandaocontador.com.br` → `brandaocontador.com.br`

### 2. Deploy Manual (Workflows separados)
Agora existem dois workflows independentes para deploy manual via GitHub Actions:

1) Backend
- Acesse `Actions` > `Manual Deploy Backend`.
- Clique em `Run workflow` e selecione a branch (padrão `main`).
- Aguarde os jobs: testes do backend, deploy via SSH no servidor DigitalOcean e health check.
- Pré-requisitos de secrets: `DO_HOST`, `DO_USERNAME`, `DO_SSH_KEY`, `BACKEND_URL`.

2) Frontend
- Acesse `Actions` > `Manual Deploy Frontend`.
- Clique em `Run workflow` e selecione a branch (padrão `main`).
- Aguarde os jobs: testes do frontend e deploy no Vercel.
- Pré-requisitos de secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `GITHUB_TOKEN`.

Observações:
- O workflow anterior `Deploy NFe System` permanece, mas recomenda-se usar os novos workflows separados.
- Pushes em `main` não disparam mais deploy automaticamente; apenas testes continuam rodando conforme configurado.
- Atualização de dependências: usar `npm ci --omit=dev` em produção; evitar `npm config set jobs` (incompatível em npm moderno).

## 🔧 Monitoramento e Manutenção

### 1. Comandos Úteis

#### Backend (DigitalOcean)
```bash
# Status da aplicação
pm2 status

# Logs em tempo real
pm2 logs brandaocontador-nfe-backend

# Restart da aplicação
pm2 restart brandaocontador-nfe-backend

# Monitoramento
pm2 monit

# Status do Nginx
sudo systemctl status nginx

# Logs do Nginx
sudo tail -f /var/log/nginx/brandaocontador-nfe-backend.access.log
```

#### Frontend (Vercel)
- Dashboard: https://vercel.com/arroschaves1973/brandaocontador-nfe-frontend
- Logs: Disponíveis no dashboard do Vercel
- Analytics: Integrado no Vercel

### 2. Backup e Segurança

#### 2.1 Backup dos Certificados
```bash
# Criar backup dos certificados NFe
tar -czf backup-certs-$(date +%Y%m%d).tar.gz /var/www/brandaocontador-nfe-backend/certs/
```

#### 2.2 Backup do Banco de Dados (se aplicável)
```bash
# Backup de logs e dados
tar -czf backup-data-$(date +%Y%m%d).tar.gz /var/www/brandaocontador-nfe-backend/logs/
```

#### 2.3 Atualizações de Segurança
```bash
# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Renovar certificados SSL
sudo certbot renew --dry-run
```
### Boas Práticas: JWT e Seed Admin
- `JWT_SECRET`: use uma chave aleatória forte (32+ caracteres). Gere com `openssl rand -base64 48`. Não versione nem compartilhe; mantenha apenas no `.env` do servidor. Defina `JWT_EXPIRES_IN` (ex.: `12h` ou `24h`) e planeje rotação periódica.
- `NEXTAUTH_SECRET`: configure um segredo próprio (diferente do `JWT_SECRET`) com 32+ caracteres no Vercel. Valide `NEXTAUTH_URL` para o domínio de produção.
- `SEED_ADMIN_*`: utilize apenas no primeiro acesso para criar o usuário administrador. Antes do deploy, altere os valores padrão. Após criar e validar o login do admin, remova ou comente `SEED_ADMIN_NOME`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_SENHA` no `.env` (o seed não sobrescreve usuários existentes). Mantenha `SIMULATION_MODE=false` em produção.
- Pós-primeiro acesso: altere a senha do admin, confirme as roles `admin_total` e `admin`, habilite logs e monitore tentativas de login.

```bash
# Gerar segredos fortes
openssl rand -base64 48  # JWT_SECRET
openssl rand -base64 32  # NEXTAUTH_SECRET
```

## 🚨 Troubleshooting

### 1. Problemas Comuns

#### Backend não responde
```bash
# Verificar status
pm2 status
pm2 logs brandaocontador-nfe-backend

# Verificar porta
sudo netstat -tlnp | grep :3001

# Verificar Nginx
sudo nginx -t
sudo systemctl status nginx
```

#### Erro de certificado NFe
```bash
# Verificar certificados
ls -la /var/www/brandaocontador-nfe-backend/certs/
openssl pkcs12 -info -in "certs/MAP LTDA45669746000120_compatible.pfx" -noout
```

#### Problemas de conectividade SEFAZ
```bash
# Testar conectividade
curl -I https://hom.nfe.sefaz.ms.gov.br/ws/NFeAutorizacao4.asmx?wsdl
```

### 2. Logs Importantes

#### Localizações dos Logs
```
Backend:
- Aplicação: /var/www/brandaocontador-nfe-backend/logs/
- PM2: ~/.pm2/logs/
- Nginx: /var/log/nginx/

Frontend:
- Vercel Dashboard: https://vercel.com/dashboard
```

## 📊 Monitoramento de Performance

### 1. Métricas Importantes
- **Uptime**: Disponibilidade da aplicação
- **Response Time**: Tempo de resposta das APIs
- **Error Rate**: Taxa de erros
- **Memory Usage**: Uso de memória
- **CPU Usage**: Uso de CPU

### 2. Alertas Recomendados
- Aplicação offline por mais de 5 minutos
- Uso de memória acima de 80%
- Taxa de erro acima de 5%
- Certificado SSL expirando em 30 dias

## 🔄 Processo de Atualização

### 1. Backend
```bash
cd /var/www/brandaocontador-nfe-backend
git pull origin main
npm ci --omit=dev --no-audit --no-fund --prefer-offline --silent
pm2 restart brandaocontador-nfe-backend
```

Nota:
- Preferir `npm ci --omit=dev` em produção para builds reprodutíveis e lean.
- Evitar `npm config set jobs` (flag não suportada em versões modernas do npm).

### 2. Frontend
O frontend é atualizado automaticamente via Vercel quando há push na branch `main`.

## 📞 Suporte

### Contatos Importantes
- **SEFAZ-MS**: Para questões relacionadas aos certificados
- **Cloudflare**: Para questões de DNS e CDN
- **Vercel**: Para questões do frontend
- **DigitalOcean**: Para questões do servidor

### Documentação Adicional
- [Documentação SEFAZ](https://www.nfe.fazenda.gov.br/)
- [Vercel Docs](https://vercel.com/docs)
- [DigitalOcean Docs](https://docs.digitalocean.com/)
- [Cloudflare Docs](https://developers.cloudflare.com/)

---

**Última atualização**: $(date)
**Versão**: 1.0.0