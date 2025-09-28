# Força UTF-8 no console
$OutputEncoding = [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()

Write-Host "🚀 Iniciando envio de NFe..."

# Define certificado
$env:CERT_PATH="certs\MAP LTDA45669746000120.pfx"
$env:CERT_PASS="1234"
$env:UF="MS"
$env:AMBIENTE="2"

# Executa o Node.js
Write-Host "Executando .\nfe-send.js..."
node --use-system-ca .\nfe-send.js

Write-Host "🎯 Processo concluído."
