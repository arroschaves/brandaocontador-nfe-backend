# 🚀 Guia de Deploy no Servidor DigitalOcean

## 📋 Passo a Passo Completo

### **PASSO 1: Conectar ao Servidor**
Abra o terminal/prompt de comando no Windows e execute:

```bash
ssh -i "C:/Users/BCNOTSONY/.ssh/id_ed25519" -p 2222 root@159.89.228.223
```

**O que esperar:** Você vai entrar no servidor Ubuntu.

---

### **PASSO 2: Verificar o que já está instalado**
Depois de conectado ao servidor, execute este comando:

```bash
curl -s https://raw.githubusercontent.com/arroschaves/brandaocontador-nfe-backend/main/deploy/check-server.sh | bash
```

**O que esperar:** Um relatório completo mostrando:
- ✅ Se Node.js está instalado
- ✅ Se PM2 está instalado  
- ✅ Se o diretório da aplicação existe
- ✅ Status atual dos serviços

---

### **PASSO 3A: Se for a PRIMEIRA VEZ (diretório não existe)**
Se o relatório mostrar que o diretório `/var/www/brandaocontador-nfe-backend` NÃO existe:

```bash
curl -s https://raw.githubusercontent.com/arroschaves/brandaocontador-nfe-backend/main/deploy/deploy.sh -o deploy.sh
chmod +x deploy.sh
./deploy.sh
```

---

### **PASSO 3B: Se for ATUALIZAÇÃO (diretório já existe)**
Se o relatório mostrar que o diretório JÁ existe:

```bash
cd /var/www/brandaocontador-nfe-backend
curl -s https://raw.githubusercontent.com/arroschaves/brandaocontador-nfe-backend/main/deploy/deploy-update.sh -o deploy-update.sh
chmod +x deploy-update.sh
./deploy-update.sh
```

---

### **PASSO 4: Verificar se funcionou**
Após o deploy, teste se a API está funcionando:

```bash
curl https://api.brandaocontador.com.br
```

**O que esperar:** Uma resposta da API (mesmo que seja erro 404, significa que está rodando).

---

## 🆘 Se Algo Der Errado

### Ver logs da aplicação:
```bash
pm2 logs brandaocontador-nfe-backend
```

### Reiniciar a aplicação:
```bash
pm2 restart brandaocontador-nfe-backend
```

### Ver status dos processos:
```bash
pm2 status
```

---

## 📞 Próximos Passos

1. **Execute o PASSO 1** (conectar ao servidor)
2. **Execute o PASSO 2** (verificação)
3. **Me envie o resultado** da verificação
4. **Eu te digo** se deve usar PASSO 3A ou 3B
5. **Execute o passo indicado**
6. **Teste** com o PASSO 4

---

## 🎯 Resumo Rápido

**Comando para copiar e colar no terminal do Windows:**
```bash
ssh -i "C:/Users/BCNOTSONY/.ssh/id_ed25519" -p 2222 root@159.89.228.223
```

**Depois de conectado, comando para verificação:**
```bash
curl -s https://raw.githubusercontent.com/arroschaves/brandaocontador-nfe-backend/main/deploy/check-server.sh | bash
```

**Pronto! Me envie o resultado e eu te oriento no próximo passo! 🚀**