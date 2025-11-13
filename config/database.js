// ==================== CONFIGURAÇÃO DE BANCO DE DADOS JSON ====================
// Sistema usando apenas arquivos JSON - MongoDB removido

const fs = require("fs").promises;
const path = require("path");
const auditService = require("../services/audit-service");

// ==================== CONFIGURAÇÃO ARQUIVO JSON ====================
class JSONDatabaseConfig {
  constructor() {
    this.dataDir = path.join(__dirname, "..", "data");
    this.arquivos = {
      usuarios: path.join(this.dataDir, "usuarios.json"),
      nfes: path.join(this.dataDir, "nfes.json"),
      logs: path.join(this.dataDir, "logs.json"),
      clientes: path.join(this.dataDir, "clientes.json"),
      produtos: path.join(this.dataDir, "produtos.json"),
      configuracoes: path.join(this.dataDir, "configuracoes.json"),
    };
    this.isConnected = false;
  }

  async conectar() {
    try {
      console.log("🔄 Inicializando banco de dados JSON...");

      // Criar diretório se não existir
      await this.criarDiretorio();

      // Inicializar arquivos se não existirem
      await this.inicializarArquivos();

      this.isConnected = true;
      console.log("✅ Banco de dados JSON inicializado");
      console.log(`📍 Diretório: ${this.dataDir}`);

      return true;
    } catch (error) {
      console.error("❌ Erro ao inicializar banco JSON:", error);
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
          nome: "Administrador",
          email: "admin@brandaocontador.com.br",
          senha: "$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.s5uIoO", // admin123
          documento: "00000000000",
          tipoCliente: "cpf",
          permissoes: ["admin", "nfe_emitir", "nfe_consultar", "nfe_cancelar"],
          ativo: true,
          status: "ativo",
          criadoEm: new Date().toISOString(),
          ultimoLogin: null,
          totalLogins: 0,
        },
      ],
      nfes: [],
      logs: [],
      clientes: [],
      produtos: [],
      configuracoes: {
        empresa: {
          razaoSocial: "",
          nomeFantasia: "",
          cnpj: "",
          inscricaoEstadual: "",
          endereco: {
            logradouro: "",
            numero: "",
            complemento: "",
            bairro: "",
            cidade: "",
            uf: "",
            cep: "",
          },
        },
        certificado: {
          tipo: "A1",
          arquivo: null,
          senha: "",
          validade: null,
        },
        sefaz: {
          ambiente: "homologacao",
          uf: "SP",
        },
      },
    };

    for (const [nome, arquivo] of Object.entries(this.arquivos)) {
      try {
        await fs.access(arquivo);
      } catch {
        await fs.writeFile(
          arquivo,
          JSON.stringify(dadosIniciais[nome], null, 2),
        );
        console.log(`📄 Arquivo ${nome}.json criado`);
      }
    }
  }

  async lerArquivo(nomeArquivo) {
    try {
      const arquivo = this.arquivos[nomeArquivo];
      if (!arquivo) {
        throw new Error(`Arquivo ${nomeArquivo} não configurado`);
      }

      const dados = await fs.readFile(arquivo, "utf8");
      return JSON.parse(dados);
    } catch (error) {
      console.error(`❌ Erro ao ler ${nomeArquivo}:`, error);
      return nomeArquivo === "configuracoes" ? {} : [];
    }
  }

  async escreverArquivo(nomeArquivo, dados) {
    try {
      const arquivo = this.arquivos[nomeArquivo];
      if (!arquivo) {
        throw new Error(`Arquivo ${nomeArquivo} não configurado`);
      }

      await fs.writeFile(arquivo, JSON.stringify(dados, null, 2));
      return true;
    } catch (error) {
      console.error(`❌ Erro ao escrever ${nomeArquivo}:`, error);
      throw error;
    }
  }

  async desconectar() {
    this.isConnected = false;
    console.log("✅ Banco de dados JSON desconectado");
  }

  async verificarConexao() {
    return this.isConnected;
  }

  obterStatus() {
    return {
      conectado: this.isConnected,
      tipo: "JSON",
      diretorio: this.dataDir,
      arquivos: Object.keys(this.arquivos),
    };
  }
}

// ==================== CLASSE PRINCIPAL ====================
class DatabaseManager {
  constructor() {
    this.config = new JSONDatabaseConfig();
    console.log("🔧 Configuração de banco: Arquivo JSON");
  }

  async conectar() {
    try {
      await this.config.conectar();
      console.log("✅ Sistema de banco de dados inicializado");
      return true;
    } catch (error) {
      console.error("❌ Falha ao inicializar banco de dados:", error);
      throw error;
    }
  }

  async desconectar() {
    await this.config.desconectar();
  }

  async verificarConexao() {
    return await this.config.verificarConexao();
  }

  obterStatus() {
    return {
      ...this.config.obterStatus(),
      tipoConfig: "Arquivo JSON",
    };
  }

  // Métodos para usuários
  async buscarUsuarios() {
    return await this.config.lerArquivo("usuarios");
  }

  async salvarUsuarios(usuarios) {
    return await this.config.escreverArquivo("usuarios", usuarios);
  }

  async buscarUsuarioPorEmail(email) {
    const usuarios = await this.buscarUsuarios();
    return usuarios.find((u) => u.email === email);
  }

  async buscarUsuarioPorId(id) {
    const usuarios = await this.buscarUsuarios();
    // Suporta tanto IDs numéricos quanto string
    const numId = parseInt(id);
    return usuarios.find((u) => u.id === numId || u.id === id);
  }

  async listarUsuarios(filtros = {}) {
    const usuarios = await this.buscarUsuarios();

    // Aplicar filtros se fornecidos
    let usuariosFiltrados = usuarios;

    if (filtros.ativo !== undefined) {
      usuariosFiltrados = usuariosFiltrados.filter(
        (u) => u.ativo === filtros.ativo,
      );
    }

    if (filtros.perfil) {
      usuariosFiltrados = usuariosFiltrados.filter(
        (u) => u.perfil === filtros.perfil,
      );
    }

    if (filtros.busca) {
      const busca = filtros.busca.toLowerCase();
      usuariosFiltrados = usuariosFiltrados.filter(
        (u) =>
          u.nome.toLowerCase().includes(busca) ||
          u.email.toLowerCase().includes(busca),
      );
    }

    // Paginação
    const pagina = parseInt(filtros.pagina) || 1;
    const limite = parseInt(filtros.limite) || 10;
    const inicio = (pagina - 1) * limite;
    const fim = inicio + limite;

    const total = usuariosFiltrados.length;
    const dados = usuariosFiltrados.slice(inicio, fim);

    return {
      dados,
      paginacao: {
        pagina,
        limite,
        total,
        totalPaginas: Math.ceil(total / limite),
      },
    };
  }

  async criarUsuario(dadosUsuario) {
    const usuarios = await this.buscarUsuarios();
    const novoId = Math.max(...usuarios.map((u) => u.id), 0) + 1;

    const novoUsuario = {
      id: novoId,
      ...dadosUsuario,
      criadoEm: new Date().toISOString(),
      ultimoLogin: null,
      totalLogins: 0,
    };

    usuarios.push(novoUsuario);
    await this.salvarUsuarios(usuarios);
    await auditService.logChange("usuarios", novoUsuario.id, "CREATE", null, novoUsuario);
    return novoUsuario;
  }

  async atualizarUsuario(id, dadosAtualizacao, meta = {}) {
    const usuarios = await this.buscarUsuarios();
    const indice = usuarios.findIndex((u) => u.id === parseInt(id));

    if (indice === -1) {
      throw new Error("Usuário não encontrado");
    }

    const before = { ...usuarios[indice] };
    usuarios[indice] = { ...usuarios[indice], ...dadosAtualizacao };
    await this.salvarUsuarios(usuarios);
    await auditService.logChange("usuarios", id, "UPDATE", before, usuarios[indice], meta);

    return usuarios[indice];
  }

  async adicionarLog(log) {
    const logs = await this.config.lerArquivo("logs");
    logs.push({
      id: Date.now(),
      timestamp: new Date().toISOString(),
      ...log,
    });
    await this.config.escreverArquivo("logs", logs);
  }

  // Métodos para clientes
  async buscarClientes() {
    return await this.config.lerArquivo("clientes");
  }

  async listarClientes() {
    return await this.config.lerArquivo("clientes");
  }

  async salvarClientes(clientes) {
    return await this.config.escreverArquivo("clientes", clientes);
  }

  async buscarClientePorId(id) {
    const clientes = await this.buscarClientes();
    return clientes.find((c) => c.id === parseInt(id));
  }

  async criarCliente(dadosCliente) {
    const clientes = await this.buscarClientes();
    const novoId = Math.max(...clientes.map((c) => c.id), 0) + 1;

    const novoCliente = {
      id: novoId,
      ...dadosCliente,
      criadoEm: new Date().toISOString(),
    };

    clientes.push(novoCliente);
    await this.salvarClientes(clientes);
    await auditService.logChange("clientes", novoCliente.id, "CREATE", null, novoCliente);
    return novoCliente;
  }

  async atualizarCliente(id, dadosAtualizados, meta = {}) {
    const clientes = await this.buscarClientes();
    const index = clientes.findIndex((c) => c.id === parseInt(id));

    if (index === -1) {
      throw new Error("Cliente não encontrado");
    }

    const before = { ...clientes[index] };
    clientes[index] = { ...clientes[index], ...dadosAtualizados };
    await this.salvarClientes(clientes);
    await auditService.logChange("clientes", id, "UPDATE", before, clientes[index], meta);
    return clientes[index];
  }

  // Métodos para produtos
  async buscarProdutos() {
    return await this.config.lerArquivo("produtos");
  }

  async salvarProdutos(produtos) {
    return await this.config.escreverArquivo("produtos", produtos);
  }

  async buscarProdutoPorId(id) {
    const produtos = await this.buscarProdutos();
    return produtos.find((p) => p.id === parseInt(id));
  }

  async criarProduto(dadosProduto) {
    const produtos = await this.buscarProdutos();
    const novoId = Math.max(...produtos.map((p) => p.id), 0) + 1;

    const novoProduto = {
      id: novoId,
      ...dadosProduto,
      criadoEm: new Date().toISOString(),
    };

    produtos.push(novoProduto);
    await this.salvarProdutos(produtos);
    await auditService.logChange("produtos", novoProduto.id, "CREATE", null, novoProduto);
    return novoProduto;
  }

  async atualizarProduto(id, dadosAtualizados, meta = {}) {
    const produtos = await this.buscarProdutos();
    const index = produtos.findIndex((p) => p.id === parseInt(id));

    if (index === -1) {
      throw new Error("Produto não encontrado");
    }

    const before = { ...produtos[index] };
    produtos[index] = { ...produtos[index], ...dadosAtualizados };
    await this.salvarProdutos(produtos);
    await auditService.logChange("produtos", id, "UPDATE", before, produtos[index], meta);
    return produtos[index];
  }

  // Métodos para configurações
  async buscarConfiguracoes() {
    return await this.config.lerArquivo("configuracoes");
  }

  async salvarConfiguracoes(configuracoes) {
    return await this.config.escreverArquivo("configuracoes", configuracoes);
  }

  async atualizarConfiguracao(secao, dados) {
    const configuracoes = await this.buscarConfiguracoes();

    if (!configuracoes[secao]) {
      configuracoes[secao] = {};
    }

    configuracoes[secao] = { ...configuracoes[secao], ...dados };
    await this.salvarConfiguracoes(configuracoes);
    return configuracoes[secao];
  }

  // Métodos para NFes
  async buscarNFes() {
    return await this.config.lerArquivo("nfes");
  }

  async salvarNFes(nfes) {
    return await this.config.escreverArquivo("nfes", nfes);
  }

  async buscarNFePorId(id) {
    const nfes = await this.buscarNFes();
    return nfes.find((n) => n.id === parseInt(id));
  }

  async criarNFe(dadosNFe) {
    const nfes = await this.buscarNFes();
    const novoId = Math.max(...nfes.map((n) => n.id), 0) + 1;

    const novaNFe = {
      id: novoId,
      ...dadosNFe,
      criadaEm: new Date().toISOString(),
    };

    nfes.push(novaNFe);
    await this.salvarNFes(nfes);
    await auditService.logChange("nfes", novaNFe.id, "CREATE", null, novaNFe);
    return novaNFe;
  }

  // Método para buscar usuário por documento
  async buscarUsuarioPorDocumento(documento) {
    const usuarios = await this.buscarUsuarios();
    return usuarios.find((u) => u.documento === documento);
  }
}

// Instância singleton
const database = new DatabaseManager();

module.exports = database;
  async deletarUsuario(id, meta = {}) {
    const usuarios = await this.buscarUsuarios();
    const idx = usuarios.findIndex(u => u.id === parseInt(id));
    if (idx === -1) throw new Error("Usuário não encontrado");
    const before = { ...usuarios[idx] };
    usuarios.splice(idx, 1);
    await this.salvarUsuarios(usuarios);
    await auditService.logChange("usuarios", id, "DELETE", before, null, meta);
    return true;
  }

  async deletarCliente(id, meta = {}) {
    const clientes = await this.buscarClientes();
    const idx = clientes.findIndex(c => c.id === parseInt(id));
    if (idx === -1) throw new Error("Cliente não encontrado");
    const before = { ...clientes[idx] };
    clientes.splice(idx, 1);
    await this.salvarClientes(clientes);
    await auditService.logChange("clientes", id, "DELETE", before, null, meta);
    return true;
  }

  async deletarProduto(id, meta = {}) {
    const produtos = await this.buscarProdutos();
    const idx = produtos.findIndex(p => p.id === parseInt(id));
    if (idx === -1) throw new Error("Produto não encontrado");
    const before = { ...produtos[idx] };
    produtos.splice(idx, 1);
    await this.salvarProdutos(produtos);
    await auditService.logChange("produtos", id, "DELETE", before, null, meta);
    return true;
  }

  async deletarNFe(id, meta = {}) {
    const nfes = await this.buscarNFes();
    const idx = nfes.findIndex(n => n.id === parseInt(id));
    if (idx === -1) throw new Error("NFe não encontrada");
    const before = { ...nfes[idx] };
    nfes.splice(idx, 1);
    await this.salvarNFes(nfes);
    await auditService.logChange("nfes", id, "DELETE", before, null, meta);
    return true;
  }
