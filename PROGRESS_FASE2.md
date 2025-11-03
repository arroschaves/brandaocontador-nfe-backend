# 🎯 CORREÇÕES IMPLEMENTADAS - Fase 2 (Em Progresso)

## ✅ BUGS CRÍTICOS CORRIGIDOS

### 1. Usuário Administrador Criado
**Status**: ✅ COMPLETO

**Criado**:
- Email: `cjbrandao@brandaocontador.com.br`
- Senha: `@Pa2684653#`
- Tipo: `admin`
- 18 permissões totais

**Arquivo**: `data/users.json` criado
**Script**: `scripts/create-admin.js`

**Login**:
```
Acesse: http://localhost:3000/login
Email: cjbrandao@brandaocontador.com.br
Senha: @Pa2684653#
```

---

### 2. Gerenciar Usuários - Não Salvava
**Status**: ✅ COMPLETO

**Problemas Identificados**:
1. Frontend enviava `PATCH`, backend só tinha `PUT`
2. Método `alterarStatusUsuario()` não existia
3. Campo `status` faltava em usuários antigos

**Correções**:
- ✅ Adicionado `router.patch('/usuarios/:id')` em `routes/admin.js`
- ✅ Adicionado `router.patch('/usuarios/:id/status')`  
- ✅ Criado `alterarStatusUsuario()` em `services/admin-service.js`

**Arquivos Modificados**:
- `routes/admin.js` (linhas 157, 194)
- `services/admin-service.js` (linha 337+)

---

### 3. Upload de Certificado - Não Gravava
**Status**: ✅ COMPLETO

**Problemas Identificados**:
1. **CRÍTICO**: Certificado salvo em arquivo mas NUNCA persistido no banco
2. Encoding errado (`utf8` ao invés de `latin1` para hex)
3. Resposta incompleta para frontend

**Correções**:
- ✅ Adicionada persistência em `data/usuarios.json` (linhas 983-1010)
- ✅ Corrigido encoding para `latin1`
- ✅ Retorno estruturado com `configuracoes.nfe.certificadoDigital`

**Arquivo Modificado**:
- `routes/configuracoes.js` (+48 linhas, -8 linhas)

**Teste**:
```bash
# Fazer upload via interface
# Verificar que aparece em Configurações após recarregar
```

---

## 🚧 BUGS A CORRIGIR (Próximos)

### 4. Dashboard - Erro ao Acessar
**Status**: 🔄 PENDENTE

**Investigar**:
- `frontend-remote/src/pages/Dashboard.tsx`
- `routes/dashboard.js`
- Possível erro de API não retornar dados esperados
- Verificar console do navegador para erro específico

**Ação**: Executar frontend e capturar erro exato

---

### 5. Cadastro (Tela Login) - Não Salva
**Status**: 🔄 PENDENTE

**Investigar**:
- `routes/auth.js` - POST `/api/auth/register`
- `services/auth-service.js` - método `register()`
- Verificar validação de email/senha
- Verificar se retorna erro específico

**Possível Problema**:
- Validação muito restritiva
- Erro ao salvar em `users.json`
- Conflito com usuário existente

---

## 🔍 FUNCIONALIDADES A IMPLEMENTAR

### 6. Busca Automática CNPJ
**Status**: 🔄 PENDENTE

**APIs Disponíveis**:
1. **ReceitaWS**: `https://www.receitaws.com.br/v1/cnpj/{cnpj}`
2. **BrasilAPI**: `https://brasilapi.com.br/api/cnpj/v1/{cnpj}`

**Implementação**:
```typescript
// frontend-remote/src/services/cnpjService.ts
export async function buscarCNPJ(cnpj: string) {
  try {
    // Limpar CNPJ
    const cnpjLimpo = cnpj.replace(/\D/g, '');
    
    // Tentar BrasilAPI primeiro
    const response = await axios.get(
      `https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`
    );
    
    return {
      razaoSocial: response.data.razao_social,
      nomeFantasia: response.data.nome_fantasia,
      cnpj: response.data.cnpj,
      endereco: {
        logradouro: response.data.logradouro,
        numero: response.data.numero,
        complemento: response.data.complemento,
        bairro: response.data.bairro,
        cidade: response.data.municipio,
        uf: response.data.uf,
        cep: response.data.cep
      },
      telefone: response.data.ddd_telefone_1,
      email: response.data.email,
      dataAbertura: response.data.data_inicio_atividade
    };
  } catch (error) {
    // Fallback para ReceitaWS
    const response = await axios.get(
      `https://www.receitaws.com.br/v1/cnpj/${cnpjLimpo}`
    );
    // ... mapear campos
  }
}
```

**Uso no Frontend**:
```tsx
// Configuracoes.tsx
const handleCNPJBlur = async () => {
  if (validarCNPJ(configEmpresa.cnpj)) {
    setCarregandoCNPJ(true);
    try {
      const dados = await buscarCNPJ(configEmpresa.cnpj);
      setConfigEmpresa(prev => ({
        ...prev,
        ...dados
      }));
      showToast('Dados preenchidos automaticamente!', 'success');
    } catch (error) {
      showToast('Erro ao buscar CNPJ', 'error');
    } finally {
      setCarregandoCNPJ(false);
    }
  }
};
```

---

### 7. Busca Automática CEP
**Status**: 🔄 PENDENTE

**APIs Disponíveis**:
1. **ViaCEP**: `https://viacep.com.br/ws/{cep}/json/`
2. **BrasilAPI**: `https://brasilapi.com.br/api/cep/v2/{cep}`

**Implementação**:
```typescript
// frontend-remote/src/services/cepService.ts
export async function buscarCEP(cep: string) {
  const cepLimpo = cep.replace(/\D/g, '');
  
  if (cepLimpo.length !== 8) {
    throw new Error('CEP inválido');
  }
  
  try {
    // Tentar ViaCEP primeiro
    const response = await axios.get(
      `https://viacep.com.br/ws/${cepLimpo}/json/`
    );
    
    if (response.data.erro) {
      throw new Error('CEP não encontrado');
    }
    
    return {
      cep: response.data.cep,
      logradouro: response.data.logradouro,
      complemento: response.data.complemento,
      bairro: response.data.bairro,
      cidade: response.data.localidade,
      uf: response.data.uf
    };
  } catch (error) {
    // Fallback BrasilAPI
    const response = await axios.get(
      `https://brasilapi.com.br/api/cep/v2/${cepLimpo}`
    );
    // ... mapear
  }
}
```

---

## 🧹 LIMPEZA DE DADOS

### 8. Remover Dados Mockados/Simulados
**Status**: 🔄 PENDENTE

**Arquivos a Limpar**:

1. **`data/users.json`**:
   - Manter apenas admin criado
   - Remover usuários de teste

2. **`data/clientes.json`**:
   - Limpar completamente (array vazio `[]`)

3. **`data/produtos.json`**:
   - Limpar completamente

4. **`data/nfes.json`**:
   - Limpar completamente

5. **`data/ctes.json`**:
   - Limpar completamente

6. **`data/mdfes.json`**:
   - Limpar completamente

7. **`data/configuracoes.json`**:
   - Manter estrutura mas limpar valores mockados

**Script de Limpeza**:
```javascript
// scripts/clean-data.js
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../data');

// Arquivos a limpar
const arquivosParaLimpar = [
  'clientes.json',
  'produtos.json',
  'nfes.json',
  'ctes.json',
  'mdfes.json',
  'eventos.json'
];

arquivosParaLimpar.forEach(arquivo => {
  const filePath = path.join(dataDir, arquivo);
  if (fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify([], null, 2), 'utf8');
    console.log(`✅ ${arquivo} limpo`);
  }
});

// Configurações - resetar mas manter estrutura
const configPath = path.join(dataDir, 'configuracoes.json');
const configClean = {
  usuarios: {}
};
fs.writeFileSync(configPath, JSON.stringify(configClean, null, 2), 'utf8');
console.log('✅ configuracoes.json resetado');

console.log('\n✨ Limpeza completa!');
```

**Executar**:
```bash
node scripts/clean-data.js
```

---

## 📋 DADOS MOCKADOS A REMOVER

### Services com Dados Mock:

1. **`services/certificate-service.js`** (linhas 115-124):
```javascript
// REMOVER MOCK
const dadosCertificado = {
    titular: 'EMPRESA TESTE LTDA',  // ❌ MOCK
    cnpj: '12345678000123',         // ❌ MOCK
    // ...
};
```
**Substituir por**: Extração real com `node-forge`

2. **`routes/configuracoes.js`** (linhas 985-992):
```javascript
const certificadoInfo = {
  instalado: true,
  valido: true,  // ❌ Sempre true
  dataVencimento: new Date(...).toISOString(),  // ❌ Mock
  titular: "Certificado Instalado",  // ❌ Mock
  // ...
};
```
**Substituir por**: Dados reais extraídos do certificado

---

## 🎯 PRÓXIMAS AÇÕES IMEDIATAS

### Prioridade 1 (Hoje):
1. ✅ ~~Criar admin~~
2. ✅ ~~Corrigir Gerenciar Usuários~~
3. ✅ ~~Corrigir Upload Certificado~~
4. 🔄 Corrigir Dashboard
5. 🔄 Corrigir Cadastro

### Prioridade 2 (Esta Semana):
6. Implementar busca CNPJ
7. Implementar busca CEP
8. Limpar dados mockados
9. Implementar validação real de certificado (node-forge)

### Prioridade 3 (Próxima Semana):
10. Implementar ST (Substituição Tributária)
11. Corrigir race condition numeração
12. Validação chave de acesso
13. Validação IE por UF

---

## 📊 STATUS GERAL

| Categoria | Total | Completo | Pendente |
|-----------|-------|----------|----------|
| **Bugs Críticos** | 5 | 3 ✅ | 2 🔄 |
| **Funcionalidades** | 4 | 0 | 4 🔄 |
| **Limpeza** | 1 | 0 | 1 🔄 |
| **Validações** | 4 | 0 | 4 🔄 |
| **TOTAL** | 14 | 3 (21%) | 11 (79%) |

---

## 🆘 TROUBLESHOOTING

### Admin Não Consegue Logar
```bash
# Verificar se admin existe
cat data/users.json | grep "cjbrandao@brandaocontador.com.br"

# Recriar admin
node scripts/create-admin.js
```

### Certificado Não Aparece
```bash
# Verificar se está salvo
ls -lh certs/*.pfx

# Verificar permissões
chmod 600 certs/*.pfx

# Ver logs
pm2 logs nfe-backend --lines 50
```

### Erro ao Salvar Usuário
```bash
# Verificar JSON
cat data/usuarios.json | jq .

# Permissões
chmod 644 data/usuarios.json
```

---

**Última Atualização**: 2025-11-03 17:45  
**Responsável**: Auditoria Automatizada  
**Próximo Checkpoint**: Após correção Dashboard e Cadastro
