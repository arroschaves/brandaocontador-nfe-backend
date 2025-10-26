const express = require('express');
const router = express.Router();
const eventosService = require('../services/eventos-service');
const validationService = require('../services/validation-service');
const authMiddleware = require('../middleware/auth');

/**
 * @swagger
 * /api/eventos/cancelar-nfe:
 *   post:
 *     summary: Cancelar NFe com validação de prazos por UF
 *     tags: [Eventos]
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
 *                 example: "35200714200166000187550010000000271023456789"
 *               protocolo:
 *                 type: string
 *                 example: "135200000000027"
 *               justificativa:
 *                 type: string
 *                 minLength: 15
 *                 maxLength: 255
 *                 example: "Cancelamento solicitado pelo cliente devido a erro na emissão"
 *               uf:
 *                 type: string
 *                 example: "SP"
 *                 description: "UF para validação de prazo específico"
 *     responses:
 *       200:
 *         description: NFe cancelada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sucesso:
 *                   type: boolean
 *                   example: true
 *                 protocolo:
 *                   type: string
 *                   example: "135200000000028"
 *                 dataEvento:
 *                   type: string
 *                   format: date-time
 *                 prazoValidado:
 *                   type: object
 *                   properties:
 *                     uf:
 *                       type: string
 *                       example: "SP"
 *                     prazoHoras:
 *                       type: integer
 *                       example: 24
 *                     dentroDoprazo:
 *                       type: boolean
 *                       example: true
 *       400:
 *         description: Prazo para cancelamento expirado ou dados inválidos
 */
router.post('/cancelar-nfe', authMiddleware.verificarAutenticacao(), async (req, res) => {
  try {
    const { chave, protocolo, justificativa, uf } = req.body;
    
    // Validar dados de entrada
    const validacao = await validationService.validarDadosCancelamento({
      chave,
      protocolo,
      justificativa,
      uf
    });
    
    if (!validacao.valido) {
      return res.status(400).json({
        sucesso: false,
        erro: 'Dados inválidos',
        detalhes: validacao.erros
      });
    }

    // Validar prazo de cancelamento por UF
    const validacaoPrazo = await eventosService.validarPrazoCancelamento(chave, uf);
    if (!validacaoPrazo.dentroDoprazo) {
      return res.status(400).json({
        sucesso: false,
        erro: 'Prazo para cancelamento expirado',
        detalhes: {
          uf,
          prazoHoras: validacaoPrazo.prazoHoras,
          horasDecorridas: validacaoPrazo.horasDecorridas,
          dataLimite: validacaoPrazo.dataLimite
        }
      });
    }
    
    // Cancelar NFe
    const resultado = await eventosService.cancelarNfe({
      chave,
      protocolo,
      justificativa,
      uf
    }, req.user);
    
    res.json({
      sucesso: true,
      ...resultado,
      prazoValidado: validacaoPrazo
    });
    
  } catch (error) {
    console.error('Erro ao cancelar NFe:', error);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro interno do servidor',
      detalhes: error.message
    });
  }
});

/**
 * @swagger
 * /api/eventos/carta-correcao:
 *   post:
 *     summary: Emitir Carta de Correção Eletrônica (CCe)
 *     tags: [Eventos]
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
 *                 example: "35200714200166000187550010000000271023456789"
 *               sequencia:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 20
 *                 example: 1
 *                 description: "Sequência da CCe (1-20)"
 *               correcao:
 *                 type: string
 *                 minLength: 15
 *                 maxLength: 1000
 *                 example: "Correção do endereço do destinatário: Rua Corrigida, 456, Bairro Novo"
 *               camposPermitidos:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: ["endereco", "telefone", "email", "observacoes"]
 *                 example: ["endereco"]
 *                 description: "Campos que podem ser corrigidos"
 *     responses:
 *       200:
 *         description: CCe emitida com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sucesso:
 *                   type: boolean
 *                   example: true
 *                 protocolo:
 *                   type: string
 *                   example: "135200000000029"
 *                 sequencia:
 *                   type: integer
 *                   example: 1
 *                 dataEvento:
 *                   type: string
 *                   format: date-time
 *                 validacaoCampos:
 *                   type: object
 *                   properties:
 *                     camposPermitidos:
 *                       type: array
 *                       items:
 *                         type: string
 *                     camposBloqueados:
 *                       type: array
 *                       items:
 *                         type: string
 *       400:
 *         description: Campos não permitidos para correção ou dados inválidos
 */
router.post('/carta-correcao', authMiddleware.verificarAutenticacao(), async (req, res) => {
  try {
    const { chave, sequencia, correcao, camposPermitidos } = req.body;
    
    // Validar dados de entrada
    const validacao = await validationService.validarDadosCartaCorrecao({
      chave,
      sequencia,
      correcao,
      camposPermitidos
    });
    
    if (!validacao.valido) {
      return res.status(400).json({
        sucesso: false,
        erro: 'Dados inválidos',
        detalhes: validacao.erros
      });
    }

    // Validar campos permitidos para correção
    const validacaoCampos = await eventosService.validarCamposCorrecao(camposPermitidos);
    if (!validacaoCampos.valido) {
      return res.status(400).json({
        sucesso: false,
        erro: 'Campos não permitidos para correção',
        detalhes: validacaoCampos
      });
    }
    
    // Emitir CCe
    const resultado = await eventosService.emitirCartaCorrecao({
      chave,
      sequencia,
      correcao,
      camposPermitidos
    }, req.user);
    
    res.json({
      sucesso: true,
      ...resultado,
      validacaoCampos
    });
    
  } catch (error) {
    console.error('Erro ao emitir CCe:', error);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro interno do servidor',
      detalhes: error.message
    });
  }
});

/**
 * @swagger
 * /api/eventos/devolucao:
 *   post:
 *     summary: Processar devolução de NFe
 *     tags: [Eventos]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               chaveOriginal:
 *                 type: string
 *                 example: "35200714200166000187550010000000271023456789"
 *               tipoDevolucao:
 *                 type: string
 *                 enum: ["total", "parcial"]
 *                 example: "total"
 *               motivoDevolucao:
 *                 type: string
 *                 example: "Produto com defeito"
 *               itensDevolvidos:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     codigo:
 *                       type: string
 *                       example: "001"
 *                     quantidade:
 *                       type: number
 *                       example: 1
 *                     valor:
 *                       type: number
 *                       example: 100.00
 *               dadosNfeDevolucao:
 *                 type: object
 *                 properties:
 *                   naturezaOperacao:
 *                     type: string
 *                     example: "Devolução de venda"
 *                   cfop:
 *                     type: string
 *                     example: "1202"
 *     responses:
 *       200:
 *         description: Devolução processada com sucesso
 */
router.post('/devolucao', authMiddleware.verificarAutenticacao(), async (req, res) => {
  try {
    const dadosDevolucao = req.body;
    
    // Validar dados de devolução
    const validacao = await validationService.validarDadosDevolucao(dadosDevolucao);
    if (!validacao.valido) {
      return res.status(400).json({
        sucesso: false,
        erro: 'Dados inválidos',
        detalhes: validacao.erros
      });
    }

    // Processar devolução
    const resultado = await eventosService.processarDevolucao(dadosDevolucao, req.user);
    
    res.json({
      sucesso: true,
      ...resultado
    });
    
  } catch (error) {
    console.error('Erro ao processar devolução:', error);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro interno do servidor',
      detalhes: error.message
    });
  }
});

/**
 * @swagger
 * /api/eventos/estorno:
 *   post:
 *     summary: Processar estorno de NFe
 *     tags: [Eventos]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               chaveOriginal:
 *                 type: string
 *                 example: "35200714200166000187550010000000271023456789"
 *               tipoEstorno:
 *                 type: string
 *                 enum: ["total", "parcial"]
 *                 example: "total"
 *               motivoEstorno:
 *                 type: string
 *                 example: "Cancelamento da operação"
 *               valorEstorno:
 *                 type: number
 *                 example: 100.00
 *     responses:
 *       200:
 *         description: Estorno processado com sucesso
 */
router.post('/estorno', authMiddleware.verificarAutenticacao(), async (req, res) => {
  try {
    const dadosEstorno = req.body;
    
    // Validar dados de estorno
    const validacao = await validationService.validarDadosEstorno(dadosEstorno);
    if (!validacao.valido) {
      return res.status(400).json({
        sucesso: false,
        erro: 'Dados inválidos',
        detalhes: validacao.erros
      });
    }

    // Processar estorno
    const resultado = await eventosService.processarEstorno(dadosEstorno, req.user);
    
    res.json({
      sucesso: true,
      ...resultado
    });
    
  } catch (error) {
    console.error('Erro ao processar estorno:', error);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro interno do servidor',
      detalhes: error.message
    });
  }
});

/**
 * @swagger
 * /api/eventos/inutilizar:
 *   post:
 *     summary: Inutilizar numeração de NFe
 *     tags: [Eventos]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               cnpj:
 *                 type: string
 *                 example: "12345678000199"
 *               serie:
 *                 type: integer
 *                 example: 1
 *               numeroInicial:
 *                 type: integer
 *                 example: 100
 *               numeroFinal:
 *                 type: integer
 *                 example: 105
 *               ano:
 *                 type: integer
 *                 example: 2024
 *               modelo:
 *                 type: string
 *                 enum: ["55", "65"]
 *                 example: "55"
 *               justificativa:
 *                 type: string
 *                 minLength: 15
 *                 maxLength: 255
 *                 example: "Inutilização devido a erro na sequência de numeração"
 *     responses:
 *       200:
 *         description: Numeração inutilizada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sucesso:
 *                   type: boolean
 *                   example: true
 *                 protocolo:
 *                   type: string
 *                   example: "135200000000030"
 *                 dataEvento:
 *                   type: string
 *                   format: date-time
 *                 numerosInutilizados:
 *                   type: object
 *                   properties:
 *                     inicial:
 *                       type: integer
 *                       example: 100
 *                     final:
 *                       type: integer
 *                       example: 105
 *                     quantidade:
 *                       type: integer
 *                       example: 6
 */
router.post('/inutilizar', authMiddleware.verificarAutenticacao(), async (req, res) => {
  try {
    const dadosInutilizacao = req.body;
    
    // Validar dados de inutilização
    const validacao = await validationService.validarDadosInutilizacao(dadosInutilizacao);
    if (!validacao.valido) {
      return res.status(400).json({
        sucesso: false,
        erro: 'Dados inválidos',
        detalhes: validacao.erros
      });
    }

    // Validar sequência de numeração
    const validacaoSequencia = await eventosService.validarSequenciaNumeracao(dadosInutilizacao);
    if (!validacaoSequencia.valido) {
      return res.status(400).json({
        sucesso: false,
        erro: 'Sequência de numeração inválida',
        detalhes: validacaoSequencia.erros
      });
    }
    
    // Inutilizar numeração
    const resultado = await eventosService.inutilizarNumeracao(dadosInutilizacao, req.user);
    
    res.json({
      sucesso: true,
      ...resultado
    });
    
  } catch (error) {
    console.error('Erro ao inutilizar numeração:', error);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro interno do servidor',
      detalhes: error.message
    });
  }
});

/**
 * @swagger
 * /api/eventos/historico/{chave}:
 *   get:
 *     summary: Consultar histórico de eventos de uma NFe/CTe/MDFe
 *     tags: [Eventos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chave
 *         required: true
 *         schema:
 *           type: string
 *         description: Chave de acesso do documento
 *     responses:
 *       200:
 *         description: Histórico de eventos
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
 *                 eventos:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       tipoEvento:
 *                         type: string
 *                         example: "110111"
 *                       descricaoEvento:
 *                         type: string
 *                         example: "Cancelamento"
 *                       dataEvento:
 *                         type: string
 *                         format: date-time
 *                       protocolo:
 *                         type: string
 *                         example: "135200000000028"
 *                       justificativa:
 *                         type: string
 *                         example: "Cancelamento solicitado pelo cliente"
 *                       usuario:
 *                         type: string
 *                         example: "admin@brandaocontador.com.br"
 */
router.get('/historico/:chave', authMiddleware.verificarAutenticacao(), async (req, res) => {
  try {
    const { chave } = req.params;
    
    const historico = await eventosService.consultarHistoricoEventos(chave, req.user);
    
    res.json({
      sucesso: true,
      chave,
      eventos: historico
    });
    
  } catch (error) {
    console.error('Erro ao consultar histórico de eventos:', error);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro interno do servidor',
      detalhes: error.message
    });
  }
});

/**
 * @swagger
 * /api/eventos/prazos-uf:
 *   get:
 *     summary: Consultar prazos de cancelamento por UF
 *     tags: [Eventos]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Prazos por UF
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sucesso:
 *                   type: boolean
 *                   example: true
 *                 prazos:
 *                   type: object
 *                   additionalProperties:
 *                     type: object
 *                     properties:
 *                       uf:
 *                         type: string
 *                         example: "SP"
 *                       prazoHoras:
 *                         type: integer
 *                         example: 24
 *                       descricao:
 *                         type: string
 *                         example: "24 horas após autorização"
 */
router.get('/prazos-uf', authMiddleware.verificarAutenticacao(), async (req, res) => {
  try {
    const prazos = await eventosService.consultarPrazosUF();
    
    res.json({
      sucesso: true,
      prazos
    });
    
  } catch (error) {
    console.error('Erro ao consultar prazos por UF:', error);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro interno do servidor',
      detalhes: error.message
    });
  }
});

module.exports = router;