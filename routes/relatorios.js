/**
 * Rotas para Relatórios Fiscais e Simulador 2026
 */

const express = require('express');
const router = express.Router();
const RelatoriosFiscaisService = require('../services/relatoriosFiscais');
const authMiddleware = require('../middleware/auth');
const { body, query, validationResult } = require('express-validator');

const relatoriosService = new RelatoriosFiscaisService();

/**
 * @swagger
 * components:
 *   schemas:
 *     RelatorioFiltros:
 *       type: object
 *       properties:
 *         dataInicial:
 *           type: string
 *           format: date
 *           description: Data inicial do período
 *         dataFinal:
 *           type: string
 *           format: date
 *           description: Data final do período
 *         formato:
 *           type: string
 *           enum: [pdf, excel, xml]
 *           description: Formato do relatório
 *     
 *     SimuladorFiltros:
 *       type: object
 *       properties:
 *         dataInicial:
 *           type: string
 *           format: date
 *         dataFinal:
 *           type: string
 *           format: date
 *         incluirIS:
 *           type: boolean
 *           description: Incluir Imposto Seletivo na simulação
 */

/**
 * @swagger
 * /api/relatorios/livro-entrada:
 *   post:
 *     summary: Gerar Livro de Entrada
 *     tags: [Relatórios]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RelatorioFiltros'
 *     responses:
 *       200:
 *         description: Livro de entrada gerado com sucesso
 *       400:
 *         description: Dados inválidos
 *       401:
 *         description: Não autorizado
 */
router.post('/livro-entrada', 
  authMiddleware.verificarAutenticacao(),
  [
    body('dataInicial').isISO8601().withMessage('Data inicial inválida'),
    body('dataFinal').isISO8601().withMessage('Data final inválida'),
    body('formato').optional().isIn(['pdf', 'excel', 'xml']).withMessage('Formato inválido')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          sucesso: false,
          erro: 'Dados inválidos',
          detalhes: errors.array()
        });
      }

      const { dataInicial, dataFinal, formato = 'pdf' } = req.body;
      
      // Validar período
      if (new Date(dataFinal) < new Date(dataInicial)) {
        return res.status(400).json({
          sucesso: false,
          erro: 'Data final deve ser maior que data inicial'
        });
      }

      const resultado = await relatoriosService.gerarLivroEntrada({
        dataInicial,
        dataFinal,
        formato,
        usuario: req.user
      });

      res.json(resultado);

    } catch (error) {
      console.error('Erro ao gerar livro de entrada:', error);
      res.status(500).json({
        sucesso: false,
        erro: error.message
      });
    }
  }
);

/**
 * @swagger
 * /api/relatorios/livro-saida:
 *   post:
 *     summary: Gerar Livro de Saída
 *     tags: [Relatórios]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RelatorioFiltros'
 *     responses:
 *       200:
 *         description: Livro de saída gerado com sucesso
 */
router.post('/livro-saida', 
  authMiddleware.verificarAutenticacao(),
  [
    body('dataInicial').isISO8601().withMessage('Data inicial inválida'),
    body('dataFinal').isISO8601().withMessage('Data final inválida'),
    body('formato').optional().isIn(['pdf', 'excel', 'xml']).withMessage('Formato inválido')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          sucesso: false,
          erro: 'Dados inválidos',
          detalhes: errors.array()
        });
      }

      const { dataInicial, dataFinal, formato = 'pdf' } = req.body;
      
      if (new Date(dataFinal) < new Date(dataInicial)) {
        return res.status(400).json({
          sucesso: false,
          erro: 'Data final deve ser maior que data inicial'
        });
      }

      const resultado = await relatoriosService.gerarLivroSaida({
        dataInicial,
        dataFinal,
        formato,
        usuario: req.user
      });

      res.json(resultado);

    } catch (error) {
      console.error('Erro ao gerar livro de saída:', error);
      res.status(500).json({
        sucesso: false,
        erro: error.message
      });
    }
  }
);

/**
 * @swagger
 * /api/relatorios/apuracao-icms:
 *   post:
 *     summary: Gerar Apuração de ICMS
 *     tags: [Relatórios]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               mes:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 12
 *               ano:
 *                 type: integer
 *                 minimum: 2020
 *               formato:
 *                 type: string
 *                 enum: [pdf, excel]
 *     responses:
 *       200:
 *         description: Apuração de ICMS gerada com sucesso
 */
router.post('/apuracao-icms', 
  authMiddleware.verificarAutenticacao(),
  [
    body('mes').isInt({ min: 1, max: 12 }).withMessage('Mês inválido'),
    body('ano').isInt({ min: 2020 }).withMessage('Ano inválido'),
    body('formato').optional().isIn(['pdf', 'excel']).withMessage('Formato inválido')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          sucesso: false,
          erro: 'Dados inválidos',
          detalhes: errors.array()
        });
      }

      const { mes, ano, formato = 'pdf' } = req.body;

      const resultado = await relatoriosService.gerarApuracaoICMS({
        mes,
        ano,
        formato,
        usuario: req.user
      });

      res.json(resultado);

    } catch (error) {
      console.error('Erro ao gerar apuração de ICMS:', error);
      res.status(500).json({
        sucesso: false,
        erro: error.message
      });
    }
  }
);

/**
 * @swagger
 * /api/relatorios/simulador-2026:
 *   post:
 *     summary: Simulador 2026 - Comparativo IBS/CBS/IS vs Sistema Atual
 *     tags: [Relatórios]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SimuladorFiltros'
 *     responses:
 *       200:
 *         description: Simulação 2026 realizada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sucesso:
 *                   type: boolean
 *                 periodo:
 *                   type: string
 *                 nfesAnalisadas:
 *                   type: integer
 *                 sistemaAtual:
 *                   type: object
 *                 sistema2026:
 *                   type: object
 *                 comparativo:
 *                   type: object
 *                 analiseImpacto:
 *                   type: object
 */
router.post('/simulador-2026', 
  authMiddleware.verificarAutenticacao(),
  [
    body('dataInicial').isISO8601().withMessage('Data inicial inválida'),
    body('dataFinal').isISO8601().withMessage('Data final inválida'),
    body('incluirIS').optional().isBoolean().withMessage('incluirIS deve ser boolean')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          sucesso: false,
          erro: 'Dados inválidos',
          detalhes: errors.array()
        });
      }

      const { dataInicial, dataFinal, incluirIS = false } = req.body;
      
      if (new Date(dataFinal) < new Date(dataInicial)) {
        return res.status(400).json({
          sucesso: false,
          erro: 'Data final deve ser maior que data inicial'
        });
      }

      const resultado = await relatoriosService.simular2026({
        dataInicial,
        dataFinal,
        incluirIS,
        usuario: req.user
      });

      res.json(resultado);

    } catch (error) {
      console.error('Erro na simulação 2026:', error);
      res.status(500).json({
        sucesso: false,
        erro: error.message
      });
    }
  }
);

/**
 * @swagger
 * /api/relatorios/dashboard:
 *   get:
 *     summary: Dados para Dashboard - KPIs e Gráficos
 *     tags: [Relatórios]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: periodo
 *         schema:
 *           type: string
 *           enum: [mes, trimestre, ano]
 *         description: Período para análise
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
 *                 periodo:
 *                   type: string
 *                 kpis:
 *                   type: object
 *                 graficos:
 *                   type: object
 *                 alertas:
 *                   type: array
 */
router.get('/dashboard', 
  authMiddleware.verificarAutenticacao(),
  [
    query('periodo').optional().isIn(['mes', 'trimestre', 'ano']).withMessage('Período inválido')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          sucesso: false,
          erro: 'Parâmetros inválidos',
          detalhes: errors.array()
        });
      }

      const { periodo = 'mes' } = req.query;

      const resultado = await relatoriosService.gerarDadosDashboard({
        periodo,
        usuario: req.usuario
      });

      res.json(resultado);

    } catch (error) {
      console.error('Erro ao gerar dados do dashboard:', error);
      res.status(500).json({
        sucesso: false,
        erro: error.message
      });
    }
  }
);

/**
 * @swagger
 * /api/relatorios/historico:
 *   get:
 *     summary: Histórico de Relatórios Gerados
 *     tags: [Relatórios]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: tipo
 *         schema:
 *           type: string
 *         description: Tipo de relatório
 *       - in: query
 *         name: limite
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Limite de registros
 *     responses:
 *       200:
 *         description: Histórico obtido com sucesso
 */
router.get('/historico', 
  authMiddleware.verificarAutenticacao(),
  [
    query('limite').optional().isInt({ min: 1, max: 100 }).withMessage('Limite inválido')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          sucesso: false,
          erro: 'Parâmetros inválidos',
          detalhes: errors.array()
        });
      }

      const { tipo, limite = 20 } = req.query;

      // Implementar busca no histórico
      const historico = await relatoriosService.buscarHistorico({
        tipo,
        limite,
        usuario: req.usuario
      });

      res.json({
        sucesso: true,
        historico,
        total: historico.length
      });

    } catch (error) {
      console.error('Erro ao buscar histórico:', error);
      res.status(500).json({
        sucesso: false,
        erro: error.message
      });
    }
  }
);

/**
 * @swagger
 * /api/relatorios/download/{arquivo}:
 *   get:
 *     summary: Download de Relatório
 *     tags: [Relatórios]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: arquivo
 *         required: true
 *         schema:
 *           type: string
 *         description: Nome do arquivo
 *     responses:
 *       200:
 *         description: Arquivo baixado com sucesso
 *       404:
 *         description: Arquivo não encontrado
 */
router.get('/download/:arquivo', 
  authMiddleware.verificarAutenticacao(),
  async (req, res) => {
    try {
      const { arquivo } = req.params;
      
      // Validar se o arquivo pertence ao usuário
      const arquivoValido = await relatoriosService.validarArquivoUsuario({
        arquivo,
        usuario: req.user
      });

      if (!arquivoValido) {
        return res.status(404).json({
          sucesso: false,
          erro: 'Arquivo não encontrado'
        });
      }

      // Implementar download do arquivo
      const caminhoArquivo = await relatoriosService.obterCaminhoArquivo(arquivo);
      
      res.download(caminhoArquivo, (err) => {
        if (err) {
          console.error('Erro no download:', err);
          res.status(500).json({
            sucesso: false,
            erro: 'Erro ao baixar arquivo'
          });
        }
      });

    } catch (error) {
      console.error('Erro no download:', error);
      res.status(500).json({
        sucesso: false,
        erro: error.message
      });
    }
  }
);

/**
 * @swagger
 * /api/relatorios/aliquotas-2026:
 *   get:
 *     summary: Consultar Alíquotas da Reforma Tributária 2026
 *     tags: [Relatórios]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Alíquotas obtidas com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sucesso:
 *                   type: boolean
 *                 aliquotas:
 *                   type: object
 *                   properties:
 *                     ibs:
 *                       type: number
 *                     cbs:
 *                       type: number
 *                     is:
 *                       type: number
 *                 produtosSujeitosIS:
 *                   type: array
 */
router.get('/aliquotas-2026', 
  authMiddleware.verificarAutenticacao(),
  async (req, res) => {
    try {
      const aliquotas = relatoriosService.aliquotas2026;
      const produtosSujeitosIS = relatoriosService.produtosSujeitosIS;

      res.json({
        sucesso: true,
        aliquotas,
        produtosSujeitosIS,
        observacoes: [
          'Alíquotas baseadas na Reforma Tributária aprovada',
          'Valores sujeitos a alterações até implementação final',
          'IBS e CBS substituem ICMS, IPI, PIS e COFINS',
          'IS incide sobre produtos específicos'
        ]
      });

    } catch (error) {
      console.error('Erro ao consultar alíquotas 2026:', error);
      res.status(500).json({
        sucesso: false,
        erro: error.message
      });
    }
  }
);

module.exports = router;