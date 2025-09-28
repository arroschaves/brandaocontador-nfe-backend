#!/bin/bash

# Script de Verificação do Servidor DigitalOcean
# brandaocontador-nfe-backend

echo "🔍 VERIFICAÇÃO DO SERVIDOR DIGITALOCEAN"
echo "========================================"
echo ""

# Informações do Sistema
echo "📋 INFORMAÇÕES DO SISTEMA:"
echo "- OS: $(lsb_release -d | cut -f2)"
echo "- Kernel: $(uname -r)"
echo "- Arquitetura: $(uname -m)"
echo "- Uptime: $(uptime -p)"
echo ""

# Verificar Node.js
echo "🟢 NODE.JS:"
if command -v node &> /dev/null; then
    echo "- ✅ Node.js instalado: $(node --version)"
    echo "- ✅ NPM instalado: $(npm --version)"
else
    echo "- ❌ Node.js NÃO instalado"
fi
echo ""

# Verificar PM2
echo "🔄 PM2:"
if command -v pm2 &> /dev/null; then
    echo "- ✅ PM2 instalado: $(pm2 --version)"
    echo "- Status dos processos PM2:"
    pm2 list
else
    echo "- ❌ PM2 NÃO instalado"
fi
echo ""

# Verificar Nginx
echo "🌐 NGINX:"
if command -v nginx &> /dev/null; then
    echo "- ✅ Nginx instalado: $(nginx -v 2>&1)"
    echo "- Status do Nginx: $(systemctl is-active nginx)"
    echo "- Configurações ativas:"
    ls -la /etc/nginx/sites-enabled/
else
    echo "- ❌ Nginx NÃO instalado"
fi
echo ""

# Verificar Git
echo "📦 GIT:"
if command -v git &> /dev/null; then
    echo "- ✅ Git instalado: $(git --version)"
else
    echo "- ❌ Git NÃO instalado"
fi
echo ""

# Verificar diretório da aplicação
APP_DIR="/var/www/brandaocontador-nfe-backend"
echo "📁 DIRETÓRIO DA APLICAÇÃO:"
if [ -d "$APP_DIR" ]; then
    echo "- ✅ Diretório existe: $APP_DIR"
    echo "- Proprietário: $(ls -ld $APP_DIR | awk '{print $3":"$4}')"
    if [ -d "$APP_DIR/.git" ]; then
        echo "- ✅ Repositório Git inicializado"
        cd $APP_DIR
        echo "- Branch atual: $(git branch --show-current)"
        echo "- Último commit: $(git log -1 --oneline)"
    else
        echo "- ❌ Repositório Git NÃO inicializado"
    fi
    
    if [ -f "$APP_DIR/package.json" ]; then
        echo "- ✅ package.json encontrado"
        echo "- Dependências instaladas:"
        if [ -d "$APP_DIR/node_modules" ]; then
            echo "  ✅ node_modules existe"
        else
            echo "  ❌ node_modules NÃO existe"
        fi
    else
        echo "- ❌ package.json NÃO encontrado"
    fi
    
    if [ -f "$APP_DIR/.env" ]; then
        echo "- ✅ Arquivo .env encontrado"
    else
        echo "- ❌ Arquivo .env NÃO encontrado"
    fi
else
    echo "- ❌ Diretório NÃO existe: $APP_DIR"
fi
echo ""

# Verificar portas em uso
echo "🔌 PORTAS EM USO:"
echo "- Porta 80 (HTTP): $(ss -tlnp | grep ':80 ' | wc -l) conexões"
echo "- Porta 443 (HTTPS): $(ss -tlnp | grep ':443 ' | wc -l) conexões"
echo "- Porta 3001 (App): $(ss -tlnp | grep ':3001 ' | wc -l) conexões"
echo ""

# Verificar espaço em disco
echo "💾 ESPAÇO EM DISCO:"
df -h / | tail -1 | awk '{print "- Usado: "$3" / "$2" ("$5")"}'
echo ""

# Verificar memória
echo "🧠 MEMÓRIA:"
free -h | grep "Mem:" | awk '{print "- Usado: "$3" / "$2" ("$3/$2*100"%)"}'
echo ""

# Verificar logs
echo "📝 LOGS RECENTES:"
if [ -d "$APP_DIR/logs" ]; then
    echo "- Logs da aplicação:"
    ls -la $APP_DIR/logs/
else
    echo "- ❌ Diretório de logs não encontrado"
fi

if command -v pm2 &> /dev/null; then
    echo "- Logs do PM2 (últimas 5 linhas):"
    pm2 logs brandaocontador-nfe-backend --lines 5 --nostream 2>/dev/null || echo "  Nenhum processo PM2 ativo"
fi
echo ""

echo "✅ VERIFICAÇÃO CONCLUÍDA!"
echo "========================================"