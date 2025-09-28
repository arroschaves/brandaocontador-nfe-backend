# 🌐 Configuração Cloudflare - Brandão Contador NFe

## 📋 Registros DNS Necessários

### 1. Registros Principais
```
Tipo    Nome                        Valor                                           Proxy   TTL
A       @                          [IP do Vercel ou CNAME]                        ✅      Auto
A       api                        159.89.228.223                                  ✅      Auto
CNAME   www                        brandaocontador-nfe-frontend.vercel.app        ✅      Auto
```

### 2. Registros de Verificação (se necessário)
```
TXT     @                          "vercel-verification=xxxxxxxx"                 ❌      Auto
TXT     @                          "v=spf1 include:_spf.google.com ~all"         ❌      Auto
```

## 🔒 Configurações SSL/TLS

### 1. Configurações Gerais
- **Modo SSL/TLS**: `Full (strict)`
- **Always Use HTTPS**: `Ativado`
- **Automatic HTTPS Rewrites**: `Ativado`
- **Opportunistic Encryption**: `Ativado`

### 2. Edge Certificates
- **Universal SSL**: `Ativado`
- **TLS 1.3**: `Ativado`
- **Minimum TLS Version**: `1.2`
- **Certificate Transparency Monitoring**: `Ativado`

### 3. Origin Server
```
Certificate Authority: Let's Encrypt
Hostnames: 
  - api.brandaocontador.com.br
  - *.brandaocontador.com.br
```

## ⚡ Configurações de Performance

### 1. Speed
- **Auto Minify**: 
  - ✅ JavaScript
  - ✅ CSS  
  - ✅ HTML
- **Brotli**: `Ativado`
- **Early Hints**: `Ativado`

### 2. Caching
- **Caching Level**: `Standard`
- **Browser Cache TTL**: `4 hours`
- **Always Online**: `Ativado`

### 3. Page Rules
```
1. api.brandaocontador.com.br/*
   - Cache Level: Bypass
   - Security Level: Medium
   - SSL: Full (strict)

2. *.brandaocontador.com.br/api/*
   - Cache Level: Bypass
   - Security Level: Medium

3. brandaocontador.com.br/*
   - Cache Level: Standard
   - Browser Cache TTL: 1 day
   - Edge Cache TTL: 1 day
```

## 🛡️ Configurações de Segurança

### 1. Firewall
- **Security Level**: `Medium`
- **Challenge Passage**: `30 minutes`
- **Browser Integrity Check**: `Ativado`

### 2. Rate Limiting
```
Rule 1: API Protection
- URL: api.brandaocontador.com.br/api/*
- Threshold: 100 requests per 1 minute
- Action: Challenge
- Duration: 1 hour

Rule 2: General Protection  
- URL: *.brandaocontador.com.br/*
- Threshold: 300 requests per 5 minutes
- Action: Challenge
- Duration: 30 minutes
```

### 3. Bot Fight Mode
- **Bot Fight Mode**: `Ativado`
- **Super Bot Fight Mode**: `Ativado` (se disponível no plano)

## 🔄 Configurações de Redirecionamento

### 1. Bulk Redirects
```
Source URL                          Target URL                              Status
http://brandaocontador.com.br/*     https://brandaocontador.com.br/$1      301
http://www.brandaocontador.com.br/* https://brandaocontador.com.br/$1      301
https://www.brandaocontador.com.br/* https://brandaocontador.com.br/$1     301
```

### 2. Transform Rules
```
Rule 1: Security Headers
- Expression: hostname eq "brandaocontador.com.br"
- Headers:
  - X-Frame-Options: DENY
  - X-Content-Type-Options: nosniff
  - Referrer-Policy: strict-origin-when-cross-origin
  - Permissions-Policy: camera=(), microphone=(), geolocation=()

Rule 2: API CORS Headers
- Expression: hostname eq "api.brandaocontador.com.br"
- Headers:
  - Access-Control-Allow-Origin: https://brandaocontador.com.br
  - Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
  - Access-Control-Allow-Headers: Content-Type, Authorization
```

## 📊 Configurações de Analytics

### 1. Web Analytics
- **Web Analytics**: `Ativado`
- **Core Web Vitals**: `Ativado`

### 2. Custom Events (se necessário)
```
Event 1: NFe Submission
- Rule: api.brandaocontador.com.br/api/nfe/enviar
- Action: Track

Event 2: Page Views
- Rule: brandaocontador.com.br/*
- Action: Track
```

## 🚀 Workers (Opcional)

### 1. Worker para Cache API
```javascript
// worker-api-cache.js
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  
  // Bypass cache para APIs NFe
  if (url.pathname.includes('/api/nfe/')) {
    return fetch(request)
  }
  
  // Cache outras APIs por 5 minutos
  const cache = caches.default
  const cacheKey = new Request(url.toString(), request)
  let response = await cache.match(cacheKey)
  
  if (!response) {
    response = await fetch(request)
    const responseClone = response.clone()
    
    if (response.status === 200) {
      responseClone.headers.set('Cache-Control', 'max-age=300')
      event.waitUntil(cache.put(cacheKey, responseClone))
    }
  }
  
  return response
}
```

### 2. Routes
```
api.brandaocontador.com.br/* → worker-api-cache.js
```

## 🔧 Configurações Avançadas

### 1. Load Balancing (se múltiplos servidores)
```
Pool: brandaocontador-api
- Origin 1: 159.89.228.223:3001 (Primary)
- Health Check: /health
- Check Interval: 30s
```

### 2. Argo Smart Routing
- **Argo Smart Routing**: `Ativado` (se disponível no plano)
- **Tiered Cache**: `Ativado`

## 📱 Mobile Optimization

### 1. Mobile Redirect
- **Mobile Redirect**: `Desativado` (PWA responsivo)

### 2. AMP
- **AMP Real URL**: `Ativado` (se usando AMP)

## 🔍 Monitoramento

### 1. Notifications
```
Alert 1: High Error Rate
- Condition: Error rate > 5% for 5 minutes
- Action: Email notification

Alert 2: Origin Unreachable
- Condition: Origin server down
- Action: Email + SMS notification

Alert 3: SSL Certificate Expiry
- Condition: Certificate expires in 30 days
- Action: Email notification
```

### 2. Logs
- **Logpush**: Configurar para análise detalhada (se disponível)
- **Retention**: 30 dias

## 🛠️ Comandos CLI Úteis

### 1. Instalação da CLI
```bash
npm install -g @cloudflare/wrangler
wrangler login
```

### 2. Comandos Comuns
```bash
# Listar zonas
wrangler zone list

# Purgar cache
wrangler zone purge --zone-id=<zone-id> --files="https://brandaocontador.com.br/*"

# Deploy worker
wrangler publish

# Ver logs
wrangler tail
```

## 📋 Checklist de Configuração

### ✅ DNS
- [ ] Registro A para api.brandaocontador.com.br
- [ ] CNAME para www.brandaocontador.com.br
- [ ] Verificação de propagação DNS

### ✅ SSL/TLS
- [ ] Modo Full (strict) ativado
- [ ] Always Use HTTPS ativado
- [ ] Certificado válido no origin server

### ✅ Performance
- [ ] Auto Minify configurado
- [ ] Page Rules criadas
- [ ] Caching configurado

### ✅ Segurança
- [ ] Firewall configurado
- [ ] Rate limiting ativo
- [ ] Security headers configurados

### ✅ Monitoramento
- [ ] Analytics ativado
- [ ] Notifications configuradas
- [ ] Health checks ativos

---

**Nota**: Algumas funcionalidades podem variar dependendo do plano Cloudflare contratado.