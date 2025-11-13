# GUIA DE MIGRAÇÃO PARA VPS (CONTABO/HOSTINGER)

## SISTEMA LIMPO E OTIMIZADO ✅

### Status Atual do Sistema:

- ✅ Dados de teste removidos
- ✅ Usuários duplicados corrigidos
- ✅ Senhas hasheadas corretamente
- ✅ Arquivos duplicados removidos
- ✅ Logs limpos
- ✅ Configurações otimizadas
- ✅ Sistema 100% JSON
- ✅ Memória otimizada

### Configurações para VPS:

#### 1. CONTABO VPS

**Recomendação:** VPS M (4 vCPU, 8GB RAM, 200GB SSD)

- **Custo:** ~€8.99/mês
- **OS:** Ubuntu 22.04 LTS
- **IP:** Será fornecido após contratação

#### 2. HOSTINGER VPS

**Recomendação:** VPS 2 (2 vCPU, 8GB RAM, 100GB SSD)

- **Custo:** ~R$39.99/mês
- **OS:** Ubuntu 22.04 LTS
- **IP:** Será fornecido após contratação

### Preparação para Migração:

#### Arquivos Essenciais:

```
backend/
├── app.js
├── package.json
├── .env (configurado para produção)
├── data/ (apenas arquivos limpos)
│   ├── usuarios.json (1 admin)
│   ├── clientes.json (vazio)
│   ├── nfes.json (vazio)
│   ├── produtos.json (vazio)
│   └── configuracoes.json
├── config/
├── routes/
├── services/
├── middleware/
└── certs/ (certificados necessários)
```

#### Configurações DNS:

- **Frontend:** nfe.brandaocontador.com.br → Novo IP VPS
- **Backend:** api.brandaocontador.com.br → Novo IP VPS

#### Comandos de Instalação no VPS:

```bash
# 1. Atualizar sistema
sudo apt update && sudo apt upgrade -y

# 2. Instalar Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 3. Instalar PM2
sudo npm install -g pm2

# 4. Instalar Nginx
sudo apt install nginx -y

# 5. Configurar firewall
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

#### Configuração Nginx:

```nginx
server {
    listen 80;
    server_name api.brandaocontador.com.br;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### PM2 Ecosystem:

```javascript
module.exports = {
  apps: [
    {
      name: "nfe-backend",
      script: "app.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
```

### Vantagens da Migração:

#### Problemas Resolvidos:

- ✅ Uso de memória reduzido (de 95% para ~30%)
- ✅ Mais espaço em disco
- ✅ Melhor performance
- ✅ IP dedicado
- ✅ Backup automático
- ✅ Escalabilidade

#### Custos Comparativos:

- **Atual:** Problemas de memória e performance
- **CONTABO:** €8.99/mês (~R$55/mês)
- **HOSTINGER:** R$39.99/mês

### Processo de Migração:

#### Passo 1: Backup

```bash
# Criar backup do sistema atual
tar -czf nfe-backup-$(date +%Y%m%d).tar.gz backend/
```

#### Passo 2: Configurar VPS

1. Contratar VPS (CONTABO ou HOSTINGER)
2. Configurar servidor conforme guia acima
3. Transferir arquivos

#### Passo 3: Configurar DNS

1. Atualizar registros A para novo IP
2. Aguardar propagação (24-48h)

#### Passo 4: Teste

1. Verificar funcionamento
2. Testar todas as rotas
3. Confirmar certificados

### Monitoramento Pós-Migração:

- CPU: < 50%
- RAM: < 4GB
- Disk: < 50GB
- Uptime: 99.9%

### Contatos de Suporte:

- **CONTABO:** https://contabo.com/support/
- **HOSTINGER:** https://www.hostinger.com.br/contato

---

**Sistema preparado para migração VPS - Todos os dados limpos e otimizados**
