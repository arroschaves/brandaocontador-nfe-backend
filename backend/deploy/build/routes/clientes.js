const express = require('express');
const router = express.Router();
const ClienteService = require('../services/cliente-service');
const { authenticateToken } = require('../middleware/auth');

// ==================== MIDDLEWARE ====================

// Aplica autenticação em todas as rotas
router.use(authenticateToken);

// ==================== ROTAS CRUD ====================

/**
 * @route   POST /api/clientes
 * @desc    Criar novo cliente
 * @access  Private
 */
router.post('/', async (req, res) => {
  try {
    const resultado = await ClienteService.criarCliente(req.body, req.user.id);
    
    if (!resultado.sucesso) {
      return res.status(400).json({
        sucesso: false,
        erros: resultado.erros,
        avisos: resultado.avisos
      });
    }

    res.status(201).json({
      sucesso: true,
      cliente: resultado.cliente,
      avisos: resultado.avisos,
      mensagem: 'Cliente criado com sucesso'
    });

  } catch (error) {
    console.error('❌ Erro na rota POST /clientes:', error.message);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro interno do servidor',
      detalhes: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   GET /api/clientes
 * @desc    Listar clientes com filtros e paginação
 * @access  Private
 */
router.get('/', async (req, res) => {
  try {
    const filtros = {
      pagina: parseInt(req.query.pagina) || 1,
      limite: parseInt(req.query.limite) || 20,
      busca: req.query.busca || '',
      tipo: req.query.tipo || '',
      ativo: req.query.ativo !== undefined ? req.query.ativo === 'true' : true,
      ordenacao: req.query.ordenacao || 'nome'
    };

    const resultado = await ClienteService.listarClientes(filtros, req.user.id);

    res.json({
      sucesso: true,
      clientes: resultado.clientes,
      paginacao: resultado.paginacao
    });

  } catch (error) {
    console.error('❌ Erro na rota GET /clientes:', error.message);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro interno do servidor',
      detalhes: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   GET /api/clientes/:id
 * @desc    Buscar cliente por ID
 * @access  Private
 */
router.get('/:id', async (req, res) => {
  try {
    const resultado = await ClienteService.buscarClientePorId(req.params.id, req.user.id);
    
    if (!resultado.sucesso) {
      return res.status(404).json({
        sucesso: false,
        erros: resultado.erros
      });
    }

    res.json({
      sucesso: true,
      cliente: resultado.cliente
    });

  } catch (error) {
    console.error('❌ Erro na rota GET /clientes/:id:', error.message);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro interno do servidor',
      detalhes: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   PUT /api/clientes/:id
 * @desc    Atualizar cliente
 * @access  Private
 */
router.put('/:id', async (req, res) => {
  try {
    const resultado = await ClienteService.atualizarCliente(
      req.params.id, 
      req.body, 
      req.user.id
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
      cliente: resultado.cliente,
      mensagem: 'Cliente atualizado com sucesso'
    });

  } catch (error) {
    console.error('❌ Erro na rota PUT /clientes/:id:', error.message);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro interno do servidor',
      detalhes: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   DELETE /api/clientes/:id
 * @desc    Desativar cliente (soft delete)
 * @access  Private
 */
router.delete('/:id', async (req, res) => {
  try {
    const resultado = await ClienteService.desativarCliente(req.params.id, req.user.id);
    
    if (!resultado.sucesso) {
      return res.status(404).json({
        sucesso: false,
        erros: resultado.erros
      });
    }

    res.json({
      sucesso: true,
      cliente: resultado.cliente,
      mensagem: 'Cliente desativado com sucesso'
    });

  } catch (error) {
    console.error('❌ Erro na rota DELETE /clientes/:id:', error.message);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro interno do servidor',
      detalhes: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ==================== ROTAS DE CONSULTA ====================

/**
 * @route   GET /api/clientes/documento/:documento
 * @desc    Buscar cliente por documento
 * @access  Private
 */
router.get('/documento/:documento', async (req, res) => {
  try {
    const resultado = await ClienteService.buscarClientePorDocumento(
      req.params.documento, 
      req.user.id
    );
    
    if (!resultado.sucesso) {
      return res.status(404).json({
        sucesso: false,
        erros: resultado.erros
      });
    }

    res.json({
      sucesso: true,
      cliente: resultado.cliente
    });

  } catch (error) {
    console.error('❌ Erro na rota GET /clientes/documento/:documento:', error.message);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro interno do servidor',
      detalhes: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ==================== ROTAS DE VALIDAÇÃO ====================

/**
 * @route   POST /api/clientes/validar/documento
 * @desc    Validar documento (CPF/CNPJ)
 * @access  Private
 */
router.post('/validar/documento', async (req, res) => {
  try {
    const { documento, tipo } = req.body;
    
    if (!documento || !tipo) {
      return res.status(400).json({
        sucesso: false,
        erro: 'Documento e tipo são obrigatórios'
      });
    }

    const resultado = await ClienteService.validarDocumento(documento, tipo);

    res.json({
      sucesso: true,
      validacao: resultado
    });

  } catch (error) {
    console.error('❌ Erro na rota POST /clientes/validar/documento:', error.message);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro interno do servidor',
      detalhes: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   GET /api/clientes/consultar/cnpj/:cnpj
 * @desc    Consultar CNPJ na Receita Federal
 * @access  Private
 */
router.get('/consultar/cnpj/:cnpj', async (req, res) => {
  try {
    const resultado = await ClienteService.consultarCNPJ(req.params.cnpj);
    
    if (!resultado.sucesso) {
      return res.status(400).json({
        sucesso: false,
        erro: resultado.erro
      });
    }

    res.json({
      sucesso: true,
      dados: resultado.dados
    });

  } catch (error) {
    console.error('❌ Erro na rota GET /clientes/consultar/cnpj/:cnpj:', error.message);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro interno do servidor',
      detalhes: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   GET /api/clientes/consultar/cep/:cep
 * @desc    Consultar CEP
 * @access  Private
 */
router.get('/consultar/cep/:cep', async (req, res) => {
  try {
    const resultado = await ClienteService.consultarCEP(req.params.cep);
    
    if (!resultado.sucesso) {
      return res.status(400).json({
        sucesso: false,
        erro: resultado.erro
      });
    }

    res.json({
      sucesso: true,
      dados: resultado.dados
    });

  } catch (error) {
    console.error('❌ Erro na rota GET /clientes/consultar/cep/:cep:', error.message);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro interno do servidor',
      detalhes: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ==================== ROTAS DE LOCALIZAÇÃO ====================

/**
 * @route   GET /api/clientes/estados
 * @desc    Obter lista de estados brasileiros
 * @access  Private
 */
router.get('/estados', async (req, res) => {
  try {
    const resultado = await ClienteService.obterEstados();
    
    if (!resultado.sucesso) {
      return res.status(400).json({
        sucesso: false,
        erro: resultado.erro
      });
    }

    res.json({
      sucesso: true,
      estados: resultado.estados
    });

  } catch (error) {
    console.error('❌ Erro na rota GET /clientes/estados:', error.message);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro interno do servidor',
      detalhes: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   GET /api/clientes/cidades/:uf
 * @desc    Obter cidades por UF
 * @access  Private
 */
router.get('/cidades/:uf', async (req, res) => {
  try {
    const resultado = await ClienteService.obterCidades(req.params.uf);
    
    if (!resultado.sucesso) {
      return res.status(400).json({
        sucesso: false,
        erro: resultado.erro
      });
    }

    res.json({
      sucesso: true,
      cidades: resultado.cidades
    });

  } catch (error) {
    console.error('❌ Erro na rota GET /clientes/cidades/:uf:', error.message);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro interno do servidor',
      detalhes: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ==================== ROTAS DE RELATÓRIOS ====================

/**
 * @route   GET /api/clientes/relatorios/estatisticas
 * @desc    Obter estatísticas de clientes
 * @access  Private
 */
router.get('/relatorios/estatisticas', async (req, res) => {
  try {
    const resultado = await ClienteService.obterEstatisticas(req.user.id);

    res.json({
      sucesso: true,
      estatisticas: resultado.estatisticas
    });

  } catch (error) {
    console.error('❌ Erro na rota GET /clientes/relatorios/estatisticas:', error.message);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro interno do servidor',
      detalhes: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   GET /api/clientes/exportar/csv
 * @desc    Exportar clientes para CSV
 * @access  Private
 */
router.get('/exportar/csv', async (req, res) => {
  try {
    const filtros = {
      busca: req.query.busca || '',
      tipo: req.query.tipo || '',
      ativo: req.query.ativo !== undefined ? req.query.ativo === 'true' : true
    };

    const resultado = await ClienteService.exportarClientes(filtros, req.user.id);
    
    if (!resultado.sucesso) {
      return res.status(400).json({
        sucesso: false,
        erro: 'Erro ao exportar clientes'
      });
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="clientes.csv"');
    res.send('\uFEFF' + resultado.csv); // BOM para UTF-8

  } catch (error) {
    console.error('❌ Erro na rota GET /clientes/exportar/csv:', error.message);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro interno do servidor',
      detalhes: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ==================== ROTAS DE MANUTENÇÃO ====================

/**
 * @route   POST /api/clientes/cache/limpar
 * @desc    Limpar cache de validações
 * @access  Private
 */
router.post('/cache/limpar', async (req, res) => {
  try {
    ClienteService.limparCache();

    res.json({
      sucesso: true,
      mensagem: 'Cache limpo com sucesso'
    });

  } catch (error) {
    console.error('❌ Erro na rota POST /clientes/cache/limpar:', error.message);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro interno do servidor',
      detalhes: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   GET /api/clientes/cache/estatisticas
 * @desc    Obter estatísticas do cache
 * @access  Private
 */
router.get('/cache/estatisticas', async (req, res) => {
  try {
    const estatisticas = ClienteService.obterEstatisticasCache();

    res.json({
      sucesso: true,
      cache: estatisticas
    });

  } catch (error) {
    console.error('❌ Erro na rota GET /clientes/cache/estatisticas:', error.message);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro interno do servidor',
      detalhes: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;