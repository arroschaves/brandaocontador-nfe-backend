# 🚀 Configuração GitHub Actions - Deploy Automático CONTABO

## 📋 Visão Geral

Este documento explica como configurar o deploy automático do backend NFe para o servidor CONTABO usando GitHub Actions.

## 🔧 Configuração dos Secrets

### 1. Acessar Configurações do Repositório

1. Vá para o repositório no GitHub: `https://github.com/arroschaves/brandaocontador-nfe-backend`
2. Clique em **Settings** (Configurações)
3. No menu lateral, clique em **Secrets and variables** → **Actions**

### 2. Adicionar Secrets Necessários

Clique em **New repository secret** e adicione os seguintes secrets:

#### 🔐 CONTABO_SSH_PASSWORD
- **Nome:** `CONTABO_SSH_PASSWORD`
- **Valor:** A senha SSH do servidor CONTABO
- **Descrição:** Senha para autenticação SSH no servidor

```
Valor: [SENHA_DO_SERVIDOR_CONTABO]
```

## 📊 Configurações do Servidor

### Informações do Servidor CONTABO
- **IP:** 147.93.186.214
- **Porta SSH:** 22
- **Usuário:** root
- **Sistema:** Ubuntu 24.04.3 LTS
- **Diretório de Deploy:** `/var/www/brandaocontador-nfe-backend`
- **PM2 App Name:** `nfe-backend`

## 🔄 Como Funciona o Deploy

### Trigger Automático
O deploy é executado automaticamente quando:
- Há push na branch `main` ou `master`
- Arquivos na pasta `backend/` são modificados
- O arquivo `ecosystem.config.js` é modificado
- O próprio workflow é modificado

### Trigger Manual
Você também pode executar o deploy manualmente:
1. Vá para **Actions** no repositório
2. Selecione **🚀 Deploy Backend NFe para Contabo**
3. Clique em **Run workflow**
4. Escolha as opções:
   - **Forçar deploy:** Para deploy mesmo sem mudanças
   - **Pular testes:** Apenas para emergências

## 📝 Processo de Deploy

### 1. Testes e Validação
- ✅ Verificação de sintaxe do código
- ✅ Validação dos arquivos JSON
- ✅ Verificação da estrutura de arquivos

### 2. Deploy no Servidor
- 📦 Preparação dos arquivos
- 🚀 Transferência para CONTABO
- 💾 Backup automático
- ⏹️ Parada da aplicação atual
- 📁 Atualização dos arquivos
- 📦 Instalação de dependências
- 🚀 Reinício da aplicação

### 3. Verificação de Saúde
- ✅ Verificação do PM2
- ✅ Teste de conectividade
- ✅ Verificação da estrutura JSON

## 🛠️ Preparação do Servidor

### Pré-requisitos no Servidor CONTABO

```bash
# 1. Instalar Node.js 22.x
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. Instalar PM2 globalmente
sudo npm install -g pm2

# 3. Criar diretório de deploy
sudo mkdir -p /var/www/brandaocontador-nfe-backend

# 4. Criar diretório de backup
sudo mkdir -p /var/backups/brandaocontador-nfe-backend

# 5. Configurar PM2 para iniciar no boot
pm2 startup
pm2 save
```

## 📊 Estrutura de Arquivos JSON

O sistema mantém os seguintes arquivos JSON:
- `data/clientes.json` - Dados dos clientes
- `data/configuracoes.json` - Configurações do sistema
- `data/database.json` - Base de dados principal
- `data/logs.json` - Logs do sistema
- `data/nfes.json` - Notas fiscais emitidas
- `data/produtos.json` - Cadastro de produtos
- `data/usuarios.json` - Usuários do sistema

## 🔍 Monitoramento

### Verificar Status do Deploy
1. Vá para **Actions** no GitHub
2. Veja o status do último deploy
3. Clique no deploy para ver logs detalhados

### Verificar Aplicação no Servidor
```bash
# Conectar ao servidor
ssh root@147.93.186.214

# Verificar PM2
pm2 list
pm2 logs nfe-backend

# Verificar porta
netstat -tlnp | grep :3000

# Teste da API
curl http://localhost:3000/api/health
```

## 🚨 Troubleshooting

### Problemas Comuns

#### 1. Falha na Conexão SSH
- ✅ Verificar se o secret `CONTABO_SSH_PASSWORD` está correto
- ✅ Verificar se o servidor está acessível
- ✅ Verificar firewall do servidor

#### 2. Falha no PM2
```bash
# No servidor, verificar PM2
pm2 list
pm2 restart nfe-backend
pm2 logs nfe-backend --lines 50
```

#### 3. Falha na Instalação de Dependências
```bash
# No servidor, reinstalar dependências
cd /var/www/brandaocontador-nfe-backend
rm -rf node_modules package-lock.json
npm install --production
```

#### 4. Problemas com Arquivos JSON
```bash
# Verificar estrutura JSON
cd /var/www/brandaocontador-nfe-backend
ls -la data/
# Recriar arquivos se necessário
echo "[]" > data/clientes.json
```

### Logs Importantes

#### GitHub Actions
- Logs completos disponíveis na aba **Actions**
- Cada step mostra detalhes específicos

#### Servidor CONTABO
```bash
# Logs da aplicação
pm2 logs nfe-backend

# Logs do sistema
sudo journalctl -u pm2-root

# Logs do Nginx (se configurado)
sudo tail -f /var/log/nginx/error.log
```

## 🔄 Rollback

### Em Caso de Problemas
```bash
# 1. Conectar ao servidor
ssh root@147.93.186.214

# 2. Listar backups disponíveis
ls -la /var/backups/brandaocontador-nfe-backend/

# 3. Restaurar backup (substitua TIMESTAMP)
cp -r /var/backups/brandaocontador-nfe-backend/TIMESTAMP/brandaocontador-nfe-backend/* /var/www/brandaocontador-nfe-backend/

# 4. Reiniciar aplicação
pm2 restart nfe-backend
```

## 📞 Suporte

### Contatos
- **Desenvolvedor:** arroschaves
- **Email:** professormatms@bo.com.br
- **Repositório:** https://github.com/arroschaves/brandaocontador-nfe-backend

### Informações Técnicas
- **Servidor:** CONTABO VPS
- **Sistema:** Ubuntu 24.04.3 LTS
- **Node.js:** 22.x
- **Database:** 100% JSON
- **Process Manager:** PM2

---

## ✅ Checklist de Configuração

- [ ] Secret `CONTABO_SSH_PASSWORD` configurado
- [ ] Servidor CONTABO preparado
- [ ] Node.js 22.x instalado
- [ ] PM2 instalado e configurado
- [ ] Diretórios criados
- [ ] Primeiro deploy manual testado
- [ ] Monitoramento configurado

**🎉 Parabéns! Seu deploy automático está configurado e funcionando!**