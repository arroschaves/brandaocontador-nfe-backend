# Migrations SQLite

## Versões
- 0001_init: criação de tabelas base
- 0002_indices: criação de índices
- 0003_constraints: restrição de status em `nfes`
- 0004_expand_entities: colunas adicionais e rastreamento

## Aplicação
- `npm run migrate:sqlite:all`
- `npm run rollback:sqlite 0004`

## Compatibilidade
- Estrutura preserva dados ao aplicar ou reverter via tabelas temporárias
