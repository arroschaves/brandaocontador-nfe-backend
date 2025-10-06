# 🌐 Arquitetura de Subdomínios - Brandão Contador

## 📋 Configuração Atual no Cloudflare

### Subdomínios Configurados:

| Subdomínio | Destino | Tipo | Proxy | Função |
|------------|---------|------|-------|--------|
| `www.brandaocontador.com.br` | Vercel | CNAME | ✅ Com Proxy | Site institucional |
| `nfe.brandaocontador.com.br` | Vercel | CNAME | ❌ Somente DNS | Sistema NFe |
| `api.brandaocontador.com.br` | 159.89.228.223 | A | ✅ Com Proxy | API Backend |
| `app.brandaocontador.com.br` | 159.89.228.223 | A | ✅ Com Proxy | Aplicação Principal |
| `admin.brandaocontador.com.br` | 159.89.228.223 | A | ✅ Com Proxy | **Painel Administrativo** |

## 🔧 Configuração Recomendada para Admin

### 1. Configuração do Servidor (159.89.228.223)

O subdomínio `admin.brandaocontador.com.br` deve servir:
- **Frontend Admin**: Interface administrativa
- **Autenticação Restrita**: Apenas usuários admin
- **Dashboard Completo**: Visualização de todos os dados
- **Gerenciamento de Usuários**: CRUD completo

### 2. Configurações de Segurança

```nginx
# Configuração Nginx para admin.brandaocontador.com.br
server {
    listen 80;
    server_name admin.brandaocontador.com.br;
    
    # Redirecionamento HTTPS obrigatório
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name admin.brandaocontador.com.br;
    
    # Certificados SSL (Cloudflare)
    ssl_certificate /path/to/ssl/cert.pem;
    ssl_certificate_key /path/to/ssl/private.key;
    
    # Configurações de segurança extras para admin
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";
    
    # Restrição de IP (opcional)
    # allow 192.168.1.0/24;  # Sua rede local
    # deny all;
    
    location / {
        proxy_pass http://localhost:3000;  # Frontend Admin
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    location /api/ {
        proxy_pass http://localhost:3001;  # Backend API
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 3. Configurações do Cloudflare

#### Regras de Página Recomendadas:
- **URL**: `admin.brandaocontador.com.br/*`
- **Configurações**:
  - SSL: Full (Strict)
  - Security Level: High
  - Cache Level: Bypass
  - Browser Integrity Check: On

#### Firewall Rules:
```
(http.host eq "admin.brandaocontador.com.br" and not ip.src in {SEU_IP_FIXO})
Action: Block
```

## 🚀 Implementação

### Opção 1: Subdomínio Dedicado (Recomendado)
- `admin.brandaocontador.com.br` → Interface administrativa completa
- Aplicação Next.js separada com foco em administração
- Autenticação obrigatória com role "admin"

### Opção 2: Rota Protegida
- `app.brandaocontador.com.br/admin` → Seção administrativa
- Mesma aplicação com rotas protegidas
- Middleware de verificação de role

## 📊 Benefícios da Arquitetura Atual

1. **Separação de Responsabilidades**: Cada subdomínio tem função específica
2. **Escalabilidade**: Fácil de escalar cada serviço independentemente
3. **Segurança**: Isolamento entre diferentes funcionalidades
4. **Manutenção**: Atualizações independentes por serviço
5. **Performance**: Otimização específica por tipo de conteúdo

## 🔐 Credenciais de Admin

**Email**: `admin@brandaocontador.com.br`
**Senha**: `admin123`
**Role**: `admin`

## 📝 Próximos Passos

1. ✅ Configurar interface administrativa
2. ✅ Implementar autenticação com roles
3. ⏳ Configurar Nginx para subdomínio admin
4. ⏳ Implementar regras de firewall
5. ⏳ Configurar monitoramento específico