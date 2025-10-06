const fs = require('fs');
const path = require('path');

class DatabaseService {
  constructor() {
    this.dataPath = path.join(__dirname, '../data/database.json');
    this.data = {
      usuarios: [],
      nfes: [],
      logs: [],
      configuracoes: {}
    };
    this.loadData();
  }

  loadData() {
    try {
      if (fs.existsSync(this.dataPath)) {
        const rawData = fs.readFileSync(this.dataPath, 'utf8');
        this.data = JSON.parse(rawData);
        console.log('📊 Dados carregados do arquivo');
      } else {
        console.log('📁 Criando novo banco de dados em arquivo');
        this.saveData();
      }
    } catch (error) {
      console.error('❌ Erro ao carregar dados:', error.message);
      this.data = { usuarios: [], nfes: [], logs: [], configuracoes: {} };
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
    this.data = { usuarios: [], nfes: [], logs: [], configuracoes: {} };
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

  // Estatísticas
  async getEstatisticas() {
    return {
      totalUsuarios: this.data.usuarios.length,
      totalNfes: this.data.nfes.length,
      totalLogs: this.data.logs.length,
      ultimaAtualizacao: new Date().toISOString()
    };
  }
}

// Exportar instância única
module.exports = new DatabaseService();