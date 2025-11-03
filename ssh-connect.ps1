# Script para conectar ao servidor CONTABO
$serverIP = "147.93.186.214"
$username = "root"
$password = "Cont@bo2025!"

Write-Host "🔗 Conectando ao servidor CONTABO..." -ForegroundColor Green
Write-Host "IP: $serverIP" -ForegroundColor Yellow
Write-Host "Usuário: $username" -ForegroundColor Yellow

# Teste de conectividade
Write-Host "`n📡 Testando conectividade..." -ForegroundColor Cyan
$ping = Test-NetConnection -ComputerName $serverIP -Port 22 -WarningAction SilentlyContinue

if ($ping.TcpTestSucceeded) {
    Write-Host "✅ Porta SSH (22) está acessível" -ForegroundColor Green
    
    # Criar arquivo de comandos para executar no servidor
    $commands = @"
echo '🚀 Conexão SSH estabelecida com sucesso!'
echo '📊 Informações do sistema:'
uname -a
echo ''
echo '💾 Memória disponível:'
free -h
echo ''
echo '💿 Espaço em disco:'
df -h
echo ''
echo '🔧 Versão do sistema:'
lsb_release -a 2>/dev/null || cat /etc/os-release
echo ''
echo '📦 Node.js instalado:'
node --version 2>/dev/null || echo 'Node.js não instalado'
echo ''
echo '📦 NPM instalado:'
npm --version 2>/dev/null || echo 'NPM não instalado'
"@

    # Salvar comandos em arquivo temporário
    $commands | Out-File -FilePath "temp_commands.sh" -Encoding UTF8
    
    Write-Host "`n🔐 Conectando via SSH..." -ForegroundColor Cyan
    Write-Host "Use a senha: $password" -ForegroundColor Yellow
    Write-Host "`nComando SSH:" -ForegroundColor Magenta
    Write-Host "ssh root@$serverIP" -ForegroundColor White
    
} else {
    Write-Host "❌ Não foi possível conectar na porta SSH (22)" -ForegroundColor Red
    Write-Host "Verifique se o servidor está ativo e o firewall configurado" -ForegroundColor Yellow
}

Write-Host "`n📋 Próximos passos após conectar:" -ForegroundColor Cyan
Write-Host "1. Atualizar sistema: apt update && apt upgrade -y" -ForegroundColor White
Write-Host "2. Instalar Node.js: curl -fsSL https://deb.nodesource.com/setup_22.x | bash -" -ForegroundColor White
Write-Host "3. Instalar Node.js: apt-get install -y nodejs" -ForegroundColor White
Write-Host "4. Instalar PM2: npm install -g pm2" -ForegroundColor White
Write-Host "5. Configurar firewall: ufw allow 22,80,443,3000" -ForegroundColor White