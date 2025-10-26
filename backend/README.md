# 🏢 Sistema NFe Brandão Contador - Backend

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-5.0+-green.svg)](https://www.mongodb.com/)
[![Express](https://img.shields.io/badge/Express-4.18+-blue.svg)](https://expressjs.com/)
[![Swagger](https://img.shields.io/badge/API-Swagger-orange.svg)](http://localhost:3001/api-docs)

Sistema completo para emissão de Notas Fiscais Eletrônicas (NFe) desenvolvido para o escritório Brandão Contador. API RESTful robusta com suporte a ambientes de homologação e produção, certificados digitais A1 e integração completa com SEFAZ.

## 📋 Índice

- [Visão Geral](#-visão-geral)
- [Requisitos](#-requisitos)
- [Instalação](#-instalação)
- [Configuração](#-configuração)
- [Modos de Operação](#-modos-de-operação)
- [Scripts Disponíveis](#-scripts-disponíveis)
- [API Endpoints](#-api-endpoints)
- [Deploy em Produção](#-deploy-em-produção)
- [Monitoramento](#-monitoramento)
- [Troubleshooting](#-troubleshooting)

## 🎯 Visão Geral

### Características Principais
- **API RESTful** com Node.js e Express
- **Banco de dados** MongoDB com fallback para desenvolvimento
- **Emissão de NFe** com certificados digitais A1 (PFX/P12)
- **Ambientes** Homologação e Produção da SEFAZ
- **Documentação** completa com Swagger/OpenAPI 3.0
- **Monitoramento** com health checks e métricas
- **Segurança** JWT, rate limiting e validações
- **Deploy** automatizado com PM2 e Nginx

### Arquitetura
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │   SEFAZ         │
│   (React/Next)  │◄──►│   (Node.js)     │◄──►│   (Webservices) │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   MongoDB       │
                       │   (Dados)       │
                       └─────────────────┘
```

## 🔧 Requisitos

### Sistema
- **Node.js** >= 18 (recomendado 20+)
- **MongoDB** >= 5.0 (produção/homologação)
- **PM2** (para produção)
- **Nginx** (proxy reverso)

### Certificados
- **Certificado A1** (arquivo `.pfx` ou `.p12`)
- **Senha do certificado**
- **Validade** dentro do prazo

### Conectividade
- **Internet** para comunicação com SEFAZ
- **Portas** 443 (HTTPS) e 3001 (API)

## 🚀 Instalação

### 1. Clone o Repositório
```bash
git clone https://github.com/seu-usuario/brandaocontador-nfe.git
cd brandaocontador-nfe/backend
```

### 2. Instale as Dependências
```bash
npm install
```

### 3. Configure o Ambiente
```bash
# Copie o arquivo de exemplo
cp .env.example .env

# Configure as variáveis necessárias
nano .env
```

### 4. Inicie a Aplicação
```bash
# Desenvolvimento
npm run dev

# Produção
npm start
```

## ⚙️ Configuração

### Variáveis de Ambiente

Crie os arquivos de configuração para cada ambiente:

#### `.env.development` (Desenvolvimento)
```env
NODE_ENV=development
AMBIENTE=0
SIMULATION_MODE=true
DEBUG_MODE=true
PORT=3001
MONGODB_URI=mongodb://localhost:27017/brandaocontador_nfe_dev
JWT_SECRET=sua_chave_jwt_desenvolvimento
```

#### `.env.producao` (Produção)
```env
NODE_ENV=production
AMBIENTE=1
SIMULATION_MODE=false
DEBUG_MODE=false
PORT=3001
MONGODB_URI=mongodb://localhost:27017/brandaocontador_nfe_production
JWT_SECRET=sua_chave_jwt_super_secreta_aqui_production

# NFe - Configurações obrigatórias
UF=SP
CNPJ_EMITENTE=12345678000195
CERT_PATH=./certs/certificado.pfx
CERT_PASS=senha_do_certificado

# Segurança
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Admin seed
SEED_ADMIN_NOME=Administrador
SEED_ADMIN_EMAIL=admin@brandaocontador.com.br
SEED_ADMIN_SENHA=admin:123
ENABLE_AUTO_SEED=true
```

### Configuração do Certificado Digital

1. **Obtenha o certificado A1** da Receita Federal
2. **Coloque o arquivo** na pasta `./certs/`
3. **Configure as variáveis**:
   ```env
   CERT_PATH=./certs/seu-certificado.pfx
   CERT_PASS=sua-senha-do-certificado
   ```

### Configuração do MongoDB

#### Desenvolvimento (Opcional)
```bash
# Instalar MongoDB localmente
# Ubuntu/Debian
sudo apt install mongodb

# Windows
# Baixar do site oficial: https://www.mongodb.com/try/download/community
```

#### Produção
```bash
# Configurar MongoDB em produção
sudo systemctl enable mongod
sudo systemctl start mongod
```

## 🔄 Modos de Operação

### Modo Simulação (Desenvolvimento)
```env
SIMULATION_MODE=true
AMBIENTE=0
DEBUG_MODE=true
```
- **Uso**: Desenvolvimento e testes
- **Características**: Não comunica com SEFAZ, usa dados simulados
- **Certificado**: Não obrigatório

### Modo Real (Produção/Homologação)
```env
SIMULATION_MODE=false
AMBIENTE=1
DEBUG_MODE=false
```
- **Uso**: Produção e homologação
- **Características**: Comunicação real com SEFAZ
- **Certificado**: Obrigatório e válido

## 📜 Scripts Disponíveis

### Desenvolvimento
```bash
npm run dev          # Inicia em modo desenvolvimento (hot reload)
npm start            # Inicia em modo produção
npm test             # Executa testes
npm run lint         # Verifica código com ESLint
```

### Produção
```bash
npm run build        # Build para produção
npm run start:prod   # Inicia com PM2
npm run stop         # Para a aplicação
npm run restart      # Reinicia a aplicação
```

### Manutenção
```bash
npm run seed:users           # Cria usuário administrador
npm run limpar-banco         # Limpa banco de desenvolvimento
npm run limpar-seletivo      # Limpeza seletiva preservando dados importantes
npm run validar-producao     # Valida configurações de produção
```

### Scripts PowerShell (Windows)
```powershell
# Configurar ambiente de produção
.\scripts\set-producao.ps1

# Limpeza e seed
.\scripts\clean-and-seed.ps1
```

## 🌐 API Endpoints

### Documentação Interativa
- **Swagger UI**: `http://localhost:3001/api-docs`
- **OpenAPI JSON**: `http://localhost:3001/api-docs.json`

### Autenticação
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/auth/login` | Login do usuário |
| POST | `/auth/logout` | Logout do usuário |
| GET | `/auth/me` | Dados do usuário logado |

### NFe (Nota Fiscal Eletrônica)
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/nfe/status` | Status do emissor/SEFAZ |
| POST | `/nfe/emitir` | Emitir nova NFe |
| POST | `/nfe/cancelar` | Cancelar NFe |
| POST | `/nfe/inutilizar` | Inutilizar numeração |
| GET | `/nfe/consultar/:chave` | Consultar NFe por chave |
| GET | `/nfe/download/:id` | Download XML/PDF |
| POST | `/nfe/validar` | Validar dados antes da emissão |
| GET | `/nfe/historico` | Histórico de NFes |

### Clientes
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/clientes` | Listar clientes |
| POST | `/clientes` | Criar cliente |
| GET | `/clientes/:id` | Buscar cliente |
| PUT | `/clientes/:id` | Atualizar cliente |
| DELETE | `/clientes/:id` | Excluir cliente |

### Produtos
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/produtos` | Listar produtos |
| POST | `/produtos` | Criar produto |
| GET | `/produtos/:id` | Buscar produto |
| PUT | `/produtos/:id` | Atualizar produto |
| DELETE | `/produtos/:id` | Excluir produto |

### Administração
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/admin/usuarios` | Listar usuários |
| GET | `/admin/health` | Saúde do sistema |
| GET | `/admin/alerts` | Alertas do sistema |
| POST | `/admin/alerts/test` | Testar alertas |

### Monitoramento
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/health` | Health check básico |
| GET | `/health/detailed` | Health check detalhado |
| GET | `/metrics` | Métricas Prometheus |
| GET | `/status/performance` | Métricas de performance |

## 🚀 Deploy em Produção

### 1. Preparação do Servidor
```bash
# Instalar dependências
sudo apt update
sudo apt install -y nodejs npm mongodb nginx certbot

# Instalar PM2 globalmente
sudo npm install -g pm2
```

### 2. Configuração do Ambiente
```bash
# Clonar repositório
git clone https://github.com/seu-usuario/brandaocontador-nfe.git
cd brandaocontador-nfe/backend

# Instalar dependências
npm ci --production

# Configurar ambiente de produção
cp .env.producao .env
```

### 3. Configuração do PM2
```bash
# Iniciar com PM2
pm2 start ecosystem.production.js --env production

# Salvar configuração
pm2 save
pm2 startup
```

### 4. Configuração do Nginx
```bash
# Copiar configuração
sudo cp deploy/nginx.conf /etc/nginx/sites-available/brandaocontador-nfe-backend
sudo ln -s /etc/nginx/sites-available/brandaocontador-nfe-backend /etc/nginx/sites-enabled/

# Testar e recarregar
sudo nginx -t
sudo systemctl reload nginx
```

### 5. Configuração SSL
```bash
# Obter certificado Let's Encrypt
sudo certbot --nginx -d api.brandaocontador.com.br
```

### 6. Script de Deploy Automatizado
```bash
# Executar script de deploy
chmod +x scripts/deploy-production.sh
./scripts/deploy-production.sh
```

## 📊 Monitoramento

### Health Checks
- **Básico**: `GET /health` - Status simples da API
- **Detalhado**: `GET /health/detailed` - Status completo do sistema
- **Performance**: `GET /status/performance` - Métricas de performance

### Logs
```bash
# Logs da aplicação
pm2 logs brandaocontador-nfe-backend

# Logs do Nginx
sudo tail -f /var/log/nginx/brandaocontador-nfe-backend.access.log
sudo tail -f /var/log/nginx/brandaocontador-nfe-backend.error.log
```

### Métricas
- **Prometheus**: `GET /metrics`
- **Alertas**: Sistema de alertas configurável
- **Performance**: Monitoramento de CPU, memória e requisições

## 🔧 Troubleshooting

### Problemas Comuns

#### MongoDB não conecta
```bash
# Verificar status
sudo systemctl status mongod

# Iniciar MongoDB
sudo systemctl start mongod

# Verificar logs
sudo journalctl -u mongod
```

#### Certificado inválido
```bash
# Verificar certificado
node scripts/diagnose-certificate.js

# Validar configuração
node scripts/validar-producao.js
```

#### Erro de permissões
```bash
# Ajustar permissões
sudo chown -R nfeapp:nfeapp /var/www/brandaocontador-nfe-backend
chmod 600 certs/*.pfx
```

#### SEFAZ indisponível
- Verificar status da SEFAZ no portal oficial
- Confirmar conectividade de rede
- Validar certificado e credenciais

### Logs de Debug
```bash
# Ativar debug
DEBUG_MODE=true npm start

# Verificar logs específicos
tail -f logs/app.log
tail -f logs/nfe.log
tail -f logs/error.log
```

## 🔒 Segurança

### Configurações de Segurança
- **JWT** para autenticação
- **Rate limiting** para proteção contra ataques
- **CORS** configurado adequadamente
- **Headers de segurança** implementados
- **Validação** rigorosa de entrada
- **Certificados** protegidos com permissões adequadas

### Boas Práticas
- Manter certificados atualizados
- Usar HTTPS em produção
- Monitorar logs de segurança
- Backup regular dos dados
- Atualizar dependências regularmente

## 📚 Documentação Adicional

- [Guia de Instalação](docs/INSTALACAO.md)
- [Configuração de Certificados](docs/CERTIFICADOS.md)
- [Endpoints de Monitoramento](docs/ENDPOINTS_MONITORAMENTO.md)
- [Checklist de Produção](CHECKLIST_PRODUCAO.md)

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está licenciado sob a Licença MIT - veja o arquivo [LICENSE](LICENSE) para detalhes.

## 📞 Suporte

Para suporte técnico, entre em contato:
- **Email**: suporte@brandaocontador.com.br
- **Telefone**: (11) 99999-9999
- **Documentação**: [Wiki do Projeto](https://github.com/seu-usuario/brandaocontador-nfe/wiki)