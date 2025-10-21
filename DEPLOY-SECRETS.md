# Secrets de Deploy (Backend e Frontend)

Este documento lista os secrets necessários para os workflows de deploy do backend (DigitalOcean via SSH com PM2 + Nginx + SSL) e do frontend (GitHub Pages com Vite).

## Backend (PM2 + Nginx + SSL)
Use no workflow `deploy-backend.yml`.

Obrigatórios:
- `DO_HOST`: IP ou domínio do servidor (DigitalOcean).
- `DO_USERNAME`: Usuário SSH (ex.: `root` ou usuário dedicado, como `nfeapp`).
- `DO_SSH_KEY`: Chave privada SSH (conteúdo PEM) para acesso.
- `API_DOMAIN`: Domínio público da API (ex.: `api.brandaocontador.com.br`).
- `SSL_EMAIL`: E-mail para emissão de certificado (Let's Encrypt / Certbot).
- `BACKEND_URL`: URL completa para health check (ex.: `https://api.brandaocontador.com.br`).
- `MONGODB_URI`: String de conexão do MongoDB.
- `JWT_SECRET`: Segredo para tokens JWT.

Recomendados/Contexto de negócio:
- `CORS_ORIGINS`: Origem(es) permitida(s), separadas por vírgula (ex.: `https://brandaocontador.com.br,https://app.brandaocontador.com.br`).
- `UF`: Unidade Federativa (ex.: `MS`).
- `AMBIENTE`: Ambiente SEFAZ (`1` = produção, `2` = homologação).
- `CNPJ_EMITENTE`: CNPJ do emitente.
- `CERT_PATH`: Caminho absoluto do certificado (PFX) no servidor.
- `CERT_PASS`: Senha do certificado.
- `SEED_ADMIN_NOME`: Nome do admin inicial.
- `SEED_ADMIN_EMAIL`: E-mail do admin inicial.
- `SEED_ADMIN_SENHA`: Senha do admin inicial.
- `SIMULATION_MODE`: `true` ou `false` (modo simulação).
- `GH_PAT_CHECKOUT`: (Opcional) PAT do GitHub com permissão de leitura do repositório, usado para `git clone` via HTTPS.

Observações:
- O workflow configura Nginx e emite/renova SSL automaticamente via Certbot se `API_DOMAIN` e `SSL_EMAIL` estiverem definidos.
- O `.env` de produção é gerado no servidor a partir dos secrets acima.
- O PM2 usa `deploy/ecosystem.production.js` e carrega variáveis do `.env`, evitando sobrescrever configs sensíveis.

## Frontend (GitHub Pages)
Use no workflow `frontend-pages.yml`.

Obrigatórios:
- `VITE_API_URL`: URL base da API (ex.: `https://api.brandaocontador.com.br`).

Opcionais:
- `VITE_APP_NAME`: Nome do app para exibir em UI.
- `VITE_APP_VERSION`: Versão do app.
- `VITE_BASE`: Base path do site. Use `'/'` para domínio customizado (CNAME) ou `'/<repo>/'` para publicação em `https://<user>.github.io/<repo>/`.

Observações:
- Se usar GitHub Pages com domínio customizado, configure o domínio em `Settings > Pages` (CNAME). Nesse caso, o `base` do Vite pode permanecer `'/'`.
- Se publicar em `https://<user>.github.io/<repo>/` sem CNAME, defina `VITE_BASE` para `'/<repo>/'` e o workflow já passará isso para o build; também adicionamos `404.html` como fallback para SPA.

## Como definir secrets no GitHub
- Vá em `Settings > Secrets and variables > Actions`.
- Clique em `New repository secret` e adicione cada secret conforme listado.

## Testes de deploy
- Backend: acione manualmente `Deploy Backend (PM2 + Nginx + SSL)` em `Actions`, informe a branch `main`, e verifique o health check.
- Frontend: faça push na `main` ou dispare manualmente `Deploy Frontend to GitHub Pages` e valide a publicação em `Settings > Pages`.