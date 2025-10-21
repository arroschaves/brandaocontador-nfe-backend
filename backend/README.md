# Backend — Sistema NFe Brandão

Documentação oficial do backend do Sistema de Nota Fiscal Eletrônica (NFe) do Brandão Contador. Este documento consolida configurações, modos de operação, scripts de manutenção e endpoints principais, eliminando rascunhos e arquivos obsoletos.

## Visão Geral
- API Node.js (Express) com MongoDB (fallback para MongoDB em memória em desenvolvimento).
- Emissão de NFe com suporte a ambiente de Homologação e Produção.
- Certificado digital A1 (PFX/P12) e variáveis de ambiente para credenciais.

## Requisitos
- Node >= 18 (recomendado Node 20)
- MongoDB em Produção/Homologação
- Certificado A1 (arquivo `.pfx`/`.p12`) e senha

## Modos de Operação
- Modo Real: `SIMULATION_MODE=false` e certificado válido configurado.
- Modo Simulação: `SIMULATION_MODE=true` (usa emissor simulado para testes sem SEFAZ).

## Variáveis de Ambiente
Crie `.env.production`, `.env.homologacao` e `.env.development` conforme necessidade. Principais variáveis:

- Banco de dados:
  - `MONGODB_URI=mongodb://usuario:senha@host:27017/nfe`

- NFe:
  - `SIMULATION_MODE=false` (produção/homologação reais)
  - `NFE_ENV=homologacao` ou `producao`
  - `CERT_PATH=/caminho/para/certificado.pfx`
  - `CERT_PASSWORD=senha-do-certificado`
  - `NFE_SERIE=1` (série da nota)

- Usuário administrador:
  - `ADMIN_EMAIL=admin@brandaocontador.com.br`
  - `ADMIN_PASSWORD=<senha>`

## Scripts
- `npm start` — inicia a API real (`app-real.js`)
- `npm run dev` — inicia em desenvolvimento (hot reload)
- `npm run limpar-banco` — zera o banco simples (arquivos JSON) para desenvolvimento
- `npm run seed:users` — cria/garante usuário administrador
- `npm run limpar-seletivo` — limpa dados mocados preservando:
  - Administrador (por `ADMIN_EMAIL`)
  - Registros criados entre `PRESERVE_START` e `PRESERVE_END` (default: 16–18/10/2025)

Exemplo:
```powershell
$env:PRESERVE_START="2025-10-16T00:00:00-03:00"; `
$env:PRESERVE_END="2025-10-18T23:59:59-03:00"; `
$env:SEED_ADMIN_EMAIL="admin@brandaocontador.com.br"; `
npm run limpar-seletivo
```

## Fluxo de Emissão
1. Configurar certificado e ambiente (`NFE_ENV`, `CERT_PATH`, `CERT_PASSWORD`).
2. Criar cadastro de cliente e produtos.
3. Emitir NFe em `/nfe/emitir` (via frontend) ou endpoint da API.
4. Consultar histórico em `/nfe/historico`.

## Endpoints Principais
- `GET /health` — status da API
- `POST /auth/login` — autenticação
- `GET /nfe/status` — status do emissor/SEFAZ
- `POST /nfe/emitir` — emissão de NFe
- `GET /nfe/historico` — histórico de NFes

## Certificado e Ambientes
- Homologação: usar `NFE_ENV=homologacao` com certificado válido (algumas SEFAZ aceitam o mesmo A1).
- Produção: `NFE_ENV=producao` com certificado oficial da empresa.
- Arquivo do certificado deve ser acessível ao processo da API e protegido por ACL adequada.

## Política de Dados
- Limpeza seletiva remove dados de teste/mocados.
- Preserva o admin e dados reais de 16–18/10/2025 (ajustável via `PRESERVE_*`).
- Não remove logs ou NFes reais se estiverem na janela de preservação.

## Troubleshooting
- `ECONNREFUSED 27017` — MongoDB não está rodando. Inicie o serviço ou use fallback em memória em dev.
- Certificado inválido — verifique `CERT_PATH` e `CERT_PASSWORD`.
- Emissão falha na Produção — confirme `SIMULATION_MODE=false`, ambiente correto e conectividade com SEFAZ.

## Roadmap
- Persistência robusta de NFes e logs.
- Auditoria detalhada de operações (LGPD).
- Fila assíncrona para emissão e callbacks.