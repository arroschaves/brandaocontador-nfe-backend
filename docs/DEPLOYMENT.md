# Guia de Deploy — NFe Brandão Contador

Este guia cobre deploy com Docker Compose e Nginx, variáveis de ambiente e troubleshooting comum.

## Pré-requisitos
- Domínio configurado (ex.: `nfe.brandaocontador.com.br`) e DNS apontando para o servidor
- Certificados SSL (`cert.pem` e `key.pem`) válidos
- Docker e Docker Compose instalados
- Node 18+ (para builds locais, opcional)
- MongoDB disponível (local, Atlas, ou habilitar banco em memória em dev)

## Estrutura dos serviços (docker-compose.yml)
- `nfe-backend` — API Node.js (`PORT=3001`)
- `nginx` — Reverse proxy com TLS e rate limiting
- `redis` — Cache/sessões (opcional para futuras filas)
- `postgres` — Planejado (não utilizado pelo código atual que usa MongoDB)
- `prometheus` e `grafana` — Observabilidade (perfil `monitoring`, opcionais)

## Configuração de ambiente
Crie o arquivo `.env` no diretório `backend/` com base em `backend/.env.example`:

- Principais variáveis:
  - `PORT=3001`
  - `NODE_ENV=production`
  - `MONGODB_URI=mongodb://<usuario>:<senha>@<host>:27017/<db>?authSource=admin`
  - `JWT_SECRET=<chave-forte>`
  - `AMBIENTE=2` (2=Homologação, 1=Produção)
  - `UF=MS` (UF do emitente)
  - `CNPJ_EMITENTE=<apenas números>`
  - `CERT_PATH` e `CERT_PASS` se quiser carregar o certificado via env (alternativamente use os endpoints de upload)
  - `LOG_LEVEL=info`
  - `CORS_ORIGINS=https://app.brandaocontador.com.br,https://nfe.brandaocontador.com.br`
  - `USE_MEMORY_DB=true` (opcional para desenvolvimento sem Mongo externo)

No `docker-compose.yml`, é recomendável adicionar `MONGODB_URI` ao serviço `nfe-backend`:
```yaml
services:
  nfe-backend:
    environment:
      - MONGODB_URI=${MONGODB_URI}
      - JWT_SECRET=${JWT_SECRET}
      - PORT=3001
      - LOG_LEVEL=info
      - CERT_PATH=/app/certs
```

## Nginx
- Arquivo principal: `nginx/nginx.conf`
- Virtual host: `nginx/conf.d/nfe.conf`
  - Prefixo externo da API: `/api/` → proxy para `nfe-backend:3001`
  - Endpoints de saúde: `/health` (direto e via proxy)
  - TLS: apontar `ssl_certificate` e `ssl_certificate_key`
  - Rate limiting: zonas `api` e `login` já configuradas

Certificados devem estar em `nginx/ssl/`:
- `nginx/ssl/cert.pem`
- `nginx/ssl/key.pem`

## Passo a passo
1. Copie `.env.example` para `.env` no `backend/` e ajuste variáveis
2. Configure certs SSL em `nginx/ssl/`
3. Ajuste `MONGODB_URI` (use Atlas ou instância local)
4. (Opcional) Habilite Prometheus/Grafana adicionando `--profile monitoring`
5. Suba os serviços:
   - `docker compose up -d --build`
6. Verifique saúde:
   - `curl http://localhost/health` (Nginx)
   - `curl http://localhost:3001/health` (Backend)
7. Acesse API (produção): `https://nfe.brandaocontador.com.br/api/health`

## Certificado Digital
- Admin: `POST /configuracoes/certificado` (form-data: `certificado` .pfx, `senha`)
- Cliente: `POST /me/certificado` (form-data: `certificado`, `senha`)
- Remoção: `DELETE /configuracoes/certificado` ou `DELETE /me/certificado`
- Após upload, o serviço recarrega o certificado automaticamente.

## Troubleshooting
- API retorna `401 AUTH_REQUIRED`:
  - Verifique header `Authorization: Bearer <jwt>` e validade do token
- `429 RATE_LIMIT` em `/auth/*`:
  - Aguarde o tempo indicado em `Retry-After`
- `CERTIFICADO_AUSENTE` ao emitir:
  - Faça upload do `.pfx` via endpoint apropriado ou configure `CERT_PATH` e `CERT_PASS`
- Erro de conexão com MongoDB:
  - Valide `MONGODB_URI`; em dev, set `USE_MEMORY_DB=true` para fallback em memória
- CORS bloqueando requisição:
  - Ajuste `CORS_ORIGINS` para incluir a origem do frontend
- Nginx retorna 502/504:
  - Verifique se `nfe-backend` está saudável (`/health`) e timeouts em `nginx/conf.d/nfe.conf`

## Observabilidade (opcional)
- Prometheus: expor métricas em `/metrics` (a ser integrado conforme plano)
- Grafana: acessar `http://<host>:3000` (default login admin)