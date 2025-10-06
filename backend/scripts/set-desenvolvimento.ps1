# Script para configurar ambiente de DESENVOLVIMENTO
Write-Host "🔧 Configurando ambiente de DESENVOLVIMENTO..." -ForegroundColor Blue

# Copia configurações de desenvolvimento
Copy-Item ".env.desenvolvimento" ".env" -Force

Write-Host "✅ Ambiente configurado para DESENVOLVIMENTO" -ForegroundColor Green
Write-Host "📋 Configurações aplicadas:" -ForegroundColor Cyan
Write-Host "   - AMBIENTE=2 (Homologação)" -ForegroundColor White
Write-Host "   - DEBUG_MODE=true" -ForegroundColor White
Write-Host "   - SIMULATION_MODE=true" -ForegroundColor White
Write-Host "   - Modo simulação ativo" -ForegroundColor White
Write-Host ""
Write-Host "🚀 Para iniciar o servidor: npm start" -ForegroundColor Green