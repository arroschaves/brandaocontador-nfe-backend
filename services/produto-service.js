const database = require("../config/database");
const validationService = require("./validation-service");

class ProdutoService {
  /**
   * Criar novo produto
   */
  static async criarProduto(dadosProduto, usuarioId) {
    try {
      // Validar dados obrigatórios
      const validacao = this.validarDadosProduto(dadosProduto);
      if (!validacao.valido) {
        return {
          sucesso: false,
          erros: validacao.erros,
        };
      }

      // Verificar se já existe produto com o mesmo código
      const produtoExistente = await database.buscarProdutoPorCodigo(
        dadosProduto.codigo,
      );
      if (produtoExistente) {
        return {
          sucesso: false,
          erros: ["Já existe um produto com este código"],
        };
      }

      // Criar produto
      const produto = {
        ...dadosProduto,
        ativo: true,
        criadoEm: new Date().toISOString(),
        criadoPor: usuarioId,
      };

      const produtoCriado = await database.criarProduto(produto);

      return {
        sucesso: true,
        produto: produtoCriado,
      };
    } catch (error) {
      console.error("❌ Erro ao criar produto:", error);
      return {
        sucesso: false,
        erros: ["Erro interno do servidor"],
      };
    }
  }

  /**
   * Listar produtos com filtros
   */
  static async listarProdutos(filtros, usuarioId) {
    try {
      const produtos = await database.listarProdutos(filtros);

      return {
        sucesso: true,
        produtos: produtos.dados,
        paginacao: produtos.paginacao,
      };
    } catch (error) {
      console.error("❌ Erro ao listar produtos:", error);
      return {
        sucesso: false,
        erros: ["Erro interno do servidor"],
      };
    }
  }

  /**
   * Buscar produto por ID
   */
  static async buscarProdutoPorId(produtoId, usuarioId) {
    try {
      const produto = await database.buscarProdutoPorId(produtoId);

      if (!produto) {
        return {
          sucesso: false,
          erros: ["Produto não encontrado"],
        };
      }

      return {
        sucesso: true,
        produto,
      };
    } catch (error) {
      console.error("❌ Erro ao buscar produto:", error);
      return {
        sucesso: false,
        erros: ["Erro interno do servidor"],
      };
    }
  }

  /**
   * Buscar produto por código
   */
  static async buscarProdutoPorCodigo(codigo, usuarioId) {
    try {
      const produto = await database.buscarProdutoPorCodigo(codigo);

      if (!produto) {
        return {
          sucesso: false,
          erros: ["Produto não encontrado"],
        };
      }

      return {
        sucesso: true,
        produto,
      };
    } catch (error) {
      console.error("❌ Erro ao buscar produto por código:", error);
      return {
        sucesso: false,
        erros: ["Erro interno do servidor"],
      };
    }
  }

  /**
   * Atualizar produto
   */
  static async atualizarProduto(produtoId, dadosAtualizacao, usuarioId) {
    try {
      // Verificar se produto existe
      const produtoExistente = await database.buscarProdutoPorId(produtoId);
      if (!produtoExistente) {
        return {
          sucesso: false,
          erros: ["Produto não encontrado"],
        };
      }

      // Validar dados
      const validacao = this.validarDadosProduto(dadosAtualizacao, true);
      if (!validacao.valido) {
        return {
          sucesso: false,
          erros: validacao.erros,
        };
      }

      // Atualizar produto
      const dadosCompletos = {
        ...dadosAtualizacao,
        atualizadoEm: new Date().toISOString(),
        atualizadoPor: usuarioId,
      };

      const produtoAtualizado = await database.atualizarProduto(
        produtoId,
        dadosCompletos,
      );

      return {
        sucesso: true,
        produto: produtoAtualizado,
      };
    } catch (error) {
      console.error("❌ Erro ao atualizar produto:", error);
      return {
        sucesso: false,
        erros: ["Erro interno do servidor"],
      };
    }
  }

  /**
   * Desativar produto (soft delete)
   */
  static async desativarProduto(produtoId, usuarioId) {
    try {
      const produto = await database.buscarProdutoPorId(produtoId);
      if (!produto) {
        return {
          sucesso: false,
          erros: ["Produto não encontrado"],
        };
      }

      const produtoDesativado = await database.atualizarProduto(produtoId, {
        ativo: false,
        desativadoEm: new Date().toISOString(),
        desativadoPor: usuarioId,
      });

      return {
        sucesso: true,
        produto: produtoDesativado,
      };
    } catch (error) {
      console.error("❌ Erro ao desativar produto:", error);
      return {
        sucesso: false,
        erros: ["Erro interno do servidor"],
      };
    }
  }

  /**
   * Buscar produtos por categoria
   */
  static async buscarProdutosPorCategoria(filtros, usuarioId) {
    try {
      const produtos = await database.listarProdutos({
        ...filtros,
        categoria: filtros.categoria,
      });

      return {
        sucesso: true,
        produtos: produtos.dados,
        paginacao: produtos.paginacao,
      };
    } catch (error) {
      console.error("❌ Erro ao buscar produtos por categoria:", error);
      return {
        sucesso: false,
        erros: ["Erro interno do servidor"],
      };
    }
  }

  /**
   * Validar dados do produto
   */
  static validarDadosProduto(dados, isUpdate = false) {
    const erros = [];

    if (!isUpdate || dados.nome !== undefined) {
      if (!dados.nome || dados.nome.trim().length < 2) {
        erros.push("Nome do produto deve ter pelo menos 2 caracteres");
      }
    }

    if (!isUpdate || dados.codigo !== undefined) {
      if (!dados.codigo || dados.codigo.trim().length < 1) {
        erros.push("Código do produto é obrigatório");
      }
    }

    if (!isUpdate || dados.preco !== undefined) {
      if (!dados.preco || dados.preco <= 0) {
        erros.push("Preço deve ser maior que zero");
      }
    }

    if (dados.ncm && dados.ncm.length !== 8) {
      erros.push("NCM deve ter 8 dígitos");
    }

    return {
      valido: erros.length === 0,
      erros,
    };
  }
}

module.exports = ProdutoService;
