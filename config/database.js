// ==================== CONFIGURAÇÃO DE BANCO DE DADOS JSON ====================
// Sistema usando APENAS arquivos JSON - SEM MONGODB

const fs = require('fs').promises;
const path = require('path');

// ==================== CONFIGURAÇÃO JSON DATABASE ====================
class JSONDatabaseConfig {
  constructor() {
    this.isConnected = false;
    this.dataDir = path.join(__dirname, '..', 'data');
    this.paths = {
      usuarios: path.join(this.dataDir, 'usuarios.json'),
      clientes: path.join(this.dataDir, 'clientes.json'),
      produtos: path.join(this.dataDir, 'produtos.json'),
      configuracoes: path.join(this.dataDir, 'configuracoes.json'),
      nfes: path.join(this.dataDir, 'nfes.json'),
      logs: path.join(this.dataDir, 'logs.json')
    };
  }

  async conectar() {
    try {
      console.log('🔄 Inicializando banco de dados JSON...');
      
      // Criar diretório data se não existir
      await this.criarDiretorioData();
      
      // Inicializar arquivos JSON
      await this.inicializarArquivos();
      
      this.isConnected = true;
      console.log('✅ Banco de dados JSON inicializado com sucesso');
      return true;
    } catch (error) {
      console.error('❌ Erro ao inicializar banco JSON:', error);
      throw error;
    }
  }

  async criarDiretorioData() {
    try {
      await fs.access(this.dataDir);
    } catch {
      await fs.mkdir(this.dataDir, { recursive: true });
      console.log('📁 Diretório data/ criado');
    }
  }

  async inicializarArquivos() {
    const arquivosIniciais = {
      usuarios: [],
      clientes: [],
      produtos: [],
      configuracoes: {
        sistema: {
          nome: "Brandão Contador NFe",
          versao: "1.0.0",
          ambiente: "desenvolvimento"
        },
        certificado: {
          caminho: null,
          senha: null,
          validade: null
        },
        sefaz: {
          ambiente: "homologacao",
          timeout: 30000
        }
      },
      nfes: [],
      logs: []
    };

    for (const [nome, conteudoInicial] of Object.entries(arquivosIniciais)) {
      const caminhoArquivo = this.paths[nome];
      try {
        await fs.access(caminhoArquivo);
      } catch {
        await fs.writeFile(caminhoArquivo, JSON.stringify(conteudoInicial, null, 2));
        console.log(`📄 Arquivo ${nome}.json criado`);
      }
    }
  }

  async desconectar() {
    this.isConnected = false;
    console.log('🔌 Banco de dados JSON desconectado');
    return true;
  }

  async verificarConexao() {
    return this.isConnected;
  }

  async obterStatus() {
    const status = {
      tipo: 'JSON',
      conectado: this.isConnected,
      diretorio: this.dataDir,
      arquivos: {}
    };

    if (this.isConnected) {
      for (const [nome, caminho] of Object.entries(this.paths)) {
        try {
          const stats = await fs.stat(caminho);
          status.arquivos[nome] = {
            existe: true,
            tamanho: stats.size,
            modificado: stats.mtime
          };
        } catch {
          status.arquivos[nome] = {
            existe: false
          };
        }
      }
    }

    return status;
  }

  // Métodos para operações com arquivos JSON
  async lerArquivo(tipo) {
    try {
      const caminho = this.paths[tipo];
      if (!caminho) {
        throw new Error(`Tipo de arquivo não suportado: ${tipo}`);
      }

      const conteudo = await fs.readFile(caminho, 'utf8');
      return JSON.parse(conteudo);
    } catch (error) {
      console.error(`Erro ao ler arquivo ${tipo}:`, error);
      return tipo === 'configuracoes' ? {} : [];
    }
  }

  async escreverArquivo(tipo, dados) {
    try {
      const caminho = this.paths[tipo];
      if (!caminho) {
        throw new Error(`Tipo de arquivo não suportado: ${tipo}`);
      }

      await fs.writeFile(caminho, JSON.stringify(dados, null, 2));
      return true;
    } catch (error) {
      console.error(`Erro ao escrever arquivo ${tipo}:`, error);
      throw error;
    }
  }

  async adicionarItem(tipo, item) {
    const dados = await this.lerArquivo(tipo);
    if (Array.isArray(dados)) {
      dados.push(item);
      await this.escreverArquivo(tipo, dados);
    }
    return item;
  }

  async atualizarItem(tipo, filtro, novosDados) {
    const dados = await this.lerArquivo(tipo);
    if (Array.isArray(dados)) {
      const indice = dados.findIndex(item => {
        return Object.keys(filtro).every(key => item[key] === filtro[key]);
      });
      
      if (indice !== -1) {
        dados[indice] = { ...dados[indice], ...novosDados };
        await this.escreverArquivo(tipo, dados);
        return dados[indice];
      }
    }
    return null;
  }

  async removerItem(tipo, filtro) {
    const dados = await this.lerArquivo(tipo);
    if (Array.isArray(dados)) {
      const novosDados = dados.filter(item => {
        return !Object.keys(filtro).every(key => item[key] === filtro[key]);
      });
      
      if (novosDados.length !== dados.length) {
        await this.escreverArquivo(tipo, novosDados);
        return true;
      }
    }
    return false;
  }

  async buscarItens(tipo, filtro = {}) {
    const dados = await this.lerArquivo(tipo);
    if (Array.isArray(dados)) {
      if (Object.keys(filtro).length === 0) {
        return dados;
      }
      
      return dados.filter(item => {
        return Object.keys(filtro).every(key => {
          if (typeof filtro[key] === 'object' && filtro[key].$regex) {
            const regex = new RegExp(filtro[key].$regex, filtro[key].$options || 'i');
            return regex.test(item[key]);
          }
          return item[key] === filtro[key];
        });
      });
    }
    return [];
  }
}

// ==================== INSTÂNCIA ÚNICA ====================
const database = new JSONDatabaseConfig();

// ==================== FUNÇÕES PÚBLICAS ====================
async function conectarBanco() {
  try {
    await database.conectar();
    return database;
  } catch (error) {
    console.error('❌ Falha ao conectar banco de dados:', error);
    throw error;
  }
}

async function desconectarBanco() {
  try {
    await database.desconectar();
    console.log('🔌 Banco de dados desconectado com sucesso');
  } catch (error) {
    console.error('❌ Erro ao desconectar banco:', error);
  }
}

async function obterStatusBanco() {
  return await database.obterStatus();
}

async function verificarConexaoBanco() {
  return await database.verificarConexao();
}

// ==================== EXPORTS ====================
module.exports = {
  conectarBanco,
  desconectarBanco,
  obterStatusBanco,
  verificarConexaoBanco,
  database
};