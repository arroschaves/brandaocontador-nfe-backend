# API do Sistema NFe Brandão Contador

Esta documentação descreve os principais endpoints do backend, exemplos de request/response, autenticação e códigos de erro.

## Bases de URL
- Desenvolvimento (local): `http://localhost:3001`
- Produção (Nginx reverse proxy): `https://nfe.brandaocontador.com.br/api`
  - Observação: Em produção, os endpoints são acessados com prefixo `/api` (ex.: `https://nfe.brandaocontador.com.br/api/nfe/status`).

## Autenticação
- JWT via `Authorization: Bearer <token>`
  - Endpoints: `POST /auth/login`, `POST /auth/register`, `GET /auth/validate`
- API Key (apenas em dev, quando habilitado): `X-API-Key: <chave>` ou `api-key: <chave>`
- CORS: Headers permitidos incluem `Content-Type`, `Authorization`, `X-API-Key`.
- Rate limit em autenticação (dev/prod variam): Respostas `429` incluem `Retry-After`.

### Login
- `POST /auth/login`
- Body (JSON):
```json
{
  "email": "admin@example.com",
  "senha": "adminpassword"
}
```
- Resposta (200):
```json
{
  "sucesso": true,
  "token": "<jwt>",
  "usuario": { "id": "...", "email": "admin@example.com", "permissoes": ["admin", "nfe_emitir", "nfe_consultar"] },
  "expiresIn": "7d"
}
```
- Erros comuns: `400 MISSING_CREDENTIALS`, `401 INVALID_CREDENTIALS`

### Validar token
- `GET /auth/validate`
- Header: `Authorization: Bearer <jwt>`
- Resposta (200): `{ "sucesso": true, "usuario": { ... } }`
- Erros: `401 INVALID_TOKEN`

## Saúde
- `GET /health` → Status da API
- `GET /api/health` → Via proxy Nginx

## NFe
- Em dev/simulação, alguns endpoints permitem uso sem JWT para facilitar testes; em produção exigem JWT e permissões.

### Status do sistema
- `GET /nfe/status`
- Header: `Authorization: Bearer <jwt>`
- Resposta (200):
```json
{ "sucesso": true, "status": { "certificado": "ok|ausente", "sefaz": "online|offline", "ambiente": "1|2" } }
```

### Validar dados da NFe
- `POST /nfe/validar`
- Body (exemplo mínimo):
```json
{
  "emitente": {
    "cnpj": "12345678000199",
    "razaoSocial": "Empresa Emitente",
    "inscricaoEstadual": "123456789",
    "endereco": {
      "logradouro": "Rua A",
      "numero": "100",
      "bairro": "Centro",
      "cep": "01001000",
      "municipio": "São Paulo",
      "codigoMunicipio": "3550308",
      "uf": "SP"
    }
  },
  "destinatario": {
    "cpf": "12345678901",
    "nome": "Cliente Teste",
    "endereco": {
      "logradouro": "Av B",
      "numero": "200",
      "bairro": "Jardim",
      "cep": "01310940",
      "municipio": "São Paulo",
      "codigoMunicipio": "3550308",
      "uf": "SP"
    }
  },
  "itens": [
    { "descricao": "Produto X", "quantidade": 1, "valorUnitario": 100.0, "cfop": "5102", "ncm": "12345678", "cst": "00" }
  ],
  "totais": { "valorTotal": 100.0 },
  "numero": 1,
  "serie": 1
}
```
- Resposta (200):
```json
{ "sucesso": true, "validacao": { "valido": true, "erros": [], "avisos": [] } }
```
- Erros (500): `{ "sucesso": false, "erro": "Erro interno na validação", "codigo": "VALIDACAO_ERROR" }`

### Emitir NFe
- `POST /nfe/emitir`
- Header: `Authorization: Bearer <jwt>` (exigido em produção)
- Body: Mesmo formato da validação
- Resposta (200, simulação):
```json
{
  "sucesso": true,
  "chave": "3520...",
  "protocolo": "173937...",
  "dataEmissao": "2024-01-15T10:30:00.000Z",
  "xml": "<NFe>..." 
}
```
- Erros (400): `{ "sucesso": false, "erro": "Dados inválidos", "erros": ["..."] }`
- Erros (400): `{ "sucesso": false, "erro": "Certificado não carregado", "codigo": "CERTIFICADO_AUSENTE" }`
- Erros (500): `{ "sucesso": false, "erro": "Erro interno na emissão da NFe", "codigo": "EMISSAO_ERROR" }`

### Histórico de NFes
- `GET /nfe/historico?pagina=1&limite=10`
- Header: `Authorization: Bearer <jwt>`
- Resposta (200, simulação): Lista paginada com campos como `numero`, `serie`, `chave`, `destinatario`, `valor`, `status`, `dataEmissao`.

### Consultar NFe
- `GET /nfe/consultar/:chave`
- Header: `Authorization: Bearer <jwt>`
- Resposta (200): `{ "sucesso": true, "nfe": { "chave": "...", "status": "autorizada|cancelada|denegada", ... } }`

### Cancelar NFe
- Em ambiente real: `GET /nfe/cancelar/:chave`
- Em app de desenvolvimento: `POST /nfe/cancelar` com body `{ "chave": "..." }`
- Header: `Authorization: Bearer <jwt>`

### Inutilizar numeração
- `POST /nfe/inutilizar`
- Header: `Authorization: Bearer <jwt>`

### Download
- `GET /nfe/download/:tipo/:chave` (`tipo` = `xml`/`pdf`)
- Header: `Authorization: Bearer <jwt>`

## Configurações

### Geral
- `GET /configuracoes` (permite `configuracoes_ver` ou admin)
- `POST /configuracoes` (admin)

### NFe
- `GET /configuracoes/nfe`
- `PATCH /configuracoes/nfe`
- Body (exemplo):
```json
{
  "ambiente": 2,
  "serie": 1,
  "numeracaoInicial": 1,
  "emailEnvio": {
    "servidor": "smtp.example.com",
    "porta": 587,
    "usuario": "user",
    "senha": "pass",
    "ssl": true
  }
}
```

### Notificações
- `GET /configuracoes/notificacoes`
- `PATCH /configuracoes/notificacoes`
- Body (exemplo):
```json
{
  "emailNFeEmitida": true,
  "emailNFeCancelada": true,
  "emailErroEmissao": true,
  "emailVencimentoCertificado": true,
  "whatsappNotificacoes": false,
  "numeroWhatsapp": "+55 11 99999-9999"
}
```

### Certificado Digital
- Admin: `POST /configuracoes/certificado` (form-data: `certificado` .pfx, `senha`)
- Admin: `DELETE /configuracoes/certificado`
- Cliente: `POST /me/certificado` (form-data: `certificado`, `senha`)
- Cliente: `DELETE /me/certificado`

## Códigos de erro comuns
- `401 AUTH_REQUIRED` — Token JWT necessário
- `401 INVALID_TOKEN` — Token inválido/expirado
- `401 USER_NOT_FOUND` — Usuário não encontrado/inativo
- `403 PERMISSION_DENIED` — Permissão insuficiente
- `429 RATE_LIMIT` — Muitas tentativas (veja `Retry-After`)
- `400 MISSING_CREDENTIALS` — Login sem email/senha
- `400 VALIDACAO_ERROR` — Erro interno na validação
- `400 CERTIFICADO_AUSENTE` — Emissão sem certificado
- `500 EMISSAO_ERROR` — Erro interno na emissão

## Observações
- Em produção, sempre usar `Authorization: Bearer <jwt>` nos endpoints protegidos.
- Em dev/simulação, alguns endpoints permitem teste sem token para agilizar desenvolvimento.