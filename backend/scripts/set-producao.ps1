# Script para configurar ambiente de PRODUÇÃO
Write-Host "🔧 Configurando ambiente de PRODUÇÃO..." -ForegroundColor Red

# Copia configurações de produção
Copy-Item ".env.producao" ".env" -Force

Write-Host "✅ Ambiente configurado para PRODUÇÃO" -ForegroundColor Green
Write-Host "📋 Configurações aplicadas:" -ForegroundColor Cyan
Write-Host "   - AMBIENTE=1 (Produção)" -ForegroundColor White
Write-Host "   - DEBUG_MODE=false" -ForegroundColor White
Write-Host "   - SIMULATION_MODE=false" -ForegroundColor White
Write-Host "   - Rate limit mais restritivo" -ForegroundColor White
Write-Host ""
Write-Host "⚠️  ATENÇÃO: Você está em PRODUÇÃO!" -ForegroundColor Red
Write-Host "🚀 Para iniciar o servidor: npm start" -ForegroundColor Green