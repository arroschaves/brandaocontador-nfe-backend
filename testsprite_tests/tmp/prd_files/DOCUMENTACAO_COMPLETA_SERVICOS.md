# 📚 Documentação Completa dos Serviços - Brandão Contador NFe

## 🏗️ Arquitetura Geral do Sistema

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Cloudflare    │    │     Vercel       │    │  DigitalOcean   │
│   (DNS + CDN)   │────│   (Frontend)     │────│   (Backend)     │
│ brandaocontador │    │ React/TypeScript │    │   Node.js       │
│    .com.br      │    │                  │    │   Ubuntu 25.04  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

---

## 🐙 GitHub - Repositórios

### Backend Repository
- **URL**: https://github.com/arroschaves/brandaocontador-nfe-backend.git
- **Branch Principal**: `main`
- **Tecnologias**: Node.js, Express, SQLite, PM2
- **CI/CD**: GitHub Actions configurado para deploy automático

### Frontend Repository  
- **URL**: https://github.com/arroschaves/brandaocontador-nfe-frontend.git
- **Branch Principal**: `main`
- **Tecnologias**: React, TypeScript, Vite, TailwindCSS
- **Deploy**: Automático via Vercel

### Comandos Git Úteis
```bash
# Clonar repositórios
git clone https://github.com/arroschaves/brandaocontador-nfe-backend.git
git clone https://github.com/arroschaves/brandaocontador-nfe-frontend.git

# Atualizar e fazer push
git add .
git commit -m "feat: descrição da alteração"
git push origin main
```

---

## ▲ Vercel - Frontend

### Informações do Projeto
- **URL de Produção**: https://brandaocontador-nfe-frontend.vercel.app
- **Domínio Personalizado**: https://nfe.brandaocontador.com.br
- **Framework**: React + TypeScript + Vite
- **Deploy**: Automático a cada push no branch `main`

### Variáveis de Ambiente (Vercel)
```env
VITE_API_URL=https://api.brandaocontador.com.br
VITE_APP_NAME=Sistema NFe Brandão Contador
VITE_ENVIRONMENT=production
```

### Comandos Vercel CLI
```bash
# Instalar CLI
npm install -g vercel

# Login
vercel login

# Deploy manual
vercel --prod

# Ver logs
vercel logs
```

### Configuração de Domínio
1. Acesse: https://vercel.com/dashboard
2. Selecione o projeto `brandaocontador-nfe-frontend`
3. Vá para `Settings > Domains`
4. Adicione: `nfe.brandaocontador.com.br`
5. Configure DNS no Cloudflare conforme instruções

---

## 🌊 DigitalOcean - Backend

### Informações do Servidor
- **Droplet**: ubuntu-s-1vcpu-512mb-10gb-nyc1-01
- **OS**: Ubuntu 25.04 x64
- **Recursos**: 512 MB RAM / 10 GB Disco / 1 vCPU
- **Localização**: NYC1 (Nova York)

### IPs e Conectividade
- **IPv4 Público**: `159.89.228.223`
- **IPv6**: Não habilitado
- **IP Privado**: `10.116.0.2`
- **SSH Port**: `2222` (customizado)

### Acesso SSH
```bash
# Conectar ao servidor (Windows)
ssh -i "$env:USERPROFILE\.ssh\digitalocean_key" -p 2222 root@159.89.228.223

# Conectar ao servidor (Linux/Mac)
ssh -i "~/.ssh/digitalocean_key" -p 2222 root@159.89.228.223

# Teste de conectividade
ssh -i "$env:USERPROFILE\.ssh\digitalocean_key" -p 2222 root@159.89.228.223 "echo 'Conexão OK' && whoami"
```

### Configuração da Chave SSH
```bash
# Chave pública configurada no servidor:
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIEArFHNMudUlIJ5Aqtq7WoJWO1OBjF85ALslfjvuwofO digitalocean-brandaocontador

# Localização da chave privada (Windows):
C:\Users\[USUARIO]\.ssh\digitalocean_key

# Permissões necessárias no servidor:
chmod 700 /root/.ssh
chmod 600 /root/.ssh/authorized_keys
```

### Estrutura de Diretórios
```
/var/www/brandaocontador-nfe-backend/
├── app.js                 # Aplicação principal
├── package.json          # Dependências
├── .env                  # Variáveis de ambiente
├── data/                 # Banco de dados SQLite
├── certs/               # Certificados NFe
├── services/            # Serviços da aplicação
└── middleware/          # Middlewares
```

### Serviços Instalados
- **Node.js**: v18.x
- **PM2**: Gerenciador de processos
- **Nginx**: Proxy reverso
- **UFW**: Firewall
- **Certbot**: SSL/TLS certificates

### URLs da API
- **Produção**: https://api.brandaocontador.com.br
- **Health Check**: https://api.brandaocontador.com.br/api/health
- **Documentação**: https://api.brandaocontador.com.br/api/docs

### Comandos de Deploy
```bash
# Verificar status do servidor
curl -s https://raw.githubusercontent.com/arroschaves/brandaocontador-nfe-backend/main/deploy/check-server.sh | bash

# Deploy inicial (primeira vez)
curl -s https://raw.githubusercontent.com/arroschaves/brandaocontador-nfe-backend/main/deploy/deploy.sh -o deploy.sh
chmod +x deploy.sh
./deploy.sh

# Atualização (servidor já configurado)
cd /var/www/brandaocontador-nfe-backend
curl -s https://raw.githubusercontent.com/arroschaves/brandaocontador-nfe-backend/main/deploy/deploy-update.sh -o deploy-update.sh
chmod +x deploy-update.sh
./deploy-update.sh
```

### Comandos PM2 Úteis
```bash
# Ver status dos processos
pm2 list

# Ver logs em tempo real
pm2 logs brandaocontador-nfe-backend

# Reiniciar aplicação
pm2 restart brandaocontador-nfe-backend

# Parar aplicação
pm2 stop brandaocontador-nfe-backend

# Iniciar aplicação
pm2 start brandaocontador-nfe-backend

# Salvar configuração PM2
pm2 save

# Configurar PM2 para iniciar no boot
pm2 startup
```

### Comandos Nginx
```bash
# Verificar status
sudo systemctl status nginx

# Reiniciar Nginx
sudo systemctl restart nginx

# Testar configuração
sudo nginx -t

# Ver logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

---

## ☁️ Cloudflare - DNS e CDN

### Configuração DNS
```
Tipo    Nome                    Conteúdo              Proxy
A       @                      159.89.228.223        ✅ Proxied
A       www                    159.89.228.223        ✅ Proxied  
A       api                    159.89.228.223        ✅ Proxied
CNAME   nfe                    brandaocontador-nfe-frontend.vercel.app  ✅ Proxied
```

### SSL/TLS
- **Modo**: Full (strict)
- **Certificados**: Let's Encrypt via Certbot
- **HSTS**: Habilitado
- **Always Use HTTPS**: Habilitado

### Page Rules
```
1. nfe.brandaocontador.com.br/*
   - Cache Level: Cache Everything
   - Edge Cache TTL: 1 month

2. api.brandaocontador.com.br/*
   - Cache Level: Bypass
   - Disable Security
```

---

## 🔧 Variáveis de Ambiente

### Backend (.env)
```env
NODE_ENV=production
PORT=3001
JWT_SECRET=seu_jwt_secret_super_seguro
DATABASE_URL=./data/database.json

# NFe Configuration
NFE_AMBIENTE=1
NFE_UF=35
NFE_CODIGO_MUNICIPIO=3550308

# CORS
CORS_ORIGIN=https://nfe.brandaocontador.com.br

# SSL
SSL_CERT_PATH=/etc/letsencrypt/live/api.brandaocontador.com.br/fullchain.pem
SSL_KEY_PATH=/etc/letsencrypt/live/api.brandaocontador.com.br/privkey.pem
```

### Frontend (.env)
```env
VITE_API_URL=https://api.brandaocontador.com.br
VITE_APP_NAME=Sistema NFe Brandão Contador
VITE_ENVIRONMENT=production
```

---

## 🚀 Processo de Deploy Completo

### 1. Deploy do Frontend (Automático)
```bash
# No diretório frontend
git add .
git commit -m "feat: nova funcionalidade"
git push origin main
# Deploy automático no Vercel
```

### 2. Deploy do Backend (Manual)
```bash
# No diretório backend
git add .
git commit -m "feat: nova funcionalidade"
git push origin main

# Conectar ao servidor
ssh -p 2222 root@159.89.228.223

# Executar deploy
cd /var/www/brandaocontador-nfe-backend
./deploy-update.sh
```

### 3. Verificação Pós-Deploy
```bash
# Testar frontend
curl -I https://nfe.brandaocontador.com.br

# Testar backend
curl -I https://api.brandaocontador.com.br/api/health

# Verificar logs
pm2 logs brandaocontador-nfe-backend
```

---

## 🔍 Monitoramento e Logs

### Logs do Sistema
```bash
# Logs da aplicação
pm2 logs brandaocontador-nfe-backend

# Logs do Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Logs do sistema
sudo journalctl -u nginx -f
sudo journalctl -f
```

### Métricas do Servidor
```bash
# Uso de CPU e memória
htop

# Espaço em disco
df -h

# Processos ativos
ps aux | grep node

# Conexões de rede
netstat -tulpn | grep :3001
```

---

## 🆘 Troubleshooting

### Problemas Comuns

#### 1. Aplicação não responde
```bash
# Verificar se PM2 está rodando
pm2 list

# Reiniciar aplicação
pm2 restart brandaocontador-nfe-backend

# Verificar logs
pm2 logs brandaocontador-nfe-backend
```

#### 2. Erro de SSL
```bash
# Renovar certificado
sudo certbot renew

# Testar configuração Nginx
sudo nginx -t

# Reiniciar Nginx
sudo systemctl restart nginx
```

#### 3. Erro de CORS
```bash
# Verificar variável CORS_ORIGIN no .env
cat /var/www/brandaocontador-nfe-backend/.env | grep CORS

# Reiniciar aplicação após alterar
pm2 restart brandaocontador-nfe-backend
```

#### 4. Banco de dados corrompido
```bash
# Backup do banco atual
cp /var/www/brandaocontador-nfe-backend/data/database.json /tmp/backup_db.json

# Restaurar backup (se disponível)
cp /path/to/backup.json /var/www/brandaocontador-nfe-backend/data/database.json

# Reiniciar aplicação
pm2 restart brandaocontador-nfe-backend
```

---

## 📞 Contatos e Suporte

### Informações Técnicas
- **Desenvolvedor**: Arrôs Chaves
- **GitHub**: @arroschaves
- **Projeto**: Sistema NFe Brandão Contador

### URLs Importantes
- **Frontend**: https://nfe.brandaocontador.com.br
- **Backend**: https://api.brandaocontador.com.br
- **GitHub Backend**: https://github.com/arroschaves/brandaocontador-nfe-backend
- **GitHub Frontend**: https://github.com/arroschaves/brandaocontador-nfe-frontend
- **Vercel Dashboard**: https://vercel.com/dashboard
- **DigitalOcean Dashboard**: https://cloud.digitalocean.com

---

## 📅 Histórico de Atualizações

### Última Atualização: 06/10/2025
- ✅ Deploy completo do frontend no Vercel
- ✅ Deploy completo do backend no GitHub
- ✅ Correções de layout do Dashboard
- ✅ Dados demo zerados
- ✅ Sistema pronto para produção

### Próximas Melhorias
- [ ] Implementar monitoramento automático
- [ ] Configurar backup automático do banco
- [ ] Implementar logs estruturados
- [ ] Adicionar métricas de performance
- [ ] Configurar alertas de sistema