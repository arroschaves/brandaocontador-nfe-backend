# Deploy Simplificado (Oficial)

Este documento consolida o fluxo de deploy em dois caminhos canônicos: um para BACKEND e outro para FRONTEND. Scripts e workflows redundantes foram removidos.

## BACKEND (DigitalOcean)

- Script oficial (Windows):
  - `powershell -ExecutionPolicy Bypass -File .\atualizar-backend-digitalocean.ps1`
- Workflow oficial (GitHub Actions):
  - `Actions → Manual Deploy Backend → Run workflow (branch main)`
- O que acontece:
  - Atualiza dependências, reinicia via PM2, valida `/health` e `/api/health`.

## FRONTEND (Vercel)

- Script oficial (Windows):
  - `powershell -ExecutionPolicy Bypass -File .\scripts\deploy-frontend.ps1`
- Workflow oficial (GitHub Actions):
  - `Actions → Manual Deploy Frontend → Run workflow (branch main)`
- O que acontece:
  - Cria um commit vazio `[deploy-frontend]` e dá push, acionando o workflow no GitHub Actions;
  - Fallback opcional via `VERCEL_DEPLOY_HOOK_URL` (se definido); health-check básico.

## Conveniência (opcional)

- Orquestrar ambos:
  - `powershell -ExecutionPolicy Bypass -File .\scripts\deploy-all.ps1`

## Health Checks

- Backend: `https://api.brandaocontador.com.br/health` (esperado: 200)
- Frontend: `https://nfe.brandaocontador.com.br` (aguarde 2–4 minutos após disparo)

## Notas

- Não é necessário token JWT ou chave NFe para realizar deploy.
- Mantenha a ordem: primeiro BACKEND, depois FRONTEND.
- Variáveis críticas de produção já alinhadas: `SIMULATION_MODE=false`, `AMBIENTE=1`, `VITE_API_URL=https://api.brandaocontador.com.br`.

## Testes com XML (se necessário)

- XML real disponível: `E:\PROJETOS\brandaocontador-nfe\50250702226278001340550010000094371354412592-nfe.xml`
- Para consulta via API real:
  - Obtenha um token (admin seed: `admin@example.com`/`adminpassword`), então:
  - `GET https://api.brandaocontador.com.br/nfe/consultar/50250702226278001340550010000094371354412592` com `Authorization: Bearer <token>`.
- Alternativa local: `node backend/scripts/smoke-real.js` valida login/health rapidamente (em ambiente local padrão).