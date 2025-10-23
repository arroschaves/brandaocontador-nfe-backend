# Script para testar validação específica da NFe
$ErrorActionPreference = "Stop"

Write-Host "=== TESTE DE VALIDAÇÃO NFE - DEBUG ===" -ForegroundColor Yellow

# URL da API
$apiUrl = "https://api.brandaocontador.com.br"

# Dados de login
$loginData = @{
    email = "adm@brandaocontador.com.br"
    senha = "BrandaoNFe2024!"
} | ConvertTo-Json -Depth 10

Write-Host "1. Fazendo login..." -ForegroundColor Cyan

try {
    $loginResponse = Invoke-RestMethod -Uri "$apiUrl/auth/login" -Method POST -Body $loginData -ContentType "application/json"
    $token = $loginResponse.token
    Write-Host "✓ Login realizado com sucesso" -ForegroundColor Green
    Write-Host "Token: $($token.Substring(0, 20))..." -ForegroundColor Gray
} catch {
    Write-Host "✗ Erro no login: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Headers com token
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

# Dados da NFe com TODOS os campos obrigatórios
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

Write-Host "`n2. Testando emissão da NFe..." -ForegroundColor Cyan
Write-Host "Dados enviados:" -ForegroundColor Gray
Write-Host $nfeData -ForegroundColor DarkGray

try {
    $nfeResponse = Invoke-RestMethod -Uri "$apiUrl/nfe/emitir" -Method POST -Body $nfeData -Headers $headers
    Write-Host "✓ NFe emitida com sucesso!" -ForegroundColor Green
    Write-Host "Resposta: $($nfeResponse | ConvertTo-Json -Depth 3)" -ForegroundColor Gray
} catch {
    Write-Host "✗ Erro na emissão da NFe:" -ForegroundColor Red
    Write-Host "Status Code: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    Write-Host "Status Description: $($_.Exception.Response.StatusDescription)" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        try {
            $errorStream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($errorStream)
            $errorBody = $reader.ReadToEnd()
            Write-Host "Corpo da resposta de erro:" -ForegroundColor Red
            Write-Host $errorBody -ForegroundColor DarkRed
        } catch {
            Write-Host "Não foi possível ler o corpo da resposta de erro" -ForegroundColor Red
        }
    }
}

Write-Host "`n=== FIM DO TESTE ===" -ForegroundColor Yellow