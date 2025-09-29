# Configuração de Variáveis de Ambiente no Vercel

## Problema Identificado

O painel administrativo não está funcionando no Vercel porque as variáveis de ambiente necessárias para o NextAuth não estão configuradas.

## Variáveis Obrigatórias no Vercel

Acesse o painel do Vercel → Projeto → Settings → Environment Variables e adicione:

### Autenticação (Obrigatórias)
```
NEXTAUTH_URL=https://nfe.brandaocontador.com.br
NEXTAUTH_SECRET=sua_secret_key_super_segura_aqui_min_32_chars
```

### Backend API
```
NEXT_PUBLIC_BACKEND_URL=https://api.brandaocontador.com.br
NEXT_PUBLIC_ENVIRONMENT=production
```

### Aplicação
```
NEXT_PUBLIC_APP_NAME=Brandão Contador NFe
NEXT_PUBLIC_APP_VERSION=1.0.0
NEXT_PUBLIC_COMPANY_NAME=Brandão Contador
```

## Como Configurar

1. **Acesse o Vercel Dashboard**
   - Vá para https://vercel.com/dashboard
   - Selecione o projeto `brandaocontador-nfe-frontend`

2. **Configure as Variáveis**
   - Clique em "Settings" → "Environment Variables"
   - Adicione cada variável acima
   - Marque para todos os ambientes (Production, Preview, Development)

3. **Gere uma NEXTAUTH_SECRET**
   ```bash
   # Use este comando para gerar uma secret segura:
   openssl rand -base64 32
   ```

4. **Redeploy**
   - Após adicionar as variáveis, faça um redeploy
   - Ou force um novo commit para trigger automático

## Teste Após Configuração

Após configurar as variáveis de ambiente:

1. **Teste o site principal:**
   - https://nfe.brandaocontador.com.br

2. **Teste o painel admin:**
   - https://nfe.brandaocontador.com.br/admin/login
   - Credenciais: admin@brandaocontador.com / admin123456

3. **Teste o subdomínio (quando configurado):**
   - https://admin.brandaocontador.com.br

## Status Atual

- ✅ Código commitado e enviado para GitHub
- ✅ Vercel detectou as alterações
- ❌ Variáveis de ambiente não configuradas
- ❌ Painel admin retornando 404

## Próximos Passos

1. Configurar variáveis de ambiente no Vercel
2. Fazer redeploy
3. Testar funcionalidades
4. Configurar subdomínio admin.brandaocontador.com.br no Vercel (opcional)