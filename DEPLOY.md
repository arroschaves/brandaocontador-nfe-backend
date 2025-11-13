# 🚀 Deploy NFe Backend - Digital Ocean

## 📋 Visão Geral

Este documento descreve o processo completo de deploy do backend NFe para Digital Ocean, incluindo preparação, configuração e monitoramento.

## 🎯 Funcionalidades Implementadas

### ✅ APIs Modernas NFe/CTe/MDFe

- **NFe**: Emissão, cálculos automáticos, validações 2025/2026
- **CTe**: Conhecimento de transporte, prazos, vínculos MDFe
- **MDFe**: Manifesto eletrônico, validações, cancelamentos
- **Campos 2026**: IBS/CBS/IS preparados (facultativo 2025, obrigatório 2026)

### ✅ Cálculos Tributários Automáticos

- **Simples Nacional**: Alíquotas progressivas, partilha ICMS
- **Lucro Presumido/Real**: ICMS por UF, PIS/COFINS
- **Substituição Tributária**: MVA automática, ICMS-ST
- **Cálculos 2026**: IBS/CBS com créditos integrais
- **Observações legais**: Textos automáticos por regime

### ✅ Gestão Completa de Eventos

- **Cancelamento**: Validação prazos por UF (24h-168h)
- **Carta de Correção**: Campos permitidos/bloqueados
- **Devolução/Estorno**: Fluxos completos NFe
- **Inutilização**: Numeração sequencial
- **Histórico**: Rastreamento completo de eventos

### ✅ Relatórios e Simulador 2026

- **Livros Fiscais**: Entrada, Saída, Apuração ICMS/IPI
- **Simulador 2026**: Comparativo IBS/CBS/IS vs atual
- **Exportação**: PDF, Excel, XML
- **Dashboards**: APIs para KPIs e gráficos
- **Auditoria**: Logs detalhados de operações

### ✅ Segurança e Integração SEFAZ

- **Certificados**: Upload, validação, renovação automática
- **TLS 1.2+**: Comunicação segura obrigatória
- **Assinatura Digital**: XML com certificado A1/A3
- **Validação XSD**: Schemas atualizados 2025/2026
- **Status SEFAZ**: Monitoramento em tempo real por UF

### ✅ Configurações e Produção

- **Dados Empresa**: CNPJ, IE, regimes tributários
- **Parâmetros SEFAZ**: URLs por UF, timeouts
- **Backup**: Automático e manual
- **Logs**: Sistema completo de auditoria
- **Performance**: Otimizações para produção

## 🛠️ Pré-requisitos

### Servidor Digital Ocean

- **Droplet**: Ubuntu 20.04 LTS ou superior
- **Recursos mínimos**: 2GB RAM, 2 vCPUs, 25GB SSD
- **Recursos recomendados**: 4GB RAM, 2 vCPUs, 50GB SSD

### Software

- Node.js 18+ (instalado automaticamente)
- MongoDB (local ou Atlas)
- Nginx (instalado automaticamente)
- PM2 (instalado automaticamente)

## 🚀 Processo de Deploy

### 1. Preparação Local

```bash
# Executar script de deploy
npm run deploy

# Ou manualmente
node scripts/deploy.js
```

O script irá:

- ✅ Validar ambiente e dependências
- ✅ Executar testes (se configurados)
- ✅ Gerar build de produção
- ✅ Criar pacote de deploy
- ✅ Gerar scripts de instalação
- ✅ Criar documentação

### 2. Upload para Digital Ocean

```bash
# Upload do pacote
scp nfe-backend-*.zip root@your-server:/tmp/

# Upload dos scripts
scp deploy/scripts/* root@your-server:/tmp/scripts/
```

### 3. Instalação no Servidor

```bash
# Conectar ao servidor
ssh root@your-server

# Executar instalação
cd /tmp
chmod +x scripts/install.sh
./scripts/install.sh
```

### 4. Configuração

```bash
# Configurar variáveis de ambiente
sudo -u nfe-app nano /opt/nfe-backend/.env

# Copiar configurações do exemplo
sudo -u nfe-app cp .env.production.example .env
```

### 5. SSL/TLS

```bash
# Instalar Certbot
sudo apt install certbot python3-certbot-nginx

# Obter certificado
sudo certbot --nginx -d yourdomain.com
```

### 6. Inicialização

```bash
# Iniciar aplicação
sudo -u nfe-app pm2 start ecosystem.config.js

# Salvar configuração PM2
sudo -u nfe-app pm2 save
sudo pm2 startup
```

## 📊 Monitoramento

### Health Checks

```bash
# Verificação única
npm run health-check

# Monitoramento contínuo
npm run health-monitor

# Via HTTP
curl http://localhost:3001/health
```

### PM2 Dashboard

```bash
# Status dos processos
pm2 status

# Logs em tempo real
pm2 logs

# Monitoramento
pm2 monit

# Restart
pm2 restart all
```

### Logs do Sistema

```bash
# Logs da aplicação
tail -f /var/log/nfe-backend/application.log

# Logs de erro
tail -f /var/log/nfe-backend/error.log

# Logs de health check
tail -f /var/log/nfe-backend/health.log

# Logs do Nginx
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

## 🔧 Configurações Importantes

### Variáveis de Ambiente Críticas

```bash
# Segurança
JWT_SECRET=your-super-secret-jwt-key
ENCRYPTION_KEY=your-32-character-key

# Banco de dados
MONGODB_URI=mongodb://localhost:27017/nfe_production

# SEFAZ
SEFAZ_AMBIENTE=producao

# Email
SMTP_HOST=smtp.gmail.com
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

### Nginx Configuration

```nginx
# Localização: /etc/nginx/sites-available/nfe-backend
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    # SSL configurado pelo Certbot

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### PM2 Ecosystem

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: "nfe-backend",
      script: "scripts/start.js",
      instances: "max",
      exec_mode: "cluster",
      env: {
        NODE_ENV: "production",
        PORT: 3001,
      },
    },
  ],
};
```

## 🔄 Backup e Manutenção

### Backup Automático

```bash
# Configurado via cron (2:00 AM diário)
0 2 * * * /opt/nfe-backend/scripts/backup.sh

# Backup manual
sudo /opt/nfe-backend/scripts/backup.sh
```

### Atualizações

```bash
# Parar aplicação
pm2 stop all

# Backup antes da atualização
sudo /opt/nfe-backend/scripts/backup.sh

# Deploy nova versão
# ... processo de deploy ...

# Iniciar aplicação
pm2 start ecosystem.config.js
```

### Limpeza de Logs

```bash
# Rotação automática configurada
# Logs mantidos por 30 dias

# Limpeza manual se necessário
find /var/log/nfe-backend -name "*.log" -mtime +30 -delete
```

## 🚨 Troubleshooting

### Aplicação não inicia

```bash
# Verificar logs
pm2 logs

# Verificar configurações
cat /opt/nfe-backend/.env

# Verificar permissões
ls -la /opt/nfe-backend

# Verificar porta
netstat -tlnp | grep 3001
```

### Erro de conexão com banco

```bash
# Verificar string de conexão
echo $MONGODB_URI

# Testar conectividade
ping your-mongodb-host

# Verificar firewall
sudo ufw status
```

### Erro 502 Bad Gateway

```bash
# Verificar se aplicação está rodando
pm2 status

# Verificar configuração Nginx
sudo nginx -t

# Verificar logs Nginx
sudo tail -f /var/log/nginx/error.log

# Reiniciar Nginx
sudo systemctl restart nginx
```

### Performance Issues

```bash
# Verificar recursos
htop
df -h
free -h

# Verificar métricas da aplicação
curl http://localhost:3001/metrics

# Ajustar workers PM2
pm2 scale nfe-backend 4
```

## 📈 Otimizações de Performance

### Configurações Recomendadas

```bash
# PM2 - ecosystem.config.js
instances: 'max'  # ou número específico
max_memory_restart: '1G'
node_args: '--max-old-space-size=1024'

# Nginx
worker_processes auto;
worker_connections 1024;
keepalive_timeout 65;
gzip on;
```

### Cache e Compressão

```bash
# Habilitado por padrão
ENABLE_CACHE=true
ENABLE_COMPRESSION=true
COMPRESSION_LEVEL=6
```

### Rate Limiting

```bash
# Configurado por padrão
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## 🔐 Segurança

### Firewall

```bash
# Configurado automaticamente
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw enable
```

### SSL/TLS

```bash
# Renovação automática
sudo crontab -l | grep certbot
# 0 12 * * * /usr/bin/certbot renew --quiet
```

### Headers de Segurança

```javascript
// Configurado no Helmet
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=63072000
```

## 📞 Suporte

### Contatos

- **Desenvolvimento**: dev@brandaocontador.com
- **Infraestrutura**: infra@brandaocontador.com
- **Emergência**: +55 11 99999-9999

### Documentação Adicional

- [API Documentation](http://yourdomain.com/api-docs)
- [Health Check](http://yourdomain.com/health)
- [Metrics](http://yourdomain.com/metrics)

### Logs de Auditoria

- Todas as operações são logadas
- Logs mantidos por 30 dias
- Backup automático dos logs

---

**✅ Backend 100% preparado para produção na Digital Ocean!**

**🎯 Conformidade total à legislação fiscal 2025/2026**

**🚀 Pronto para substituição do sistema atual**
