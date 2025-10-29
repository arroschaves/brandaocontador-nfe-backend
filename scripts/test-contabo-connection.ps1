# ==========================================
# TESTE DE CONEXÃO CONTABO VPS
# ==========================================

Write-Host "=== TESTE DE CONEXÃO CONTABO VPS ===" -ForegroundColor Green
Write-Host "IP: 147.93.186.214" -ForegroundColor Yellow
Write-Host "Usuário: root" -ForegroundColor Yellow
Write-Host ""

# Teste básico de ping
Write-Host "1. Testando conectividade (ping)..." -ForegroundColor Cyan
$pingResult = Test-Connection -ComputerName "147.93.186.214" -Count 3 -Quiet
if ($pingResult) {
    Write-Host "✓ Servidor respondendo ao ping" -ForegroundColor Green
} else {
    Write-Host "✗ Servidor não responde ao ping" -ForegroundColor Red
    exit 1
}

# Teste de porta SSH (22)
Write-Host "2. Testando porta SSH (22)..." -ForegroundColor Cyan
$tcpTest = Test-NetConnection -ComputerName "147.93.186.214" -Port 22 -WarningAction SilentlyContinue
if ($tcpTest.TcpTestSucceeded) {
    Write-Host "✓ Porta SSH (22) acessível" -ForegroundColor Green
} else {
    Write-Host "✗ Porta SSH (22) não acessível" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== RESULTADO ===" -ForegroundColor Green
Write-Host "✓ Servidor CONTABO está acessível" -ForegroundColor Green
Write-Host "✓ SSH está funcionando" -ForegroundColor Green
Write-Host "✓ Pronto para migração" -ForegroundColor Green
Write-Host ""
Write-Host "Próximo passo: Executar scripts de configuração no servidor" -ForegroundColor Yellow