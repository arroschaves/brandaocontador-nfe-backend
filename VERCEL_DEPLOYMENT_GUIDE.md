# Guia de Deployment no Vercel

## Problema Identificado
O deployment atual no Vercel (`https://brandaocontador-nfe-frontend.vercel.app/`) não está atualizado com o código mais recente do repositório GitHub.

## Solução

### 1. Conectar Vercel ao GitHub (Recomendado)

1. Acesse [vercel.com](https://vercel.com) e faça login
2. Vá em "Dashboard" → "Import Project"
3. Conecte com GitHub e selecione o repositório: `arroschaves/brandaocontador-nfe-backend`
4. Configure as seguintes opções:
   - **Framework Preset**: Next.js
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
   - **Install Command**: `npm install`

### 2. Variáveis de Ambiente no Vercel

Configure estas variáveis no painel do Vercel:
```
NEXT_PUBLIC_API_URL=https://api.brandaocontador.com.br
NEXT_PUBLIC_ENVIRONMENT=production
```

### 3. Configuração de Domínio Personalizado

Para usar `nfe.brandaocontador.com.br`:
1. No painel do Vercel, vá em "Settings" → "Domains"
2. Adicione o domínio: `nfe.brandaocontador.com.br`
3. Configure o DNS no Cloudflare:
   - Tipo: CNAME
   - Nome: nfe
   - Valor: cname.vercel-dns.com

## Deployment Automático

Após a configuração, qualquer push para a branch `main` irá automaticamente:
1. Fazer build do frontend
2. Fazer deploy no Vercel
3. Atualizar o site em tempo real

## URLs Finais

- **Sistema NFe**: `https://nfe.brandaocontador.com.br`
- **API Backend**: `https://api.brandaocontador.com.br`
- **Site Principal**: `https://brandaocontador.com.br`

## Status Atual

✅ Código atualizado no GitHub (commit: cac423f)
✅ Backend funcionando em produção
✅ Configuração do Vercel pronta
⏳ Aguardando conexão Vercel → GitHub