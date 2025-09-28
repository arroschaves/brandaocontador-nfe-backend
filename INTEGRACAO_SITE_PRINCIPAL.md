# Integração com Site Principal

## Opções de Integração

### Opção 1: Menu de Navegação
Adicionar no menu principal do site `brandaocontador.com.br`:

```html
<nav class="main-navigation">
  <ul>
    <li><a href="/">Início</a></li>
    <li><a href="/servicos">Serviços</a></li>
    <li><a href="/contato">Contato</a></li>
    <li><a href="https://nfe.brandaocontador.com.br" target="_blank">
      📄 Sistema NFe
    </a></li>
  </ul>
</nav>
```

### Opção 2: Botão de Acesso Rápido
Adicionar um botão destacado na página inicial:

```html
<div class="nfe-access-button">
  <a href="https://nfe.brandaocontador.com.br" 
     class="btn btn-primary btn-lg"
     target="_blank">
    <i class="fas fa-file-invoice"></i>
    Acessar Sistema de NFe
  </a>
</div>

<style>
.nfe-access-button {
  text-align: center;
  margin: 2rem 0;
  padding: 2rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 10px;
}

.nfe-access-button .btn {
  background: #fff;
  color: #333;
  padding: 15px 30px;
  font-size: 1.2rem;
  text-decoration: none;
  border-radius: 5px;
  transition: all 0.3s ease;
}

.nfe-access-button .btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(0,0,0,0.2);
}
</style>
```

### Opção 3: Sidebar com Serviços
Criar uma sidebar com todos os serviços:

```html
<div class="services-sidebar">
  <h3>Nossos Serviços</h3>
  <ul class="services-list">
    <li>
      <a href="/contabilidade">
        <i class="fas fa-calculator"></i>
        Contabilidade
      </a>
    </li>
    <li>
      <a href="https://nfe.brandaocontador.com.br" target="_blank">
        <i class="fas fa-file-invoice"></i>
        Emissão de NFe
      </a>
    </li>
    <li>
      <a href="/consultoria">
        <i class="fas fa-chart-line"></i>
        Consultoria
      </a>
    </li>
  </ul>
</div>
```

### Opção 4: Modal de Boas-vindas
Exibir um modal quando o usuário acessa o site:

```html
<div id="nfe-modal" class="modal">
  <div class="modal-content">
    <span class="close">&times;</span>
    <h2>🎉 Novo Sistema de NFe Disponível!</h2>
    <p>Agora você pode emitir suas Notas Fiscais Eletrônicas diretamente online.</p>
    <div class="modal-buttons">
      <a href="https://nfe.brandaocontador.com.br" 
         class="btn btn-primary" 
         target="_blank">
        Acessar Sistema NFe
      </a>
      <button class="btn btn-secondary" onclick="closeModal()">
        Mais Tarde
      </button>
    </div>
  </div>
</div>

<script>
function closeModal() {
  document.getElementById('nfe-modal').style.display = 'none';
  localStorage.setItem('nfe-modal-shown', 'true');
}

// Mostrar modal apenas uma vez por sessão
if (!localStorage.getItem('nfe-modal-shown')) {
  setTimeout(() => {
    document.getElementById('nfe-modal').style.display = 'block';
  }, 3000);
}
</script>
```

## 🌐 Configuração de Subdomínio (Recomendado)

### ⚠️ **IMPORTANTE - Evitar Erro CNAME Circular:**

**❌ NÃO FAÇA:**
- CNAME apontando para o próprio domínio
- CNAME no domínio raiz (@)
- Misturar registros A e CNAME para o mesmo nome

**✅ CONFIGURAÇÃO CORRETA:**

### Cloudflare DNS:
```
Tipo: CNAME
Nome: nfe
Conteúdo: brandaocontador-nfe-frontend.vercel.app
Proxy: ✅ Ativado (nuvem laranja)
TTL: Auto
```

### Se já existe registro A para "nfe":
1. **Primeiro**: Delete o registro A existente
2. **Depois**: Crie o CNAME conforme acima

### No Vercel:
- Adicionar domínio personalizado: `nfe.brandaocontador.com.br`

## URLs Finais Sugeridas

- **Site Principal**: `https://brandaocontador.com.br`
- **Sistema NFe**: `https://nfe.brandaocontador.com.br`
- **API**: `https://api.brandaocontador.com.br`

## Implementação Recomendada

1. **Imediato**: Usar Opção 2 (Botão de Acesso Rápido)
2. **Médio Prazo**: Configurar subdomínio `nfe.brandaocontador.com.br`
3. **Longo Prazo**: Integrar completamente no menu principal