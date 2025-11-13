const express = require("express");
const router = express.Router();
const mdfeService = require("../services/mdfe-service");
const validationService = require("../services/validation-service");
const authMiddleware = require("../middleware/auth");

/**
 * @swagger
 * /api/mdfe/emitir:
 *   post:
 *     summary: Emitir MDFe (Manifesto Eletrônico de Documentos Fiscais)
 *     tags: [MDFe]
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
 *               informacoesViagem:
 *                 type: object
 *                 properties:
 *                   ufInicio:
 *                     type: string
 *                     example: "SP"
 *                   ufFim:
 *                     type: string
 *                     example: "RJ"
 *                   municipioInicio:
 *                     type: string
 *                     example: "São Paulo"
 *                   municipioFim:
 *                     type: string
 *                     example: "Rio de Janeiro"
 *                   dhInicioViagem:
 *                     type: string
 *                     format: date-time
 *                     example: "2024-01-15T08:00:00.000Z"
 *                   dhFimViagem:
 *                     type: string
 *                     format: date-time
 *                     example: "2024-01-15T18:00:00.000Z"
 *               veiculo:
 *                 type: object
 *                 properties:
 *                   placa:
 *                     type: string
 *                     example: "ABC1234"
 *                   renavam:
 *                     type: string
 *                     example: "123456789"
 *                   tara:
 *                     type: number
 *                     example: 5000
 *                   capacidadeKG:
 *                     type: number
 *                     example: 15000
 *                   capacidadeM3:
 *                     type: number
 *                     example: 50
 *                   tipoRodado:
 *                     type: string
 *                     enum: ["01", "02", "03", "04", "05", "06"]
 *                     example: "01"
 *                     description: "01-Truck, 02-Toco, 03-Cavalo Mecânico, 04-VAN, 05-Utilitário, 06-Outros"
 *                   tipoCarroceria:
 *                     type: string
 *                     enum: ["00", "01", "02", "03", "04", "05"]
 *                     example: "00"
 *                     description: "00-Não aplicável, 01-Aberta, 02-Fechada/Baú, 03-Granelera, 04-Porta Container, 05-Sider"
 *               condutor:
 *                 type: object
 *                 properties:
 *                   nome:
 *                     type: string
 *                     example: "João Motorista"
 *                   cpf:
 *                     type: string
 *                     example: "12345678901"
 *                   cnh:
 *                     type: string
 *                     example: "12345678901"
 *               documentosTransportados:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     tipoDocumento:
 *                       type: string
 *                       enum: ["01", "02", "03", "04"]
 *                       example: "01"
 *                       description: "01-CTe, 02-NFe, 03-Outros, 04-NF modelo 1/1A"
 *                     chave:
 *                       type: string
 *                       example: "35200714200166000187570010000000011023456789"
 *                     municipioCarregamento:
 *                       type: string
 *                       example: "São Paulo"
 *                     municipioDescarregamento:
 *                       type: string
 *                       example: "Rio de Janeiro"
 *               percurso:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     uf:
 *                       type: string
 *                       example: "SP"
 *               totais:
 *                 type: object
 *                 properties:
 *                   quantidadeCTe:
 *                     type: integer
 *                     example: 5
 *                   quantidadeNFe:
 *                     type: integer
 *                     example: 10
 *                   quantidadeMDFe:
 *                     type: integer
 *                     example: 1
 *                   valorTotalCarga:
 *                     type: number
 *                     example: 50000.00
 *                   pesoTotalCarga:
 *                     type: number
 *                     example: 10000.5
 *                   quantidadeTotalCarga:
 *                     type: number
 *                     example: 100
 *               observacoes:
 *                 type: string
 *                 example: "Transporte de cargas diversas"
 *     responses:
 *       200:
 *         description: MDFe emitido com sucesso
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
 *                   example: "35200714200166000187580010000000011023456789"
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
router.post(
  "/emitir",
  authMiddleware.verificarAutenticacao(),
  async (req, res) => {
    try {
      const dadosMdfe = req.body;

      // Validar dados de entrada
      const validacao = await validationService.validarDadosMdfe(dadosMdfe);
      if (!validacao.valido) {
        return res.status(400).json({
          sucesso: false,
          erro: "Dados inválidos",
          detalhes: validacao.erros,
        });
      }

      // Validar documentos vinculados
      const validacaoDocumentos = await mdfeService.validarDocumentosVinculados(
        dadosMdfe.documentosTransportados,
      );
      if (!validacaoDocumentos.valido) {
        return res.status(400).json({
          sucesso: false,
          erro: "Documentos vinculados inválidos",
          detalhes: validacaoDocumentos.erros,
        });
      }

      // Emitir MDFe
      const resultado = await mdfeService.emitirMdfe(dadosMdfe, req.user);

      res.json({
        sucesso: true,
        ...resultado,
      });
    } catch (error) {
      console.error("Erro ao emitir MDFe:", error);
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
 * /api/mdfe/consultar/{chave}:
 *   get:
 *     summary: Consultar MDFe por chave de acesso
 *     tags: [MDFe]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chave
 *         required: true
 *         schema:
 *           type: string
 *         description: Chave de acesso do MDFe
 *     responses:
 *       200:
 *         description: MDFe encontrado
 *       404:
 *         description: MDFe não encontrado
 */
router.get(
  "/consultar/:chave",
  authMiddleware.verificarAutenticacao(),
  async (req, res) => {
    try {
      const { chave } = req.params;

      const mdfe = await mdfeService.consultarMdfe(chave, req.user);

      if (!mdfe) {
        return res.status(404).json({
          sucesso: false,
          erro: "MDFe não encontrado",
        });
      }

      res.json({
        sucesso: true,
        mdfe,
      });
    } catch (error) {
      console.error("Erro ao consultar MDFe:", error);
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
 * /api/mdfe/historico:
 *   get:
 *     summary: Listar histórico de MDFes
 *     tags: [MDFe]
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
 *           enum: ["autorizado", "cancelado", "rejeitado", "pendente", "encerrado"]
 *         description: Filtrar por situação
 *     responses:
 *       200:
 *         description: Lista de MDFes
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

      const resultado = await mdfeService.listarMdfes(filtros, req.user);

      res.json({
        sucesso: true,
        ...resultado,
      });
    } catch (error) {
      console.error("Erro ao listar MDFes:", error);
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
 * /api/mdfe/encerrar:
 *   post:
 *     summary: Encerrar MDFe
 *     tags: [MDFe]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               chave:
 *                 type: string
 *                 example: "35200714200166000187580010000000011023456789"
 *               protocolo:
 *                 type: string
 *                 example: "135200000000001"
 *               municipioEncerramento:
 *                 type: string
 *                 example: "Rio de Janeiro"
 *               ufEncerramento:
 *                 type: string
 *                 example: "RJ"
 *               dataEncerramento:
 *                 type: string
 *                 format: date-time
 *                 example: "2024-01-15T18:00:00.000Z"
 *     responses:
 *       200:
 *         description: MDFe encerrado com sucesso
 */
router.post(
  "/encerrar",
  authMiddleware.verificarAutenticacao(),
  async (req, res) => {
    try {
      const dadosEncerramento = req.body;

      // Validar dados de encerramento
      const validacao =
        await validationService.validarDadosEncerramentoMdfe(dadosEncerramento);
      if (!validacao.valido) {
        return res.status(400).json({
          sucesso: false,
          erro: "Dados de encerramento inválidos",
          detalhes: validacao.erros,
        });
      }

      const resultado = await mdfeService.encerrarMdfe(
        dadosEncerramento,
        req.user,
      );

      res.json({
        sucesso: true,
        ...resultado,
      });
    } catch (error) {
      console.error("Erro ao encerrar MDFe:", error);
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
 * /api/mdfe/incluir-condutor:
 *   post:
 *     summary: Incluir condutor no MDFe
 *     tags: [MDFe]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               chave:
 *                 type: string
 *                 example: "35200714200166000187580010000000011023456789"
 *               condutor:
 *                 type: object
 *                 properties:
 *                   nome:
 *                     type: string
 *                     example: "Maria Motorista"
 *                   cpf:
 *                     type: string
 *                     example: "98765432100"
 *                   cnh:
 *                     type: string
 *                     example: "98765432100"
 *     responses:
 *       200:
 *         description: Condutor incluído com sucesso
 */
router.post(
  "/incluir-condutor",
  authMiddleware.verificarAutenticacao(),
  async (req, res) => {
    try {
      const { chave, condutor } = req.body;

      // Validar dados do condutor
      const validacao = await validationService.validarDadosCondutor(condutor);
      if (!validacao.valido) {
        return res.status(400).json({
          sucesso: false,
          erro: "Dados do condutor inválidos",
          detalhes: validacao.erros,
        });
      }

      const resultado = await mdfeService.incluirCondutor(
        chave,
        condutor,
        req.user,
      );

      res.json({
        sucesso: true,
        ...resultado,
      });
    } catch (error) {
      console.error("Erro ao incluir condutor:", error);
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
 * /api/mdfe/incluir-dfes:
 *   post:
 *     summary: Incluir DFes no MDFe
 *     tags: [MDFe]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               chave:
 *                 type: string
 *                 example: "35200714200166000187580010000000011023456789"
 *               documentos:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     tipoDocumento:
 *                       type: string
 *                       enum: ["01", "02", "03", "04"]
 *                       example: "01"
 *                     chave:
 *                       type: string
 *                       example: "35200714200166000187570010000000011023456789"
 *                     municipioCarregamento:
 *                       type: string
 *                       example: "São Paulo"
 *                     municipioDescarregamento:
 *                       type: string
 *                       example: "Rio de Janeiro"
 *     responses:
 *       200:
 *         description: DFes incluídos com sucesso
 */
router.post(
  "/incluir-dfes",
  authMiddleware.verificarAutenticacao(),
  async (req, res) => {
    try {
      const { chave, documentos } = req.body;

      // Validar documentos
      const validacao =
        await mdfeService.validarDocumentosVinculados(documentos);
      if (!validacao.valido) {
        return res.status(400).json({
          sucesso: false,
          erro: "Documentos inválidos",
          detalhes: validacao.erros,
        });
      }

      const resultado = await mdfeService.incluirDfes(
        chave,
        documentos,
        req.user,
      );

      res.json({
        sucesso: true,
        ...resultado,
      });
    } catch (error) {
      console.error("Erro ao incluir DFes:", error);
      res.status(500).json({
        sucesso: false,
        erro: "Erro interno do servidor",
        detalhes: error.message,
      });
    }
  },
);

module.exports = router;
