# Teste produção com dados completos
Write-Host "=== TESTE PRODUÇÃO ===" -ForegroundColor Yellow

$loginData = @{
    email = "adm@brandaocontador.com.br"
    senha = "BrandaoNFe2024!"
} | ConvertTo-Json

try {
    Write-Host "Fazendo login..." -ForegroundColor Yellow
    $loginResponse = Invoke-RestMethod -Uri "https://api.brandaocontador.com.br/auth/login" -Method POST -Body $loginData -ContentType "application/json"
    $token = $loginResponse.token
    Write-Host "✓ Login OK" -ForegroundColor Green
    Write-Host "Token: $($token.Substring(0,20))..." -ForegroundColor Green

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

    Write-Host "Emitindo NFe..." -ForegroundColor Yellow
    $nfeResponse = Invoke-RestMethod -Uri "https://api.brandaocontador.com.br/nfe/emitir" -Method POST -Body $nfeData -Headers $headers
    Write-Host "✓ NFe emitida com sucesso!" -ForegroundColor Green
    Write-Host $nfeResponse
} catch {
    Write-Host "✗ Erro: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        Write-Host "Status: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
        try {
            $errorStream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($errorStream)
            $errorBody = $reader.ReadToEnd()
            Write-Host "Resposta:" -ForegroundColor Red
            Write-Host $errorBody -ForegroundColor DarkRed
        } catch {
            Write-Host "Não foi possível ler o corpo da resposta de erro" -ForegroundColor Red
        }
    }
}