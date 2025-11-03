const express = require('express');
const router = express.Router();
const AdminService = require('../services/admin-service');
const authMiddleware = require('../middleware/auth');

// ==================== MIDDLEWARE ====================

// Aplica autenticação em todas as rotas
router.use(authMiddleware.verificarAutenticacao());

// Aplica verificação de admin em todas as rotas
router.use(authMiddleware.verificarPermissao('admin'));

// ==================== ROTAS DE USUÁRIOS ====================

/**
 * @route   POST /api/admin/usuarios
 * @desc    Criar novo usuário
 * @access  Admin
 */
router.post('/usuarios', async (req, res) => {
  try {
    const resultado = await AdminService.criarUsuario(req.body, req.usuario.id);
    
    if (!resultado.sucesso) {
      return res.status(400).json({
        sucesso: false,
        erros: resultado.erros,
        avisos: resultado.avisos
      });
    }

    res.status(201).json({
      sucesso: true,
      usuario: resultado.usuario,
      avisos: resultado.avisos,
      mensagem: 'Usuário criado com sucesso'
    });

  } catch (error) {
    console.error('❌ Erro na rota POST /admin/usuarios:', error.message);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro interno do servidor',
      detalhes: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   GET /api/admin/usuarios
 * @desc    Listar usuários com filtros e paginação
 * @access  Admin
 */
router.get('/usuarios', async (req, res) => {
  try {
    const filtros = {
      pagina: parseInt(req.query.pagina) || 1,
      limite: parseInt(req.query.limite) || 20,
      busca: req.query.busca || '',
      tipo: req.query.tipo || '',
      ativo: req.query.ativo !== undefined ? req.query.ativo === 'true' : true,
      ordenacao: req.query.ordenacao || 'nome'
    };

    const resultado = await AdminService.listarUsuarios(filtros, req.usuario.id);

    res.json({
      sucesso: true,
      usuarios: resultado.usuarios,
      paginacao: resultado.paginacao
    });

  } catch (error) {
    console.error('❌ Erro na rota GET /admin/usuarios:', error.message);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro interno do servidor',
      detalhes: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   GET /api/admin/usuarios/:id
 * @desc    Buscar usuário por ID
 * @access  Admin
 */
router.get('/usuarios/:id', async (req, res) => {
  try {
    const resultado = await AdminService.buscarUsuarioPorId(req.params.id, req.usuario.id);
    
    if (!resultado.sucesso) {
      return res.status(404).json({
        sucesso: false,
        erros: resultado.erros
      });
    }

    res.json({
      sucesso: true,
      usuario: resultado.usuario
    });

  } catch (error) {
    console.error('❌ Erro na rota GET /admin/usuarios/:id:', error.message);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro interno do servidor',
      detalhes: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   PUT /api/admin/usuarios/:id
 * @desc    Atualizar usuário
 * @access  Admin
 */
router.put('/usuarios/:id', async (req, res) => {
  try {
    const resultado = await AdminService.atualizarUsuario(
      req.params.id, 
      req.body, 
      req.usuario.id
    );
    
    if (!resultado.sucesso) {
      return res.status(400).json({
        sucesso: false,
        erros: resultado.erros,
        avisos: resultado.avisos
      });
    }

    res.json({
      sucesso: true,
      usuario: resultado.usuario,
      mensagem: 'Usuário atualizado com sucesso'
    });

  } catch (error) {
    console.error('❌ Erro na rota PUT /admin/usuarios/:id:', error.message);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro interno do servidor',
      detalhes: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   PATCH /api/admin/usuarios/:id
 * @desc    Atualizar usuário (PATCH)
 * @access  Admin
 */
router.patch('/usuarios/:id', async (req, res) => {
  try {
    const resultado = await AdminService.atualizarUsuario(
      req.params.id, 
      req.body, 
      req.usuario.id
    );
    
    if (!resultado.sucesso) {
      return res.status(400).json({
        sucesso: false,
        erros: resultado.erros,
        avisos: resultado.avisos
      });
    }

    res.json({
      sucesso: true,
      usuario: resultado.usuario,
      mensagem: 'Usuário atualizado com sucesso'
    });

  } catch (error) {
    console.error('❌ Erro na rota PATCH /admin/usuarios/:id:', error.message);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro interno do servidor',
      detalhes: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   PATCH /api/admin/usuarios/:id/status
 * @desc    Alterar status do usuário
 * @access  Admin
 */
router.patch('/usuarios/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['ativo', 'inativo', 'bloqueado'].includes(status)) {
      return res.status(400).json({
        sucesso: false,
        erros: ['Status inválido. Use: ativo, inativo ou bloqueado']
      });
    }

    const resultado = await AdminService.atualizarUsuario(
      req.params.id,
      { status },
      req.usuario.id
    );
    
    if (!resultado.sucesso) {
      return res.status(400).json({
        sucesso: false,
        erros: resultado.erros
      });
    }

    res.json({
      sucesso: true,
      usuario: resultado.usuario,
      mensagem: `Status alterado para ${status}`
    });

  } catch (error) {
    console.error('❌ Erro na rota PATCH /admin/usuarios/:id/status:', error.message);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro interno do servidor',
      detalhes: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   DELETE /api/admin/usuarios/:id
 * @desc    Deletar usuário
 * @access  Admin
 */
router.delete('/usuarios/:id', async (req, res) => {
  try {
    const resultado = await AdminService.desativarUsuario(req.params.id, req.usuario.id);
    
    if (!resultado.sucesso) {
      return res.status(404).json({
        sucesso: false,
        erros: resultado.erros
      });
    }

    res.json({
      sucesso: true,
      usuario: resultado.usuario,
      mensagem: 'Usuário excluído com sucesso'
    });

  } catch (error) {
    console.error('❌ Erro na rota DELETE /admin/usuarios/:id:', error.message);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro interno do servidor',
      detalhes: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   PUT /api/admin/usuarios/:id/senha
 * @desc    Alterar senha do usuário
 * @access  Admin
 */
router.put('/usuarios/:id/senha', async (req, res) => {
  try {
    const resultado = await AdminService.alterarSenhaUsuario(
      req.params.id, 
      req.body.novaSenha, 
      req.usuario.id
    );
    
    if (!resultado.sucesso) {
      return res.status(400).json({
        sucesso: false,
        erros: resultado.erros
      });
    }

    res.json({
      sucesso: true,
      mensagem: 'Senha alterada com sucesso'
    });

  } catch (error) {
    console.error('❌ Erro na rota PUT /admin/usuarios/:id/senha:', error.message);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro interno do servidor',
      detalhes: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ==================== ROTAS DE SISTEMA ====================

/**
 * @route   GET /api/admin/sistema/status
 * @desc    Obter status do sistema
 * @access  Admin
 */
router.get('/sistema/status', async (req, res) => {
  try {
    const resultado = await AdminService.obterStatusSistema(req.usuario.id);

    res.json({
      sucesso: true,
      status: resultado.status
    });

  } catch (error) {
    console.error('❌ Erro na rota GET /admin/sistema/status:', error.message);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro interno do servidor',
      detalhes: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   GET /api/admin/sistema/logs
 * @desc    Obter logs do sistema
 * @access  Admin
 */
router.get('/sistema/logs', async (req, res) => {
  try {
    const filtros = {
      pagina: parseInt(req.query.pagina) || 1,
      limite: parseInt(req.query.limite) || 50,
      nivel: req.query.nivel || '',
      dataInicio: req.query.dataInicio,
      dataFim: req.query.dataFim
    };

    const resultado = await AdminService.obterLogs(filtros, req.usuario.id);

    res.json({
      sucesso: true,
      logs: resultado.logs,
      paginacao: resultado.paginacao
    });

  } catch (error) {
    console.error('❌ Erro na rota GET /admin/sistema/logs:', error.message);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro interno do servidor',
      detalhes: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;