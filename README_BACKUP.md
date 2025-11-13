# Backend NFe Brandão Contador - Backup

Este é o backup do código do backend do sistema NFe Brandão Contador.

## ⚠️ IMPORTANTE - CONFIGURAÇÃO PARA PRODUÇÃO

### 1. Configurações de Ambiente

Copie o arquivo `.env.production.example` para `.env` e configure:

```bash
cp .env.production.example .env
```

### 2. Variáveis Críticas de Produção

**OBRIGATÓRIO configurar no arquivo .env:**

```env
# Produção SEFAZ
NODE_ENV=production
AMBIENTE=1
SIMULATION_MODE=false

# MongoDB (configurar string de conexão real)
MONGODB_URI=mongodb+srv://usuario:senha@cluster.mongodb.net/nfe_production

# JWT (gerar chave forte)
JWT_SECRET=sua-chave-jwt-super-forte-aqui

# CORS (domínios autorizados)
CORS_ORIGINS=https://nfe.brandaocontador.com.br,https://brandaocontador.com.br

# Certificado Digital A1
CERT_PATH=./certs/certificado.pfx
CERT_PASS=senha_do_certificado

# Dados do Emitente (configurar dados reais)
CNPJ_EMITENTE=seu_cnpj_aqui
EMITENTE_RAZAO_SOCIAL=Razão Social da Empresa
EMITENTE_IE=inscricao_estadual
```

### 3. Certificado Digital

1. Colocar o certificado A1 (.pfx) na pasta `certs/`
2. Configurar `CERT_PATH` e `CERT_PASS` no .env

### 4. Banco de Dados

- **PRODUÇÃO**: Usar MongoDB Atlas ou MongoDB remoto
- **NUNCA** usar localhost em produção
- Configurar backup automático do banco

### 5. Deploy

```bash
# Instalar dependências
npm ci --omit=dev

# Iniciar em produção
npm start
```

### 6. Monitoramento

- Health check: `/health`
- Métricas: `/metrics`
- Status: `/status`

## 🚫 DADOS REMOVIDOS DO BACKUP

- Arquivo `.env` (contém dados sensíveis)
- Certificados digitais
- Logs de produção
- Dados de clientes
- Chaves de API

## 📁 Estrutura Principal

```
backend/
├── app.js              # Aplicação principal
├── routes/             # Rotas da API
├── models/             # Modelos do banco
├── services/           # Serviços (NFe, SEFAZ, etc)
├── middleware/         # Middlewares (auth, security)
├── config/             # Configurações
└── monitoring/         # Monitoramento e logs
```

## 🔒 Segurança

- Todas as rotas protegidas por autenticação JWT
- Rate limiting configurado
- CORS restritivo para domínios autorizados
- Validação de entrada em todas as rotas
- Logs de auditoria

## 📞 Suporte

Para configuração e deploy, consulte:

- `GUIA_DEPLOY_DIGITAL_OCEAN.md`
- `GUIA_CONFIGURACAO_PRODUCAO.md`
- `DEPLOY.md`
