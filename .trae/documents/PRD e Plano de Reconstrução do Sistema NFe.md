## Visão e Escopo

- Objetivo: reconstruir um sistema NFe limpo, seguro e funcional, com foco em emissão, consulta, cancelamento/inutilização, download de XML/DANFE e gestão de configurações/certificado.
- Abordagem: remover mocks e dados de teste, eliminar duplicações, consolidar backend, manter frontend mínimo para operar com o backend.
- Não-objetivos iniciais: features avançadas (CTe/MDFe completos, relatórios complexos) entram após MVP.

## Inventário do Projeto

- Backend (Node/Express): `app.js`, `routes/*`, `services/*`, `middleware/*`, `monitoring/*`, `config/*`.
- Frontend (React/Vite/TS/Tailwind): `frontend-remote/*` com páginas e serviços.
- Persistência: arquivos JSON em `data/*` controlados por `config/database.js`.
- DevOps/Deploy: `ecosystem*.config.js`, `nginx/*`, scripts em `scripts/*`.
- Duplicações: há espelhos da estrutura na raiz e em `backend/` (necessário consolidar).

## Essenciais vs Não Essenciais

- Essenciais (mínimo viável):
  - Backend: `app.js`, `routes/{auth,clientes,produtos,nfe,configuracoes,me}`, `services/{nfe-service,sefaz-client,certificate-service,validation-service,log-service}`, `middleware/{auth,security}`, `monitoring/{logger,health,metrics,apm,alerts}`, `config/{database,monitoring}`, `xmls/numeracao.json`, `.env`.
  - Frontend: `frontend-remote/src/{pages,components,contexts,services,utils}`, `vite.config.ts`, `tsconfig*`, `tailwind.config.js`, `.env*`.
- Não essenciais para funcionamento principal (remover/arquivar):
  - Rotas e scripts de teste/diagnóstico: `routes/test-errors.js` (e similares), mensagens de simulação em `app.js:1585` e uso de `SIMULATION_MODE`.
  - Dados de teste: `data/*.json` com usuários/clientes/produtos/logs/NFes, `usuarios-admin.json`.
  - Duplicações: pasta `backend/` inteira (se a raiz for a fonte de verdade), `certs/` duplicado na raiz e em `backend/`.
  - Dependências não utilizadas: `express-mongo-sanitize` (presente em `backend/package.json` mas não utilizado no código), duplicidade `bcrypt` e `bcryptjs`.
  - Documentos internos gerados em `.trae/documents/*` (manter fora do artefato de execução).

## Dados de Teste e Mocks a Remover

- Backend:
  - Mocks em NFe listagem e status: `services/nfe-service.js:1203–1267`, `services/nfe-service.js:1279–1345`.
  - "Conteúdo simulado para desenvolvimento" em download: `app.js:1585–1591`.
  - Certificado com chaves mock: `services/certificate-service.js:398–401` e `services/certificate-service.js:420–423`.
  - Rotas de erro proposital: `routes/test-errors.js:34–114`, `routes/test-errors.js:128–142`.
  - Test user nos dados: `data/database.json` e `backend/data/database.json` com `email: "teste@teste.com"` (e similares), `usuarios-admin.json`.
  - Referência a `SIMULATION_MODE`: `app.js:9`, `app.js:2453–2456`, `app.js:2489–2491`, `app.js:3238–3241`.
- Frontend:
  - Endpoints de teste/simulação referenciados em `frontend-remote/src/config/api.ts` (ex.: `NFE.TESTE`). Desativar/ocultar no MVP.

## Diagnóstico de Problemas

- Duplicação de código: duas árvores de backend (`/` e `/backend`) com serviços, rotas e configs duplicados → risco alto de drift e bugs.
- Persistência em JSON: concorrência, integridade e escalabilidade limitadas; arquivos versionados no repositório expõem dados sensíveis.
- Mocks no core:
  - Listagens/status NFe e download retornam dados fictícios (ver referências acima) → comportamento não real.
  - Certificado retorna `mock-private-key` e `mock-certificate` → impede assinatura/transações reais.
- Rotas de erro proposital (`routes/test-errors.js`) podem causar exceções e poluir logs em produção.
- Segurança:
  - `usuarios-admin.json` com credenciais/admin hash versionado → risco grave.
  - Dependências duplicadas (`bcrypt`/`bcryptjs`) e desnecessárias (`express-mongo-sanitize` sem uso) → superfície de ataque e manutenção pior.
- Configuração: uso de `SIMULATION_MODE` espalhado na aplicação → confusão de estado real vs simulado; `fs` como dependência no `package.json` (desnecessário, builtin).

## Dependências Faltantes/Desatualizadas (amostra)

- Backend `package.json`:
  - `axios` ^1.6.0 (há versões mais novas 1.7.x+).
  - `express` ^4.18.2 (ok, última 4.x; considerar 5 beta com cautela).
  - `soap` ^1.0.0 (biblioteca antiga; revisar manutenção e alternativas).
  - `bcrypt` ^6.0.0 e `bcryptjs` ^3.0.2 (unificar em uma só para reduzir superfície).
  - `fs` 0.0.1-security (remover; módulo core).
  - Dev: `eslint` ^9.38.0, `prettier` ^3.6.2 (atuais).
- Frontend `package.json`:
  - `vite` ^5.0.0, `typescript` ^5.2.2, `tailwindcss` ^3.3.6 (ok, verificar updates leves).
- Ação proposta: executar análise de desatualização com `npm/pnpm/yarn outdated` em ambiente de CI e planejar upgrades seguros.

## PRD Completo

### Visão do Produto

- Sistema NFe para empresas, com foco em emissão, consulta, cancelamento/inutilização e gestão de certificados/emitente, integrando com SEFAZ via SOAP e certificado A1.

### Personas

- Administrador: configura certificado/emitente, gerencia usuários, monitora saúde/segurança.
- Operador: emite, consulta, cancela/inutiliza NFe, baixa XML/DANFE.

### Requisitos Funcionais

- Autenticação JWT: login/logout, validação de sessão (`routes/auth.js`, `middleware/auth.js`).
- Configurações do Emitente: cadastro/edição, upload de certificado A1 (`routes/configuracoes.js`, `services/certificate-service.js`).
- Emissão NFe: validação dados, montagem XML, assinatura, envio lote (`services/nfe-service.js`, `services/sefaz-client.js`).
- Consulta NFe: por chave, protocolo, status (`services/sefaz-client.js`).
- Cancelamento/Inutilização: operações e retorno de protocolos (substituir TODO: `services/nfe-service.js:597`).
- Download XML/DANFE: recuperação segura do XML e geração DANFE (`services/danfe-service.js`).
- Relatórios básicos: histórico simples por período/status (`routes/relatorios.js`).
- Monitoramento: health (`GET /health`), métricas (`GET /metrics`), alertas, performance.
- Segurança: CORS, rate limit, helmet, sanitização, CSRF simples, logs por domínio.

### Requisitos Técnicos

- Node >= 20 (alinhar com frontend), Express 4.x, SOAP client com TLS 1.2+ e cadeia CA brasileira.
- Persistência: no MVP, JSON local sem versionamento; planejar migração para SQLite/PostgreSQL.
- Logs: Winston com rotação diária, segregação por domínio; correlação por `traceId`.
- Infra: PM2 em produção, Nginx reverso, `.env` com segredos (`JWT_SECRET`, `ENCRYPTION_KEY`).
- Observabilidade: Prometheus/Express Prom Bundle; dashboards futuros.

### Critérios de Aceitação

- Autenticação: tokens válidos/expiração, rate limit em login, sem vazamento de segredos.
- Configurações/certificado: upload e validação real (sem mocks), expiração detectada.
- Emissão: XML assinado válido, envio à SEFAZ com sucesso; erros tratados com códigos claros.
- Consulta: resposta interpretada e apresentada; fallback de contingência documentado.
- Cancelamento/Inutilização: protocolos persistidos; TODOs removidos.
- Download: entrega de XML/DANFE sem conteúdo simulado; cabeçalhos corretos.
- Monitoramento: `GET /health` e `GET /metrics` funcionais; alertas disparáveis via endpoint admin.
- Segurança: CORS correto, helmet habilitado, CSRF válido para métodos mutáveis, sem endpoints de teste em produção.

### Roadmap Passo a Passo

1. Limpeza Estrutural
   - Remover duplicação (`backend/`), consolidar raiz como fonte de verdade.
   - Excluir `usuarios-admin.json`, remover `data/*.json` do repositório e criar inicialização runtime.
   - Excluir `routes/test-errors.js` e referências.
   - Remover mocks: `app.js:1585–1591`, `services/nfe-service.js:1203–1267`, `services/nfe-service.js:1279–1345`, `services/certificate-service.js:398–401`, `420–423`.
   - Remover `express-mongo-sanitize` e `fs` de deps; unificar em `bcrypt`.
2. Backend MVP (Real)
   - Implementar validação real do certificado A1; carregar PFX com `node-forge`/`crypto` e extrair chaves.
   - Integrar `sefaz-client` com operações reais e interpretação de resposta SOAP (substituir TODO em `services/nfe-service.js:597`).
   - Ajustar persistência JSON para diretório configurável fora do repo; seed opcional via `.env`.
   - Remover `SIMULATION_MODE`; falhas tratadas com mensagens claras.
3. Frontend Alinhado
   - Remover entradas de teste; ocultar `NFE.TESTE`.
   - Validar fluxos principais: login, configurações, emissão, consulta, download.
4. Observabilidade e Segurança
   - Revisar CORS/helmet/rate-limit de acordo com domínios definidos.
   - Ativar métricas/health nos ambientes; configurar alertas administráveis.
5. Hardening e Migração de Dados
   - Planejar migração para SQLite/PostgreSQL; definir esquema e migração.
   - Criar backups/snapshots; documentar RPO/RTO.

### Processos de Correção (Checklist)

- Revisão de código para remoção de mocks e endpoints de teste.
- Auditoria de dependências e remoção de pacotes não utilizados.
- Validação de TLS/CA com SEFAZ; testes de ponta a ponta.
- Configuração de `.env` segura; verificar que nada sensível fica versionado.
- Pipeline CI: lint/format, segurança (Snyk/OSV), build, preview.

### Fluxo de Trabalho

- Branches: `main` (produção), `develop` (integração), `feature/*` (tópicos), `hotfix/*`.
- Commits: convencionais; PRs com checklist (segurança, testes, observabilidade, documentação).
- Releases: tags semânticas; changelog automático.

### Entregáveis

- Backend consolidado sem duplicações, sem mocks, com integração SEFAZ funcional.
- Frontend mínimo operando com backend consolidado.
- Documentação atualizada: `.env.example`, `DEPLOY.md`, `GUIA_INSTALACAO.md`.
- Relatórios: auditoria final pós-limpeza, lista de mudanças e riscos mitigados.

## Itens para Remoção/Refatoração (Resumo)

- Remover: `backend/` (duplicado), `usuarios-admin.json`, `data/*.json` do repo (substituir por inicialização runtime), `routes/test-errors.js`, mocks em `app.js`, `services/nfe-service.js`, `services/certificate-service.js`, dependências `express-mongo-sanitize` e `fs` do `package.json`, endpoints de teste no frontend.
- Refatorar: consolidar persistência; interpretar respostas SOAP; unificar `bcrypt`.

## Próximos Passos

- Confirmar consolidação da raiz como backend oficial.
- Autorizar limpeza dos itens listados.
- Iniciar implementação fase 1 (Limpeza Estrutural) com checkpoints e validações em CI.
