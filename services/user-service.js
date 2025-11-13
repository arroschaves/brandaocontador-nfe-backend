/**
 * Serviço de usuários
 * Gerencia operações relacionadas aos usuários do sistema
 */

const db = require("../config/database");

class UserService {
  constructor() {
    // Usar apenas o sistema JSON existente
  }

  /**
   * Obtém dados do usuário por ID
   */
  async obterUsuario(userId) {
    try {
      const user = await db.buscarUsuarioPorId(userId);

      if (!user) {
        throw new Error("Usuário não encontrado");
      }

      // Remove dados sensíveis do retorno
      const { senha, ...userData } = user;

      return {
        success: true,
        data: userData,
      };
    } catch (error) {
      console.error("❌ Erro ao obter usuário:", error.message);
      throw new Error(`Falha ao obter dados do usuário: ${error.message}`);
    }
  }

  /**
   * Atualiza dados do usuário
   */
  async atualizarUsuario(userId, dadosAtualizacao) {
    try {
      const user = await db.buscarUsuarioPorId(userId);

      if (!user) {
        throw new Error("Usuário não encontrado");
      }

      // Campos permitidos para atualização
      const camposPermitidos = [
        "nome",
        "email",
        "telefone",
        "empresa",
        "cnpj",
        "endereco",
        "configuracoes",
      ];

      // Atualiza apenas campos permitidos
      const dadosLimpos = {};
      for (const campo of camposPermitidos) {
        if (dadosAtualizacao[campo] !== undefined) {
          dadosLimpos[campo] = dadosAtualizacao[campo];
        }
      }

      // Validações básicas
      if (dadosLimpos.email && !this.validarEmail(dadosLimpos.email)) {
        throw new Error("Email inválido");
      }

      if (dadosLimpos.cnpj && !this.validarCNPJ(dadosLimpos.cnpj)) {
        throw new Error("CNPJ inválido");
      }

      // Atualiza o usuário no banco JSON
      const dadosComData = {
        ...dadosLimpos,
        dataAtualizacao: new Date().toISOString(),
      };

      const usuarioAtualizado = await db.atualizarUsuario(userId, dadosComData);

      // Remove dados sensíveis do retorno
      const { senha, ...userData } = usuarioAtualizado;

      return {
        success: true,
        data: userData,
        message: "Dados atualizados com sucesso",
      };
    } catch (error) {
      console.error("❌ Erro ao atualizar usuário:", error.message);
      throw new Error(`Falha ao atualizar dados do usuário: ${error.message}`);
    }
  }

  /**
   * Valida formato de email
   */
  validarEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  }

  /**
   * Valida CNPJ (validação básica)
   */
  validarCNPJ(cnpj) {
    // Remove caracteres não numéricos
    const cnpjLimpo = cnpj.replace(/\D/g, "");

    // Verifica se tem 14 dígitos
    if (cnpjLimpo.length !== 14) {
      return false;
    }

    // Verifica se não são todos os dígitos iguais
    if (/^(\d)\1+$/.test(cnpjLimpo)) {
      return false;
    }

    return true; // Validação simplificada para desenvolvimento
  }

  /**
   * Obtém estatísticas do usuário
   */
  async obterEstatisticasUsuario(userId) {
    try {
      const user = await db.buscarUsuarioPorId(userId);

      if (!user) {
        throw new Error("Usuário não encontrado");
      }

      // Busca NFEs do usuário para estatísticas reais
      const nfes = await db.buscarNfesPorUsuario(userId);
      const valorTotal = nfes.reduce(
        (total, nfe) => total + (nfe.valorTotal || 0),
        0,
      );

      return {
        success: true,
        data: {
          nfesEmitidas: nfes.length,
          valorTotalNfes: valorTotal,
          certificadoValido: !!user.certificado,
          ultimoAcesso: user.ultimoLogin || new Date().toISOString(),
          diasAtivo: Math.ceil(
            (new Date() - new Date(user.criadoEm)) / (1000 * 60 * 60 * 24),
          ),
        },
      };
    } catch (error) {
      console.error("❌ Erro ao obter estatísticas:", error.message);
      throw new Error(
        `Falha ao obter estatísticas do usuário: ${error.message}`,
      );
    }
  }

  /**
   * Verifica se usuário existe
   */
  async usuarioExiste(userId) {
    try {
      const user = await db.buscarUsuarioPorId(userId);
      return !!user;
    } catch (error) {
      return false;
    }
  }

  /**
   * Lista todos os usuários (admin)
   */
  async listarUsuarios(filtros = {}) {
    try {
      const usuarios = await db.lerArquivo("usuarios");

      let usuariosFiltrados = usuarios;

      // Aplica filtros
      if (filtros.ativo !== undefined) {
        usuariosFiltrados = usuariosFiltrados.filter(
          (user) => user.ativo === filtros.ativo,
        );
      }

      if (filtros.empresa) {
        usuariosFiltrados = usuariosFiltrados.filter(
          (user) =>
            user.empresa &&
            user.empresa.toLowerCase().includes(filtros.empresa.toLowerCase()),
        );
      }

      // Remove dados sensíveis
      usuariosFiltrados = usuariosFiltrados.map(
        ({ senha, ...userData }) => userData,
      );

      return {
        success: true,
        data: usuariosFiltrados,
        total: usuariosFiltrados.length,
      };
    } catch (error) {
      console.error("❌ Erro ao listar usuários:", error.message);
      throw new Error(`Falha ao listar usuários: ${error.message}`);
    }
  }
}

module.exports = new UserService();
