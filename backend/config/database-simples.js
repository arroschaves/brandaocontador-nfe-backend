const fs = require('fs');
const path = require('path');

class DatabaseService {
  constructor() {
    this.dataPath = path.join(__dirname, '../data/database.json');
    this.data = {
      usuarios: [],
      nfes: [],
      logs: [],
      configuracoes: {},
      clientes: [],
      produtos: []
    };
    this.loadData();
  }

  loadData() {
    try {
      if (fs.existsSync(this.dataPath)) {
        const rawData = fs.readFileSync(this.dataPath, 'utf8');
        this.data = JSON.parse(rawData);
        // Garantir chaves novas
        this.data.clientes = this.data.clientes || [];
        this.data.produtos = this.data.produtos || [];
        console.log('📊 Dados carregados do arquivo');
      } else {
        console.log('📁 Criando novo banco de dados em arquivo');
        this.saveData();
      }
    } catch (error) {
      console.error('❌ Erro ao carregar dados:', error.message);
      this.data = { usuarios: [], nfes: [], logs: [], configuracoes: {}, clientes: [], produtos: [] };
    }
  }

  saveData() {
    try {
      const dir = path.dirname(this.dataPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.dataPath, JSON.stringify(this.data, null, 2));
    } catch (error) {
      console.error('❌ Erro ao salvar dados:', error.message);
    }
  }

  // Métodos de conexão (simulados para compatibilidade)
  async connect() {
    console.log('📡 Conectando ao banco de dados (modo arquivo)...');
    this.loadData();
    console.log('✅ Conexão estabelecida com banco de dados em arquivo');
    return true;
  }

  async disconnect() {
    console.log('🔌 Desconectando do banco de dados...');
    this.saveData();
    console.log('✅ Desconectado do banco de dados');
    return true;
  }

  isConnected() {
    return true; // Sempre conectado em modo arquivo
  }

  // Métodos de limpeza
  async limparBanco() {
    console.log('🧹 Limpando banco de dados...');
    this.data = { usuarios: [], nfes: [], logs: [], configuracoes: {}, clientes: [], produtos: [] };
    this.saveData();
    console.log('✅ Banco de dados limpo');
  }

  // Métodos de usuários
  async criarUsuario(usuarioData) {
    const usuario = {
      id: Date.now().toString(),
      ...usuarioData,
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString()
    };
    
    this.data.usuarios.push(usuario);
    this.saveData();
    return usuario;
  }

  async buscarUsuarioPorEmail(email) {
    return this.data.usuarios.find(u => u.email === email);
  }

  async buscarUsuarioPorId(id) {
    return this.data.usuarios.find(u => u.id === id);
  }

  async buscarUsuarioPorDocumento(documento) {
    return this.data.usuarios.find(u => u.documento === documento);
  }

  async atualizarUsuario(id, dados) {
    const index = this.data.usuarios.findIndex(u => u.id === id);
    if (index === -1) return null;
    
    this.data.usuarios[index] = {
      ...this.data.usuarios[index],
      ...dados,
      atualizadoEm: new Date().toISOString()
    };
    
    this.saveData();
    return this.data.usuarios[index];
  }

  async listarUsuarios() {
    return this.data.usuarios;
  }

  async removerUsuario(id) {
    const index = this.data.usuarios.findIndex(u => u.id === id);
    if (index === -1) return false;
    this.data.usuarios.splice(index, 1);
    this.saveData();
    return true;
  }

  // Métodos de NFe
  async criarNFe(nfeData) {
    const nfe = {
      id: Date.now().toString(),
      ...nfeData,
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString()
    };
    
    this.data.nfes.push(nfe);
    this.saveData();
    return nfe;
  }

  async buscarNFePorId(id) {
    return this.data.nfes.find(n => n.id === id);
  }

  async buscarNFePorChave(chave) {
    return this.data.nfes.find(n => n.chave === chave);
  }

  async listarNfes(filtros = {}) {
    let nfes = [...this.data.nfes];
    
    // Aplicar filtros básicos
    if (filtros.status) {
      nfes = nfes.filter(n => n.status === filtros.status);
    }
    if (filtros.usuarioId) {
      nfes = nfes.filter(n => n.usuarioId === filtros.usuarioId);
    }
    
    return nfes;
  }

  // Métodos de logs
  async criarLog(logData) {
    const log = {
      id: Date.now().toString(),
      ...logData,
      timestamp: new Date().toISOString()
    };
    
    this.data.logs.push(log);
    this.saveData();
    return log;
  }

  async listarLogs(limit = 100) {
    return this.data.logs.slice(-limit);
  }

  // Clientes
  async criarCliente(clienteData) {
    const cliente = {
      id: Date.now().toString(),
      ...clienteData,
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
      ativo: clienteData.ativo !== undefined ? clienteData.ativo : true
    };
    this.data.clientes.push(cliente);
    this.saveData();
    return cliente;
  }

  async listarClientes(filtros = {}) {
    let clientes = [...this.data.clientes];
    if (filtros.q) {
      const q = String(filtros.q).toLowerCase();
      const qNum = String(filtros.q).replace(/\D/g, '');
      clientes = clientes.filter(c =>
        (c.nome || '').toLowerCase().includes(q) ||
        (c.razaoSocial || '').toLowerCase().includes(q) ||
        (c.nomeFantasia || '').toLowerCase().includes(q) ||
        (c.documento || '').includes(qNum) ||
        (c.email || '').toLowerCase().includes(q)
      );
    }
    if (filtros.ativo !== undefined) {
      const ativo = filtros.ativo === true || filtros.ativo === 'true';
      clientes = clientes.filter(c => c.ativo === ativo);
    }
    if (filtros.usuarioId) {
      clientes = clientes.filter(c => c.usuarioId === filtros.usuarioId);
    }
    return clientes;
  }

  async buscarClientePorId(id) {
    return this.data.clientes.find(c => c.id === id);
  }

  async atualizarCliente(id, dados) {
    const index = this.data.clientes.findIndex(c => c.id === id);
    if (index === -1) return null;
    this.data.clientes[index] = {
      ...this.data.clientes[index],
      ...dados,
      atualizadoEm: new Date().toISOString()
    };
    this.saveData();
    return this.data.clientes[index];
  }

  async removerCliente(id) {
    const index = this.data.clientes.findIndex(c => c.id === id);
    if (index === -1) return false;
    this.data.clientes.splice(index, 1);
    this.saveData();
    return true;
  }

  // Produtos
  async criarProduto(produtoData) {
    const produto = {
      id: Date.now().toString(),
      ...produtoData,
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
      ativo: produtoData.ativo !== undefined ? produtoData.ativo : true
    };
    this.data.produtos.push(produto);
    this.saveData();
    return produto;
  }

  async listarProdutos(filtros = {}) {
    let produtos = [...this.data.produtos];
    if (filtros.q) {
      const q = String(filtros.q).toLowerCase();
      produtos = produtos.filter(p =>
        (p.nome || '').toLowerCase().includes(q) ||
        (p.codigo || '').toLowerCase().includes(q) ||
        (p.ncm || '').toLowerCase().includes(q) ||
        (p.descricao || '').toLowerCase().includes(q)
      );
    }
    if (filtros.ativo !== undefined) {
      const ativo = filtros.ativo === true || filtros.ativo === 'true';
      produtos = produtos.filter(p => p.ativo === ativo);
    }
    if (filtros.usuarioId) {
      produtos = produtos.filter(p => p.usuarioId === filtros.usuarioId);
    }
    return produtos;
  }

  async buscarProdutoPorId(id) {
    return this.data.produtos.find(p => p.id === id);
  }

  async atualizarProduto(id, dados) {
    const index = this.data.produtos.findIndex(p => p.id === id);
    if (index === -1) return null;
    this.data.produtos[index] = {
      ...this.data.produtos[index],
      ...dados,
      atualizadoEm: new Date().toISOString()
    };
    this.saveData();
    return this.data.produtos[index];
  }

  async removerProduto(id) {
    const index = this.data.produtos.findIndex(p => p.id === id);
    if (index === -1) return false;
    this.data.produtos.splice(index, 1);
    this.saveData();
    return true;
  }

  // Estatísticas
  async getEstatisticas() {
    return {
      totalUsuarios: this.data.usuarios.length,
      totalNfes: this.data.nfes.length,
      totalLogs: this.data.logs.length,
      ultimaAtualizacao: new Date().toISOString()
    };
  }

  // Configurações
  async getConfiguracoes() {
    return this.data.configuracoes || {};
  }

  async atualizarConfiguracoes(novasConfiguracoes) {
    this.data.configuracoes = {
      ...this.data.configuracoes,
      ...novasConfiguracoes,
      atualizadoEm: new Date().toISOString()
    };
    this.saveData();
    return this.data.configuracoes;
  }
}

// Exportar instância única
module.exports = new DatabaseService();