# 🚀 PLANO DE EXECUÇÃO - AUDITORIA SISTEMÁTICA NFe

## 📋 RESUMO EXECUTIVO

Este documento detalha a **execução prática** da auditoria completa do sistema NFe Brandão Contador, fornecendo scripts, comandos e procedimentos específicos para identificar e corrigir todos os bugs sistematicamente.

---

## 1. 🔧 FERRAMENTAS DE AUDITORIA

### 1.1 Scripts de Verificação Automática

**Script 1: Verificação de Rotas Backend**
```bash
# Verificar todas as rotas registradas
curl -s https://api.brandaocontador.com.br/api/health | jq .
curl -s https://api.brandaocontador.com.br/api/configuracoes | jq .
curl -s https://api.brandaocontador.com.br/api/auth/register | jq .
curl -s https://api.brandaocontador.com.br/api/nfe/status | jq .
```

**Script 2: Teste de Autenticação**
```bash
# Testar login e obter token
TOKEN=$(curl -s -X POST https://api.brandaocontador.com.br/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@teste.com","password":"123456"}' | jq -r .token)

# Testar rotas protegidas
curl -H "Authorization: Bearer $TOKEN" https://api.brandaocontador.com.br/api/dashboard
```

**Script 3: Verificação de Permissões**
```bash
# Testar diferentes níveis de acesso
for route in dashboard nfe/emitir configuracoes/certificado usuarios; do
  echo "Testando: $route"
  curl -H "Authorization: Bearer $TOKEN" \
    https://api.brandaocontador.com.br/api/$route
done
```

### 1.2 Checklist de Verificação Manual

**Arquivo: audit-checklist.json**
```json
{
  "infrastructure": {
    "ssh_connection": false,
    "pm2_status": false,
    "nginx_status": false,
    "disk_space": false,
    "memory_usage": false
  },
  "authentication": {
    "login_works": false,
    "token_validation": false,
    "permissions_check": false,
    "user_registration": false
  },
  "routes": {
    "health_endpoint": false,
    "dashboard_api": false,
    "nfe_routes": false,
    "config_routes": false,
    "user_management": false
  },
  "functionality": {
    "nfe_emission": false,
    "certificate_upload": false,
    "client_management": false,
    "reports_generation": false
  }
}
```

---

## 2. 🎯 EXECUÇÃO FASE POR FASE

### FASE 1: DIAGNÓSTICO INICIAL (30 min)

**Objetivo**: Identificar o estado atual do sistema

**Comandos SSH na Contabo:**
```bash
# Conectar na Contabo
ssh root@147.93.186.214

# Verificar serviços
cd /var/www/nfe-backend
pm2 status
systemctl status nginx
df -h
free -h

# Verificar logs recentes
pm2 logs --lines 50
tail -f /var/log/nginx/error.log

# Testar sintaxe do código
node -c app.js
npm test 2>/dev/null || echo "Testes não configurados"
```

**Resultado Esperado:**
- [ ] PM2 com status "online"
- [ ] Nginx ativo e funcionando
- [ ] Espaço em disco > 10%
- [ ] Memória disponível > 20%
- [ ] Sem erros críticos nos logs

### FASE 2: VERIFICAÇÃO DE ROTAS (45 min)

**Objetivo**: Mapear todas as rotas e identificar 404s

**Script de Verificação:**
```bash
#!/bin/bash
# audit-routes.sh

BASE_URL="https://api.brandaocontador.com.br"
ROUTES=(
  "/health"
  "/api/health"
  "/api/auth/login"
  "/api/auth/register"
  "/api/dashboard"
  "/api/configuracoes"
  "/api/configuracoes/empresa"
  "/api/configuracoes/sefaz"
  "/api/configuracoes/certificado"
  "/api/nfe/status"
  "/api/nfe/emitir"
  "/api/clientes"
  "/api/produtos"
  "/api/usuarios"
)

echo "=== AUDITORIA DE ROTAS ==="
for route in "${ROUTES[@]}"; do
  status=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL$route")
  echo "[$status] $route"
  
  if [[ $status == "404" ]]; then
    echo "  ❌ ROTA NÃO ENCONTRADA"
  elif [[ $status == "401" ]]; then
    echo "  ✅ ROTA EXISTE (precisa auth)"
  elif [[ $status == "200" ]]; then
    echo "  ✅ ROTA FUNCIONANDO"
  else
    echo "  ⚠️  STATUS INESPERADO: $status"
  fi
done
```

### FASE 3: TESTE DE AUTENTICAÇÃO (30 min)

**Objetivo**: Validar sistema de login e permissões

**Procedimento:**
1. **Testar Login Admin:**
```bash
curl -X POST https://api.brandaocontador.com.br/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "bcrandaocontador@gmail.com",
    "password": "sua_senha_aqui"
  }'
```

2. **Testar Registro de Usuário (ERRO 409):**
```bash
curl -X POST https://api.brandaocontador.com.br/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "nome": "Teste Usuario",
    "email": "teste@exemplo.com",
    "password": "123456",
    "tipo": "contador"
  }'
```

3. **Verificar Permissões:**
```bash
# Com token válido
curl -H "Authorization: Bearer $TOKEN" \
  https://api.brandaocontador.com.br/api/usuarios
```

### FASE 4: FUNCIONALIDADES CORE (60 min)

**Objetivo**: Testar cada funcionalidade principal

**4.1 Upload de Certificado:**
```bash
curl -X POST https://api.brandaocontador.com.br/api/configuracoes/certificado \
  -H "Authorization: Bearer $TOKEN" \
  -F "certificado=@certificado-teste.pfx" \
  -F "senha=senha123"
```

**4.2 Configuração de Empresa:**
```bash
curl -X PUT https://api.brandaocontador.com.br/api/configuracoes/empresa \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "razaoSocial": "Empresa Teste LTDA",
    "cnpj": "12345678000195",
    "inscricaoEstadual": "123456789"
  }'
```

**4.3 Cadastro de Cliente:**
```bash
curl -X POST https://api.brandaocontador.com.br/api/clientes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "nome": "Cliente Teste",
    "documento": "12345678901",
    "email": "cliente@teste.com"
  }'
```

### FASE 5: CORREÇÕES IDENTIFICADAS (120 min)

**Objetivo**: Corrigir problemas encontrados

**5.1 Problemas Conhecidos:**
- ❌ **409 Conflict** em registro de usuários
- ❌ **503 Service Unavailable** em health checks
- ❌ **500 Internal Server Error** em status NFe
- ❌ **404 Not Found** em rotas de configurações

**5.2 Plano de Correção:**

1. **Corrigir Erro 409 (Registro de Usuários):**
   - Verificar duplicação de email/ID
   - Validar constraints do banco
   - Implementar verificação prévia

2. **Corrigir Erro 503 (Health Check):**
   - Verificar rota `/health` no app.js
   - Implementar endpoint básico
   - Testar conectividade

3. **Corrigir Erro 500 (NFe Status):**
   - Verificar logs específicos
   - Validar conexão SEFAZ
   - Corrigir tratamento de erros

---

## 3. 📊 RELATÓRIO DE PROGRESSO

### 3.1 Template de Relatório

```markdown
# RELATÓRIO DE AUDITORIA - [DATA]

## Status Geral
- ✅ Concluído: X/Y funcionalidades
- ⚠️ Em andamento: X funcionalidades  
- ❌ Com problemas: X funcionalidades

## Problemas Críticos Encontrados
1. [Descrição do problema]
   - Impacto: Alto/Médio/Baixo
   - Solução: [Descrição]
   - Status: Pendente/Em andamento/Resolvido

## Funcionalidades Testadas
- [ ] Dashboard
- [ ] Autenticação
- [ ] Configurações
- [ ] NFe
- [ ] Gestão de dados

## Próximos Passos
1. [Ação prioritária]
2. [Ação secundária]
```

### 3.2 Métricas de Qualidade

**Indicadores de Sucesso:**
- **Disponibilidade**: > 99% das rotas funcionando
- **Performance**: < 3s tempo de resposta
- **Segurança**: 100% das rotas protegidas
- **Funcionalidade**: Fluxo completo NFe operacional

---

## 4. 🔄 PROCESSO DE MELHORIA CONTÍNUA

### 4.1 Monitoramento Automático

**Script de Monitoramento (monitor.sh):**
```bash
#!/bin/bash
# Executar a cada 15 minutos via cron

LOG_FILE="/var/log/nfe-monitor.log"
DATE=$(date '+%Y-%m-%d %H:%M:%S')

# Testar endpoints críticos
endpoints=(
  "https://api.brandaocontador.com.br/health"
  "https://api.brandaocontador.com.br/api/health"
  "https://api.brandaocontador.com.br/api/configuracoes"
)

for endpoint in "${endpoints[@]}"; do
  status=$(curl -s -o /dev/null -w "%{http_code}" "$endpoint")
  echo "[$DATE] $endpoint: $status" >> $LOG_FILE
  
  if [[ $status != "200" && $status != "401" ]]; then
    echo "[$DATE] ALERTA: $endpoint retornou $status" >> $LOG_FILE
    # Enviar notificação se necessário
  fi
done
```

### 4.2 Checklist de Deploy

**Antes de cada deploy:**
- [ ] Executar testes automatizados
- [ ] Verificar sintaxe do código
- [ ] Testar rotas críticas
- [ ] Validar configurações
- [ ] Backup do banco de dados

**Após cada deploy:**
- [ ] Verificar status dos serviços
- [ ] Testar funcionalidades core
- [ ] Monitorar logs por 30 min
- [ ] Validar métricas de performance

---

## 5. 📞 PLANO DE CONTINGÊNCIA

### 5.1 Rollback Rápido

**Em caso de problemas críticos:**
```bash
# Voltar para versão anterior
cd /var/www/nfe-backend
git log --oneline -5
git reset --hard [COMMIT_ANTERIOR]
pm2 restart all
```

### 5.2 Recuperação de Emergência

**Procedimentos de emergência:**
1. **Backup imediato** dos dados
2. **Isolamento** do problema
3. **Comunicação** com usuários
4. **Correção** prioritária
5. **Validação** completa

---

**🎯 OBJETIVO FINAL**: Sistema 100% funcional, testado e documentado, eliminando a necessidade de correções pontuais e garantindo operação estável e confiável.