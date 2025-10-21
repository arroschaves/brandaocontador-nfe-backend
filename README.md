# Brandão Contador NFe — Repositório

Bem-vindo ao repositório do sistema NFe. Comece pelos guias abaixo:

- Manual de Deploy consolidado: `MANUAL_DEPLOY_BACKEND_FRONTEND.md`
- Guia completo de deploy: `DEPLOY_GUIDE.md`
- Opções e automação de deploy: `DEPLOY.md`

Workflows manuais (GitHub Actions):
- Manual Deploy Backend: `.github/workflows/deploy-backend.yml`
- Manual Deploy Frontend: `.github/workflows/deploy-frontend.yml`
- Publicação automática (Vercel): push na branch conectada publica o frontend

Ordem de publicação recomendada:
- Primeiro: Backend (DigitalOcean)
- Depois: Frontend (Vercel)