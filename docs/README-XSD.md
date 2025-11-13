# Gestão de XSDs

## Estrutura
- `xsd/producao/*.xsd`
- `xsd/homologacao/*.xsd`
- `xsd/versions.json`: lista ordenada de versões por operação
- `xsd/checksums.json`: checksums SHA-256

## Verificação
- `node scripts/verify-xsd.js`

## Fallback
- Em falha de validação, utiliza a versão anterior definida em `versions.json`
