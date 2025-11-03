# 🔒 CORREÇÕES DE SEGURANÇA IMPLEMENTADAS - Fase 1

Este documento descreve as correções críticas de segurança implementadas no sistema NFe Brandão Contador.

## ✅ Fase 1 - Segurança (COMPLETA)

### 1. SSL/TLS no Nginx

**Problema**: HTTPS desabilitado, tráfego HTTP sem criptografia

**Correção**:
- ✅ Bloco HTTPS descomentado e ativado
- ✅ Redirecionamento automático HTTP → HTTPS (301)
- ✅ Rate limiting ajustado: 2 req/s (API) e 1 req/s (auth)
- ✅ Timeouts reduzidos: 30s (API), 15s (auth)
- ✅ Cache de API desabilitado (proxy_no_cache)
- ✅ Ciphers modernos configurados (TLS 1.2+)
- ✅ HSTS com preload
- ✅ OCSP Stapling ativado

**Arquivo modificado**: `nginx-nfe.conf`

**Próximos passos no servidor**:
```bash
# 1. Instalar Certbot
sudo apt install certbot python3-certbot-nginx

# 2. Obter certificado SSL
sudo certbot --nginx -d api.brandaocontador.com.br -d nfe.brandaocontador.com.br

# 3. Renovação automática
sudo certbot renew --dry-run

# 4. Testar configuração
sudo nginx -t
sudo systemctl reload nginx
```

---

### 2. Secrets Hardcoded Removidos

**Problema**: JWT_SECRET e API keys hardcoded no código

**Correção**:
- ✅ JWT_SECRET agora OBRIGATÓRIO via env var (min 32 chars)
- ✅ Validação automática de tamanho e valores de exemplo
- ✅ API Keys agora via `API_KEYS` env var (separadas por vírgula)
- ✅ JWT expiry reduzido de 24h para 4h
- ✅ Script `scripts/generate-secrets.js` criado para gerar secrets

**Arquivos modificados**:
- `middleware/auth.js`
- `.env.example`

**Gerar secrets seguros**:
```bash
# Opção 1: Usar script automatizado
node scripts/generate-secrets.js

# Opção 2: Gerar manualmente
JWT_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)
API_KEYS=$(openssl rand -base64 32),$(openssl rand -base64 32)

# Adicionar ao arquivo .env
echo "JWT_SECRET=$JWT_SECRET" >> .env
echo "ENCRYPTION_KEY=$ENCRYPTION_KEY" >> .env
echo "API_KEYS=$API_KEYS" >> .env
```

---

### 3. Rate Limiting e Input Sanitization

**Problema**: Middleware de segurança desabilitado

**Correção**:
- ✅ Rate limiting global reabilitado
- ✅ Rate limiting específico para auth reabilitado
- ✅ Input sanitization (XSS, injection) reabilitado
- ✅ Limite de payload reduzido: 10MB (JSON), 5MB (urlencoded)

**Arquivo modificado**: `app.js`

---

### 4. Criptografia de Certificados e Senhas

**Problema**: Certificados digitais e senhas armazenados em plaintext

**Correção**:
- ✅ Novo serviço `encryption-service.js` criado (AES-256-GCM)
- ✅ Certificados criptografados antes de salvar no disco
- ✅ Senhas criptografadas com AES-256-GCM
- ✅ IV (Initialization Vector) aleatório por arquivo
- ✅ Auth tag para validação de integridade

**Arquivos criados/modificados**:
- `services/encryption-service.js` (NOVO)
- `services/certificate-service.js`
- `routes/configuracoes.js`

**Uso**:
```javascript
const encryptionService = require('./services/encryption-service');

// Criptografar
const encrypted = encryptionService.encrypt('senha123');

// Descriptografar
const decrypted = encryptionService.decrypt(encrypted);

// Buffer (certificados)
const encryptedBuffer = encryptionService.encryptBuffer(certificadoBuffer);
const decryptedBuffer = encryptionService.decryptBuffer(encryptedBuffer);
```

---

### 5. Deploy Não-Root

**Problema**: Deploy executado como root (risco de comprometimento total)

**Correção**:
- ✅ Usuário alterado de `root` para `nfeapp`
- ✅ Caminho alterado de `/var/www/` para `/home/nfeapp/`

**Arquivo modificado**: `.github/workflows/deploy-contabo.yml`

**Configurar servidor**:
```bash
# No servidor Contabo
sudo adduser nfeapp
sudo usermod -aG sudo nfeapp

# Criar diretórios
sudo mkdir -p /home/nfeapp/brandaocontador-nfe-backend
sudo chown -R nfeapp:nfeapp /home/nfeapp/brandaocontador-nfe-backend

# Configurar PM2 para nfeapp
sudo su - nfeapp
npm install -g pm2
pm2 startup
```

---

### 6. SSH Verificação de Host

**Problema**: `StrictHostKeyChecking=no` permite MITM attacks

**Correção**:
- ✅ `StrictHostKeyChecking=no` removido
- ✅ `ssh-keyscan` adicionado para popular known_hosts
- ✅ Verificação de fingerprint ativada

**Arquivo modificado**: `.github/workflows/deploy-contabo.yml`

---

### 7. SSL Relaxado em SEFAZ Removido

**Problema**: Cliente SEFAZ com `strictSSL: false` permite MITM

**Correção**:
- ✅ Fallback para SSL relaxado REMOVIDO
- ✅ Sistema agora FALHA se SSL não validar corretamente
- ✅ Ciphers modernos configurados (ECDHE, CHACHA20-POLY1305)
- ✅ TLS 1.2+ obrigatório
- ✅ Mensagens de erro descritivas para troubleshooting

**Arquivo modificado**: `services/sefaz-client.js`

**Troubleshooting SSL SEFAZ**:
```bash
# Verificar certificado CA
openssl s_client -connect nfe.sefaz.sp.gov.br:443 -showcerts

# Atualizar CA bundle
curl https://curl.se/ca/cacert.pem -o certs/ca-bundle.pem

# Verificar certificado digital
openssl pkcs12 -info -in certificado.pfx -passin pass:senha -noout
```

---

## 📋 Checklist Pré-Deploy

Antes de fazer deploy em produção, certifique-se de:

### Variáveis de Ambiente

- [ ] `JWT_SECRET` gerado com `openssl rand -base64 32`
- [ ] `ENCRYPTION_KEY` gerado com `openssl rand -hex 32`
- [ ] `API_KEYS` geradas (mínimo 1, separadas por vírgula)
- [ ] `NODE_ENV=production`
- [ ] `AMBIENTE=1` (produção SEFAZ)
- [ ] `SIMULATION_MODE=false`

### Servidor

- [ ] Usuário `nfeapp` criado
- [ ] PM2 configurado para `nfeapp`
- [ ] Certificado SSL instalado (Let's Encrypt)
- [ ] Nginx configurado e testado (`nginx -t`)
- [ ] Firewall configurado (UFW/iptables)
- [ ] Portas abertas: 80 (HTTP), 443 (HTTPS), 22 (SSH)
- [ ] Porta 3000 (Node.js) fechada para acesso externo

### GitHub Secrets

- [ ] `CONTABO_SSH_PRIVATE_KEY` configurado
- [ ] Chave SSH pública adicionada ao servidor

### Certificados

- [ ] Certificado A1 válido (não expirado)
- [ ] CA bundle atualizado (`certs/ca-bundle.pem`)
- [ ] Senha do certificado salva de forma segura

---

## 🚨 Avisos Importantes

### 1. Backup antes de aplicar

```bash
# Backup do backend
tar -czf backend-backup-$(date +%Y%m%d).tar.gz \
  app.js package.json services/ routes/ middleware/ config/ data/

# Backup do Nginx
sudo cp /etc/nginx/sites-available/default \
  /etc/nginx/sites-available/default.backup
```

### 2. Monitoramento

Após deploy, monitore:
- Logs do Nginx: `/var/log/nginx/nfe_ssl_error.log`
- Logs do PM2: `pm2 logs nfe-backend`
- Tentativas de login falhadas
- Erros de rate limiting (429)

### 3. Rollback

Se algo der errado:
```bash
# Restaurar configuração anterior
sudo cp /etc/nginx/sites-available/default.backup \
  /etc/nginx/sites-available/default
sudo systemctl reload nginx

# Voltar versão anterior via PM2
pm2 restart nfe-backend --update-env
```

---

## 🔍 Testes de Segurança

### 1. Teste SSL/TLS

```bash
# SSL Labs (online)
https://www.ssllabs.com/ssltest/analyze.html?d=api.brandaocontador.com.br

# Comando local
openssl s_client -connect api.brandaocontador.com.br:443 -tls1_2
```

### 2. Teste Rate Limiting

```bash
# Deve retornar 429 após limite
for i in {1..10}; do
  curl -X POST https://api.brandaocontador.com.br/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","senha":"wrong"}'
done
```

### 3. Teste HTTPS Redirect

```bash
# Deve retornar 301
curl -I http://api.brandaocontador.com.br
```

### 4. Teste Secrets

```bash
# Deve falhar se JWT_SECRET não estiver configurado
JWT_SECRET= node app.js
```

---

## 📊 Impacto das Mudanças

| Mudança | Impacto | Mitigação |
|---------|---------|-----------|
| HTTPS obrigatório | Clientes HTTP falham | Automático (301 redirect) |
| JWT expiry 4h | Sessões expiram mais rápido | Implementar refresh token |
| Rate limiting | Requisições bloqueadas | Avisar usuários, ajustar limites |
| SSL SEFAZ strict | Falha se cert inválido | Manter certificados atualizados |
| Deploy não-root | Menos permissões | Ajustar permissões de arquivos |

---

## 📝 Próximas Fases

**Fase 2 - Funcionalidades Críticas** (próximo):
- Implementar Substituição Tributária (ST)
- Validação real de certificados (node-forge)
- Corrigir race condition em numeração
- Validação de chave de acesso (checksum módulo 11)
- Validação de Inscrição Estadual por UF

**Fase 3 - Performance e Estabilidade**:
- Corrigir memory leaks
- Otimizar re-renders do frontend
- Implementar retry logic
- Log rotation

**Fase 4 - Qualidade de Código**:
- Remover tipos `any` do TypeScript
- Consolidar validações duplicadas
- Implementar testes automatizados

---

## 🆘 Suporte

Em caso de problemas após aplicar estas correções:

1. Verifique logs: `pm2 logs nfe-backend --lines 100`
2. Verifique configuração: `nginx -t`
3. Verifique variáveis de ambiente: `pm2 env nfe-backend`
4. Revise este documento
5. Consulte auditoria completa: `AUDITORIA_COMPLETA_BACKEND.md`

---

**Última atualização**: 2025-11-03  
**Versão**: 1.0  
**Responsável**: Auditoria Automatizada
