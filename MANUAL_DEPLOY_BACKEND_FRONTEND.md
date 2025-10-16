# 📦 Manual de Atualização e Deploy — Backend e Frontend

Este manual consolida, em um único lugar, como atualizar e publicar o Backend (DigitalOcean) e o Frontend (Vercel) do projeto Brandão Contador NFe.

## ✅ Pré-requisitos
- `Node.js` 18+
- `Git`
- `Docker` e `Docker Compose` (no servidor)
- Conta no `GitHub`, `Vercel` e acesso ao `Droplet` da `DigitalOcean`
- Chave SSH configurada para acesso ao servidor
- DNS configurado no Cloudflare para os domínios públicos

## 🔄 Ordem Recomendada
- Primeiro: Backend (DigitalOcean)
- Depois: Frontend (Vercel)

---

## 🛠️ Backend (DigitalOcean)

### Opção A — via GitHub Actions (Manual Deploy Backend)
Recomendado para garantir verificação funcional e health check.

1. Acesse `GitHub → Actions → Manual Deploy Backend`.
2. Clique em `Run workflow` e selecione a branch (padrão `main`).
3. Aguarde os jobs:
   - Verificação funcional (`npm run testar`)
   - Deploy via SSH no servidor (reinicia stack com Docker Compose)
   - Health check em `BACKEND_URL/health`
4. Secrets necessários:
   - `DO_HOST`, `DO_USERNAME`, `DO_SSH_KEY`, `BACKEND_URL`

### Opção B — via SSH e Docker Compose (Deploy/Atualização direta)
Para atualização rápida sem passar pelo workflow.

1. Conecte ao servidor via SSH:
   ```bash
   ssh <usuario>@<ip-servidor>
   ```
2. Navegue até o diretório do stack (padrão):
   ```bash
   cd /opt/nfe-system
   ```
3. Atualize o código e reinicie os serviços:
   ```bash
   git fetch origin
   git reset --hard origin/main
   docker-compose build --pull
   docker-compose up -d --remove-orphans
   docker system prune -f
   ```
4. Valide a saúde da API:
   ```bash
   curl -f https://api.brandaocontador.com.br/health
   ```

5. Alternativa com script (se preferir):
   - No servidor: torne executável e rode `scripts/deploy-digitalocean.sh`
   ```bash
   cd /opt/nfe-system
   chmod +x scripts/deploy-digitalocean.sh
   ./scripts/deploy-digitalocean.sh production
   ```

### Opção C — via scripts do repositório Backend (modo PM2)
Use apenas se o servidor estiver configurado em `/var/www/brandaocontador-nfe-backend` (modo PM2).

1. Verifique o estado do servidor:
   ```bash
   curl -s https://raw.githubusercontent.com/arroschaves/brandaocontador-nfe-backend/main/deploy/check-server.sh | bash
   ```
2. Primeira instalação:
   ```bash
   curl -s https://raw.githubusercontent.com/arroschaves/brandaocontador-nfe-backend/main/deploy/deploy.sh -o deploy.sh
   chmod +x deploy.sh
   ./deploy.sh
   ```
3. Atualização:
   ```bash
   cd /var/www/brandaocontador-nfe-backend
   curl -s https://raw.githubusercontent.com/arroschaves/brandaocontador-nfe-backend/main/deploy/deploy-update.sh -o deploy-update.sh
   chmod +x deploy-update.sh
   ./deploy-update.sh
   ```

### Variáveis críticas do Backend
- Arquivo `.env` baseado em `backend/.env.production` (ou `.env.producao`):
  - `PORT=3001`, `NODE_ENV=production`
  - `JWT_SECRET` (forte e privado)
  - `SIMULATION_MODE=false`
  - `AMBIENTE=2` (produção) e `UF`, `CNPJ_EMITENTE`, `CERT_PATH`, `CERT_PASS`
  - `CORS_ORIGINS` deve incluir `https://nfe.brandaocontador.com.br`

---

## 🌐 Frontend (Vercel)

### Opção A — via GitHub Actions (Manual Deploy Frontend)
1. Acesse `GitHub → Actions → Manual Deploy Frontend`.
2. Clique em `Run workflow` e selecione a branch (padrão `main`).
3. Aguarde os jobs:
   - Lint (`npm run lint`) e build (`npm run build`)
   - Deploy no Vercel em produção (`--prod`)
4. Secrets necessários:
   - `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` (o `GITHUB_TOKEN` é padrão)

### Opção B — via Vercel Dashboard/CLI
1. CLI:
   ```bash
   cd frontend
   npm install -g vercel
   vercel login
   vercel --prod
   ```
2. Dashboard:
   - Configure domínios e variáveis de ambiente
   - Dispare um deploy manual

### Variáveis críticas do Frontend
- Em `frontend/vercel.json` e no projeto Vercel:
  - `VITE_API_URL=https://api.brandaocontador.com.br`
  - `VITE_NODE_ENV=production`

---

## 🔍 Validações Pós-Deploy
- API: `curl -f https://api.brandaocontador.com.br/health`
- CORS: `curl -I https://api.brandaocontador.com.br -H "Origin: https://nfe.brandaocontador.com.br"`
- Frontend: fluxo de login em `https://nfe.brandaocontador.com.br/login`
- Integração: Dashboard e página de Configurações consumindo a API de produção

## 🧰 Troubleshooting Rápido
- Docker Compose: `docker-compose logs -f` e `docker-compose ps`
- Nginx: `sudo nginx -t` e logs em `/var/log/nginx/*`
- DNS: confirme apontamentos no Cloudflare
- PM2 (modo PM2): `pm2 status`, `pm2 logs`, `pm2 restart <app>`
- Secrets ausentes: confirme no GitHub Actions e Vercel

## 📌 Notas Importantes
- Mantenha a ordem Backend → Frontend para evitar erros de integração
- Em produção, garanta `SIMULATION_MODE=false` e `JWT_SECRET` forte
- Certifique que `CORS_ORIGINS` inclui o domínio público do frontend
- Para ambientes de homologação, ajuste variáveis e subdomínios conforme necessário

---

## 📚 Referências Úteis no Repositório
- `DEPLOY_GUIDE.md` — guia completo de deploy (atualizado com workflows separados)
- `DEPLOY.md` — opções e automação de deploy
- `scripts/deploy-digitalocean.sh` — deploy direto (Docker Compose)
- `backend/deploy/*` — scripts de deploy (modo PM2)
- `.github/workflows/deploy-backend.yml` — workflow manual do Backend
- `.github/workflows/deploy-frontend.yml` — workflow manual do Frontend