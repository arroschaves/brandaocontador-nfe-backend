const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');

/**
 * @swagger
 * /api/logs:
 *   get:
 *     tags:
 *       - Logs
 *     summary: Visualizar logs do sistema
 *     description: Retorna os logs organizados por categoria e data
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: categoria
 *         schema:
 *           type: string
 *           enum: [auth, nfe, clientes, certificados, dashboard, produtos, system, cte, mdfe, eventos, relatorios]
 *         description: Categoria dos logs
 *       - in: query
 *         name: tipo
 *         schema:
 *           type: string
 *           enum: [errors, access]
 *           default: errors
 *         description: Tipo de log
 *       - in: query
 *         name: data
 *         schema:
 *           type: string
 *           format: date
 *         description: Data dos logs (YYYY-MM-DD)
 *       - in: query
 *         name: limite
 *         schema:
 *           type: integer
 *           default: 100
 *         description: Número máximo de logs a retornar
 *     responses:
 *       200:
 *         description: Logs obtidos com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sucesso:
 *                   type: boolean
 *                   example: true
 *                 logs:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *                       level:
 *                         type: string
 *                       message:
 *                         type: string
 *                       request:
 *                         type: object
 *                       error:
 *                         type: object
 *                 categoria:
 *                   type: string
 *                 tipo:
 *                   type: string
 *                 data:
 *                   type: string
 *                 total:
 *                   type: integer
 *       401:
 *         description: Token inválido ou expirado
 *       403:
 *         description: Acesso negado (apenas administradores)
 *       500:
 *         description: Erro interno do servidor
 */
router.get('/', authMiddleware.verificarAutenticacao(), async (req, res) => {
  try {
    const advancedLogger = req.app.get('advancedLogger');
    
    // Verificar se o usuário é administrador
    if (req.user.tipo !== 'admin') {
      advancedLogger.logWarning('system', 'Tentativa de acesso aos logs por usuário não autorizado', req, {
        userId: req.user.id,
        userType: req.user.tipo
      });
      
      return res.status(403).json({
        sucesso: false,
        erro: 'Acesso negado. Apenas administradores podem visualizar logs.',
        codigo: 'ACCESS_DENIED'
      });
    }

    const { categoria = 'system', tipo = 'errors', data, limite = 100 } = req.query;
    
    // Log da requisição
    advancedLogger.logInfo('system', 'Solicitação de visualização de logs', req, {
      userId: req.user.id,
      categoria,
      tipo,
      data
    });

    // Obter logs
    const logs = advancedLogger.getLogs(categoria, tipo, data);
    
    // Limitar número de logs retornados
    const logsLimitados = logs.slice(0, parseInt(limite));

    res.json({
      sucesso: true,
      logs: logsLimitados,
      categoria,
      tipo,
      data: data || new Date().toISOString().split('T')[0],
      total: logs.length,
      exibindo: logsLimitados.length
    });

  } catch (error) {
    const advancedLogger = req.app.get('advancedLogger');
    advancedLogger.logError('system', 'Erro ao obter logs', req, error, {
      userId: req.user?.id
    });

    res.status(500).json({
      sucesso: false,
      erro: 'Erro interno do servidor',
      codigo: 'INTERNAL_ERROR'
    });
  }
});

/**
 * @swagger
 * /api/logs/stats:
 *   get:
 *     tags:
 *       - Logs
 *     summary: Obter estatísticas de erros
 *     description: Retorna estatísticas de erros por categoria e período
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: dias
 *         schema:
 *           type: integer
 *           default: 7
 *         description: Número de dias para análise
 *     responses:
 *       200:
 *         description: Estatísticas obtidas com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sucesso:
 *                   type: boolean
 *                   example: true
 *                 stats:
 *                   type: object
 *                   additionalProperties:
 *                     type: object
 *                     properties:
 *                       total:
 *                         type: integer
 *                       byDay:
 *                         type: object
 *                         additionalProperties:
 *                           type: integer
 *                 periodo:
 *                   type: integer
 *       401:
 *         description: Token inválido ou expirado
 *       403:
 *         description: Acesso negado (apenas administradores)
 *       500:
 *         description: Erro interno do servidor
 */
router.get('/stats', authMiddleware.verificarAutenticacao(), async (req, res) => {
  try {
    const advancedLogger = req.app.get('advancedLogger');
    
    // Verificar se o usuário é administrador
    if (req.user.tipo !== 'admin') {
      return res.status(403).json({
        sucesso: false,
        erro: 'Acesso negado. Apenas administradores podem visualizar estatísticas.',
        codigo: 'ACCESS_DENIED'
      });
    }

    const { dias = 7 } = req.query;
    
    // Log da requisição
    advancedLogger.logInfo('system', 'Solicitação de estatísticas de logs', req, {
      userId: req.user.id,
      dias
    });

    // Obter estatísticas
    const stats = advancedLogger.getErrorStats(parseInt(dias));

    res.json({
      sucesso: true,
      stats,
      periodo: parseInt(dias)
    });

  } catch (error) {
    const advancedLogger = req.app.get('advancedLogger');
    advancedLogger.logError('system', 'Erro ao obter estatísticas de logs', req, error, {
      userId: req.user?.id
    });

    res.status(500).json({
      sucesso: false,
      erro: 'Erro interno do servidor',
      codigo: 'INTERNAL_ERROR'
    });
  }
});

/**
 * @swagger
 * /api/logs/missing-routes:
 *   get:
 *     tags:
 *       - Logs
 *     summary: Obter rotas que estão gerando 404
 *     description: Retorna lista de rotas que o frontend está tentando acessar mas não existem no backend
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: dias
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Número de dias para análise
 *     responses:
 *       200:
 *         description: Rotas faltantes obtidas com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sucesso:
 *                   type: boolean
 *                   example: true
 *                 rotasFaltantes:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ["GET /api/me", "POST /api/me/certificado"]
 *                 periodo:
 *                   type: integer
 *       401:
 *         description: Token inválido ou expirado
 *       403:
 *         description: Acesso negado (apenas administradores)
 *       500:
 *         description: Erro interno do servidor
 */
router.get('/missing-routes', authMiddleware.verificarAutenticacao(), async (req, res) => {
  try {
    const advancedLogger = req.app.get('advancedLogger');
    
    // Verificar se o usuário é administrador
    if (req.user.tipo !== 'admin') {
      return res.status(403).json({
        sucesso: false,
        erro: 'Acesso negado. Apenas administradores podem visualizar rotas faltantes.',
        codigo: 'ACCESS_DENIED'
      });
    }

    const { dias = 1 } = req.query;
    
    // Log da requisição
    advancedLogger.logInfo('system', 'Solicitação de rotas faltantes', req, {
      userId: req.user.id,
      dias
    });

    // Obter rotas faltantes
    const rotasFaltantes = advancedLogger.getMissingRoutes(parseInt(dias));

    res.json({
      sucesso: true,
      rotasFaltantes,
      periodo: parseInt(dias),
      total: rotasFaltantes.length
    });

  } catch (error) {
    const advancedLogger = req.app.get('advancedLogger');
    advancedLogger.logError('system', 'Erro ao obter rotas faltantes', req, error, {
      userId: req.user?.id
    });

    res.status(500).json({
      sucesso: false,
      erro: 'Erro interno do servidor',
      codigo: 'INTERNAL_ERROR'
    });
  }
});

/**
 * @swagger
 * /api/logs/dashboard:
 *   get:
 *     tags:
 *       - Logs
 *     summary: Dashboard de monitoramento
 *     description: Retorna dados consolidados para dashboard de monitoramento
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dados do dashboard obtidos com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sucesso:
 *                   type: boolean
 *                   example: true
 *                 dashboard:
 *                   type: object
 *                   properties:
 *                     errosHoje:
 *                       type: integer
 *                     errosOntem:
 *                       type: integer
 *                     rotasFaltantes:
 *                       type: integer
 *                     categoriaComMaisErros:
 *                       type: string
 *                     ultimosErros:
 *                       type: array
 *                       items:
 *                         type: object
 *                     estatisticasPorCategoria:
 *                       type: object
 *       401:
 *         description: Token inválido ou expirado
 *       403:
 *         description: Acesso negado (apenas administradores)
 *       500:
 *         description: Erro interno do servidor
 */
router.get('/dashboard', authMiddleware.verificarAutenticacao(), async (req, res) => {
  try {
    const advancedLogger = req.app.get('advancedLogger');
    
    // Verificar se o usuário é administrador
    if (req.user.tipo !== 'admin') {
      return res.status(403).json({
        sucesso: false,
        erro: 'Acesso negado. Apenas administradores podem visualizar o dashboard.',
        codigo: 'ACCESS_DENIED'
      });
    }

    // Log da requisição
    advancedLogger.logInfo('system', 'Solicitação de dashboard de logs', req, {
      userId: req.user.id
    });

    // Obter dados para o dashboard
    const stats = advancedLogger.getErrorStats(2); // 2 dias para comparar hoje vs ontem
    const rotasFaltantes = advancedLogger.getMissingRoutes(1);
    
    const hoje = new Date().toISOString().split('T')[0];
    const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    let errosHoje = 0;
    let errosOntem = 0;
    let categoriaComMaisErros = 'system';
    let maxErros = 0;
    
    // Calcular estatísticas
    Object.keys(stats).forEach(categoria => {
      const errosHojeCat = stats[categoria].byDay[hoje] || 0;
      const errosOntemCat = stats[categoria].byDay[ontem] || 0;
      
      errosHoje += errosHojeCat;
      errosOntem += errosOntemCat;
      
      if (stats[categoria].total > maxErros) {
        maxErros = stats[categoria].total;
        categoriaComMaisErros = categoria;
      }
    });

    // Obter últimos erros (de todas as categorias)
    const ultimosErros = [];
    const categorias = ['auth', 'nfe', 'clientes', 'certificados', 'dashboard', 'produtos', 'system'];
    
    categorias.forEach(categoria => {
      const logs = advancedLogger.getLogs(categoria, 'errors', hoje);
      ultimosErros.push(...logs.slice(0, 3)); // 3 últimos de cada categoria
    });
    
    // Ordenar por timestamp e pegar os 10 mais recentes
    ultimosErros.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const ultimosErrosLimitados = ultimosErros.slice(0, 10);

    const dashboard = {
      errosHoje,
      errosOntem,
      rotasFaltantes: rotasFaltantes.length,
      categoriaComMaisErros,
      ultimosErros: ultimosErrosLimitados,
      estatisticasPorCategoria: stats,
      tendencia: errosHoje > errosOntem ? 'crescente' : errosHoje < errosOntem ? 'decrescente' : 'estavel'
    };

    res.json({
      sucesso: true,
      dashboard
    });

  } catch (error) {
    const advancedLogger = req.app.get('advancedLogger');
    advancedLogger.logError('system', 'Erro ao obter dashboard de logs', req, error, {
      userId: req.user?.id
    });

    res.status(500).json({
      sucesso: false,
      erro: 'Erro interno do servidor',
      codigo: 'INTERNAL_ERROR'
    });
  }
});

module.exports = router;