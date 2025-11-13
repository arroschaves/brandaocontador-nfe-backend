# Deploy Contabo

## Requisitos
- Secrets: `SSH_HOST`, `SSH_USER`, `SSH_KEY`, `SSH_PORT`
- PM2 instalado no servidor

## Processo
- Workflow `.github/workflows/deploy-contabo.yml` conecta via SSH e executa build/restart
- Configure `.env` no servidor com variáveis de ambiente seguras
