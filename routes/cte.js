const express = require('express');
const router = express.Router();
const cteService = require('../services/cte-service');
const validationService = require('../services/validation-service');
const authMiddleware = require('../middleware/auth');

/**
 * @swagger
 * /api/cte/emitir:
 *   post:
 *     summary: Emitir CTe (Conhecimento de Transporte Eletrônico)
 *     tags: [CTe]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               emitente:
 *                 type: object
 *                 properties:
 *                   cnpj:
 *                     type: string
 *                     example: "12345678000199"
 *                   razaoSocial:
 *                     type: string
 *                     example: "Transportadora LTDA"
 *                   inscricaoEstadual:
 *                     type: string
 *                     example: "123456789"
 *               remetente:
 *                 type: object
 *                 properties:
 *                   documento:
 *                     type: string
 *                     example: "98765432000188"
 *                   nome:
 *                     type: string
 *                     example: "Empresa Remetente"
 *                   endereco:
 *                     type: object
 *                     properties:
 *                       cep:
 *                         type: string
 *                         example: "01001000"
 *                       logradouro:
 *                         type: string
 *                         example: "Rua Origem"
 *                       numero:
 *                         type: string
 *                         example: "100"
 *                       bairro:
 *                         type: string
 *                         example: "Centro"
 *                       cidade:
 *                         type: string
 *                         example: "São Paulo"
 *                       uf:
 *                         type: string
 *                         example: "SP"
 *               destinatario:
 *                 type: object
 *                 properties:
 *                   documento:
 *                     type: string
 *                     example: "11122233000144"
 *                   nome:
 *                     type: string
 *                     example: "Empresa Destinatária"
 *                   endereco:
 *                     type: object
 *                     properties:
 *                       cep:
 *                         type: string
 *                         example: "20040020"
 *                       logradouro:
 *                         type: string
 *                         example: "Rua Destino"
 *                       numero:
 *                         type: string
 *                         example: "200"
 *                       bairro:
 *                         type: string
 *                         example: "Centro"
 *                       cidade:
 *                         type: string
 *                         example: "Rio de Janeiro"
 *                       uf:
 *                         type: string
 *                         example: "RJ"
 *               informacoesTransporte:
 *                 type: object
 *                 properties:
 *                   modal:
 *                     type: string
 *                     enum: ["01", "02", "03", "04", "05", "06"]
 *                     example: "01"
 *                     description: "01-Rodoviário, 02-Aéreo, 03-Aquaviário, 04-Ferroviário, 05-Dutoviário, 06-Multimodal"
 *                   tipoServico:
 *                     type: string
 *                     enum: ["0", "1", "2", "3", "4"]
 *                     example: "0"
 *                     description: "0-Normal, 1-Subcontratação, 2-Redespacho, 3-Redespacho Intermediário, 4-Serviço Vinculado a Multimodal"
 *                   retira:
 *                     type: string
 *                     enum: ["0", "1"]
 *                     example: "0"
 *                     description: "0-Remetente, 1-Destinatário"
 *                   indIEToma:
 *                     type: string
 *                     enum: ["1", "2", "9"]
 *                     example: "1"
 *                     description: "1-Contribuinte ICMS, 2-Contribuinte isento, 9-Não contribuinte"
 *               valores:
 *                 type: object
 *                 properties:
 *                   valorServico:
 *                     type: number
 *                     example: 150.00
 *                   valorReceber:
 *                     type: number
 *                     example: 150.00
 *                   cst:
 *                     type: string
 *                     example: "00"
 *                   aliquotaICMS:
 *                     type: number
 *                     example: 12.00
 *                   valorICMS:
 *                     type: number
 *                     example: 18.00
 *               carga:
 *                 type: object
 *                 properties:
 *                   valorTotal:
 *                     type: number
 *                     example: 1000.00
 *                   produto:
 *                     type: string
 *                     example: "Mercadorias Diversas"
 *                   pesoTotal:
 *                     type: number
 *                     example: 100.5
 *                   unidadeMedida:
 *                     type: string
 *                     enum: ["00", "01", "02"]
 *                     example: "01"
 *                     description: "00-M3, 01-KG, 02-TON"
 *               documentosOriginarios:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     tipoDocumento:
 *                       type: string
 *                       enum: ["00", "01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "99"]
 *                       example: "00"
 *                       description: "00-Declaração, 01-Dutoviário, 02-Rodoviário, 03-Aquaviário, 04-Ferroviário, 05-Aéreo, 06-Entrada/Importação, 07-Passagem, 08-Intermediário, 09-Subcontratação, 10-Redespacho, 99-Outros"
 *                     chave:
 *                       type: string
 *                       example: "35200714200166000187550010000000271023456789"
 *                     valor:
 *                       type: number
 *                       example: 1000.00
 *               observacoes:
 *                 type: string
 *                 example: "Transporte de mercadorias diversas"
 *     responses:
 *       200:
 *         description: CTe emitido com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sucesso:
 *                   type: boolean
 *                   example: true
 *                 chave:
 *                   type: string
 *                   example: "35200714200166000187570010000000011023456789"
 *                 numero:
 *                   type: integer
 *                   example: 1
 *                 protocolo:
 *                   type: string
 *                   example: "135200000000001"
 *                 dataAutorizacao:
 *                   type: string
 *                   format: date-time
 */
router.post('/emitir', authMiddleware.verificarAutenticacao(), async (req, res) => {
  try {
    const dadosCte = req.body;
    
    // Validar dados de entrada
    const validacao = await validationService.validarDadosCte(dadosCte);
    if (!validacao.valido) {
      return res.status(400).json({
        sucesso: false,
        erro: 'Dados inválidos',
        detalhes: validacao.erros
      });
    }

    // Validar prazos específicos do CTe
    const validacaoPrazos = await cteService.validarPrazos(dadosCte);
    if (!validacaoPrazos.valido) {
      return res.status(400).json({
        sucesso: false,
        erro: 'Prazos inválidos',
        detalhes: validacaoPrazos.erros
      });
    }
    
    // Emitir CTe
    const resultado = await cteService.emitirCte(dadosCte, req.user);
    
    res.json({
      sucesso: true,
      ...resultado
    });
    
  } catch (error) {
    console.error('Erro ao emitir CTe:', error);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro interno do servidor',
      detalhes: error.message
    });
  }
});

/**
 * @swagger
 * /api/cte/consultar/{chave}:
 *   get:
 *     summary: Consultar CTe por chave de acesso
 *     tags: [CTe]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chave
 *         required: true
 *         schema:
 *           type: string
 *         description: Chave de acesso do CTe
 *     responses:
 *       200:
 *         description: CTe encontrado
 *       404:
 *         description: CTe não encontrado
 */
router.get('/consultar/:chave', authMiddleware.verificarAutenticacao(), async (req, res) => {
  try {
    const { chave } = req.params;
    
    const cte = await cteService.consultarCte(chave, req.user);
    
    if (!cte) {
      return res.status(404).json({
        sucesso: false,
        erro: 'CTe não encontrado'
      });
    }
    
    res.json({
      sucesso: true,
      cte
    });
    
  } catch (error) {
    console.error('Erro ao consultar CTe:', error);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro interno do servidor',
      detalhes: error.message
    });
  }
});

/**
 * @swagger
 * /api/cte/historico:
 *   get:
 *     summary: Listar histórico de CTes
 *     tags: [CTe]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Itens por página
 *       - in: query
 *         name: dataInicio
 *         schema:
 *           type: string
 *           format: date
 *         description: Data início (YYYY-MM-DD)
 *       - in: query
 *         name: dataFim
 *         schema:
 *           type: string
 *           format: date
 *         description: Data fim (YYYY-MM-DD)
 *       - in: query
 *         name: situacao
 *         schema:
 *           type: string
 *           enum: ["autorizado", "cancelado", "rejeitado", "pendente"]
 *         description: Filtrar por situação
 *     responses:
 *       200:
 *         description: Lista de CTes
 */
router.get('/historico', authMiddleware.verificarAutenticacao(), async (req, res) => {
  try {
    const filtros = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
      dataInicio: req.query.dataInicio,
      dataFim: req.query.dataFim,
      situacao: req.query.situacao
    };
    
    const resultado = await cteService.listarCtes(filtros, req.user);
    
    res.json({
      sucesso: true,
      ...resultado
    });
    
  } catch (error) {
    console.error('Erro ao listar CTes:', error);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro interno do servidor',
      detalhes: error.message
    });
  }
});

/**
 * @swagger
 * /api/cte/validar-vinculos:
 *   post:
 *     summary: Validar vínculos com MDFe
 *     tags: [CTe]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               chavesCte:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["35200714200166000187570010000000011023456789"]
 *               chaveMdfe:
 *                 type: string
 *                 example: "35200714200166000187580010000000011023456789"
 *     responses:
 *       200:
 *         description: Validação de vínculos realizada
 */
router.post('/validar-vinculos', authMiddleware.verificarAutenticacao(), async (req, res) => {
  try {
    const { chavesCte, chaveMdfe } = req.body;
    
    const validacao = await cteService.validarVinculos(chavesCte, chaveMdfe, req.user);
    
    res.json({
      sucesso: true,
      validacao
    });
    
  } catch (error) {
    console.error('Erro ao validar vínculos:', error);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro interno do servidor',
      detalhes: error.message
    });
  }
});

/**
 * @swagger
 * /api/cte/calcular-frete:
 *   post:
 *     summary: Calcular valor do frete
 *     tags: [CTe]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               origem:
 *                 type: object
 *                 properties:
 *                   cep:
 *                     type: string
 *                     example: "01001000"
 *                   uf:
 *                     type: string
 *                     example: "SP"
 *               destino:
 *                 type: object
 *                 properties:
 *                   cep:
 *                     type: string
 *                     example: "20040020"
 *                   uf:
 *                     type: string
 *                     example: "RJ"
 *               peso:
 *                 type: number
 *                 example: 100.5
 *               valor:
 *                 type: number
 *                 example: 1000.00
 *               modal:
 *                 type: string
 *                 enum: ["01", "02", "03", "04", "05", "06"]
 *                 example: "01"
 *     responses:
 *       200:
 *         description: Cálculo de frete realizado
 */
router.post('/calcular-frete', authMiddleware.verificarAutenticacao(), async (req, res) => {
  try {
    const dadosCalculo = req.body;
    
    const calculo = await cteService.calcularFrete(dadosCalculo);
    
    res.json({
      sucesso: true,
      calculo
    });
    
  } catch (error) {
    console.error('Erro ao calcular frete:', error);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro interno do servidor',
      detalhes: error.message
    });
  }
});

module.exports = router;