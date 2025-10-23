# Script de teste completo para emissão de NFe
# Baseado na estrutura do validation-service.js

Write-Host "=== TESTE COMPLETO DE EMISSÃO DE NFE ===" -ForegroundColor Cyan

# 1. Login
Write-Host "`n1. Fazendo login..." -ForegroundColor Yellow
$loginData = @{
    email = "admin@brandaocontador.com.br"
    senha = "admin123"
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "https://api.brandaocontador.com.br/auth/login" -Method POST -Body $loginData -ContentType "application/json"
    Write-Host "✓ Login realizado com sucesso!" -ForegroundColor Green
    $token = $loginResponse.token
} catch {
    Write-Host "✗ Erro no login: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# 2. Teste de emissão de NFe
Write-Host "`n2. Testando emissão de NFe..." -ForegroundColor Yellow

$nfeData = @{
    # Dados do emitente (obrigatórios)
    emitente = @{
        cnpj = "45669746000120"
        razaoSocial = "MAP LTDA"
        nomeFantasia = "MAP LTDA"
        inscricaoEstadual = "123456789"
        endereco = @{
            logradouro = "Rua Exemplo"
            numero = "100"
            complemento = ""
            bairro = "Centro"
            cep = "01001000"
            municipio = "São Paulo"
            codigoMunicipio = "3550308"
            uf = "SP"
        }
    }
    
    # Dados do destinatário (obrigatórios)
    destinatario = @{
        cpf = "12345678901"
        nome = "Cliente Teste"
        endereco = @{
            logradouro = "Rua Cliente"
            numero = "200"
            complemento = ""
            bairro = "Centro"
            cep = "01002000"
            municipio = "São Paulo"
            codigoMunicipio = "3550308"
            uf = "SP"
        }
    }
    
    # Itens da NFe (obrigatórios)
    itens = @(
        @{
            codigo = "001"
            descricao = "Produto Teste"
            quantidade = 1
            unidade = "UN"
            valorUnitario = 100.0
            valorTotal = 100.0
            cfop = "5102"
            ncm = "12345678"
            cst = "00"
        }
    )
    
    # Totais (obrigatórios)
    totais = @{
        valorProdutos = 100.0
        valorTotal = 100.0
        baseCalculoICMS = 0.0
        valorICMS = 0.0
    }
    
    # Dados gerais
    numero = 1
    serie = 1
    naturezaOperacao = "Venda de mercadoria"
    tipoOperacao = 1  # 1 = Saída
    finalidade = 1    # 1 = Normal
    consumidorFinal = $true
    presencaComprador = 1  # 1 = Presencial
} | ConvertTo-Json -Depth 10

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

Write-Host "Dados da NFe:" -ForegroundColor Cyan
Write-Host $nfeData -ForegroundColor DarkCyan

try {
    Write-Host "`nEnviando requisição..." -ForegroundColor Yellow
    $nfeResponse = Invoke-RestMethod -Uri "https://api.brandaocontador.com.br/nfe/emitir" -Method POST -Body $nfeData -Headers $headers
    
    Write-Host "✓ NFe emitida com sucesso!" -ForegroundColor Green
    Write-Host "Resposta:" -ForegroundColor Green
    Write-Host ($nfeResponse | ConvertTo-Json -Depth 5) -ForegroundColor DarkGreen
    
} catch {
    Write-Host "✗ Erro na emissão da NFe: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        Write-Host "Status HTTP: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
        
        try {
            $errorStream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($errorStream)
            $errorBody = $reader.ReadToEnd()
            Write-Host "Resposta de erro:" -ForegroundColor Red
            Write-Host $errorBody -ForegroundColor DarkRed
        } catch {
            Write-Host "Não foi possível ler o corpo da resposta de erro" -ForegroundColor Red
        }
    }
}

Write-Host "`n=== FIM DO TESTE ===" -ForegroundColor Green