# 🏗️ Arquitetura Completa - Brandão Contador

## 📊 **Mapeamento do Ecossistema**

### 🌐 **Domínios e Subdomínios**

```
brandaocontador.com.br (Ecossistema Digital Completo)
│
├── 🏠 www.brandaocontador.com.br
│   ├── 📍 Localização: Vercel
│   ├── 📂 Repositório: arroschaves/brandaocontador-site
│   ├── 🎯 Função: Site institucional/comercial
│   └── 📱 Tecnologia: [A identificar - provavelmente Next.js]
│
├── 📱 app.brandaocontador.com.br  
│   ├── 📍 Localização: Vercel
│   ├── 📂 Repositório: arroschaves/brandaocontador-nfe-frontend
│   ├── 🎯 Função: Sistema NFe (Interface do usuário)
│   └── 📱 Tecnologia: Next.js + TypeScript
│
├── 🔧 api.brandaocontador.com.br
│   ├── 📍 Localização: DigitalOcean (159.89.228.223)
│   ├── 📂 Repositório: arroschaves/brandaocontador-nfe-backend  
│   ├── 🎯 Função: Sistema NFe (API + Processamento)
│   └── 📱 Tecnologia: Node.js + Express
│
└── 👨‍💼 admin.brandaocontador.com.br
    ├── 📍 Localização: [A definir]
    ├── 📂 Repositório: [A definir]
    ├── 🎯 Função: Painel administrativo
    └── 📱 Tecnologia: [A definir]
```

## 🔄 **Fluxo de Integração**

### 🎯 **Jornada do Cliente**
```
1. 🏠 Site Principal (www) → Apresentação/Marketing
   ↓
2. 📱 Sistema NFe (app) → Funcionalidades específicas
   ↓  
3. 🔧 API Backend (api) → Processamento e SEFAZ
```

### 🔗 **Integrações Necessárias**

#### 1. **Site Principal → Sistema NFe**
```javascript
// No site principal (www.brandaocontador.com.br)
const redirectToNFe = () => {
  window.location.href = 'https://app.brandaocontador.com.br';
};
```

#### 2. **Sistema NFe → API Backend**
```javascript
// No frontend NFe (app.brandaocontador.com.br)
const API_BASE_URL = 'https://api.brandaocontador.com.br';
```

## 🛠️ **Configurações DNS Otimizadas**

### 📋 **Registros Cloudflare Recomendados**

```dns
# Registros A (IPv4)
A    brandaocontador.com.br     216.198.79.1      🟠 Proxied
A    api                        159.89.228.223    🟠 Proxied

# Registros CNAME  
CNAME www                       cname.vercel-dns.com    🟠 Proxied
CNAME app                       cname.vercel-dns.com    🟠 Proxied
CNAME admin                     [A definir]             🟠 Proxied

# Email (Zoho) - Manter como está
MX   brandaocontador.com.br     mx.zoho.com             🔴 DNS Only
TXT  brandaocontador.com.br     "v=spf1 include:zoho.com ~all"
```

### ⚠️ **Ações Urgentes no Cloudflare**

#### 1. **Ativar Proxy (CRÍTICO)**
Todos os registros estão em "DNS Only" - precisa ativar "Proxied":

```
ANTES (Atual - INSEGURO):
A    api                        159.89.228.223    🔴 DNS Only
CNAME www                       vercel-dns...     🔴 DNS Only

DEPOIS (Recomendado - SEGURO):  
A    api                        159.89.228.223    🟠 Proxied
CNAME www                       vercel-dns...     🟠 Proxied
```

#### 2. **Configurar SSL Full (Strict)**
```
Cloudflare → SSL/TLS → Overview
Modo: Full (strict) ✅
```

#### 3. **Page Rules Específicas**

**Rule 1: Site Principal (Cache Agressivo)**
```
URL: www.brandaocontador.com.br/*
Configurações:
- Cache Level: Standard
- Browser Cache TTL: 1 day
- Edge Cache TTL: 7 days
- Always Online: On
```

**Rule 2: Sistema NFe (Cache Moderado)**
```
URL: app.brandaocontador.com.br/*  
Configurações:
- Cache Level: Standard
- Browser Cache TTL: 4 hours
- Edge Cache TTL: 2 hours
```

**Rule 3: API Backend (Bypass Cache)**
```
URL: api.brandaocontador.com.br/*
Configurações:
- Cache Level: Bypass
- Security Level: High
- Rate Limiting: 200 req/min
```

**Rule 4: Redirecionamentos**
```
URL: brandaocontador.com.br/*
Forwarding URL: 301 → https://www.brandaocontador.com.br/$1
```

## 🔐 **Configurações de Segurança**

### 🛡️ **WAF Rules**

#### Rule 1: Proteção API
```
Rule Name: API Protection
Expression: (http.host eq "api.brandaocontador.com.br")
Action: Challenge if rate > 100 req/min
```

#### Rule 2: Proteção Geral
```
Rule Name: General Protection  
Expression: (cf.threat_score gt 10)
Action: Challenge
```

### 🔒 **Headers de Segurança**
```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
```

## 📈 **Monitoramento e Analytics**

### 📊 **Métricas por Subdomínio**

#### 🏠 Site Principal (www)
- **Foco**: Conversão, SEO, Performance
- **KPIs**: Page Speed, Bounce Rate, Conversions
- **Tools**: Google Analytics, Search Console

#### 📱 Sistema NFe (app)  
- **Foco**: Usabilidade, Disponibilidade
- **KPIs**: Uptime, Response Time, User Flow
- **Tools**: Cloudflare Analytics, Custom Metrics

#### 🔧 API Backend (api)
- **Foco**: Performance, Erros, Segurança  
- **KPIs**: Response Time, Error Rate, Throughput
- **Tools**: PM2 Monitoring, Cloudflare Logs

## 🚀 **Plano de Implementação**

### Fase 1: Segurança Básica (URGENTE)
- [ ] Ativar proxy Cloudflare em todos os domínios
- [ ] Configurar SSL Full (Strict)
- [ ] Implementar headers de segurança

### Fase 2: Performance
- [ ] Configurar Page Rules otimizadas
- [ ] Ativar compressão e minificação
- [ ] Configurar cache strategies

### Fase 3: Integração
- [ ] Conectar site principal com sistema NFe
- [ ] Implementar SSO/autenticação unificada
- [ ] Configurar analytics cross-domain

### Fase 4: Monitoramento
- [ ] Configurar alertas Cloudflare
- [ ] Implementar health checks
- [ ] Dashboard de monitoramento unificado

## 🔧 **Scripts de Configuração**

### Teste de Conectividade Completa
```bash
#!/bin/bash
echo "🔍 Testando ecossistema completo..."

echo "1. Site Principal:"
curl -I https://www.brandaocontador.com.br

echo "2. Sistema NFe:"  
curl -I https://app.brandaocontador.com.br

echo "3. API Backend:"
curl -I https://api.brandaocontador.com.br/health

echo "4. Redirecionamentos:"
curl -I http://brandaocontador.com.br
```

### Verificação de SSL
```bash
#!/bin/bash
domains=("www.brandaocontador.com.br" "app.brandaocontador.com.br" "api.brandaocontador.com.br")

for domain in "${domains[@]}"; do
  echo "🔒 Verificando SSL para $domain:"
  echo | openssl s_client -servername $domain -connect $domain:443 2>/dev/null | openssl x509 -noout -dates
done
```

## 📋 **Checklist de Validação**

### ✅ **Funcionalidades Básicas**
- [ ] Site principal carrega corretamente
- [ ] Sistema NFe é acessível  
- [ ] API responde aos health checks
- [ ] Redirecionamentos funcionam

### ✅ **Segurança**
- [ ] HTTPS forçado em todos os domínios
- [ ] Headers de segurança presentes
- [ ] Rate limiting ativo na API
- [ ] WAF configurado

### ✅ **Performance**  
- [ ] Cache configurado adequadamente
- [ ] Compressão ativa
- [ ] CDN funcionando
- [ ] Tempos de resposta < 2s

### ✅ **Integração**
- [ ] Navegação entre site e sistema NFe
- [ ] APIs comunicando corretamente
- [ ] Analytics tracking cross-domain
- [ ] Autenticação unificada (se aplicável)

---

**🎯 PRÓXIMOS PASSOS**: 
1. Ativar proxy Cloudflare (URGENTE)
2. Configurar SSL Full Strict  
3. Implementar Page Rules
4. Testar integração completa