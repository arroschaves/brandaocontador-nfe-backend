const express = require('express');
const router = express.Router();
const ProdutoService = require('../services/produto-service');
const authMiddleware = require('../middleware/auth');

// ==================== MIDDLEWARE ====================

// Aplica autenticação em todas as rotas
router.use(authMiddleware.verificarAutenticacao());

// ==================== ROTAS CRUD ====================

/**
 * @route   POST /api/produtos
 * @desc    Criar novo produto
 * @access  Private
 */
router.post('/', async (req, res) => {
  try {
    const resultado = await ProdutoService.criarProduto(req.body, req.usuario.id);
    
    if (!resultado.sucesso) {
      return res.status(400).json({
        sucesso: false,
        erros: resultado.erros,
        avisos: resultado.avisos
      });
    }

    res.status(201).json({
      sucesso: true,
      produto: resultado.produto,
      avisos: resultado.avisos,
      mensagem: 'Produto criado com sucesso'
    });

  } catch (error) {
    console.error('❌ Erro na rota POST /produtos:', error.message);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro interno do servidor',
      detalhes: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   GET /api/produtos
 * @desc    Listar produtos com filtros e paginação
 * @access  Private
 */
router.get('/', async (req, res) => {
  try {
    const filtros = {
      pagina: parseInt(req.query.pagina) || 1,
      limite: parseInt(req.query.limite) || 20,
      busca: req.query.busca || '',
      categoria: req.query.categoria || '',
      ativo: req.query.ativo !== undefined ? req.query.ativo === 'true' : true,
      ordenacao: req.query.ordenacao || 'nome'
    };

    const resultado = await ProdutoService.listarProdutos(filtros, req.usuario.id);

    res.json({
      sucesso: true,
      produtos: resultado.produtos,
      paginacao: resultado.paginacao
    });

  } catch (error) {
    console.error('❌ Erro na rota GET /produtos:', error.message);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro interno do servidor',
      detalhes: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   GET /api/produtos/:id
 * @desc    Buscar produto por ID
 * @access  Private
 */
router.get('/:id', async (req, res) => {
  try {
    const resultado = await ProdutoService.buscarProdutoPorId(req.params.id, req.usuario.id);
    
    if (!resultado.sucesso) {
      return res.status(404).json({
        sucesso: false,
        erros: resultado.erros
      });
    }

    res.json({
      sucesso: true,
      produto: resultado.produto
    });

  } catch (error) {
    console.error('❌ Erro na rota GET /produtos/:id:', error.message);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro interno do servidor',
      detalhes: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   PUT /api/produtos/:id
 * @desc    Atualizar produto
 * @access  Private
 */
router.put('/:id', async (req, res) => {
  try {
    const resultado = await ProdutoService.atualizarProduto(
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
      produto: resultado.produto,
      mensagem: 'Produto atualizado com sucesso'
    });

  } catch (error) {
    console.error('❌ Erro na rota PUT /produtos/:id:', error.message);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro interno do servidor',
      detalhes: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   DELETE /api/produtos/:id
 * @desc    Desativar produto (soft delete)
 * @access  Private
 */
router.delete('/:id', async (req, res) => {
  try {
    const resultado = await ProdutoService.desativarProduto(req.params.id, req.usuario.id);
    
    if (!resultado.sucesso) {
      return res.status(404).json({
        sucesso: false,
        erros: resultado.erros
      });
    }

    res.json({
      sucesso: true,
      produto: resultado.produto,
      mensagem: 'Produto desativado com sucesso'
    });

  } catch (error) {
    console.error('❌ Erro na rota DELETE /produtos/:id:', error.message);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro interno do servidor',
      detalhes: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ==================== ROTAS DE CONSULTA ====================

/**
 * @route   GET /api/produtos/codigo/:codigo
 * @desc    Buscar produto por código
 * @access  Private
 */
router.get('/codigo/:codigo', async (req, res) => {
  try {
    const resultado = await ProdutoService.buscarProdutoPorCodigo(
      req.params.codigo, 
      req.usuario.id
    );
    
    if (!resultado.sucesso) {
      return res.status(404).json({
        sucesso: false,
        erros: resultado.erros
      });
    }

    res.json({
      sucesso: true,
      produto: resultado.produto
    });

  } catch (error) {
    console.error('❌ Erro na rota GET /produtos/codigo/:codigo:', error.message);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro interno do servidor',
      detalhes: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   GET /api/produtos/categoria/:categoria
 * @desc    Buscar produtos por categoria
 * @access  Private
 */
router.get('/categoria/:categoria', async (req, res) => {
  try {
    const filtros = {
      categoria: req.params.categoria,
      pagina: parseInt(req.query.pagina) || 1,
      limite: parseInt(req.query.limite) || 20,
      ativo: req.query.ativo !== undefined ? req.query.ativo === 'true' : true
    };

    const resultado = await ProdutoService.buscarProdutosPorCategoria(filtros, req.usuario.id);

    res.json({
      sucesso: true,
      produtos: resultado.produtos,
      paginacao: resultado.paginacao
    });

  } catch (error) {
    console.error('❌ Erro na rota GET /produtos/categoria/:categoria:', error.message);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro interno do servidor',
      detalhes: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;