# 🛡️ Guia de Acesso ao Painel Administrativo

## 📋 Resumo da Configuração

O painel administrativo foi configurado para ser acessado através do subdomínio `admin.brandaocontador.com.br`.

## 🌐 Configuração DNS (Cloudflare)

✅ **Status**: Configurado
- **Subdomínio**: `admin.brandaocontador.com.br`
- **Tipo**: A Record
- **IP**: `159.89.228.223`
- **Proxy**: Ativado (🟠)
- **SSL**: Automático via Cloudflare

## 🔧 Configuração do Servidor

### Nginx
✅ **Configuração criada**: `/etc/nginx/sites-available/admin.brandaocontador.com.br`
✅ **Site ativado**: Link simbólico criado em `/etc/nginx/sites-enabled/`
✅ **Nginx recarregado**: Configuração aplicada

### Configuração do Proxy
```nginx
server {
    server_name admin.brandaocontador.com.br;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Redirecionamento automático para /admin/login
    location = / {
        return 301 https://$host/admin/login;
    }
}
```

## 🚀 Opções de Deploy do Frontend

### Opção 1: Deploy no Servidor (Recomendado)
Para ter o painel administrativo funcionando via `admin.brandaocontador.com.br`, você precisa fazer o deploy do frontend no servidor:

1. **Fazer build do projeto**:
   ```bash
   cd frontend
   npm run build
   ```

2. **Enviar para o servidor**:
   ```bash
   scp -r .next package.json package-lock.json root@159.89.228.223:/var/www/brandaocontador-frontend/
   ```

3. **Instalar dependências no servidor**:
   ```bash
   ssh root@159.89.228.223
   cd /var/www/brandaocontador-frontend
   npm install --production
   ```

4. **Configurar PM2 para rodar o frontend**:
   ```bash
   pm2 start npm --name "frontend" -- start
   pm2 save
   ```

### Opção 2: Usar Vercel (Atual)
Se preferir manter no Vercel, você pode:

1. **Configurar redirecionamento no Nginx**:
   ```nginx
   location / {
       proxy_pass https://seu-projeto.vercel.app;
   }
   ```

2. **Configurar variáveis de ambiente no Vercel**:
   - `NEXTAUTH_URL=https://admin.brandaocontador.com.br`
   - `NEXT_PUBLIC_BACKEND_URL=https://api.brandaocontador.com.br`

## 🔐 Credenciais de Acesso Administrativo

### Usuário Administrador Padrão
- **Email**: `admin@brandaocontador.com.br`
- **Senha**: `admin123`
- **Role**: `admin` (ou `admin_total` para acesso completo)
- Variáveis de seed no `.env` do backend:
  - `SEED_ADMIN_NOME=Administrador`
  - `SEED_ADMIN_EMAIL=admin@brandaocontador.com.br`
  - `SEED_ADMIN_SENHA=admin123`

### URLs de Acesso
- **Painel Admin**: `https://admin.brandaocontador.com.br/admin`
- **Login Admin**: `https://admin.brandaocontador.com.br/admin/login`
- **Redirecionamento**: `https://admin.brandaocontador.com.br/` → `/admin/login`

## 🛠️ Funcionalidades do Painel

### Dashboard Administrativo
- 📊 Estatísticas gerais do sistema
- 👥 Gerenciamento de usuários
- 🧾 Visualização de NFe (em desenvolvimento)
- ⚙️ Configurações do sistema
- 📝 Logs de atividades

### Gerenciamento de Usuários
- ✅ Listar todos os usuários
- ❌ Excluir usuários
- 🔄 Alterar roles (admin/user)
- 📈 Estatísticas de usuários

### Segurança
- 🔒 Autenticação obrigatória
- 🛡️ Verificação de role 'admin'
- 🚫 Redirecionamento automático para não-admins
- 🔐 Middleware de proteção
 - 🔑 Suporte a login social (Google/Facebook) integrado via `/auth/social`
 
#### Boas Práticas Pós-Primeiro Acesso
- Altere imediatamente a senha do usuário administrador padrão.
- Confirme as roles `admin_total` e `admin` no usuário admin e remova permissões desnecessárias.
- Após criar o admin, remova/comente `SEED_ADMIN_NOME`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_SENHA` do `.env` do backend para evitar reuso acidental.
- Mantenha `SIMULATION_MODE=false` em produção.
- Gere segredos fortes: `JWT_SECRET` e `NEXTAUTH_SECRET` (32+ caracteres) e não versione.

## 🔍 Verificação de Status

### Verificar se o frontend está rodando:
```bash
ssh root@159.89.228.223 "ps aux | grep -E '(next|node.*3000)'"
```

### Verificar logs do Nginx:
```bash
ssh root@159.89.228.223 "tail -f /var/log/nginx/access.log"
```

### Testar conectividade:
```bash
curl -I http://admin.brandaocontador.com.br
```

## 🚨 Próximos Passos

1. **Deploy do Frontend**: Escolher entre servidor próprio ou Vercel
2. **SSL Certificate**: Configurar Let's Encrypt para HTTPS
3. **Monitoramento**: Configurar logs e alertas
4. **Backup**: Implementar backup automático dos dados

## 📞 Suporte

Para acessar o painel administrativo:
1. Acesse: `https://admin.brandaocontador.com.br`
2. Será redirecionado para: `/admin/login`
3. Use as credenciais: `admin@brandaocontador.com.br` / `admin123`
4. Após login, acesse: `/admin` para o dashboard

---

**Nota**: O frontend precisa estar rodando na porta 3000 do servidor para que o proxy Nginx funcione corretamente.