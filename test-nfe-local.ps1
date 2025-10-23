# Script para testar emissão de NFe localmente

Write-Host "🔐 Fazendo login..." -ForegroundColor Yellow

# Login
$loginData = @{
    email = "admin@brandaocontador.com.br"
    senha = "BrandaoNFe2024!"
}

$loginResponse = Invoke-RestMethod -Uri "http://localhost:3001/auth/login" -Method POST -Body ($loginData | ConvertTo-Json) -ContentType "application/json"

if ($loginResponse.sucesso) {
    Write-Host "✅ Login realizado com sucesso!" -ForegroundColor Green
    $token = $loginResponse.token
    
    # Headers com token
    $headers = @{
        "Authorization" = "Bearer $token"
        "Content-Type" = "application/json"
    }
    
    # Dados da NFe
    $nfeData = @{
        naturezaOperacao = "Venda"
        serie = "1"
        tipoOperacao = 1
        finalidade = 1
        presencaComprador = 1
        consumidorFinal = $true
        dataEmissao = "2025-10-23"
        destinatario = @{
            nome = "NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO – SEM VALOR FISCAL"
        }
        emitente = @{
            nome = "Brandão Contador LTDA"
            cnpj = "45669746000120"
            inscricaoEstadual = "123456789012"
        }
        itens = @(
            @{
                id = "1761241476338"
                codigo = "NB001"
                descricao = "Notebook Dell"
                ncm = "84713000"
                cfop = "5102"
                quantidade = 1
                valorUnitario = 2500
                valorTotal = 2500
            }
        )
        totais = @{
            valorProdutos = 2500
            valorTotal = 2500
            baseCalculoICMS = 0
            valorICMS = 0
        }
    }
    
    Write-Host "📄 Testando emissão de NFe localmente..." -ForegroundColor Yellow
    
    try {
        $nfeResponse = Invoke-RestMethod -Uri "http://localhost:3001/nfe/emitir" -Method POST -Body ($nfeData | ConvertTo-Json -Depth 10) -Headers $headers
        
        Write-Host "✅ NFe emitida com sucesso localmente!" -ForegroundColor Green
        Write-Host "Resposta:" -ForegroundColor Cyan
        $nfeResponse | ConvertTo-Json -Depth 10 | Write-Host -ForegroundColor Gray
        
    } catch {
        Write-Host "❌ Erro na emissão da NFe:" -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Red
        
        if ($_.Exception.Response) {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $responseBody = $reader.ReadToEnd()
            Write-Host "Resposta do servidor:" -ForegroundColor Yellow
            Write-Host $responseBody -ForegroundColor Gray
        }
    }
    
} else {
    Write-Host "❌ Falha no login:" -ForegroundColor Red
    Write-Host ($loginResponse | ConvertTo-Json) -ForegroundColor Gray
}