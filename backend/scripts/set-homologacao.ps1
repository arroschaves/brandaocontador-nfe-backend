# Script para configurar ambiente de HOMOLOGAÇÃO
Write-Host "🔧 Configurando ambiente de HOMOLOGAÇÃO..." -ForegroundColor Yellow

# Copia configurações de homologação
Copy-Item ".env.homologacao" ".env" -Force

Write-Host "✅ Ambiente configurado para HOMOLOGAÇÃO" -ForegroundColor Green
Write-Host "📋 Configurações aplicadas:" -ForegroundColor Cyan
Write-Host "   - AMBIENTE=2 (Homologação)" -ForegroundColor White
Write-Host "   - DEBUG_MODE=true" -ForegroundColor White
Write-Host "   - SIMULATION_MODE=false" -ForegroundColor White
Write-Host "   - Certificado real será usado" -ForegroundColor White
Write-Host ""
Write-Host "🚀 Para iniciar o servidor: npm start" -ForegroundColor Green