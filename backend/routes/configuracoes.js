/**
 * Rotas para Configurações Avançadas
 */

const express = require('express');
const router = express.Router();
const ConfiguracoesService = require('../services/configuracoes');
const authMiddleware = require('../middleware/auth');
const { body, query, validationResult } = require('express-validator');

const configService = new ConfiguracoesService();

/**
 * @swagger
 * components:
 *   schemas:
 *     ConfigEmpresa:
 *       type: object
 *       properties:
 *         razaoSocial:
 *           type: string
 *         nomeFantasia:
 *           type: string
 *         cnpj:
 *           type: string
 *         inscricaoEstadual:
 *           type: string
 *         regimeTributario:
 *           type: string
 *           enum: [simples_nacional, lucro_presumido, lucro_real]
 *         endereco:
 *           type: object
 *         contato:
 *           type: object
 *     
 *     ConfigBackup:
 *       type: object
 *       properties:
 *         automatico:
 *           type: object
 *           properties:
 *             ativo:
 *               type: boolean
 *             frequencia:
 *               type: string
 *               enum: [diario, semanal, mensal]
 *             horario:
 *               type: string
 *         manual:
 *           type: object
 */

/**
 * @swagger
 * /api/configuracoes/empresa:
 *   get:
 *     summary: Obter configurações da empresa
 *     tags: [Configurações]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Configurações obtidas com sucesso
 */
router.get('/empresa', 
  authMiddleware.verificarAutenticacao(),
  async (req, res) => {
    try {
      const configuracao = await configService.obterConfigEmpresa(req.usuario);

      res.json({
        sucesso: true,
        configuracao
      });

    } catch (error) {
      console.error('Erro ao obter configurações da empresa:', error);
      res.status(500).json({
        sucesso: false,
        erro: error.message
      });
    }
  }
);

/**
 * @swagger
 * /api/configuracoes/empresa:
 *   put:
 *     summary: Configurar dados da empresa
 *     tags: [Configurações]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ConfigEmpresa'
 *     responses:
 *       200:
 *         description: Empresa configurada com sucesso
 */
router.put('/empresa', 
  authMiddleware.verificarAutenticacao(),
  [
    body('razaoSocial').optional().isLength({ min: 3 }).withMessage('Razão social deve ter pelo menos 3 caracteres'),
    body('cnpj').optional().matches(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$|^\d{14}$/).withMessage('CNPJ inválido'),
    body('regimeTributario').optional().isIn(['simples_nacional', 'lucro_presumido', 'lucro_real']).withMessage('Regime tributário inválido'),
    body('endereco.cep').optional().matches(/^\d{5}-?\d{3}$/).withMessage('CEP inválido'),
    body('contato.email').optional().isEmail().withMessage('Email inválido')
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

      const resultado = await configService.configurarEmpresa(req.body, req.usuario);

      res.json(resultado);

    } catch (error) {
      console.error('Erro ao configurar empresa:', error);
      res.status(500).json({
        sucesso: false,
        erro: error.message
      });
    }
  }
);

/**
 * @swagger
 * /api/configuracoes/sefaz:
 *   get:
 *     summary: Obter parâmetros SEFAZ
 *     tags: [Configurações]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Parâmetros obtidos com sucesso
 */
router.get('/sefaz', 
  authMiddleware.verificarAutenticacao(),
  async (req, res) => {
    try {
      const configuracao = await configService.obterConfigSefaz(req.usuario);

      res.json({
        sucesso: true,
        configuracao
      });

    } catch (error) {
      console.error('Erro ao obter configurações SEFAZ:', error);
      res.status(500).json({
        sucesso: false,
        erro: error.message
      });
    }
  }
);

/**
 * @swagger
 * /api/configuracoes/sefaz:
 *   put:
 *     summary: Configurar parâmetros SEFAZ
 *     tags: [Configurações]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties:
 *               type: object
 *               properties:
 *                 timeout:
 *                   type: integer
 *                 tentativas:
 *                   type: integer
 *                 ambiente:
 *                   type: string
 *                   enum: [producao, homologacao]
 *     responses:
 *       200:
 *         description: Parâmetros configurados com sucesso
 */
router.put('/sefaz', 
  authMiddleware.verificarAutenticacao(),
  async (req, res) => {
    try {
      const resultado = await configService.configurarSefaz(req.body, req.usuario);

      res.json(resultado);

    } catch (error) {
      console.error('Erro ao configurar SEFAZ:', error);
      res.status(500).json({
        sucesso: false,
        erro: error.message
      });
    }
  }
);

/**
 * @swagger
 * /api/configuracoes/backup:
 *   get:
 *     summary: Obter configurações de backup
 *     tags: [Configurações]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Configurações obtidas com sucesso
 */
router.get('/backup', 
  authMiddleware.verificarAutenticacao(),
  async (req, res) => {
    try {
      const configuracao = await configService.obterConfigBackup(req.usuario);

      res.json({
        sucesso: true,
        configuracao
      });

    } catch (error) {
      console.error('Erro ao obter configurações de backup:', error);
      res.status(500).json({
        sucesso: false,
        erro: error.message
      });
    }
  }
);

/**
 * @swagger
 * /api/configuracoes/backup:
 *   put:
 *     summary: Configurar backup automático
 *     tags: [Configurações]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ConfigBackup'
 *     responses:
 *       200:
 *         description: Backup configurado com sucesso
 */
router.put('/backup', 
  authMiddleware.verificarAutenticacao(),
  [
    body('automatico.frequencia').optional().isIn(['diario', 'semanal', 'mensal']).withMessage('Frequência inválida'),
    body('automatico.horario').optional().matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Horário inválido'),
    body('automatico.retencao').optional().isInt({ min: 1, max: 365 }).withMessage('Retenção deve ser entre 1 e 365 dias')
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

      const resultado = await configService.configurarBackup(req.body, req.user);

      res.json(resultado);

    } catch (error) {
      console.error('Erro ao configurar backup:', error);
      res.status(500).json({
        sucesso: false,
        erro: error.message
      });
    }
  }
);

/**
 * @swagger
 * /api/configuracoes/backup/manual:
 *   post:
 *     summary: Realizar backup manual
 *     tags: [Configurações]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               incluirArquivos:
 *                 type: boolean
 *               incluirBanco:
 *                 type: boolean
 *               incluirLogs:
 *                 type: boolean
 *               compressao:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Backup realizado com sucesso
 */
router.post('/backup/manual', 
  authMiddleware.verificarAutenticacao(),
  [
    body('incluirArquivos').optional().isBoolean().withMessage('incluirArquivos deve ser boolean'),
    body('incluirBanco').optional().isBoolean().withMessage('incluirBanco deve ser boolean'),
    body('incluirLogs').optional().isBoolean().withMessage('incluirLogs deve ser boolean'),
    body('compressao').optional().isBoolean().withMessage('compressao deve ser boolean')
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

      const opcoes = {
        incluirArquivos: req.body.incluirArquivos ?? true,
        incluirBanco: req.body.incluirBanco ?? true,
        incluirLogs: req.body.incluirLogs ?? false,
        compressao: req.body.compressao ?? true
      };

      const resultado = await configService.realizarBackupManual(opcoes, req.user);

      res.json(resultado);

    } catch (error) {
      console.error('Erro ao realizar backup manual:', error);
      res.status(500).json({
        sucesso: false,
        erro: error.message
      });
    }
  }
);

/**
 * @swagger
 * /api/configuracoes/logs:
 *   get:
 *     summary: Obter configurações de logs
 *     tags: [Configurações]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Configurações obtidas com sucesso
 */
router.get('/logs', 
  authMiddleware.verificarAutenticacao(),
  async (req, res) => {
    try {
      const configuracao = await configService.obterConfigLogs(req.user);

      res.json({
        sucesso: true,
        configuracao
      });

    } catch (error) {
      console.error('Erro ao obter configurações de logs:', error);
      res.status(500).json({
        sucesso: false,
        erro: error.message
      });
    }
  }
);

/**
 * @swagger
 * /api/configuracoes/logs:
 *   put:
 *     summary: Configurar sistema de logs
 *     tags: [Configurações]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nivel:
 *                 type: string
 *                 enum: [error, warn, info, debug]
 *               arquivo:
 *                 type: object
 *               auditoria:
 *                 type: object
 *     responses:
 *       200:
 *         description: Logs configurados com sucesso
 */
router.put('/logs', 
  authMiddleware.verificarAutenticacao(),
  [
    body('nivel').optional().isIn(['error', 'warn', 'info', 'debug']).withMessage('Nível de log inválido'),
    body('arquivo.retencao').optional().isInt({ min: 1, max: 365 }).withMessage('Retenção deve ser entre 1 e 365 dias')
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

      const resultado = await configService.configurarLogs(req.body, req.user);

      res.json(resultado);

    } catch (error) {
      console.error('Erro ao configurar logs:', error);
      res.status(500).json({
        sucesso: false,
        erro: error.message
      });
    }
  }
);

/**
 * @swagger
 * /api/configuracoes/performance:
 *   get:
 *     summary: Obter configurações de performance
 *     tags: [Configurações]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Configurações obtidas com sucesso
 */
router.get('/performance', 
  authMiddleware.verificarAutenticacao(),
  async (req, res) => {
    try {
      const configuracao = await configService.obterConfigPerformance(req.user);

      res.json({
        sucesso: true,
        configuracao
      });

    } catch (error) {
      console.error('Erro ao obter configurações de performance:', error);
      res.status(500).json({
        sucesso: false,
        erro: error.message
      });
    }
  }
);

/**
 * @swagger
 * /api/configuracoes/performance:
 *   put:
 *     summary: Otimizar performance do sistema
 *     tags: [Configurações]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               cache:
 *                 type: object
 *               compressao:
 *                 type: object
 *               rateLimit:
 *                 type: object
 *               monitoramento:
 *                 type: object
 *     responses:
 *       200:
 *         description: Performance otimizada com sucesso
 */
router.put('/performance', 
  authMiddleware.verificarAutenticacao(),
  [
    body('cache.ttl').optional().isInt({ min: 60 }).withMessage('TTL do cache deve ser maior que 60 segundos'),
    body('compressao.nivel').optional().isInt({ min: 1, max: 9 }).withMessage('Nível de compressão deve ser entre 1 e 9'),
    body('rateLimit.maximo').optional().isInt({ min: 10 }).withMessage('Rate limit deve ser maior que 10')
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

      const resultado = await configService.otimizarPerformance(req.body, req.user);

      res.json(resultado);

    } catch (error) {
      console.error('Erro ao otimizar performance:', error);
      res.status(500).json({
        sucesso: false,
        erro: error.message
      });
    }
  }
);

/**
 * @swagger
 * /api/configuracoes/sistema/status:
 *   get:
 *     summary: Obter status do sistema
 *     tags: [Configurações]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Status obtido com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sucesso:
 *                   type: boolean
 *                 sistema:
 *                   type: object
 *                 servicos:
 *                   type: object
 */
router.get('/sistema/status', 
  authMiddleware.verificarAutenticacao(),
  async (req, res) => {
    try {
      const status = await configService.obterStatusSistema();

      res.json(status);

    } catch (error) {
      console.error('Erro ao obter status do sistema:', error);
      res.status(500).json({
        sucesso: false,
        erro: error.message
      });
    }
  }
);

/**
 * @swagger
 * /api/configuracoes/sistema/info:
 *   get:
 *     summary: Obter informações do sistema
 *     tags: [Configurações]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Informações obtidas com sucesso
 */
router.get('/sistema/info', 
  authMiddleware.verificarAutenticacao(),
  async (req, res) => {
    try {
      const package = require('../../package.json');
      
      const info = {
        sucesso: true,
        aplicacao: {
          nome: package.name,
          versao: package.version,
          descricao: package.description,
          autor: package.author
        },
        ambiente: process.env.NODE_ENV || 'development',
        node: process.version,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      };

      res.json(info);

    } catch (error) {
      console.error('Erro ao obter informações do sistema:', error);
      res.status(500).json({
        sucesso: false,
        erro: error.message
      });
    }
  }
);

/**
 * @swagger
 * /api/configuracoes/reset:
 *   post:
 *     summary: Resetar configurações para padrão
 *     tags: [Configurações]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tipo:
 *                 type: string
 *                 enum: [empresa, sefaz, backup, logs, performance, todos]
 *               confirmar:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Configurações resetadas com sucesso
 */
router.post('/reset', 
  authMiddleware.verificarAutenticacao(),
  [
    body('tipo').isIn(['empresa', 'sefaz', 'backup', 'logs', 'performance', 'todos']).withMessage('Tipo inválido'),
    body('confirmar').equals(true).withMessage('Confirmação obrigatória')
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

      const { tipo } = req.body;

      // Implementar reset das configurações
      let resultado;
      switch (tipo) {
        case 'empresa':
          resultado = await configService.resetarConfigEmpresa(req.user);
          break;
        case 'sefaz':
          resultado = await configService.resetarConfigSefaz(req.user);
          break;
        case 'backup':
          resultado = await configService.resetarConfigBackup(req.user);
          break;
        case 'logs':
          resultado = await configService.resetarConfigLogs(req.user);
          break;
        case 'performance':
          resultado = await configService.resetarConfigPerformance(req.user);
          break;
        case 'todos':
          resultado = await configService.resetarTodasConfiguracoes(req.user);
          break;
      }

      res.json({
        sucesso: true,
        mensagem: `Configurações de ${tipo} resetadas com sucesso`,
        resultado
      });

    } catch (error) {
      console.error('Erro ao resetar configurações:', error);
      res.status(500).json({
        sucesso: false,
        erro: error.message
      });
    }
  }
);

module.exports = router;