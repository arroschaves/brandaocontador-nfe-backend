$ErrorActionPreference = 'Stop'
Start-Sleep -Seconds 45
$resp = Invoke-WebRequest -UseBasicParsing -Uri 'https://nfe.brandaocontador.com.br'
Write-Host "Status: $($resp.StatusCode)"
Write-Host "x-vercel-id: $($resp.Headers['x-vercel-id'])"
Write-Host "x-vercel-cache: $($resp.Headers['x-vercel-cache'])"
Write-Host "cache-control: $($resp.Headers['cache-control'])"