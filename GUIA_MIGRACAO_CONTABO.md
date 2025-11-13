# 🚀 GUIA COMPLETO DE MIGRAÇÃO - SISTEMA NFE PARA CONTABO

## 📋 Informações do Servidor

**Servidor Contabo:**

- **Host:** 147.93.186.214
- **Porta:** 22
- **Usuário:** root
- **Senha:** Cont@bo2025!
- **OS:** Ubuntu 24.04.3 LTS
- **Disco:** 192GB (1% usado)
- **Memória:** 2% usado

**Domínios:**

- api.brandaocontador.com.br
- nfe.brandaocontador.com.br

---

## 🎯 Objetivo da Migração

Migrar o sistema NFe local para o servidor Contabo, mantendo:

- ✅ Sistema 100% JSON (sem banco de dados)
- ✅ Todas as configurações atuais
- ✅ Performance otimizada
- ✅ SSL/HTTPS configurado
- ✅ Monitoramento com PM2

---

## 📁 Arquivos de Migração Criados

### 1. **setup-contabo.sh**

Script para configurar o servidor Ubuntu com todas as dependências necessárias.

### 2. **migrate-to-contabo.ps1**

Script PowerShell para automatizar a migração completa do sistema local para o servidor.

### 3. **nginx-nfe.conf**

Configuração otimizada do Nginx para produção com SSL, cache e segurança.

### 4. **ecosystem-production.config.js**

Configuração PM2 para cluster mode, monitoramento e logs estruturados.

### 5. **deploy-production.sh**

Script de deploy no servidor para instalar e configurar a aplicação.

---

## 🔧 PASSO A PASSO DA MIGRAÇÃO

### **FASE 1: Preparação Local**

#### 1.1 Verificar Sistema Local

```powershell
# Verificar se o sistema está funcionando
cd E:\PROJETOS\brandaocontador-nfe\backend
node app.js

# Testar endpoints principais
curl http://localhost:3000/health
curl http://localhost:3000/api/empresas
```

#### 1.2 Backup Local

```powershell
# Criar backup completo
$backupDate = Get-Date -Format "yyyyMMdd_HHmmss"
$backupPath = "E:\BACKUPS\nfe_backup_$backupDate"
New-Item -ItemType Directory -Path $backupPath -Force

# Copiar dados essenciais
Copy-Item "E:\PROJETOS\brandaocontador-nfe\backend\data" -Destination "$backupPath\data" -Recurse
Copy-Item "E:\PROJETOS\brandaocontador-nfe\backend\.env" -Destination "$backupPath\.env"
```

---

### **FASE 2: Configuração do Servidor**

#### 2.1 Conectar ao Servidor

```bash
# Via SSH (Linux/Mac) ou PuTTY (Windows)
ssh root@147.93.186.214
# Senha: Cont@bo2025!
```

#### 2.2 Executar Script de Configuração

```bash
# Fazer upload do script
scp setup-contabo.sh root@147.93.186.214:/root/

# Conectar e executar
ssh root@147.93.186.214
chmod +x setup-contabo.sh
./setup-contabo.sh
```

**O script irá:**

- ✅ Atualizar Ubuntu 24.04
- ✅ Instalar Node.js 22.x
- ✅ Instalar PM2, Nginx, Git
- ✅ Configurar firewall UFW
- ✅ Criar usuário `nfeapp`
- ✅ Configurar estrutura de diretórios
- ✅ Instalar Certbot para SSL

---

### **FASE 3: Migração Automática**

#### 3.1 Executar Script de Migração

```powershell
# No Windows, executar o PowerShell como Administrador
cd E:\PROJETOS\brandaocontador-nfe
.\migrate-to-contabo.ps1
```

**O script irá:**

- ✅ Compactar sistema local
- ✅ Transferir via SCP para servidor
- ✅ Executar configuração remota
- ✅ Instalar dependências
- ✅ Configurar PM2
- ✅ Iniciar aplicação
- ✅ Verificar funcionamento

---

### **FASE 4: Configuração de Produção**

#### 4.1 Configurar Nginx

```bash
# Copiar configuração
sudo cp nginx-nfe.conf /etc/nginx/sites-available/nfe
sudo ln -s /etc/nginx/sites-available/nfe /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### 4.2 Configurar SSL com Certbot

```bash
# Instalar certificados SSL
sudo certbot --nginx -d api.brandaocontador.com.br -d nfe.brandaocontador.com.br

# Verificar renovação automática
sudo certbot renew --dry-run
```

#### 4.3 Configurar DNS

**No painel do seu provedor de DNS:**

```
Tipo: A
Nome: api.brandaocontador.com.br
Valor: 147.93.186.214
TTL: 300

Tipo: A
Nome: nfe.brandaocontador.com.br
Valor: 147.93.186.214
TTL: 300
```

---

### **FASE 5: Verificação e Testes**

#### 5.1 Verificar Serviços

```bash
# Status do PM2
sudo -u nfeapp pm2 list
sudo -u nfeapp pm2 logs

# Status do Nginx
sudo systemctl status nginx
sudo nginx -t

# Verificar portas
sudo netstat -tlnp | grep :80
sudo netstat -tlnp | grep :443
sudo netstat -tlnp | grep :3000
```

#### 5.2 Testes de Conectividade

```bash
# Teste local
curl http://localhost:3000/health
curl http://localhost:3000/api/empresas

# Teste externo (após DNS configurado)
curl https://api.brandaocontador.com.br/health
curl https://nfe.brandaocontador.com.br/health
```

#### 5.3 Verificar Logs

```bash
# Logs da aplicação
tail -f /var/log/nfe/pm2-combined.log

# Logs do Nginx
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

---

## 🔍 TROUBLESHOOTING

### **Problema: Aplicação não inicia**

```bash
# Verificar logs
sudo -u nfeapp pm2 logs nfe-api

# Verificar permissões
ls -la /var/www/nfe/backend/
sudo chown -R nfeapp:nfeapp /var/www/nfe/

# Reinstalar dependências
cd /var/www/nfe/backend
sudo -u nfeapp npm install
```

### **Problema: Nginx não funciona**

```bash
# Verificar configuração
sudo nginx -t

# Verificar logs
sudo tail -f /var/log/nginx/error.log

# Reiniciar serviço
sudo systemctl restart nginx
```

### **Problema: SSL não funciona**

```bash
# Verificar certificados
sudo certbot certificates

# Renovar certificados
sudo certbot renew

# Verificar configuração Nginx
sudo nginx -t
```

### **Problema: DNS não resolve**

```bash
# Verificar DNS
nslookup api.brandaocontador.com.br
dig api.brandaocontador.com.br

# Aguardar propagação (até 24h)
```

---

## 📊 MONITORAMENTO

### **Comandos Úteis**

```bash
# Status geral do sistema
htop
df -h
free -h

# Status da aplicação
sudo -u nfeapp pm2 monit
sudo -u nfeapp pm2 list

# Logs em tempo real
sudo -u nfeapp pm2 logs --lines 50

# Reiniciar aplicação
sudo -u nfeapp pm2 restart nfe-api

# Recarregar aplicação (sem downtime)
sudo -u nfeapp pm2 reload nfe-api
```

### **Backup Automático**

```bash
# Criar script de backup diário
sudo crontab -e

# Adicionar linha para backup às 2h da manhã
0 2 * * * /usr/local/bin/backup-nfe.sh
```

---

## 🚨 COMANDOS DE EMERGÊNCIA

### **Parar Tudo**

```bash
sudo -u nfeapp pm2 stop all
sudo systemctl stop nginx
```

### **Reiniciar Tudo**

```bash
sudo systemctl restart nginx
sudo -u nfeapp pm2 restart all
```

### **Restaurar Backup**

```bash
# Parar aplicação
sudo -u nfeapp pm2 stop nfe-api

# Restaurar dados
sudo cp -r /var/backups/nfe/YYYYMMDD_HHMMSS/data/* /var/www/nfe/backend/data/

# Reiniciar aplicação
sudo -u nfeapp pm2 start nfe-api
```

---

## ✅ CHECKLIST FINAL

### **Antes da Migração:**

- [ ] Backup local criado
- [ ] Sistema local funcionando
- [ ] Credenciais do servidor confirmadas
- [ ] Scripts de migração preparados

### **Durante a Migração:**

- [ ] Servidor configurado com setup-contabo.sh
- [ ] Aplicação transferida com migrate-to-contabo.ps1
- [ ] Nginx configurado
- [ ] PM2 funcionando
- [ ] SSL configurado

### **Após a Migração:**

- [ ] DNS configurado e propagado
- [ ] HTTPS funcionando
- [ ] Todos os endpoints testados
- [ ] Logs funcionando
- [ ] Backup automático configurado
- [ ] Monitoramento ativo

---

## 📞 SUPORTE

**Em caso de problemas:**

1. Verificar logs: `/var/log/nfe/`
2. Verificar status: `pm2 list`
3. Verificar conectividade: `curl localhost:3000/health`
4. Consultar este guia
5. Contatar suporte técnico

---

## 🎉 CONCLUSÃO

Após seguir este guia, você terá:

- ✅ Sistema NFe rodando no servidor Contabo
- ✅ HTTPS configurado e funcionando
- ✅ Monitoramento com PM2
- ✅ Logs estruturados
- ✅ Backup automático
- ✅ Performance otimizada

**O sistema estará pronto para produção!** 🚀
