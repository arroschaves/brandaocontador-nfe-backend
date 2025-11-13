# Memória do Processo de Deploy e Configuração

Este arquivo registra decisões, padrões e valores que devemos reaproveitar para evitar perguntas repetidas em futuras automações.

## Perfil de Ambiente (Produção)

- Domínio da API: `api.brandaocontador.com.br`
- Porta backend: `3001`
- Proxy: Nginx -> `http://localhost:3001`
- Origens CORS padrão: `https://brandaocontador.com.br, https://app.brandaocontador.com.br`
- Base do frontend (Pages): `'/'` quando usar CNAME; use `'/<repo>/'` quando publicar em `https://<user>.github.io/<repo>/`.

## Convenções

- Backend gerencia o processo com PM2 usando `backend/deploy/ecosystem.production.js` e carrega variáveis do `.env` gerado no servidor.
- SSL automatizado com Certbot/Nginx quando `API_DOMAIN` e `SSL_EMAIL` estiverem definidos.
- Health público: `GET /health` (alias: `GET /api/health`).
- Frontend (Vite) consome `import.meta.env.VITE_API_URL` e respeita `process.env.VITE_BASE` no build.

## Onde centralizar valores

- Variáveis não sensíveis: use `Repository Variables` (`Settings > Environments/Variables`) como `API_DOMAIN`, `BACKEND_URL`, `VITE_API_URL`, `VITE_BASE`, `UF`, `AMBIENTE`.
- Secrets sensíveis: use `Actions Secrets` como `MONGODB_URI`, `JWT_SECRET`, `CERT_PASS`, `DO_SSH_KEY`.

## Workflows atualizados

- `/.github/workflows/deploy-backend.yml`: usa `vars` como fallback para `API_DOMAIN`, `SSL_EMAIL`, `CORS_ORIGINS`, etc., e mantém secrets para dados sensíveis.
- `/.github/workflows/frontend-pages.yml`: usa `vars` como fallback para `VITE_API_URL`, `VITE_BASE` e adiciona `404.html` para SPA.

## Próximos registros (como atualizar este arquivo)

- Ao decidir novos domínios/subdomínios, portas ou políticas de CORS, adicione aqui e crie/atualize `Repository Variables` correspondentes.
- Sempre que mudar o fluxo de deploy, registre o resumo do que foi alterado e o motivo.

## Últimos passos executados

- Ajustado PM2 para não sobrescrever variáveis do `.env` em produção.
- Reescrito workflow do backend para PM2+Nginx+SSL via SSH.
- Criado workflow do frontend para GitHub Pages com `VITE_API_URL` e `VITE_BASE`.
- Documentados secrets e variáveis em `DEPLOY-SECRETS.md`.

---

## Backend na DigitalOcean — Processo de Atualização (Memória Oficial)

- Localização: Droplet DigitalOcean atendendo `api.brandaocontador.com.br` via Nginx → Node/PM2.
- Diretório da aplicação: `/var/www/brandaocontador-nfe-backend`.
- Repositório: `arroschaves/brandaocontador-nfe-backend` (branch `main`).
- Orquestração: PM2 com `backend/deploy/ecosystem.production.js` e `.env` em produção.

### Rotas de atualização suportadas

- Via CI/CD (recomendado): `/.github/workflows/auto-deploy.yml`
  - Dispara em `push` para `main`.
  - Requisitos (Secrets): `SSH_PRIVATE_KEY`, `SSH_HOST`, `SSH_USER`.
  - Passos: testa backend, conecta via SSH, atualiza checkout, grava `backend/deploy-version.json` (commit/branch/timestamp), instala dependências, aplica `.env` a partir de secrets/vars, reinicia PM2, faz health check.
  - Observação: se os secrets obrigatórios estiverem ausentes, o deploy do backend é pulado.

- Via scripts no servidor (SSH manual)
  - Primeira instalação:

    ```bash
    # Conectar ao servidor
    ssh -i <chave> -p 2222 root@159.89.228.223

    # Checar estado do servidor
    curl -s https://raw.githubusercontent.com/arroschaves/brandaocontador-nfe-backend/main/deploy/check-server.sh | bash

    # Setup inicial
    curl -s https://raw.githubusercontent.com/arroschaves/brandaocontador-nfe-backend/main/deploy/deploy.sh -o deploy.sh
    chmod +x deploy.sh
    ./deploy.sh
    ```

  - Atualização (diretório já existe):
    ```bash
    cd /var/www/brandaocontador-nfe-backend
    curl -s https://raw.githubusercontent.com/arroschaves/brandaocontador-nfe-backend/main/deploy/deploy-update.sh -o deploy-update.sh
    chmod +x deploy-update.sh
    ./deploy-update.sh
    ```

- Via PowerShell local (Windows): `atualizar-backend-digitalocean.ps1`
  - IP: `159.89.228.223`, Porta SSH: `2222`, Chave: `%USERPROFILE%\.ssh\digitalocean_key`.
  - Fluxo: testa SSH, faz backup do `.env`, `git fetch/reset --hard origin/main`, instala dependências com limites de memória/swap, valida PM2, testa `https://api.brandaocontador.com.br/health` e `/api/health`.

### Confirmação de atualização 100%

- Endpoints de versão: `GET /version` e `GET /api/version` devem existir e retornar JSON com `commit`, `branch` e `deployedAt` do último deploy.
- Health detalhado: `GET /api/health` deve incluir `bancoDados`, `uptime`, `versaoNode` (formato do `app-real.js`).
- PM2: processo visível como `brandaocontador-nfe-backend`.

### Variáveis e secrets essenciais

- Secrets: `MONGODB_URI`, `JWT_SECRET`, `CERT_PASS`, credenciais SSH (`SSH_PRIVATE_KEY`, `SSH_HOST`, `SSH_USER`).
- Vars (defaults): `API_DOMAIN`, `BACKEND_URL`, `CORS_ORIGINS`, `AMBIENTE`, `UF`.
- Convenção: secrets só para dados sensíveis; valores públicos em `Repository Variables`.

### Observação de estado atual

- Se `/version` não existir em produção, significa que o backend não está no último commit. Preencher os secrets SSH e acionar o `auto-deploy` (ou executar `deploy-update.sh`) para atualizar.

## Fluxo Operacional Contínuo (Local → DigitalOcean)

- Desenvolver e testar localmente o backend em `backend/`.
- Rodar testes rápidos: `npm run testar` (ou endpoint `GET /api/health`).
- Commitar mudanças: `git add -A && git commit -m "feat/fix: descrição"`.
- Push para `main`: `git push origin main`.
- O `Auto Deploy Backend and Frontend` será acionado:
  - Testa backend (Node instalado no runner).
  - Se `SSH_PRIVATE_KEY`, `SSH_HOST` e `SSH_USER` estiverem definidos, conecta no servidor, atualiza o checkout no `APP_DIR`, instala dependências, aplica `.env` e reinicia com PM2.
  - Grava `backend/deploy-version.json` com `commit`, `branch` e `deployedAt` do deploy.
- Validação pós-deploy:
  - `GET https://api.brandaocontador.com.br/version` deve retornar o commit implantado.
  - `GET https://api.brandaocontador.com.br/api/health` deve retornar o formato completo (inclui `bancoDados`).
- Se o job pular (por falta de secrets), usar fallback manual (abaixo).

## Informações de Acesso (DigitalOcean)

- Domínio da API: `https://api.brandaocontador.com.br`
- Droplet IP: `159.89.228.223`
- SSH:
  - Porta: `2222`
  - Usuário: `root` (recomendado migrar para usuário dedicado futuramente)
  - Chave local (Windows): `%USERPROFILE%\.ssh\digitalocean_key`
  - Conexão: `ssh -i "%USERPROFILE%\.ssh\digitalocean_key" -p 2222 root@159.89.228.223`
- Diretório da aplicação: `/var/www/brandaocontador-nfe-backend`
- Processo PM2: `brandaocontador-nfe-backend`
- Node (servidor): `v20.18.1` (atual de produção)

## Checklist de Secrets e Vars (GitHub)

- Secrets obrigatórios (backend deploy): `SSH_PRIVATE_KEY`, `SSH_HOST`, `SSH_USER`.
- Secrets de app: `MONGODB_URI`, `JWT_SECRET`, `CERT_PASS`.
- Vars (não sensíveis): `API_DOMAIN`, `BACKEND_URL`, `CORS_ORIGINS`, `AMBIENTE`, `UF`.

## Fallback Manual (se CI/CD não rodar)

- Via scripts no servidor:
  - Primeira instalação:
    - `ssh -i <chave> -p 2222 root@159.89.228.223`
    - `curl -s https://raw.githubusercontent.com/arroschaves/brandaocontador-nfe-backend/main/deploy/check-server.sh | bash`
    - `curl -s https://raw.githubusercontent.com/arroschaves/brandaocontador-nfe-backend/main/deploy/deploy.sh -o deploy.sh && chmod +x deploy.sh && ./deploy.sh`
  - Atualização:
    - `cd /var/www/brandaocontador-nfe-backend`
    - `curl -s https://raw.githubusercontent.com/arroschaves/brandaocontador-nfe-backend/main/deploy/deploy-update.sh -o deploy-update.sh && chmod +x deploy-update.sh && ./deploy-update.sh`
- Via PowerShell (Windows): `./atualizar-backend-digitalocean.ps1`
  - Atualiza código (`git reset --hard origin/main`), instala dependências com swap temporária e valida PM2 + health.

## Rotinas de Operação

- PM2:
  - Status: `pm2 list`
  - Logs: `pm2 logs brandaocontador-nfe-backend --lines 200`
  - Reiniciar: `pm2 restart brandaocontador-nfe-backend`
- Nginx:
  - Teste config: `sudo nginx -t`
  - Reload: `sudo systemctl reload nginx`
- Health/versão:
  - `GET /api/health`, `GET /health` e `GET /version`.

## Troubleshooting Rápido

- Deploy não atualiza:
  - Verifique se os secrets SSH estão definidos no GitHub.
  - Confirme acesso SSH manual (`ssh ...`).
  - Rode `deploy-update.sh` no servidor.
- API responde formato antigo (sem `/version`):
  - O servidor não está no último commit: acionar CI/CD ou atualizar via script.
- Erros de build/npm:
  - No servidor, usar `npm ci --omit=dev` e limitar memória (`export NODE_OPTIONS=--max-old-space-size=256`).
- SSL/Nginx:
  - Testar `nginx -t` e recarregar; revisar `backend/deploy/nginx.conf` como base.

## Registro de Atualização — 2025-10-17

- Contexto: endpoints `/version` e `/api/version` indisponíveis; `/health` retornava simplificado e, em seguida, 502 (Cloudflare) após reinícios.
- Análise: `pm2 logs api-nfe` mostrou erros por módulos ausentes (`mongodb-memory-server`, `multer`) e modelos inexistentes (`./models/Cliente`). O diretório remoto `backend/models` não tinha `Cliente.js` e `Produto.js`.
- Ações executadas:
  - Instalada dependência de fallback: `npm install --include=dev mongodb-memory-server@^10.2.3` (no servidor, em `/var/www/brandaocontador-nfe-backend/backend`).
  - Instalada dependência de upload: `npm install multer@^1.4.5-lts.1`.
  - Sincronizados modelos faltantes com o workspace:
    - Criado `/backend/models/Cliente.js` (schema completo com índices e `toJSON`).
    - Criado `/backend/models/Produto.js` (schema completo com índices e `toJSON`).
  - Reiniciado PM2: `pm2 restart api-nfe` e verificados logs.
  - Observado fallback ativo do banco: download do MongoDB em memória e health retornando `bancoDados:"desconectado"` (sem `MONGODB_URI`).
- Validação pós-ajustes:
  - `GET https://api.brandaocontador.com.br/api/health` → 200 com `{ sucesso:true, status:"ok", bancoDados:"desconectado", versaoNode }`.
  - `GET https://api.brandaocontador.com.br/version` → 200 com `{ sucesso:true, packageVersion:"1.0.0", node, env }`.
  - `GET https://api.brandaocontador.com.br/api/version` → 200 com `{ sucesso:true, packageVersion:"1.0.0", node, env }`.
- Causa raiz provável:
  - Repositório remoto `arroschaves/brandaocontador-nfe-backend` desatualizado em relação ao workspace local (monorepo). Sem CI/CD, alguns arquivos e devDependencies não estavam presentes.
- Recomendações definitivas:
  - Preencher secrets do backend no GitHub (`SSH_PRIVATE_KEY`, `SSH_HOST`, `SSH_USER`, `MONGODB_URI`, `JWT_SECRET`, `CERT_PASS`).
  - Acionar `/.github/workflows/auto-deploy.yml` com `git commit --allow-empty` para garantir deploy.
  - Garantir que `ecosystem.production.js` aponte para `backend/app-real.js` e que `NODE_ENV=production` e `PORT=3001` estejam no `.env`.
  - Subir `MONGODB_URI` válido para produção; caso contrário, o serviço usará Mongo em memória (apenas homologação/simulação).
- Comandos úteis:
  - `pm2 list && pm2 logs api-nfe --lines 200`
  - `cd /var/www/brandaocontador-nfe-backend/backend && npm ci --omit=dev`
  - `curl -fsSL https://api.brandaocontador.com.br/api/health`
  - `curl -fsSL https://api.brandaocontador.com.br/version`
