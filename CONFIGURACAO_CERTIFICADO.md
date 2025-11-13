# Configuração do Certificado Digital para NFe

## Pré-requisitos

1. **Certificado Digital A1 ou A3** válido para NFe
2. **Arquivo .pfx** (PKCS#12) do certificado
3. **Senha** do certificado

## Passos para Configuração

### 1. Colocar o Arquivo do Certificado

Coloque o arquivo `.pfx` do seu certificado em uma das seguintes localizações:

```
backend/certs/certificado.pfx    (recomendado)
backend/certs/cert.pfx
backend/certs/nfe.pfx
```

### 2. Configurar Variáveis de Ambiente

Edite o arquivo `.env` e configure:

```env
# Caminho para o certificado (opcional se estiver em certs/certificado.pfx)
CERT_PATH=./certs/certificado.pfx

# Senha do certificado
CERT_PASS=sua_senha_aqui

# CNPJ do emitente (apenas números)
CNPJ_EMITENTE=12345678000195
```

### 3. Verificar Configuração

Após configurar, teste o certificado:

```bash
curl -X GET http://localhost:3001/nfe/status
```

O retorno deve mostrar:

```json
{
  "certificado": {
    "carregado": true,
    "valido": true,
    "vencimento": "2025-12-31T23:59:59.000Z"
  }
}
```

## Estrutura de Fallback

O sistema tenta carregar o certificado na seguinte ordem:

1. `CERT_PATH` (se definido no .env)
2. `./certs/certificado.pfx`
3. `./certs/cert.pfx`
4. `./certs/nfe.pfx`

## Troubleshooting

### Erro: "Senha inválida"

- Verifique se a senha está correta no arquivo `.env`
- Teste a senha abrindo o certificado no Windows

### Erro: "Arquivo não encontrado"

- Verifique se o arquivo `.pfx` está no local correto
- Confirme as permissões de leitura do arquivo

### Erro: "Certificado expirado"

- Verifique a validade do certificado
- Renove o certificado se necessário

## Segurança

⚠️ **IMPORTANTE:**

- Nunca commite o arquivo `.pfx` no Git
- Mantenha a senha segura
- Use permissões restritas no arquivo do certificado
- Em produção, considere usar variáveis de ambiente do sistema

## Exemplo de Configuração Completa

```env
# Certificado
CERT_PATH=./certs/certificado.pfx
CERT_PASS=MinhaSenh@123

# Emitente
CNPJ_EMITENTE=12345678000195
UF=SP

# Ambiente
AMBIENTE=1
NODE_ENV=production
```
