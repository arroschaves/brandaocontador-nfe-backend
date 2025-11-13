const express = require("express");
const router = express.Router();
const nfeService = require("../services/nfe-service");
const {
  TaxCalculationService,
} = require("../services/tax-calculation-service");
const validationService = require("../services/validation-service");
const XmlValidatorService = require("../services/xml-validator-service");
const authMiddleware = require("../middleware/auth");

const taxCalculationService = new TaxCalculationService();
const xmlValidatorService = new XmlValidatorService();

/**
 * @swagger
 * /api/nfe/emitir:
 *   post:
 *     summary: Emitir NFe com cálculos automáticos 2025/2026
 *     tags: [NFe]
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
 *                     example: "Empresa LTDA"
 *                   regimeTributario:
 *                     type: string
 *                     enum: ["simples_nacional", "lucro_presumido", "lucro_real", "substituicao_tributaria"]
 *                     example: "simples_nacional"
 *               destinatario:
 *                 type: object
 *                 properties:
 *                   documento:
 *                     type: string
 *                     example: "12345678901"
 *                   nome:
 *                     type: string
 *                     example: "João Silva"
 *                   endereco:
 *                     type: object
 *                     properties:
 *                       cep:
 *                         type: string
 *                         example: "01001000"
 *                       logradouro:
 *                         type: string
 *                         example: "Rua Exemplo"
 *                       numero:
 *                         type: string
 *                         example: "123"
 *                       bairro:
 *                         type: string
 *                         example: "Centro"
 *                       cidade:
 *                         type: string
 *                         example: "São Paulo"
 *                       uf:
 *                         type: string
 *                         example: "SP"
 *               itens:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     codigo:
 *                       type: string
 *                       example: "001"
 *                     descricao:
 *                       type: string
 *                       example: "Produto Exemplo"
 *                     ncm:
 *                       type: string
 *                       example: "12345678"
 *                     cfop:
 *                       type: string
 *                       example: "5102"
 *                     quantidade:
 *                       type: number
 *                       example: 1
 *                     valorUnitario:
 *                       type: number
 *                       example: 100.00
 *                     gtin:
 *                       type: string
 *                       example: "7891234567890"
 *                       description: "GTIN obrigatório para 2025/2026"
 *                     campos2026:
 *                       type: object
 *                       properties:
 *                         ibs:
 *                           type: number
 *                           example: 12.0
 *                           description: "Alíquota IBS (facultativo 2025, obrigatório 2026)"
 *                         cbs:
 *                           type: number
 *                           example: 9.25
 *                           description: "Alíquota CBS (facultativo 2025, obrigatório 2026)"
 *                         is:
 *                           type: number
 *                           example: 5.0
 *                           description: "Alíquota IS (facultativo 2025, obrigatório 2026)"
 *     responses:
 *       200:
 *         description: NFe emitida com sucesso
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
 *                   example: "35200714200166000187550010000000271023456789"
 *                 numero:
 *                   type: integer
 *                   example: 27
 *                 protocolo:
 *                   type: string
 *                   example: "135200000000027"
 *                 dataAutorizacao:
 *                   type: string
 *                   format: date-time
 *                 calculosRealizados:
 *                   type: object
 *                   properties:
 *                     regime:
 *                       type: string
 *                       example: "simples_nacional"
 *                     totalTributos:
 *                       type: number
 *                       example: 15.50
 *                     observacoesLegais:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["Documento emitido por ME ou EPP optante pelo Simples Nacional"]
 *                     campos2026:
 *                       type: object
 *                       properties:
 *                         totalIBS:
 *                           type: number
 *                           example: 12.00
 *                         totalCBS:
 *                           type: number
 *                           example: 9.25
 *                         totalIS:
 *                           type: number
 *                           example: 5.00
 */
router.post(
  "/emitir",
  authMiddleware.verificarAutenticacao(),
  async (req, res) => {
    try {
      const dadosNfe = req.body;

      // Validar dados de entrada
      try {
        xmlValidatorService.validarDadosNfe(dadosNfe);
      } catch (error) {
        return res.status(400).json({
          sucesso: false,
          erro: "Dados inválidos",
          detalhes: error.message,
        });
      }

      // Calcular impostos automaticamente baseado no regime tributário
      const calculosImpostos = taxCalculationService.calcularImpostosCompleto(
        dadosNfe.itens[0] || {},
        {
          regimeTributario:
            dadosNfe.emitente?.regimeTributario || "simplesNacional",
        },
      );

      // Aplicar cálculos aos dados da NFe
      dadosNfe.calculosRealizados = calculosImpostos;

      // Emitir NFe
      const resultado = await nfeService.emitirNfe(dadosNfe, req.user);

      res.json({
        sucesso: true,
        ...resultado,
        calculosRealizados: calculosImpostos,
      });
    } catch (error) {
      console.error("Erro ao emitir NFe:", error);
      res.status(500).json({
        sucesso: false,
        erro: "Erro interno do servidor",
        detalhes: error.message,
      });
    }
  },
);

/**
 * @swagger
 * /api/nfe/consultar/{chave}:
 *   get:
 *     summary: Consultar NFe por chave de acesso
 *     tags: [NFe]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chave
 *         required: true
 *         schema:
 *           type: string
 *         description: Chave de acesso da NFe
 *     responses:
 *       200:
 *         description: NFe encontrada
 *       404:
 *         description: NFe não encontrada
 */
router.get(
  "/consultar/:chave",
  authMiddleware.verificarAutenticacao(),
  async (req, res) => {
    try {
      const { chave } = req.params;

      const nfe = await nfeService.consultarNfe(chave, req.user);

      if (!nfe) {
        return res.status(404).json({
          sucesso: false,
          erro: "NFe não encontrada",
        });
      }

      res.json({
        sucesso: true,
        nfe,
      });
    } catch (error) {
      console.error("Erro ao consultar NFe:", error);
      res.status(500).json({
        sucesso: false,
        erro: "Erro interno do servidor",
        detalhes: error.message,
      });
    }
  },
);

/**
 * @swagger
 * /api/nfe/historico:
 *   get:
 *     summary: Listar histórico de NFes
 *     tags: [NFe]
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
 *           enum: ["autorizada", "cancelada", "rejeitada", "pendente"]
 *         description: Filtrar por situação
 *     responses:
 *       200:
 *         description: Lista de NFes
 */
router.get(
  "/historico",
  authMiddleware.verificarAutenticacao(),
  async (req, res) => {
    try {
      const filtros = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20,
        dataInicio: req.query.dataInicio,
        dataFim: req.query.dataFim,
        situacao: req.query.situacao,
      };

      const resultado = await nfeService.listarNfes(filtros, req.user);

      res.json({
        sucesso: true,
        ...resultado,
      });
    } catch (error) {
      console.error("Erro ao listar NFes:", error);
      res.status(500).json({
        sucesso: false,
        erro: "Erro interno do servidor",
        detalhes: error.message,
      });
    }
  },
);

/**
 * @swagger
 * /api/nfe/calcular-impostos:
 *   post:
 *     summary: Calcular impostos sem emitir NFe (preview)
 *     tags: [NFe]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               regimeTributario:
 *                 type: string
 *                 enum: ["simples_nacional", "lucro_presumido", "lucro_real", "substituicao_tributaria"]
 *               itens:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     valorUnitario:
 *                       type: number
 *                     quantidade:
 *                       type: number
 *                     ncm:
 *                       type: string
 *                     cfop:
 *                       type: string
 *     responses:
 *       200:
 *         description: Cálculos realizados
 */
router.post(
  "/calcular-impostos",
  authMiddleware.verificarAutenticacao(),
  async (req, res) => {
    try {
      const dadosCalculo = req.body;

      const calculos =
        await taxCalculationService.calcularImpostos(dadosCalculo);

      res.json({
        sucesso: true,
        calculos,
      });
    } catch (error) {
      console.error("Erro ao calcular impostos:", error);
      res.status(500).json({
        sucesso: false,
        erro: "Erro interno do servidor",
        detalhes: error.message,
      });
    }
  },
);

/**
 * @swagger
 * /api/nfe/validar-dados:
 *   post:
 *     summary: Validar dados NFe antes da emissão
 *     tags: [NFe]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Validação realizada
 */
router.post(
  "/validar-dados",
  authMiddleware.verificarAutenticacao(),
  async (req, res) => {
    try {
      const dadosNfe = req.body;

      const validacao = await validationService.validarDadosNfe(dadosNfe);

      res.json({
        sucesso: true,
        validacao,
      });
    } catch (error) {
      console.error("Erro ao validar dados:", error);
      res.status(500).json({
        sucesso: false,
        erro: "Erro interno do servidor",
        detalhes: error.message,
      });
    }
  },
);

/**
 * @swagger
 * /api/nfe/status:
 *   get:
 *     summary: Obter status geral das NFes do usuário
 *     tags: [NFe]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Status das NFes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sucesso:
 *                   type: boolean
 *                   example: true
 *                 dados:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                       example: 150
 *                     autorizadas:
 *                       type: integer
 *                       example: 140
 *                     canceladas:
 *                       type: integer
 *                       example: 5
 *                     rejeitadas:
 *                       type: integer
 *                       example: 3
 *                     pendentes:
 *                       type: integer
 *                       example: 2
 *                     ultimasNfes:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           chave:
 *                             type: string
 *                           numero:
 *                             type: integer
 *                           dataEmissao:
 *                             type: string
 *                             format: date-time
 *                           situacao:
 *                             type: string
 *                           valorTotal:
 *                             type: number
 *                     valorTotalMes:
 *                       type: number
 *                       example: 25000.50
 *       401:
 *         description: Token inválido ou expirado
 *       500:
 *         description: Erro interno do servidor
 */
router.get(
  "/status",
  authMiddleware.verificarAutenticacao(),
  async (req, res) => {
    try {
      const advancedLogger = req.app.get("advancedLogger");

      // Log da requisição
      advancedLogger.logInfo("nfe", "Solicitação de status das NFes", req, {
        userId: req.user.id,
      });

      // Obter estatísticas das NFes do usuário
      const status = await nfeService.obterStatusNfes(req.user);

      advancedLogger.logInfo(
        "nfe",
        "Status das NFes retornado com sucesso",
        req,
        {
          userId: req.user.id,
          totalNfes: status.total,
        },
      );

      res.json({
        sucesso: true,
        dados: status,
      });
    } catch (error) {
      const advancedLogger = req.app.get("advancedLogger");
      advancedLogger.logError(
        "nfe",
        "Erro ao obter status das NFes",
        req,
        error,
        {
          userId: req.user?.id,
        },
      );

      res.status(500).json({
        sucesso: false,
        erro: "Erro interno do servidor",
        codigo: "INTERNAL_ERROR",
      });
    }
  },
);

module.exports = router;
