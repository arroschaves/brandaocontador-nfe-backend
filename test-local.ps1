# Teste local com dados completos
Write-Host "=== TESTE LOCAL ===" -ForegroundColor Yellow

$loginData = @{
    email = "admin@brandaocontador.com.br"
    senha = "BrandaoNFe2024!"
} | ConvertTo-Json

$loginResponse = Invoke-RestMethod -Uri "http://localhost:3001/auth/login" -Method POST -Body $loginData -ContentType "application/json"
$token = $loginResponse.token

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

$nfeData = @{
    naturezaOperacao = "Venda"
    serie = "1"
    tipoOperacao = 1
    finalidade = 1
    presencaComprador = 1
    consumidorFinal = $true
    dataEmissao = "2025-01-23"
    emitente = @{
        nome = "Brandão Contador LTDA"
        cnpj = "45669746000120"
        inscricaoEstadual = "123456789012"
        endereco = @{
            logradouro = "Rua Teste"
            numero = "123"
            bairro = "Centro"
            cep = "01234567"
            municipio = "São Paulo"
            codigoMunicipio = "3550308"
            uf = "SP"
        }
    }
    destinatario = @{
        nome = "NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO – SEM VALOR FISCAL"
        cnpj = "11222333000181"
        endereco = @{
            logradouro = "Rua Destinatario"
            numero = "456"
            bairro = "Centro"
            cep = "01234567"
            municipio = "São Paulo"
            codigoMunicipio = "3550308"
            uf = "SP"
        }
    }
    itens = @(
        @{
            id = "1761241476338"
            codigo = "NB001"
            descricao = "Notebook Dell"
            ncm = "84713000"
            cfop = "5102"
            unidade = "UN"
            quantidade = 1
            valorUnitario = 2500.00
            valorTotal = 2500.00
        }
    )
    totais = @{
        valorProdutos = 2500.00
        valorTotal = 2500.00
        baseCalculoICMS = 0
        valorICMS = 0
    }
} | ConvertTo-Json -Depth 10

try {
    $nfeResponse = Invoke-RestMethod -Uri "http://localhost:3001/nfe/emitir" -Method POST -Body $nfeData -Headers $headers
    Write-Host "✓ Sucesso!" -ForegroundColor Green
    Write-Host $nfeResponse
} catch {
    Write-Host "✗ Erro: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $errorStream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($errorStream)
        $errorBody = $reader.ReadToEnd()
        Write-Host $errorBody -ForegroundColor Red
    }
}