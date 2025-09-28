# 🌐 Configuração DNS Cloudflare - Sistema NFe

## 📋 Configuração Atual Analisada

Baseado na sua configuração DNS atual, aqui está o plano para adicionar o sistema NFe:

### ✅ Registros Existentes (Manter):
- `brandaocontador.com.br` → `216.198.79.1` (Site principal)
- `www` → `4e39985949c6fdd1.vercel-dns-017.com` (Vercel)
- `api` → `159.89.228.223` (Backend NFe - ✅ Funcionando)
- `admin` → `159.89.228.223`
- `app` → `159.89.228.223`

## 🎯 Novo Registro para NFe

### Adicionar no Cloudflare:

```
Tipo: CNAME
Nome: nfe
Conteúdo: brandaocontador-nfe-frontend.vercel.app
Status do proxy: Com proxy (🟠)
TTL: Auto
```

## 📝 Passos Detalhados:

### 1. No Cloudflare Dashboard:
1. Acesse **DNS > Registros**
2. Clique em **Adicionar registro**
3. Selecione **CNAME**
4. **Nome**: `nfe`
5. **Conteúdo**: `brandaocontador-nfe-frontend.vercel.app`
6. **Status do proxy**: ✅ Com proxy (nuvem laranja)
7. **TTL**: Auto
8. Clique em **Salvar**

### 2. No Vercel:
1. Acesse seu projeto: `brandaocontador-nfe-frontend`
2. Vá em **Settings > Domains**
3. Clique em **Add Domain**
4. Digite: `nfe.brandaocontador.com.br`
5. Clique em **Add**
6. Aguarde verificação (5-10 minutos)

## 🔄 Alternativa (Se preferir usar o subdomínio "app"):

Se quiser usar `app.brandaocontador.com.br` em vez de criar `nfe`:

### Modificar registro existente:
```
Tipo: CNAME (alterar o registro A existente)
Nome: app
Conteúdo: brandaocontador-nfe-frontend.vercel.app
Status do proxy: Com proxy (🟠)
TTL: Auto
```

## ✅ URLs Finais:

### Opção 1 (Recomendada):
- **Sistema NFe**: `https://nfe.brandaocontador.com.br`
- **API Backend**: `https://api.brandaocontador.com.br` (já funcionando)
- **Site Principal**: `https://brandaocontador.com.br`

### Opção 2 (Usando app):
- **Sistema NFe**: `https://app.brandaocontador.com.br`
- **API Backend**: `https://api.brandaocontador.com.br` (já funcionando)
- **Site Principal**: `https://brandaocontador.com.br`

## ⚠️ Importante:

- **Não haverá conflito** com registros existentes
- **Propagação DNS**: 5-15 minutos
- **Certificado SSL**: Automático via Cloudflare
- **Backup**: Sempre mantenha `https://brandaocontador-nfe-frontend.vercel.app/` funcionando

## 🧪 Teste após configuração:

```bash
# Verificar propagação DNS
nslookup nfe.brandaocontador.com.br

# Testar acesso
curl -I https://nfe.brandaocontador.com.br
```

## 📞 Suporte:

Se encontrar problemas:
1. Verifique se o registro foi salvo no Cloudflare
2. Confirme que o domínio foi adicionado no Vercel
3. Aguarde até 15 minutos para propagação completa
4. Teste em modo anônimo/incógnito do navegador