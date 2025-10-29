# Sistema NFe - Backend API

Sistema completo de emissão de Nota Fiscal Eletrônica (NFe) desenvolvido em Node.js com banco de dados JSON.

## 🚀 Características

- ✅ **100% JSON** - Sem dependência de banco de dados
- ✅ **API RESTful** completa
- ✅ **Autenticação JWT**
- ✅ **Integração SEFAZ**
- ✅ **Emissão de NFe**
- ✅ **Gestão de Clientes e Produtos**
- ✅ **Dashboard administrativo**
- ✅ **Logs estruturados**

## 📋 Pré-requisitos

- Node.js 18+ 
- NPM ou Yarn
- Certificado Digital A1 (para produção)

## 🔧 Instalação

1. Clone o repositório:
```bash
git clone https://github.com/arroschaves/brandaocontador-nfe-backend.git
cd brandaocontador-nfe-backend
```

2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente:
```bash
cp .env.example .env
# Edite o arquivo .env com suas configurações
```

4. Execute o sistema:
```bash
npm start
```

## 🌐 Endpoints Principais

### Autenticação
- `POST /api/auth/login` - Login do usuário
- `POST /api/auth/register` - Registro de usuário

### Dashboard
- `GET /api/dashboard` - Dados do dashboard

### Clientes
- `GET /api/clientes` - Listar clientes
- `POST /api/clientes` - Criar cliente
- `PUT /api/clientes/:id` - Atualizar cliente
- `DELETE /api/clientes/:id` - Excluir cliente

### Produtos
- `GET /api/produtos` - Listar produtos
- `POST /api/produtos` - Criar produto
- `PUT /api/produtos/:id` - Atualizar produto
- `DELETE /api/produtos/:id` - Excluir produto

### NFe
- `POST /api/nfe/emitir` - Emitir NFe
- `GET /api/nfe` - Listar NFes
- `GET /api/nfe/:id` - Buscar NFe específica

### Configurações
- `GET /api/configuracoes/empresa` - Dados da empresa
- `PUT /api/configuracoes/empresa` - Atualizar empresa
- `GET /api/configuracoes/sefaz` - Configurações SEFAZ

## 🏗️ Estrutura do Projeto

```
├── app.js                 # Arquivo principal
├── routes/               # Rotas da API
├── services/             # Serviços de negócio
├── models/               # Modelos de dados
├── middleware/           # Middlewares
├── config/               # Configurações
├── data/                 # Banco de dados JSON
├── logs/                 # Arquivos de log
└── docs/                 # Documentação
```

## 🔒 Segurança

- Autenticação JWT
- Rate limiting
- Validação de dados
- Logs de auditoria
- CORS configurado

## 📊 Monitoramento

- Health check: `GET /health`
- Logs estruturados
- Métricas de performance

## 🚀 Deploy

O sistema está preparado para deploy em:
- VPS (Ubuntu/CentOS)
- Docker
- PM2 (recomendado)

## 📝 Licença

Este projeto é propriedade de Brandão Contador.

## 🆘 Suporte

Para suporte técnico, entre em contato através do email: suporte@brandaocontador.com.br