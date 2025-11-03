// ==================== CONFIGURAÇÃO DE BANCO DE DADOS CONSOLIDADA ====================
// Combina funcionalidades de database.js e database-simples.js
// Auto-detecção de ambiente: MongoDB (produção) ou Arquivo JSON (desenvolvimento)

const fs = require('fs').promises;
const path = require('path');

// Auto-detecção de ambiente
const NODE_ENV = process.env.NODE_ENV || 'development';
const USE_MONGODB = process.env.USE_MONGODB !== 'false' && NODE_ENV !== 'test';

// Imports condicionais baseados no ambiente
let mongoose;
if (USE_MONGODB) {
  mongoose = require('mongoose');
}

// ==================== CONFIGURAÇÃO MONGODB ====================
class MongoDBConfig {
  constructor() {
    this.isConnected = false;
    this.connectionRetries = 0;
    this.maxRetries = 5;
    this.retryDelay = 5000; // 5 segundos
  }

  async conectar() {
    if (this.isConnected) {
      console.log('✅ MongoDB já está conectado');
      return true;
    }

    try {
      const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/brandao-nfe';
      
      console.log('🔄 Conectando ao MongoDB...');
      
      await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 10000, // 10 segundos
        socketTimeoutMS: 45000, // 45 segundos
        family: 4, // Usar IPv4
        maxPoolSize: 10,
        minPoolSize: 2,
        maxIdleTimeMS: 30000,
        bufferCommands: false
      });

      this.isConnected = true;
      this.connectionRetries = 0;
      
      console.log('✅ MongoDB conectado com sucesso');
      console.log(`📍 URI: ${mongoUri.replace(/\/\/.*@/, '//***:***@')}`);
      
      // Event listeners para monitoramento
      mongoose.connection.on('error', (error) => {
        console.error('❌ Erro na conexão MongoDB:', error);
        this.isConnected = false;
      });

      mongoose.connection.on('disconnected', () => {
        console.warn('⚠️ MongoDB desconectado');
        this.isConnected = false;
        this.tentarReconectar();
      });

      mongoose.connection.on('reconnected', () => {
        console.log('✅ MongoDB reconectado');
        this.isConnected = true;
        this.connectionRetries = 0;
      });

      return true;

    } catch (error) {
      console.error('❌ Erro ao conectar MongoDB:', error.message);
      this.isConnected = false;
      
      if (this.connectionRetries < this.maxRetries) {
        this.connectionRetries++;
        console.log(`🔄 Tentativa ${this.connectionRetries}/${this.maxRetries} em ${this.retryDelay/1000}s...`);
        
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        return this.conectar();
      } else {
        console.error('💥 Máximo de tentativas de conexão MongoDB excedido');
        throw error;
      }
    }
  }

  async tentarReconectar() {
    if (this.connectionRetries < this.maxRetries && !this.isConnected) {
      this.connectionRetries++;
      console.log(`🔄 Tentando reconectar MongoDB (${this.connectionRetries}/${this.maxRetries})...`);
      
      setTimeout(() => {
        this.conectar().catch(console.error);
      }, this.retryDelay);
    }
  }

  async desconectar() {
    if (this.isConnected && mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      this.isConnected = false;
      console.log('✅ MongoDB desconectado');
    }
  }

  async verificarConexao() {
    if (!this.isConnected) {
      return false;
    }

    try {
      await mongoose.connection.db.admin().ping();
      return true;
    } catch (error) {
      console.error('❌ Falha no ping MongoDB:', error);
      this.isConnected = false;
      return false;
    }
  }

  obterStatus() {
    const estados = {
      0: 'desconectado',
      1: 'conectado',
      2: 'conectando',
      3: 'desconectando'
    };

    return {
      conectado: this.isConnected,
      estado: estados[mongoose?.connection?.readyState] || 'indefinido',
      host: mongoose?.connection?.host || 'N/A',
      porta: mongoose?.connection?.port || 'N/A',
      database: mongoose?.connection?.name || 'N/A',
      tentativas: this.connectionRetries
    };
  }
}

// ==================== CONFIGURAÇÃO ARQUIVO JSON ====================
class JSONDatabaseConfig {
  constructor() {
    this.dataDir = path.join(__dirname, '..', 'data');
    this.arquivos = {
      usuarios: path.join(this.dataDir, 'usuarios.json'),
      nfes: path.join(this.dataDir, 'nfes.json'),
      logs: path.join(this.dataDir, 'logs.json'),
      clientes: path.join(this.dataDir, 'clientes.json'),
      produtos: path.join(this.dataDir, 'produtos.json'),
      configuracoes: path.join(this.dataDir, 'configuracoes.json')
    };
    this.isConnected = false;
  }

  async conectar() {
    try {
      console.log('🔄 Inicializando banco de dados JSON...');
      
      // Criar diretório se não existir
      await this.criarDiretorio();
      
      // Inicializar arquivos se não existirem
      await this.inicializarArquivos();
      
      this.isConnected = true;
      console.log('✅ Banco de dados JSON inicializado');
      console.log(`📍 Diretório: ${this.dataDir}`);
      
      return true;

    } catch (error) {
      console.error('❌ Erro ao inicializar banco JSON:', error);
      this.isConnected = false;
      throw error;
    }
  }

  async criarDiretorio() {
    try {
      await fs.access(this.dataDir);
    } catch {
      await fs.mkdir(this.dataDir, { recursive: true });
      
    }
  }

  async inicializarArquivos() {
    const dadosIniciais = {
      usuarios: [
        {
          id: 1,
          nome: 'Administrador',
          email: 'admin@brandaocontador.com.br',
          senha: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.s5uIoO', // admin123
          documento: '00000000000',
          tipoCliente: 'cpf',
          permissoes: ['admin', 'nfe_emitir', 'nfe_consultar', 'nfe_cancelar'],
          ativo: true,
          status: 'ativo',
          criadoEm: new Date().toISOString(),
          ultimoLogin: null,
          totalLogins: 0
        }
      ],
      nfes: [],
      logs: [],
      clientes: [],
      produtos: [],
      configuracoes: {
        sistema: {
          versao: '1.0.0',
          ambiente: NODE_ENV,
          inicializado: new Date().toISOString()
        },
        nfe: {
          ambiente: process.env.NFE_AMBIENTE || 'homologacao',
          uf: process.env.NFE_UF || 'SP',
          serie: parseInt(process.env.NFE_SERIE) || 1,
          numeroInicial: parseInt(process.env.NFE_NUMERO_INICIAL) || 1
        }
      }
    };

    for (const [nome, arquivo] of Object.entries(this.arquivos)) {
      try {
        await fs.access(arquivo);
      } catch {
        await fs.writeFile(arquivo, JSON.stringify(dadosIniciais[nome] || [], null, 2));
        
      }
    }
  }

  async lerArquivo(tipo) {
    try {
      const arquivo = this.arquivos[tipo];
      if (!arquivo) {
        throw new Error(`Tipo de arquivo inválido: ${tipo}`);
      }

      const conteudo = await fs.readFile(arquivo, 'utf8');
      return JSON.parse(conteudo);
    } catch (error) {
      console.error(`❌ Erro ao ler arquivo ${tipo}:`, error);
      return [];
    }
  }

  async escreverArquivo(tipo, dados) {
    try {
      const arquivo = this.arquivos[tipo];
      if (!arquivo) {
        throw new Error(`Tipo de arquivo inválido: ${tipo}`);
      }

      await fs.writeFile(arquivo, JSON.stringify(dados, null, 2));
      return true;
    } catch (error) {
      console.error(`❌ Erro ao escrever arquivo ${tipo}:`, error);
      throw error;
    }
  }

  // ==================== MÉTODOS CRUD PARA USUÁRIOS ====================

  async buscarUsuarioPorEmail(email) {
    const usuarios = await this.lerArquivo('usuarios');
    return usuarios.find(u => u.email.toLowerCase() === email.toLowerCase());
  }

  async buscarUsuarioPorId(id) {
    const usuarios = await this.lerArquivo('usuarios');
    return usuarios.find(u => u.id == id);
  }

  async buscarUsuarioPorDocumento(documento) {
    const usuarios = await this.lerArquivo('usuarios');
    return usuarios.find(u => u.documento === documento.replace(/\D/g, ''));
  }

  async criarUsuario(dadosUsuario) {
    const usuarios = await this.lerArquivo('usuarios');
    const novoId = Math.max(...usuarios.map(u => u.id), 0) + 1;
    
    const novoUsuario = {
      id: novoId,
      ...dadosUsuario,
      criadoEm: dadosUsuario.criadoEm || new Date().toISOString()
    };

    usuarios.push(novoUsuario);
    await this.escreverArquivo('usuarios', usuarios);
    
    return novoUsuario;
  }

  async atualizarUsuario(id, dadosAtualizacao) {
    const usuarios = await this.lerArquivo('usuarios');
    const indice = usuarios.findIndex(u => u.id == id);
    
    if (indice === -1) {
      throw new Error('Usuário não encontrado');
    }

    usuarios[indice] = { ...usuarios[indice], ...dadosAtualizacao };
    await this.escreverArquivo('usuarios', usuarios);
    
    return usuarios[indice];
  }

  async removerUsuario(id) {
    const usuarios = await this.lerArquivo('usuarios');
    const usuariosFiltrados = usuarios.filter(u => u.id != id);
    
    if (usuarios.length === usuariosFiltrados.length) {
      throw new Error('Usuário não encontrado');
    }

    await this.escreverArquivo('usuarios', usuariosFiltrados);
    return true;
  }

  // ==================== MÉTODOS CRUD PARA NFES ====================

  async buscarNfePorId(id) {
    const nfes = await this.lerArquivo('nfes');
    return nfes.find(n => n.id == id);
  }

  async buscarNfesPorUsuario(usuarioId) {
    const nfes = await this.lerArquivo('nfes');
    return nfes.filter(n => n.usuarioId == usuarioId);
  }

  async criarNfe(dadosNfe) {
    const nfes = await this.lerArquivo('nfes');
    const novoId = Math.max(...nfes.map(n => n.id), 0) + 1;
    
    const novaNfe = {
      id: novoId,
      ...dadosNfe,
      criadaEm: dadosNfe.criadaEm || new Date().toISOString()
    };

    nfes.push(novaNfe);
    await this.escreverArquivo('nfes', nfes);
    
    return novaNfe;
  }

  async atualizarNfe(id, dadosAtualizacao) {
    const nfes = await this.lerArquivo('nfes');
    const indice = nfes.findIndex(n => n.id == id);
    
    if (indice === -1) {
      throw new Error('NFe não encontrada');
    }

    nfes[indice] = { ...nfes[indice], ...dadosAtualizacao };
    await this.escreverArquivo('nfes', nfes);
    
    return nfes[indice];
  }

  // ==================== MÉTODOS PARA CLIENTES ====================

  async listarClientes(filtros = {}) {
    const clientes = await this.lerArquivo('clientes');
    let resultado = clientes;

    // Aplicar filtros
    if (filtros.q) {
      const termo = filtros.q.toLowerCase();
      resultado = resultado.filter(c => 
        c.nome?.toLowerCase().includes(termo) ||
        c.email?.toLowerCase().includes(termo) ||
        c.documento?.includes(termo)
      );
    }

    if (filtros.ativo !== undefined) {
      resultado = resultado.filter(c => c.ativo === (filtros.ativo === 'true'));
    }

    // Paginação
    const limite = filtros.limite || 50;
    const pagina = filtros.pagina || 1;
    const inicio = (pagina - 1) * limite;
    
    return resultado.slice(inicio, inicio + limite);
  }

  async criarCliente(dadosCliente) {
    const clientes = await this.lerArquivo('clientes');
    const novoId = Math.max(...clientes.map(c => c.id), 0) + 1;
    
    const novoCliente = {
      id: novoId,
      criadoEm: new Date().toISOString(),
      ativo: true,
      ...dadosCliente
    };

    clientes.push(novoCliente);
    await this.escreverArquivo('clientes', clientes);
    
    return novoCliente;
  }

  async buscarClientePorId(id) {
    const clientes = await this.lerArquivo('clientes');
    return clientes.find(c => c.id == id);
  }

  async atualizarCliente(id, dadosAtualizacao) {
    const clientes = await this.lerArquivo('clientes');
    const indice = clientes.findIndex(c => c.id == id);
    
    if (indice === -1) {
      return null;
    }

    clientes[indice] = { ...clientes[indice], ...dadosAtualizacao };
    await this.escreverArquivo('clientes', clientes);
    
    return clientes[indice];
  }

  async removerCliente(id) {
    const clientes = await this.lerArquivo('clientes');
    const indice = clientes.findIndex(c => c.id == id);
    
    if (indice === -1) {
      return false;
    }

    clientes.splice(indice, 1);
    await this.escreverArquivo('clientes', clientes);
    
    return true;
  }

  // ==================== MÉTODOS PARA PRODUTOS ====================

  async listarProdutos(filtros = {}) {
    const produtos = await this.lerArquivo('produtos');
    let resultado = produtos;

    // Aplicar filtros
    if (filtros.q) {
      const termo = filtros.q.toLowerCase();
      resultado = resultado.filter(p => 
        p.nome?.toLowerCase().includes(termo) ||
        p.codigo?.toLowerCase().includes(termo) ||
        p.descricao?.toLowerCase().includes(termo)
      );
    }

    if (filtros.ativo !== undefined) {
      resultado = resultado.filter(p => p.ativo === (filtros.ativo === 'true'));
    }

    return resultado;
  }

  async criarProduto(dadosProduto) {
    const produtos = await this.lerArquivo('produtos');
    const novoId = Math.max(...produtos.map(p => p.id), 0) + 1;
    
    const novoProduto = {
      id: novoId,
      criadoEm: new Date().toISOString(),
      ativo: true,
      ...dadosProduto
    };

    produtos.push(novoProduto);
    await this.escreverArquivo('produtos', produtos);
    
    return novoProduto;
  }

  async buscarProdutoPorId(id) {
    const produtos = await this.lerArquivo('produtos');
    return produtos.find(p => p.id == id);
  }

  async atualizarProduto(id, dadosAtualizacao) {
    const produtos = await this.lerArquivo('produtos');
    const indice = produtos.findIndex(p => p.id == id);
    
    if (indice === -1) {
      return null;
    }

    produtos[indice] = { ...produtos[indice], ...dadosAtualizacao };
    await this.escreverArquivo('produtos', produtos);
    
    return produtos[indice];
  }

  async removerProduto(id) {
    const produtos = await this.lerArquivo('produtos');
    const indice = produtos.findIndex(p => p.id == id);
    
    if (indice === -1) {
      return false;
    }

    produtos.splice(indice, 1);
    await this.escreverArquivo('produtos', produtos);
    
    return true;
  }

  // ==================== MÉTODOS PARA LOGS ====================

  async adicionarLog(dadosLog) {
    const logs = await this.lerArquivo('logs');
    const novoId = Math.max(...logs.map(l => l.id), 0) + 1;
    
    const novoLog = {
      id: novoId,
      timestamp: new Date().toISOString(),
      ...dadosLog
    };

    logs.push(novoLog);
    
    // Manter apenas os últimos 1000 logs
    if (logs.length > 1000) {
      logs.splice(0, logs.length - 1000);
    }

    await this.escreverArquivo('logs', logs);
    return novoLog;
  }

  async obterLogs(limite = 100) {
    const logs = await this.lerArquivo('logs');
    return logs.slice(-limite).reverse(); // Últimos logs primeiro
  }

  async desconectar() {
    this.isConnected = false;
    console.log('✅ Banco de dados JSON desconectado');
  }

  async verificarConexao() {
    try {
      await fs.access(this.dataDir);
      return this.isConnected;
    } catch {
      return false;
    }
  }

  obterStatus() {
    return {
      conectado: this.isConnected,
      tipo: 'arquivo-json',
      diretorio: this.dataDir,
      arquivos: Object.keys(this.arquivos).length
    };
  }
}

// ==================== CLASSE PRINCIPAL CONSOLIDADA ====================
class DatabaseConfig {
  constructor() {
    this.useMongoDb = USE_MONGODB;
    this.config = this.useMongoDb ? new MongoDBConfig() : new JSONDatabaseConfig();
    
    console.log(`🔧 Configuração de banco: ${this.useMongoDb ? 'MongoDB' : 'Arquivo JSON'}`);
  }

  async conectar() {
    try {
      const resultado = await this.config.conectar();
      
      // Semear dados iniciais se necessário
      if (this.useMongoDb && NODE_ENV === 'development') {
        await this.semearDadosIniciais();
      }
      
      return resultado;
    } catch (error) {
      console.error('❌ Falha na conexão do banco de dados:', error);
      
      // Fallback para arquivo JSON se MongoDB falhar
      if (this.useMongoDb && NODE_ENV === 'development') {
        console.log('🔄 Tentando fallback para arquivo JSON...');
        this.useMongoDb = false;
        this.config = new JSONDatabaseConfig();
        return this.config.conectar();
      }
      
      throw error;
    }
  }

  async semearDadosIniciais() {
    if (!this.useMongoDb) return;

    try {
      const Usuario = require('../models/Usuario');
      const usuarioAdmin = await Usuario.findOne({ email: 'admin@brandaocontador.com.br' });
      
      if (!usuarioAdmin) {
        const bcrypt = require('bcryptjs');
        const senhaHash = await bcrypt.hash('admin123', 12);
        
        await Usuario.create({
          nome: 'Administrador',
          email: 'admin@brandaocontador.com.br',
          senha: senhaHash,
          documento: '00000000000',
          tipoCliente: 'cpf',
          permissoes: ['admin', 'nfe_emitir', 'nfe_consultar', 'nfe_cancelar'],
          ativo: true,
          status: 'ativo',
          criadoEm: new Date().toISOString()
        });
        
        console.log('👤 Usuário administrador criado');
      }
    } catch (error) {
      console.error('❌ Erro ao semear dados iniciais:', error);
    }
  }

  async desconectar() {
    return this.config.desconectar();
  }

  async verificarConexao() {
    return this.config.verificarConexao();
  }

  obterStatus() {
    return {
      ...this.config.obterStatus(),
      ambiente: NODE_ENV,
      tipoConfig: this.useMongoDb ? 'MongoDB' : 'Arquivo JSON'
    };
  }

  // Métodos proxy para arquivo JSON (quando não usar MongoDB)
  async buscarUsuarioPorEmail(email) {
    if (this.useMongoDb) {
      throw new Error('Use o modelo Usuario para MongoDB');
    }
    return this.config.buscarUsuarioPorEmail(email);
  }

  async buscarUsuarioPorId(id) {
    if (this.useMongoDb) {
      throw new Error('Use o modelo Usuario para MongoDB');
    }
    return this.config.buscarUsuarioPorId(id);
  }

  async buscarUsuarioPorDocumento(documento) {
    if (this.useMongoDb) {
      throw new Error('Use o modelo Usuario para MongoDB');
    }
    return this.config.buscarUsuarioPorDocumento(documento);
  }

  async criarUsuario(dadosUsuario) {
    if (this.useMongoDb) {
      throw new Error('Use o modelo Usuario para MongoDB');
    }
    return this.config.criarUsuario(dadosUsuario);
  }

  async atualizarUsuario(id, dadosAtualizacao) {
    if (this.useMongoDb) {
      throw new Error('Use o modelo Usuario para MongoDB');
    }
    return this.config.atualizarUsuario(id, dadosAtualizacao);
  }

  async adicionarLog(dadosLog) {
    if (this.useMongoDb) {
      // Para MongoDB, usar serviço de log separado
      return;
    }
    return this.config.adicionarLog(dadosLog);
  }

  // ==================== MÉTODOS PARA CLIENTES ====================
  
  async listarClientes(filtros = {}) {
    if (this.useMongoDb) {
      throw new Error('Use o modelo Cliente para MongoDB');
    }
    return this.config.listarClientes(filtros);
  }

  async criarCliente(dadosCliente) {
    if (this.useMongoDb) {
      throw new Error('Use o modelo Cliente para MongoDB');
    }
    return this.config.criarCliente(dadosCliente);
  }

  async buscarClientePorId(id) {
    if (this.useMongoDb) {
      throw new Error('Use o modelo Cliente para MongoDB');
    }
    return this.config.buscarClientePorId(id);
  }

  async atualizarCliente(id, dadosAtualizacao) {
    if (this.useMongoDb) {
      throw new Error('Use o modelo Cliente para MongoDB');
    }
    return this.config.atualizarCliente(id, dadosAtualizacao);
  }

  async removerCliente(id) {
    if (this.useMongoDb) {
      throw new Error('Use o modelo Cliente para MongoDB');
    }
    return this.config.removerCliente(id);
  }

  // ==================== MÉTODOS PARA PRODUTOS ====================
  
  async listarProdutos(filtros = {}) {
    if (this.useMongoDb) {
      throw new Error('Use o modelo Produto para MongoDB');
    }
    return this.config.listarProdutos(filtros);
  }

  async criarProduto(dadosProduto) {
    if (this.useMongoDb) {
      throw new Error('Use o modelo Produto para MongoDB');
    }
    return this.config.criarProduto(dadosProduto);
  }

  async buscarProdutoPorId(id) {
    if (this.useMongoDb) {
      throw new Error('Use o modelo Produto para MongoDB');
    }
    return this.config.buscarProdutoPorId(id);
  }

  async atualizarProduto(id, dadosAtualizacao) {
    if (this.useMongoDb) {
      throw new Error('Use o modelo Produto para MongoDB');
    }
    return this.config.atualizarProduto(id, dadosAtualizacao);
  }

  async removerProduto(id) {
    if (this.useMongoDb) {
      throw new Error('Use o modelo Produto para MongoDB');
    }
    return this.config.removerProduto(id);
  }

  // ==================== MÉTODOS PARA CONFIGURAÇÕES ====================
  
  async buscarConfiguracao(tipo) {
    if (this.useMongoDb) {
      throw new Error('Use o modelo Configuracao para MongoDB');
    }
    
    try {
      const configuracoes = await this.config.lerArquivo('configuracoes');
      
      // Se configuracoes for um objeto, retornar a seção específica
      if (typeof configuracoes === 'object' && !Array.isArray(configuracoes)) {
        return configuracoes[tipo] || null;
      }
      
      // Se for array, buscar por tipo
      if (Array.isArray(configuracoes)) {
        return configuracoes.find(config => config.tipo === tipo) || null;
      }
      
      return null;
    } catch (error) {
      console.warn(`⚠️ Erro ao buscar configuração ${tipo}:`, error.message);
      return null;
    }
  }

  async salvarConfiguracao(tipo, dados) {
    if (this.useMongoDb) {
      throw new Error('Use o modelo Configuracao para MongoDB');
    }
    
    try {
      const configuracoes = await this.config.lerArquivo('configuracoes');
      
      // Se configuracoes for um objeto, atualizar a seção específica
      if (typeof configuracoes === 'object' && !Array.isArray(configuracoes)) {
        configuracoes[tipo] = dados;
        await this.config.escreverArquivo('configuracoes', configuracoes);
        return dados;
      }
      
      // Se for array, buscar e atualizar ou adicionar
      if (Array.isArray(configuracoes)) {
        const indice = configuracoes.findIndex(config => config.tipo === tipo);
        if (indice >= 0) {
          configuracoes[indice] = { tipo, ...dados };
        } else {
          configuracoes.push({ tipo, ...dados });
        }
        await this.config.escreverArquivo('configuracoes', configuracoes);
        return { tipo, ...dados };
      }
      
      return null;
    } catch (error) {
      console.error(`❌ Erro ao salvar configuração ${tipo}:`, error.message);
      throw error;
    }
  }

  // ==================== MÉTODOS PARA USUÁRIOS (LISTA) ====================
  
  async listarUsuarios() {
    if (this.useMongoDb) {
      throw new Error('Use o modelo Usuario para MongoDB');
    }
    return this.config.lerArquivo('usuarios');
  }
}

// ==================== EXPORTAÇÃO ====================
const database = new DatabaseConfig();

module.exports = database;