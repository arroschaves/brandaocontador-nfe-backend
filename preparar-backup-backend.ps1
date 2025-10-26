# Script para preparar backup do backend para GitHub

Write-Host "Preparando backup do backend..." -ForegroundColor Cyan

$backupDir = "e:\PROJETOS\brandaocontador-nfe-backend-backup"
$sourceDir = "e:\PROJETOS\brandaocontador-nfe\backend"

# Criar diretório de backup
if (Test-Path $backupDir) {
    Remove-Item $backupDir -Recurse -Force
}
New-Item -ItemType Directory -Path $backupDir | Out-Null

Write-Host "Copiando arquivos do backend..." -ForegroundColor Yellow

# Copiar todos os arquivos exceto os sensíveis
robocopy $sourceDir $backupDir /E /XF .env /XD node_modules logs xmls certs data pdfs reports .git

Write-Host "Removendo dados sensíveis..." -ForegroundColor Red

# Remover arquivos sensíveis
$itemsToRemove = @(
    "*.log",
    "*.xml", 
    "*.pdf",
    "*.pfx",
    "*.p12"
)

foreach ($item in $itemsToRemove) {
    Get-ChildItem $backupDir -Recurse -Include $item | Remove-Item -Force -ErrorAction SilentlyContinue
}

# Remover pastas sensíveis
$foldersToRemove = @("logs", "xmls", "certs", "pdfs")
foreach ($folder in $foldersToRemove) {
    $folderPath = Join-Path $backupDir $folder
    if (Test-Path $folderPath) {
        Remove-Item $folderPath -Recurse -Force -ErrorAction SilentlyContinue
    }
}

Write-Host "Backup preparado em: $backupDir" -ForegroundColor Green
Write-Host "Agora você pode fazer git init, add, commit e push neste diretório" -ForegroundColor Cyan