const database = require("../config/database");
const bcrypt = require("bcryptjs");

class AdminService {
  /**
   * Criar novo usuário (apenas admin)
   */
  static async criarUsuario(dadosUsuario, adminId) {
    try {
      // Validar dados obrigatórios
      const validacao = this.validarDadosUsuario(dadosUsuario);
      if (!validacao.valido) {
        return {
          sucesso: false,
          erros: validacao.erros,
        };
      }

      // Verificar se já existe usuário com o mesmo email
      const usuarioExistente = await database.buscarUsuarioPorEmail(
        dadosUsuario.email,
      );
      if (usuarioExistente) {
        return {
          sucesso: false,
          erros: ["Já existe um usuário com este email"],
        };
      }

      // Hash da senha
      const senhaHash = await bcrypt.hash(dadosUsuario.senha, 10);

      // Criar usuário
      const usuario = {
        nome: dadosUsuario.nome,
        email: dadosUsuario.email,
        senha: senhaHash,
        perfil: dadosUsuario.perfil || "usuario",
        permissoes: dadosUsuario.permissoes || ["nfe_consultar", "nfe_emitir"],
        ativo: true,
        isAdmin: dadosUsuario.perfil === "admin",
        accessLevel: dadosUsuario.perfil === "admin" ? "full" : "basic",
        criadoEm: new Date().toISOString(),
        criadoPor: adminId,
      };

      const usuarioCriado = await database.criarUsuario(usuario);

      // Remover senha do retorno
      delete usuarioCriado.senha;

      return {
        sucesso: true,
        usuario: usuarioCriado,
      };
    } catch (error) {
      console.error("❌ Erro ao criar usuário:", error);
      return {
        sucesso: false,
        erros: ["Erro interno do servidor"],
      };
    }
  }

  /**
   * Listar usuários com filtros
   */
  static async listarUsuarios(filtros, adminId) {
    try {
      const usuarios = await database.listarUsuarios(filtros);

      // Remover senhas dos usuários
      usuarios.dados.forEach((usuario) => {
        delete usuario.senha;
      });

      return {
        sucesso: true,
        usuarios: usuarios.dados,
        paginacao: usuarios.paginacao,
      };
    } catch (error) {
      console.error("❌ Erro ao listar usuários:", error);
      return {
        sucesso: false,
        erros: ["Erro interno do servidor"],
      };
    }
  }

  /**
   * Buscar usuário por ID
   */
  static async buscarUsuarioPorId(usuarioId, adminId) {
    try {
      const usuario = await database.buscarUsuarioPorId(usuarioId);

      if (!usuario) {
        return {
          sucesso: false,
          erros: ["Usuário não encontrado"],
        };
      }

      // Remover senha
      delete usuario.senha;

      return {
        sucesso: true,
        usuario,
      };
    } catch (error) {
      console.error("❌ Erro ao buscar usuário:", error);
      return {
        sucesso: false,
        erros: ["Erro interno do servidor"],
      };
    }
  }

  /**
   * Atualizar usuário
   */
  static async atualizarUsuario(usuarioId, dadosAtualizacao, adminId) {
    try {
      // Verificar se usuário existe
      const usuarioExistente = await database.buscarUsuarioPorId(usuarioId);
      if (!usuarioExistente) {
        return {
          sucesso: false,
          erros: ["Usuário não encontrado"],
        };
      }

      // Validar dados
      const validacao = this.validarDadosUsuario(dadosAtualizacao, true);
      if (!validacao.valido) {
        return {
          sucesso: false,
          erros: validacao.erros,
        };
      }

      // Preparar dados para atualização
      const dadosCompletos = {
        ...dadosAtualizacao,
        atualizadoEm: new Date().toISOString(),
        atualizadoPor: adminId,
      };

      // Se está alterando perfil para admin, ajustar permissões
      if (dadosCompletos.perfil === "admin") {
        dadosCompletos.isAdmin = true;
        dadosCompletos.accessLevel = "full";
        dadosCompletos.permissoes = ["all", "admin", "admin_total"];
      }

      // Hash da nova senha se fornecida
      if (dadosCompletos.senha) {
        dadosCompletos.senha = await bcrypt.hash(dadosCompletos.senha, 10);
      }

      const usuarioAtualizado = await database.atualizarUsuario(
        usuarioId,
        dadosCompletos,
      );

      // Remover senha do retorno
      delete usuarioAtualizado.senha;

      return {
        sucesso: true,
        usuario: usuarioAtualizado,
      };
    } catch (error) {
      console.error("❌ Erro ao atualizar usuário:", error);
      return {
        sucesso: false,
        erros: ["Erro interno do servidor"],
      };
    }
  }

  /**
   * Desativar usuário (soft delete)
   */
  static async desativarUsuario(usuarioId, adminId) {
    try {
      const usuario = await database.buscarUsuarioPorId(usuarioId);
      if (!usuario) {
        return {
          sucesso: false,
          erros: ["Usuário não encontrado"],
        };
      }

      const usuarioDesativado = await database.atualizarUsuario(usuarioId, {
        ativo: false,
        desativadoEm: new Date().toISOString(),
        desativadoPor: adminId,
      });

      // Remover senha do retorno
      delete usuarioDesativado.senha;

      return {
        sucesso: true,
        usuario: usuarioDesativado,
      };
    } catch (error) {
      console.error("❌ Erro ao desativar usuário:", error);
      return {
        sucesso: false,
        erros: ["Erro interno do servidor"],
      };
    }
  }

  /**
   * Alterar senha do usuário
   */
  static async alterarSenhaUsuario(usuarioId, novaSenha, adminId) {
    try {
      const usuario = await database.buscarUsuarioPorId(usuarioId);
      if (!usuario) {
        return {
          sucesso: false,
          erros: ["Usuário não encontrado"],
        };
      }

      if (!novaSenha || novaSenha.length < 6) {
        return {
          sucesso: false,
          erros: ["Nova senha deve ter pelo menos 6 caracteres"],
        };
      }

      const senhaHash = await bcrypt.hash(novaSenha, 10);

      await database.atualizarUsuario(usuarioId, {
        senha: senhaHash,
        atualizadoEm: new Date().toISOString(),
        atualizadoPor: adminId,
      });

      return {
        sucesso: true,
      };
    } catch (error) {
      console.error("❌ Erro ao alterar senha:", error);
      return {
        sucesso: false,
        erros: ["Erro interno do servidor"],
      };
    }
  }

  /**
   * Obter status do sistema
   */
  static async obterStatusSistema(adminId) {
    try {
      const usuarios = await database.listarUsuarios({ limite: 1000 });
      const totalUsuarios = usuarios.dados.length;
      const usuariosAtivos = usuarios.dados.filter((u) => u.ativo).length;

      const status = {
        usuarios: {
          total: totalUsuarios,
          ativos: usuariosAtivos,
          inativos: totalUsuarios - usuariosAtivos,
        },
        sistema: {
          versao: "1.0.0",
          ambiente: process.env.NODE_ENV || "development",
          uptime: process.uptime(),
          memoria: process.memoryUsage(),
        },
        timestamp: new Date().toISOString(),
      };

      return {
        sucesso: true,
        status,
      };
    } catch (error) {
      console.error("❌ Erro ao obter status do sistema:", error);
      return {
        sucesso: false,
        erros: ["Erro interno do servidor"],
      };
    }
  }

  /**
   * Obter logs do sistema
   */
  static async obterLogs(filtros, adminId) {
    try {
      // Implementação básica de logs
      const logs = [
        {
          id: 1,
          nivel: "info",
          mensagem: "Sistema iniciado",
          timestamp: new Date().toISOString(),
          usuario: "sistema",
        },
      ];

      return {
        sucesso: true,
        logs,
        paginacao: {
          pagina: 1,
          limite: 50,
          total: logs.length,
          totalPaginas: 1,
        },
      };
    } catch (error) {
      console.error("❌ Erro ao obter logs:", error);
      return {
        sucesso: false,
        erros: ["Erro interno do servidor"],
      };
    }
  }

  /**
   * Alterar status do usuário
   */
  static async alterarStatusUsuario(usuarioId, novoStatus, adminId) {
    try {
      const usuario = await database.buscarUsuarioPorId(usuarioId);
      if (!usuario) {
        return {
          sucesso: false,
          erros: ["Usuário não encontrado"],
        };
      }

      if (!["ativo", "inativo", "bloqueado"].includes(novoStatus)) {
        return {
          sucesso: false,
          erros: ["Status inválido"],
        };
      }

      const usuarioAtualizado = await database.atualizarUsuario(usuarioId, {
        status: novoStatus,
        atualizadoEm: new Date().toISOString(),
        atualizadoPor: adminId,
      });

      delete usuarioAtualizado.senha;

      return {
        sucesso: true,
        usuario: usuarioAtualizado,
      };
    } catch (error) {
      console.error("❌ Erro ao alterar status do usuário:", error);
      return {
        sucesso: false,
        erros: ["Erro interno do servidor"],
      };
    }
  }

  /**
   * Validar dados do usuário
   */
  static validarDadosUsuario(dados, isUpdate = false) {
    const erros = [];

    if (!isUpdate || dados.nome !== undefined) {
      if (!dados.nome || dados.nome.trim().length < 2) {
        erros.push("Nome deve ter pelo menos 2 caracteres");
      }
    }

    if (!isUpdate || dados.email !== undefined) {
      if (!dados.email || !dados.email.includes("@")) {
        erros.push("Email inválido");
      }
    }

    if (!isUpdate || dados.senha !== undefined) {
      if (!dados.senha || dados.senha.length < 6) {
        erros.push("Senha deve ter pelo menos 6 caracteres");
      }
    }

    return {
      valido: erros.length === 0,
      erros,
    };
  }
}

module.exports = AdminService;
