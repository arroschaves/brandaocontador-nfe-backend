# 🚀 Guia Completo de Deploy - Brandão Contador NFe

## 📋 Visão Geral da Arquitetura

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Cloudflare    │    │     Vercel       │    │  DigitalOcean   │
│   (DNS + CDN)   │────│   (Frontend)     │────│   (Backend)     │
│                 │    │   Next.js        │    │   Node.js       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Componentes:
- **Frontend**: Next.js hospedado no Vercel
- **Backend**: Node.js hospedado no DigitalOcean Ubuntu
- **DNS**: Cloudflare para gerenciamento de domínio
- **SSL**: Let's Encrypt via Certbot

## 🏗️ Configuração Inicial

### 1. Servidor DigitalOcean

#### 1.1 Acesso ao Servidor
```bash
ssh root@159.89.228.223
```

#### 1.2 Configuração Inicial
```bash
# Executar script de configuração
curl -sSL https://raw.githubusercontent.com/arroschaves/brandaocontador-nfe-backend/main/scripts/setup-server.sh | sudo bash
```

#### 1.3 Configurar SSL
```bash
# Após configurar DNS no Cloudflare
sudo certbot --nginx -d api.brandaocontador.com.br
```

### 2. Configuração do DNS (Cloudflare)

#### 2.1 Registros DNS Necessários
```
Tipo    Nome                        Valor               TTL
A       api.brandaocontador.com.br  159.89.228.223     Auto
CNAME   www.brandaocontador.com.br  brandaocontador-nfe-frontend.vercel.app  Auto
A       brandaocontador.com.br      [Vercel IP]        Auto
```

#### 2.2 Configurações SSL/TLS
- **Modo SSL/TLS**: Full (strict)
- **Always Use HTTPS**: Ativado
- **HSTS**: Ativado
- **Min TLS Version**: 1.2

## 🚀 Deploy do Backend

### 1. Preparação
```bash
# Mudar para usuário da aplicação
su - nfeapp

# Clonar repositório
git clone https://github.com/arroschaves/brandaocontador-nfe-backend.git /var/www/brandaocontador-nfe-backend
cd /var/www/brandaocontador-nfe-backend
```

### 2. Configuração
```bash
# Copiar e configurar variáveis de ambiente
cp .env.production .env
nano .env

# Configurar certificados NFe
mkdir -p certs
# Copiar certificados para o diretório certs/
```

### 3. Deploy
```bash
# Executar script de deploy
chmod +x deploy/deploy.sh
./deploy/deploy.sh
```

### 4. Configurar Nginx
```bash
# Copiar configuração do Nginx
sudo cp deploy/nginx.conf /etc/nginx/sites-available/brandaocontador-nfe-backend
sudo ln -s /etc/nginx/sites-available/brandaocontador-nfe-backend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 🌐 Deploy do Frontend

### 1. Configuração no Vercel

#### 1.1 Variáveis de Ambiente
```
NEXT_PUBLIC_API_URL=https://api.brandaocontador.com.br
NEXT_PUBLIC_ENVIRONMENT=production
NEXTAUTH_URL=https://brandaocontador.com.br
NEXTAUTH_SECRET=sua_secret_key_aqui
```

#### 1.2 Domínio Personalizado
- Adicionar domínio: `brandaocontador.com.br`
- Configurar redirecionamento: `www.brandaocontador.com.br` → `brandaocontador.com.br`

### 2. Deploy Automático
O deploy é automático via GitHub. Cada push na branch `main` dispara um novo deploy.

## 🔧 Monitoramento e Manutenção

### 1. Comandos Úteis

#### Backend (DigitalOcean)
```bash
# Status da aplicação
pm2 status

# Logs em tempo real
pm2 logs brandaocontador-nfe-backend

# Restart da aplicação
pm2 restart brandaocontador-nfe-backend

# Monitoramento
pm2 monit

# Status do Nginx
sudo systemctl status nginx

# Logs do Nginx
sudo tail -f /var/log/nginx/brandaocontador-nfe-backend.access.log
```

#### Frontend (Vercel)
- Dashboard: https://vercel.com/arroschaves1973/brandaocontador-nfe-frontend
- Logs: Disponíveis no dashboard do Vercel
- Analytics: Integrado no Vercel

### 2. Backup e Segurança

#### 2.1 Backup dos Certificados
```bash
# Criar backup dos certificados NFe
tar -czf backup-certs-$(date +%Y%m%d).tar.gz /var/www/brandaocontador-nfe-backend/certs/
```

#### 2.2 Backup do Banco de Dados (se aplicável)
```bash
# Backup de logs e dados
tar -czf backup-data-$(date +%Y%m%d).tar.gz /var/www/brandaocontador-nfe-backend/logs/
```

#### 2.3 Atualizações de Segurança
```bash
# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Renovar certificados SSL
sudo certbot renew --dry-run
```

## 🚨 Troubleshooting

### 1. Problemas Comuns

#### Backend não responde
```bash
# Verificar status
pm2 status
pm2 logs brandaocontador-nfe-backend

# Verificar porta
sudo netstat -tlnp | grep :3001

# Verificar Nginx
sudo nginx -t
sudo systemctl status nginx
```

#### Erro de certificado NFe
```bash
# Verificar certificados
ls -la /var/www/brandaocontador-nfe-backend/certs/
openssl pkcs12 -info -in "certs/MAP LTDA45669746000120_compatible.pfx" -noout
```

#### Problemas de conectividade SEFAZ
```bash
# Testar conectividade
curl -I https://hom.nfe.sefaz.ms.gov.br/ws/NFeAutorizacao4.asmx?wsdl
```

### 2. Logs Importantes

#### Localizações dos Logs
```
Backend:
- Aplicação: /var/www/brandaocontador-nfe-backend/logs/
- PM2: ~/.pm2/logs/
- Nginx: /var/log/nginx/

Frontend:
- Vercel Dashboard: https://vercel.com/dashboard
```

## 📊 Monitoramento de Performance

### 1. Métricas Importantes
- **Uptime**: Disponibilidade da aplicação
- **Response Time**: Tempo de resposta das APIs
- **Error Rate**: Taxa de erros
- **Memory Usage**: Uso de memória
- **CPU Usage**: Uso de CPU

### 2. Alertas Recomendados
- Aplicação offline por mais de 5 minutos
- Uso de memória acima de 80%
- Taxa de erro acima de 5%
- Certificado SSL expirando em 30 dias

## 🔄 Processo de Atualização

### 1. Backend
```bash
cd /var/www/brandaocontador-nfe-backend
git pull origin main
npm ci --production
pm2 restart brandaocontador-nfe-backend
```

### 2. Frontend
O frontend é atualizado automaticamente via Vercel quando há push na branch `main`.

## 📞 Suporte

### Contatos Importantes
- **SEFAZ-MS**: Para questões relacionadas aos certificados
- **Cloudflare**: Para questões de DNS e CDN
- **Vercel**: Para questões do frontend
- **DigitalOcean**: Para questões do servidor

### Documentação Adicional
- [Documentação SEFAZ](https://www.nfe.fazenda.gov.br/)
- [Vercel Docs](https://vercel.com/docs)
- [DigitalOcean Docs](https://docs.digitalocean.com/)
- [Cloudflare Docs](https://developers.cloudflare.com/)

---

**Última atualização**: $(date)
**Versão**: 1.0.0