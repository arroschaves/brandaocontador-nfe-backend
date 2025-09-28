# 🚀 DEPLOY WEB - Sistema NFe em Produção

## ✅ Status Atual
- ✅ Código corrigido e atualizado no GitHub (commit: 728bc34)
- ✅ Backend funcionando em: `https://api.brandaocontador.com.br`
- ✅ Frontend configurado para produção
- ⏳ **PRÓXIMO PASSO**: Deploy do frontend no Vercel

---

## 🎯 PASSO A PASSO PARA COLOCAR NA WEB

### 1️⃣ **CONECTAR VERCEL AO GITHUB** (5 minutos)

1. **Acesse**: https://vercel.com/dashboard
2. **Clique em**: "Add New..." → "Project"
3. **Conecte o repositório**: `arroschaves/brandaocontador-nfe-backend`
4. **Configure**:
   - **Framework Preset**: Next.js
   - **Root Directory**: `frontend` ⚠️ **IMPORTANTE**
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`

### 2️⃣ **CONFIGURAR VARIÁVEIS DE AMBIENTE**

No Vercel, adicione estas variáveis:
```
NEXT_PUBLIC_BACKEND_URL=https://api.brandaocontador.com.br
NEXT_PUBLIC_API_URL=https://api.brandaocontador.com.br
NEXT_PUBLIC_ENVIRONMENT=production
```

### 3️⃣ **CONFIGURAR DNS NO CLOUDFLARE**

1. **Acesse**: Cloudflare Dashboard → brandaocontador.com.br → DNS
2. **Adicione CNAME**:
   - **Type**: CNAME
   - **Name**: `nfe`
   - **Content**: `brandaocontador-nfe-frontend.vercel.app`
   - **Proxy Status**: ✅ Proxied
   - **TTL**: Auto

### 4️⃣ **CONFIGURAR DOMÍNIO NO VERCEL**

1. **No projeto Vercel**: Settings → Domains
2. **Adicione**: `nfe.brandaocontador.com.br`
3. **Aguarde**: Verificação automática

---

## 🌐 **URLS FINAIS**

Após o deploy:
- **Frontend NFe**: `https://nfe.brandaocontador.com.br`
- **API Backend**: `https://api.brandaocontador.com.br`
- **Site Principal**: `https://brandaocontador.com.br` (inalterado)

---

## ⚡ **DEPLOY AUTOMÁTICO**

✅ **Configurado**: Qualquer push para `main` fará deploy automático
✅ **Monitoramento**: Vercel mostrará logs de build em tempo real
✅ **Rollback**: Possível voltar para versões anteriores

---

## 🔧 **VERIFICAÇÃO FINAL**

Após deploy, teste:
1. ✅ `https://nfe.brandaocontador.com.br` - Frontend carregando
2. ✅ Status do sistema: "online" (conectando com API)
3. ✅ Funcionalidades básicas do NFe

---

## 📞 **SUPORTE**

Se houver problemas:
1. **Logs do Vercel**: Dashboard → Project → Functions
2. **DNS**: Pode levar até 24h para propagar
3. **API**: Cloudflare pode bloquear inicialmente (normal)

**🎯 RESULTADO**: Sistema NFe funcionando 100% na web!