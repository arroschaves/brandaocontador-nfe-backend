param(
  [string]$OutPath = "E:\\PROJETOS\\brandaocontador-nfe\\backend\\certs\\teste-local.pfx",
  [string]$Senha = "1234"
)

Write-Host "Gerando certificado PFX de teste..." -ForegroundColor Yellow

try {
  $cert = New-SelfSignedCertificate -Subject "CN=Teste Local NFe" -CertStoreLocation "Cert:\\CurrentUser\\My" -KeyExportPolicy Exportable -KeyAlgorithm RSA -KeyLength 2048
  $pwd = ConvertTo-SecureString $Senha -AsPlainText -Force
  Export-PfxCertificate -Cert $cert -FilePath $OutPath -Password $pwd -Force
  if (Test-Path $OutPath) {
    Write-Host "PFX gerado com sucesso: $OutPath" -ForegroundColor Green
    exit 0
  } else {
    Write-Host "Falha ao gerar PFX" -ForegroundColor Red
    exit 1
  }
} catch {
  Write-Host "Erro ao gerar PFX: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}