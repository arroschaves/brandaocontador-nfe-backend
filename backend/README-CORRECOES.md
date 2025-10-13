# 🔧 Correções Implementadas - Erro ECONNRESET

## 📋 Problemas Identificados e Soluções

### ✅ **1. Arquivo .env Criado**
- **Problema**: Variáveis de ambiente não definidas
- **Solução**: Criados `.env` e `.env.example`
- **Ação Necessária**: ⚠️ **ALTERE A SENHA DO CERTIFICADO NO ARQUIVO .env**

### ✅ **2. URLs Corrigidas**
- **Problema**: URL hardcoded incorreta
- **Solução**: Integração com `ws_urls_uf.js` para URLs corretas por UF/ambiente

### ✅ **3. Configurações SOAP Melhoradas**
- **Problema**: Configurações inadequadas de timeout e headers
- **Solução**: Adicionados:
  - Timeout configurável (30s padrão)
  - Headers adequados (User-Agent, Content-Type)
  - Keep-alive para conexões persistentes
  - Pool de conexões

### ✅ **4. Compatibilidade de Módulos**
- **Problema**: Mistura CommonJS/ES Modules
- **Solução**: Convertido `ws_urls_uf.js` para ES modules

### ✅ **5. Validações de Certificado**
- **Problema**: Falta de validação
- **Solução**: Verificações antes da execução:
  - Existência do arquivo de certificado
  - Senha definida e alterada
  - Variáveis de ambiente obrigatórias

### ✅ **6. Sistema de Retry Melhorado**
- **Problema**: Apenas 2 tentativas fixas
- **Solução**: Sistema configurável com delay entre tentativas

### ✅ **7. Logs Detalhados**
- **Problema**: Logs insuficientes para debug
- **Solução**: Logs detalhados com códigos de erro e progresso

## 🚀 Como Usar

### 1. Configure o arquivo .env:
```bash
# Edite o arquivo .env e altere a senha:
CERT_PASS=SUA_SENHA_REAL_AQUI
```

### 2. Execute o envio:
```bash
node --tls-min-v1.2 --use-system-ca .\nfe-send.js
```

## 🔍 Variáveis de Ambiente Disponíveis

| Variável | Descrição | Padrão |
|----------|-----------|---------|
| `CERT_PATH` | Caminho do certificado | `certs/MAP LTDA45669746000120.pfx` |
| `CERT_PASS` | Senha do certificado | **OBRIGATÓRIO** |
| `UF` | Estado | `MS` |
| `AMBIENTE` | 1=Prod, 2=Homolog | `2` |
| `CNPJ_EMITENTE` | CNPJ da empresa | `45669746000120` |
| `TIMEOUT` | Timeout em ms | `30000` |
| `RETRY_ATTEMPTS` | Tentativas de retry | `3` |

## ⚠️ Próximos Passos

1. **ALTERAR SENHA**: Edite `.env` com a senha real do certificado
2. **TESTAR CONEXÃO**: Execute o script para verificar se conecta
3. **IMPLEMENTAR ENVIO**: Descomente a linha de envio real no código
4. **MONITORAR LOGS**: Verifique `logs/envio.csv` para acompanhar resultados

## 🛡️ Segurança

- ✅ Certificado validado antes do uso
- ✅ Variáveis sensíveis no .env (não commitadas)
- ✅ TLS 1.2 obrigatório
- ✅ Validação de SSL estrita
- ✅ Headers de segurança adequados
## Ajuste PM2 - Produção

- Atualizado `deploy/ecosystem.production.js` para iniciar `app-real.js` em produção.
- Certifique-se de configurar corretamente `.env` com `JWT_SECRET`, `CORS_ORIGINS`, e parâmetros da NFe.
- Reinicie com `pm2 restart brandaocontador-nfe-backend` após atualizar no servidor.