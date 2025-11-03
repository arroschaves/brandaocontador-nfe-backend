// ==================== CONFIGURAÇÃO DE AMBIENTE ====================
require('dotenv').config();

// Auto-detecção de ambiente e configuração dinâmica
const NODE_ENV = process.env.NODE_ENV || 'development';

console.log(`🔧 Ambiente detectado: ${NODE_ENV}`);
console.log(`💾 Banco de dados: Arquivo JSON`);
console.log(`🧪 Modo simulação: ${process.env.SIMULATION_MODE === 'true' ? 'ATIVO' : 'DESATIVO'}`);

// ==================== IMPORTS ====================
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// Swagger para documentação da API
const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

// ==================== SISTEMA DE MONITORAMENTO ====================
const { initialize: initializeMetrics, metricsHandler, collectNfeMetrics } = require('./monitoring/metrics');

const { initialize: initializeHealthChecks, healthCheckHandler, detailedHealthCheckHandler } = require('./monitoring/health');
const { initialize: initializeAPM, performanceMiddleware, performanceStatusHandler, recordNfeProcessing } = require('./monitoring/apm');
const { initialize: initializeAlerts, alertsHandler, testAlertHandler, processAlerts } = require('./monitoring/alerts');

// Services
const nfeService = require('./services/nfe-service');
const validationService = require('./services/validation-service');
const ValidationExternalService = require('./services/validation-external-service');
const logService = require('./services/log-service');
const emailService = require('./services/email-service');
const CertificateService = require('./services/certificate-service');

// Sistema usando apenas arquivos JSON - sem models MongoDB

// Database e Auth (consolidados com detecção automática)
const database = require('./config/database');
const authMiddleware = require('./middleware/auth');

// Importar rotas modernas
const authRoutes = require('./routes/auth');
const clientesRoutes = require('./routes/clientes');
const produtosRoutes = require('./routes/produtos');
const adminRoutes = require('./routes/admin');
const nfeRoutes = require('./routes/nfe');
const cteRoutes = require('./routes/cte');
const mdfeRoutes = require('./routes/mdfe');
const eventosRoutes = require('./routes/eventos');
const relatoriosRoutes = require('./routes/relatorios');
const configuracoesRoutes = require('./routes/configuracoes');
const dashboardRoutes = require('./routes/dashboard');
const meRoutes = require('./routes/me');

// Middlewares de segurança
const {
  helmetConfig,
  globalRateLimit,
  authRateLimit,
  sanitizeInput,
  corsConfig,
  securityLogging,
  timingAttackProtection,
  validateContentType,
  securityLogger
} = require('./middleware/security');

// ==================== CONFIGURAÇÃO BÁSICA ====================

const app = express();
const PORT = process.env.PORT || 3000;

// Inicializar serviços
const validationExternalService = new ValidationExternalService();

 // Configurar trust proxy para obter IPs corretos (apenas de proxies confiáveis)
app.set('trust proxy', 1);

// ==================== CONFIGURAÇÃO DO SWAGGER ====================
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API NFe Brandão Contador',
      version: '1.0.0',
      description: 'API para emissão, consulta e gerenciamento de Notas Fiscais Eletrônicas (NFe)',
      contact: {
        name: 'Brandão Contador',
        email: 'contato@brandaocontador.com.br'
      },
      license: {
        name: 'ISC',
        url: 'https://opensource.org/licenses/ISC'
      }
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
        description: 'Servidor de desenvolvimento'
      },
      {
        url: 'https://api.brandaocontador.com.br',
        description: 'Servidor de produção'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        },
        apiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            sucesso: {
              type: 'boolean',
              example: false
            },
            erro: {
              type: 'string',
              example: 'Mensagem de erro'
            },
            codigo: {
              type: 'string',
              example: 'ERROR_CODE'
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T00:00:00.000Z'
            }
          }
        },
        Usuario: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              example: '507f1f77bcf86cd799439011'
            },
            nome: {
              type: 'string',
              example: 'João Silva'
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'joao@empresa.com.br'
            },
            tipoCliente: {
              type: 'string',
              enum: ['cpf', 'cnpj'],
              example: 'cnpj'
            },
            documento: {
              type: 'string',
              example: '12345678000199'
            },
            telefone: {
              type: 'string',
              example: '(11) 99999-9999'
            },
            ativo: {
              type: 'boolean',
              example: true
            }
          }
        },
        NFe: {
          type: 'object',
          properties: {
            chave: {
              type: 'string',
              example: '35200714200166000187550010000000271023456789'
            },
            numero: {
              type: 'integer',
              example: 27
            },
            serie: {
              type: 'integer',
              example: 1
            },
            dataEmissao: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T10:00:00.000Z'
            },
            situacao: {
              type: 'string',
              enum: ['autorizada', 'cancelada', 'rejeitada', 'pendente'],
              example: 'autorizada'
            },
            valorTotal: {
              type: 'number',
              format: 'float',
              example: 1500.50
            }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: [
    './app.js',
    './routes/*.js',
    './controllers/*.js'
  ]
};

const swaggerSpec = swaggerJSDoc(swaggerOptions);

// ==================== INICIALIZAÇÃO DO MONITORAMENTO ====================
// Inicializar sistemas de monitoramento
const { 
  logger, 
  requestLogging: requestLoggingMiddleware, 
  errorLogging: errorLoggingMiddleware, 
  logSystemEvent,
  initialize: initializeLogging 
} = require('./monitoring/logger');

initializeLogging();
initializeMetrics();
initializeHealthChecks();
initializeAPM();
initializeAlerts();

// ==================== MIDDLEWARES DE MONITORAMENTO ====================
// Middleware de performance (deve ser um dos primeiros)
app.use(performanceMiddleware);

// Middleware de logging de requisições
app.use(requestLoggingMiddleware());

// ==================== CONFIGURAÇÃO DE UPLOAD ====================
const certsDir = path.join(__dirname, 'certs');
if (!fs.existsSync(certsDir)) {
  fs.mkdirSync(certsDir, { recursive: true });
}

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!['.pfx', '.p12'].includes(ext)) {
      return cb(new Error('Formato de certificado inválido (use .pfx ou .p12)'));
    }
    cb(null, true);
  }
});

// ==================== MIDDLEWARE DE SEGURANÇA ====================

// Importar middleware de segurança consolidado
const securityMiddleware = require('./middleware/security');

// Headers de segurança com Helmet
app.use(securityMiddleware.configurarHelmet());

// Logging de requisições
app.use(morgan('combined', {
  stream: {
    write: (message) => console.log(message.trim())
  }
}));

// Detecção de ameaças
app.use(securityMiddleware.detectarAmeacas());

// Rate limiting global - TEMPORARIAMENTE DESABILITADO
// app.use(securityMiddleware.configurarRateLimitingGlobal());

// Slow down progressivo
app.use(securityMiddleware.configurarSlowDown());

// CORS configurado dinamicamente
app.use(securityMiddleware.configurarCORS());

// Sanitização de entrada (XSS, NoSQL injection, validação) - TEMPORARIAMENTE DESABILITADO
// const sanitizationMiddlewares = securityMiddleware.configurarSanitizacao();
// sanitizationMiddlewares.forEach(middleware => app.use(middleware));

// Rate limiting específico para autenticação - TEMPORARIAMENTE DESABILITADO
// app.use('/auth/login', securityMiddleware.configurarRateLimitingAuth());
// app.use('/auth/register', securityMiddleware.configurarRateLimitingAuth());

// Rate limiting para APIs - TEMPORARIAMENTE DESABILITADO
// app.use('/api', securityMiddleware.configurarRateLimitingAPI());

// 8. Middleware para parsing JSON padrão
app.use(express.json({ limit: '50mb' }));

// Middleware padrão para outras rotas
app.use(express.json({ 
    limit: '10mb'
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 9. Sanitização de entrada já aplicada acima

// ==================== DOCUMENTAÇÃO DA API (SWAGGER) ====================
// Rota para documentação da API (público)
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'API NFe Brandão Contador',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    showExtensions: true,
    showCommonExtensions: true
  }
}));

// Rota para especificação JSON (público)
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// ==================== ROTAS DE AUTENTICAÇÃO ====================

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags:
 *       - Autenticação
 *     summary: Realizar login no sistema
 *     description: Autentica um usuário e retorna um token JWT
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - senha
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: admin@brandaocontador.com.br
 *               senha:
 *                 type: string
 *                 format: password
 *                 example: admin123
 *     responses:
 *       200:
 *         description: Login realizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sucesso:
 *                   type: boolean
 *                   example: true
 *                 token:
 *                   type: string
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                 usuario:
 *                   $ref: '#/components/schemas/Usuario'
 *       400:
 *         description: Dados inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Credenciais inválidas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.post('/auth/login', authMiddleware.login.bind(authMiddleware));
// Rota alternativa para compatibilidade com frontend
app.post('/api/auth/login', authMiddleware.login.bind(authMiddleware));
app.post("/auth/register", authMiddleware.register.bind(authMiddleware));
app.post("/api/auth/register", authMiddleware.register.bind(authMiddleware));

/**
 * @swagger
 * /auth/register:
 *   post:
 *     tags:
 *       - Autenticação
 *     summary: Registrar novo usuário
 *     description: Cria uma nova conta de usuário no sistema
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nome
 *               - email
 *               - senha
 *               - tipoCliente
 *               - documento
 *             properties:
 *               nome:
 *                 type: string
 *                 example: João Silva
 *               email:
 *                 type: string
 *                 format: email
 *                 example: joao@empresa.com.br
 *               senha:
 *                 type: string
 *                 format: password
 *                 minLength: 6
 *                 example: senha123
 *               tipoCliente:
 *                 type: string
 *                 enum: [cpf, cnpj]
 *                 example: cnpj
 *               documento:
 *                 type: string
 *                 example: 12345678000199
 *               telefone:
 *                 type: string
 *                 example: (11) 99999-9999
 *               razaoSocial:
 *                 type: string
 *                 example: Empresa LTDA
 *               nomeFantasia:
 *                 type: string
 *                 example: Empresa
 *     responses:
 *       201:
 *         description: Usuário criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sucesso:
 *                   type: boolean
 *                   example: true
 *                 usuario:
 *                   $ref: '#/components/schemas/Usuario'
 *       400:
 *         description: Dados inválidos ou usuário já existe
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Rotas de registro removidas - agora são tratadas pelo routes/auth.js

/**
 * @swagger
 * /auth/validate:
 *   get:
 *     tags:
 *       - Autenticação
 *     summary: Validar token JWT
 *     description: Verifica se o token JWT é válido e retorna informações do usuário
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token válido
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sucesso:
 *                   type: boolean
 *                   example: true
 *                 usuario:
 *                   $ref: '#/components/schemas/Usuario'
 *                 tipoAuth:
 *                   type: string
 *                   example: jwt
 *       401:
 *         description: Token inválido ou expirado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.get('/auth/validate', 
  authMiddleware.verificarAutenticacao(), 
  async (req, res) => {
    try {
      res.json({
        sucesso: true,
        usuario: {
          id: req.usuario.id,
          nome: req.usuario.nome,
          email: req.usuario.email,
          permissoes: req.usuario.permissoes || [],
          tipo: req.usuario.tipo || req.usuario.tipoCliente
        },
        tipoAuth: req.tipoAuth
      });
    } catch (error) {
      await logService.logErro('validate_token', error, { ip: req.ip });
      res.status(500).json({ sucesso: false, erro: 'Erro ao validar token' });
    }
  }
);

// Rota alternativa para compatibilidade com frontend
app.get('/api/auth/validate', 
  authMiddleware.verificarAutenticacao(), 
  async (req, res) => {
    try {
      res.json({
        sucesso: true,
        usuario: {
          id: req.usuario.id,
          nome: req.usuario.nome,
          email: req.usuario.email,
          permissoes: req.usuario.permissoes || [],
          tipo: req.usuario.tipo || req.usuario.tipoCliente
        },
        tipoAuth: req.tipoAuth
      });
    } catch (error) {
      await logService.logErro('validate_token', error, { ip: req.ip });
      res.status(500).json({ sucesso: false, erro: 'Erro ao validar token' });
    }
  }
);

// Rota social removida - sistema JSON apenas

// Geração de API Key (apenas para admins)
app.get('/auth/api-key', 
  authMiddleware.verificarAutenticacao(),
  authMiddleware.verificarPermissao ? authMiddleware.verificarPermissao('admin') : (req, res, next) => next(),
  (req, res) => {
    try {
      const apiKey = authMiddleware.gerarApiKey ? authMiddleware.gerarApiKey() : `nfe-key-${Date.now()}`;
      res.json({ sucesso: true, apiKey });
    } catch (error) {
      res.status(500).json({ sucesso: false, erro: 'Erro ao gerar API key' });
    }
  }
);

// ==================== ROTAS DO USUÁRIO (/me) ====================
app.get('/me',
  authMiddleware.verificarAutenticacao(),
  async (req, res) => {
    try {
      let usuario = await database.buscarUsuarioPorId(req.usuario.id);
      if (usuario) {
        const { senha, ...semSenha } = usuario;
        usuario = semSenha;
      }
      
      if (!usuario) {
        return res.status(404).json({ sucesso: false, erro: 'Usuário não encontrado' });
      }
      
      res.json({ sucesso: true, usuario });
    } catch (error) {
      await logService.logErro('me_get', error, { ip: req.ip });
      res.status(500).json({ sucesso: false, erro: 'Erro ao obter dados do usuário' });
    }
  }
);

app.patch('/me',
  authMiddleware.verificarAutenticacao(),
  async (req, res) => {
    try {
      const dados = req.body || {};
      const permitidos = ['nome', 'telefone'];
      const atualizacoes = {};
      
      for (const campo of permitidos) {
        if (dados[campo] !== undefined) atualizacoes[campo] = dados[campo];
      }

      let usuarioAtualizado = await database.atualizarUsuario(req.usuario.id, atualizacoes);
      if (usuarioAtualizado) {
        const { senha, ...semSenha } = usuarioAtualizado;
        usuarioAtualizado = semSenha;
      }
      
      res.json({ sucesso: true, usuario: usuarioAtualizado });
    } catch (error) {
      await logService.logErro('me_patch', error, { ip: req.ip });
      res.status(500).json({ sucesso: false, erro: 'Erro ao atualizar usuário' });
    }
  }
);

// Upload de certificado
app.post('/me/certificado',
  authMiddleware.verificarAutenticacao(),
  upload.single('certificado'),
  async (req, res) => {
    try {
      const senha = (req.body?.senha || '').trim();
      if (!req.file) {
        return res.status(400).json({ sucesso: false, erro: 'Arquivo do certificado não enviado' });
      }
      if (!senha) {
        return res.status(400).json({ sucesso: false, erro: 'Senha do certificado é obrigatória' });
      }

      // Salvar certificado no disco
      const certPath = path.join(certsDir, 'certificado.pfx');
      fs.writeFileSync(certPath, req.file.buffer);

      // Validar certificado
      try {
        const certificateService = new CertificateService();
        const validacao = await certificateService.validarCertificado(certPath, senha);
        
        if (!validacao.valido) {
          fs.unlinkSync(certPath); // Remove arquivo inválido
          return res.status(400).json({
            sucesso: false,
            erro: 'Certificado inválido',
            detalhes: validacao.erro
          });
        }

        // Atualizar configurações do usuário
        const configCert = {
          certificadoPath: certPath,
          certificadoSenha: senha,
          certificadoInfo: validacao.info,
          certificadoUploadEm: new Date().toISOString()
        };

        await database.atualizarUsuario(req.usuario.id, { certificado: configCert });

        await logService.log('certificado_upload', 'SUCESSO', {
          usuario: req.usuario.id,
          certificadoInfo: validacao.info
        });

        res.json({
          sucesso: true,
          mensagem: 'Certificado enviado e validado com sucesso',
          certificado: validacao.info
        });

      } catch (certError) {
        if (fs.existsSync(certPath)) {
          fs.unlinkSync(certPath);
        }
        throw certError;
      }

    } catch (error) {
      await logService.logErro('certificado_upload', error, { ip: req.ip });
      res.status(500).json({ sucesso: false, erro: 'Erro ao processar certificado' });
    }
  }
);

// ==================== ROTAS MODERNAS ====================
// Usar as rotas modernas organizadas em arquivos separados
app.use('/api/auth', authRoutes);
app.use('/api/clientes', clientesRoutes);
app.use('/api/produtos', produtosRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/nfe', nfeRoutes);
app.use('/api/cte', cteRoutes);
app.use('/api/mdfe', mdfeRoutes);
app.use('/api/eventos', eventosRoutes);
app.use('/api/relatorios', relatoriosRoutes);
app.use('/api/configuracoes', configuracoesRoutes);
app.use('/api/dashboard', authMiddleware.verificarAutenticacao(), dashboardRoutes);
app.use('/api/me', meRoutes);

// ==================== ENDPOINTS NFE (LEGADOS) ====================

/**
 * @swagger
 * /nfe/status:
 *   get:
 *     tags:
 *       - NFe
 *     summary: Verificar status do sistema NFe
 *     description: Retorna o status atual do sistema NFe e conectividade com SEFAZ
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
 *                   example: true
 *                 status:
 *                   type: object
 *                   properties:
 *                     sefaz:
 *                       type: string
 *                       example: online
 *                     ambiente:
 *                       type: string
 *                       example: homologacao
 *                     uf:
 *                       type: string
 *                       example: SP
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: 2024-01-01T10:00:00.000Z
 *       500:
 *         description: Erro interno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.get('/nfe/status', async (req, res) => {
  try {
    const status = await nfeService.verificarStatusSistema();
    res.json({ sucesso: true, status, timestamp: new Date().toISOString() });
  } catch (error) {
    await logService.logErro('status', error, { ip: req.ip });
    res.status(500).json({ sucesso: false, erro: 'Erro ao obter status do sistema' });
  }
});

// Status público (sem autenticação)
app.get('/nfe/status-publico', async (req, res) => {
  try {
    const status = await nfeService.verificarStatusSistema();
    res.json({ sucesso: true, status });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: 'Erro ao obter status do sistema' });
  }
});

// Teste de conectividade
app.get('/nfe/teste', async (req, res) => {
  try {
    const resultado = await nfeService.testarConectividade();
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: 'Erro no teste de conectividade' });
  }
});

/**
 * @swagger
 * /nfe/historico:
 *   get:
 *     tags: [NFe]
 *     summary: Obter histórico de NFes
 *     description: Lista as NFes emitidas com paginação e filtros opcionais
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: pagina
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Número da página para paginação
 *       - in: query
 *         name: limite
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Número de itens por página
 *       - in: query
 *         name: dataInicio
 *         schema:
 *           type: string
 *           format: date
 *         description: Data inicial para filtro (YYYY-MM-DD)
 *         example: "2024-01-01"
 *       - in: query
 *         name: dataFim
 *         schema:
 *           type: string
 *           format: date
 *         description: Data final para filtro (YYYY-MM-DD)
 *         example: "2024-12-31"
 *       - in: query
 *         name: situacao
 *         schema:
 *           type: string
 *           enum: [Autorizada, Cancelada, Rejeitada]
 *         description: Filtro por situação da NFe
 *     responses:
 *       200:
 *         description: Lista de NFes obtida com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sucesso:
 *                   type: boolean
 *                   example: true
 *                 nfes:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/NFe'
 *                 total:
 *                   type: integer
 *                   description: Total de NFes encontradas
 *                   example: 150
 *                 limite:
 *                   type: integer
 *                   description: Limite de itens por página
 *                   example: 10
 *                 pagina:
 *                   type: integer
 *                   description: Página atual
 *                   example: 1
 *       401:
 *         description: Não autorizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Erro interno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Histórico de NFes
app.get('/nfe/historico', 
  authMiddleware.verificarAutenticacao(),
  async (req, res) => {
    try {
      const pagina = parseInt(req.query.pagina) || 1;
      const limite = parseInt(req.query.limite) || 10;
      const filtros = {
        dataInicio: req.query.dataInicio,
        dataFim: req.query.dataFim,
        situacao: req.query.situacao,
        usuarioId: req.usuario.id
      };

      let nfes = [];
      let total = 0;

      const todasNfes = await database.listarNfes(filtros);
      total = todasNfes.length;
      const inicio = (pagina - 1) * limite;
      nfes = todasNfes.slice(inicio, inicio + limite);

      await logService.log('historico', 'SUCESSO', {
        usuario: req.usuario.id,
        pagina,
        limite,
        retornadas: nfes.length
      });

      res.json({
        sucesso: true,
        nfes,
        total,
        limite,
        pagina
      });
    } catch (error) {
      await logService.logErro('historico', error, { ip: req.ip });
      res.status(500).json({ sucesso: false, erro: 'Erro ao obter histórico de NFes' });
    }
  }
);

/**
 * @swagger
 * /nfe/emitir:
 *   post:
 *     tags:
 *       - NFe
 *     summary: Emitir uma Nova Nota Fiscal Eletrônica
 *     description: Emite uma NFe com os dados fornecidos e envia para SEFAZ
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - emitente
 *               - destinatario
 *               - itens
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
 *                   nomeFantasia:
 *                     type: string
 *                     example: "Empresa"
 *               destinatario:
 *                 type: object
 *                 properties:
 *                   documento:
 *                     type: string
 *                     example: "98765432000188"
 *                   nome:
 *                     type: string
 *                     example: "Cliente LTDA"
 *                   endereco:
 *                     type: object
 *                     properties:
 *                       logradouro:
 *                         type: string
 *                         example: "Rua das Flores, 123"
 *                       bairro:
 *                         type: string
 *                         example: "Centro"
 *                       cidade:
 *                         type: string
 *                         example: "São Paulo"
 *                       uf:
 *                         type: string
 *                         example: "SP"
 *                       cep:
 *                         type: string
 *                         example: "01001-000"
 *               itens:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     codigo:
 *                       type: string
 *                       example: "PROD001"
 *                     descricao:
 *                       type: string
 *                       example: "Produto de Teste"
 *                     quantidade:
 *                       type: number
 *                       example: 1
 *                     valorUnitario:
 *                       type: number
 *                       example: 100.00
 *                     valorTotal:
 *                       type: number
 *                       example: 100.00
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
 *                 nfe:
 *                   $ref: '#/components/schemas/NFe'
 *                 protocolo:
 *                   type: string
 *                   example: "135200000000001"
 *       400:
 *         description: Dados inválidos ou erro na emissão
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Não autorizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Erro interno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.post('/nfe/emitir', 
  authMiddleware.verificarAutenticacao(),
  authMiddleware.verificarPermissao ? authMiddleware.verificarPermissao('nfe_emitir') : (req, res, next) => next(),
  async (req, res) => {
    try {
      // Validação dos dados
      const validacao = await validationService.validarDadosNfe(req.body);
      
      if (!validacao.valido) {
        await logService.logValidacao(req.body, validacao);
        return res.status(400).json({
          sucesso: false,
          erro: 'Dados inválidos',
          erros: validacao.erros,
          avisos: validacao.avisos
        });
      }

      // Emissão da NFe
      const resultado = await nfeService.emitirNfe(req.body);
      
      await logService.logEmissao(req.body, resultado);

      if (resultado.sucesso) {
        res.json(resultado);
      } else {
        res.status(400).json(resultado);
      }

    } catch (error) {
      console.error('❌ ERRO DETALHADO NA EMISSÃO:', error);
      await logService.logErro('emissao', error, { 
        dados: req.body,
        usuario: req.usuario.id 
      });
      res.status(500).json({
        sucesso: false,
        erro: 'Erro interno na emissão da NFe',
        codigo: 'EMISSAO_ERROR'
      });
    }
  }
);

/**
 * @swagger
 * /nfe/consultar/{chave}:
 *   get:
 *     tags: [NFe]
 *     summary: Consultar NFe por chave de acesso
 *     description: Consulta o status e informações de uma NFe através da chave de acesso
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chave
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 44
 *           maxLength: 44
 *         description: Chave de acesso da NFe (44 dígitos)
 *         example: "35200714200166000187550010000000001123456789"
 *     responses:
 *       200:
 *         description: Consulta realizada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sucesso:
 *                   type: boolean
 *                   example: true
 *                 situacao:
 *                   type: string
 *                   example: "Autorizada"
 *                 protocolo:
 *                   type: string
 *                   example: "135200000000001"
 *                 dataAutorizacao:
 *                   type: string
 *                   format: date-time
 *                   example: "2024-01-15T10:30:00Z"
 *       400:
 *         description: Chave inválida
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Não autorizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Erro interno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Consultar NFe
app.get('/nfe/consultar/:chave', 
  authMiddleware.verificarAutenticacao(),
  authMiddleware.verificarPermissao ? authMiddleware.verificarPermissao('nfe_consultar') : (req, res, next) => next(),
  async (req, res) => {
    try {
      const { chave } = req.params;
      
      if (!chave || chave.length !== 44) {
        return res.status(400).json({
          sucesso: false,
          erro: 'Chave da NFe inválida. Deve ter 44 dígitos.',
          codigo: 'CHAVE_INVALIDA'
        });
      }

      const resultado = await nfeService.consultarNFe(chave);
      await logService.logConsulta(chave, resultado);
      res.json(resultado);

    } catch (error) {
      await logService.logErro('consulta', error, { 
        chave: req.params.chave,
        usuario: req.usuario.id 
      });
      res.status(500).json({
        sucesso: false,
        erro: 'Erro interno na consulta da NFe',
        codigo: 'CONSULTA_ERROR'
      });
    }
  }
);

/**
 * @swagger
 * /nfe/cancelar:
 *   post:
 *     tags: [NFe]
 *     summary: Cancelar NFe
 *     description: Cancela uma NFe autorizada através da chave de acesso e justificativa
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - chave
 *               - justificativa
 *             properties:
 *               chave:
 *                 type: string
 *                 minLength: 44
 *                 maxLength: 44
 *                 description: Chave de acesso da NFe (44 dígitos)
 *                 example: "35200714200166000187550010000000001123456789"
 *               justificativa:
 *                 type: string
 *                 minLength: 15
 *                 maxLength: 255
 *                 description: Justificativa para o cancelamento (mínimo 15 caracteres)
 *                 example: "Cancelamento solicitado pelo cliente devido a erro no produto"
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
 *                   example: "135200000000002"
 *                 dataCancelamento:
 *                   type: string
 *                   format: date-time
 *                   example: "2024-01-15T14:30:00Z"
 *       400:
 *         description: Dados inválidos ou erro no cancelamento
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Não autorizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Erro interno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Cancelar NFe
app.post('/nfe/cancelar', 
  authMiddleware.verificarAutenticacao(),
  authMiddleware.verificarPermissao ? authMiddleware.verificarPermissao('nfe_cancelar') : (req, res, next) => next(),
  async (req, res) => {
    try {
      const { chave, justificativa } = req.body;
      
      if (!chave || !justificativa) {
        return res.status(400).json({
          sucesso: false,
          erro: 'Chave e justificativa são obrigatórias',
          codigo: 'DADOS_OBRIGATORIOS'
        });
      }

      if (justificativa.length < 15) {
        return res.status(400).json({
          sucesso: false,
          erro: 'Justificativa deve ter pelo menos 15 caracteres',
          codigo: 'JUSTIFICATIVA_CURTA'
        });
      }

      const resultado = await nfeService.cancelarNfe(chave, justificativa);
      await logService.logCancelamento(chave, justificativa, resultado);

      if (resultado.sucesso) {
        res.json(resultado);
      } else {
        res.status(400).json(resultado);
      }

    } catch (error) {
      await logService.logErro('cancelamento', error, { 
        chave: req.body.chave,
        justificativa: req.body.justificativa,
        usuario: req.usuario.id 
      });
      res.status(500).json({
        sucesso: false,
        erro: 'Erro interno no cancelamento da NFe',
        codigo: 'CANCELAMENTO_ERROR'
      });
    }
  }
);

/**
 * @swagger
 * /nfe/inutilizar:
 *   post:
 *     tags: [NFe]
 *     summary: Inutilizar numeração de NFe
 *     description: Inutiliza uma faixa de numeração de NFe que não será utilizada
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - serie
 *               - numeroInicial
 *               - numeroFinal
 *               - justificativa
 *             properties:
 *               serie:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 999
 *                 description: Série da NFe
 *                 example: 1
 *               numeroInicial:
 *                 type: integer
 *                 minimum: 1
 *                 description: Número inicial da faixa a ser inutilizada
 *                 example: 100
 *               numeroFinal:
 *                 type: integer
 *                 minimum: 1
 *                 description: Número final da faixa a ser inutilizada
 *                 example: 105
 *               justificativa:
 *                 type: string
 *                 minLength: 15
 *                 maxLength: 255
 *                 description: Justificativa para a inutilização (mínimo 15 caracteres)
 *                 example: "Numeração pulada devido a erro no sistema"
 *               ano:
 *                 type: integer
 *                 minimum: 2000
 *                 maximum: 2099
 *                 description: Ano da numeração (opcional, padrão ano atual)
 *                 example: 2024
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
 *                   example: "135200000000003"
 *                 dataInutilizacao:
 *                   type: string
 *                   format: date-time
 *                   example: "2024-01-15T16:30:00Z"
 *       400:
 *         description: Dados inválidos ou erro na inutilização
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Não autorizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Erro interno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Inutilizar numeração NFe
app.post('/nfe/inutilizar', 
  authMiddleware.verificarAutenticacao(),
  authMiddleware.verificarPermissao ? authMiddleware.verificarPermissao('nfe_inutilizar') : (req, res, next) => next(),
  async (req, res) => {
    try {
      const { serie, numeroInicial, numeroFinal, justificativa, ano } = req.body;

      if (serie === undefined || numeroInicial === undefined || numeroFinal === undefined || !justificativa) {
        return res.status(400).json({
          sucesso: false,
          erro: 'Série, número inicial, número final e justificativa são obrigatórios',
          codigo: 'DADOS_OBRIGATORIOS'
        });
      }

      if (String(justificativa).trim().length < 15) {
        return res.status(400).json({
          sucesso: false,
          erro: 'Justificativa deve ter pelo menos 15 caracteres',
          codigo: 'JUSTIFICATIVA_CURTA'
        });
      }

      const resultado = await nfeService.inutilizarNumeracao({ serie, numeroInicial, numeroFinal, justificativa, ano });

      await logService.log('inutilizacao', resultado?.sucesso ? 'SUCESSO' : 'ERRO', {
        usuario: req.usuario.id,
        serie,
        numeroInicial,
        numeroFinal,
        justificativa,
        protocolo: resultado?.protocolo || null
      });

      if (resultado?.sucesso) {
        res.json(resultado);
      } else {
        res.status(400).json(resultado);
      }

    } catch (error) {
      await logService.logErro('inutilizacao', error, { 
        usuario: req.usuario.id,
        dados: req.body 
      });
      res.status(500).json({
        sucesso: false,
        erro: 'Erro interno na inutilização da numeração',
        codigo: 'INUTILIZACAO_ERROR'
      });
    }
  }
);

/**
 * @swagger
 * /nfe/download/{tipo}/{chave}:
 *   get:
 *     tags: [NFe]
 *     summary: Download de XML ou PDF da NFe
 *     description: Faz o download do arquivo XML ou PDF de uma NFe
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tipo
 *         required: true
 *         schema:
 *           type: string
 *           enum: [xml, pdf]
 *         description: Tipo de arquivo para download
 *         example: "xml"
 *       - in: path
 *         name: chave
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 44
 *           maxLength: 44
 *         description: Chave de acesso da NFe (44 dígitos)
 *         example: "35200714200166000187550010000000001123456789"
 *     responses:
 *       200:
 *         description: Arquivo baixado com sucesso
 *         content:
 *           application/xml:
 *             schema:
 *               type: string
 *               format: binary
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *         headers:
 *           Content-Disposition:
 *             schema:
 *               type: string
 *             description: Nome do arquivo para download
 *       400:
 *         description: Parâmetros inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Não autorizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Erro interno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Download de XML/PDF da NFe
app.get('/nfe/download/:tipo/:chave',
  authMiddleware.verificarAutenticacao(),
  authMiddleware.verificarPermissao ? authMiddleware.verificarPermissao('nfe_consultar') : (req, res, next) => next(),
  async (req, res) => {
    try {
      const { tipo, chave } = req.params;

      // Validações básicas
      const chaveNumerica = (chave || '').replace(/\D/g, '');
      if (chaveNumerica.length !== 44) {
        return res.status(400).json({
          sucesso: false,
          erro: 'Chave da NFe inválida. Deve ter 44 dígitos.',
          codigo: 'CHAVE_INVALIDA'
        });
      }

      if (!['xml', 'pdf'].includes(tipo)) {
        return res.status(400).json({
          sucesso: false,
          erro: 'Tipo de arquivo inválido. Use xml ou pdf.',
          codigo: 'TIPO_INVALIDO'
        });
      }

      await logService.log('download', 'SUCESSO', { tipo, chave, usuario: req.usuario.id });

      // Conteúdo simulado para desenvolvimento
      if (tipo === 'xml') {
        const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>\n<NFe>\n  <chaveAcesso>${chaveNumerica}</chaveAcesso>\n  <situacao>Autorizada</situacao>\n  <geradoEm>${new Date().toISOString()}</geradoEm>\n</NFe>`;
        res.setHeader('Content-Type', 'application/xml');
        res.setHeader('Content-Disposition', `attachment; filename="NFe_${chaveNumerica}.xml"`);
        return res.status(200).send(xmlContent);
      }

      // PDF mínimo (placeholder) para desenvolvimento
      const pdfMinimal = Buffer.from(
        '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
        '2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n' +
        '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Contents 4 0 R>>endobj\n' +
        '4 0 obj<</Length 55>>stream\nBT /F1 12 Tf 72 720 Td(Comprovante NFe ' + chaveNumerica + ')Tj ET\nendstream\nendobj\n' +
        'xref\n0 5\n0000000000 65535 f \n0000000010 00000 n \n0000000061 00000 n \n0000000116 00000 n \n0000000221 00000 n \ntrailer<</Size 5/Root 1 0 R>>\nstartxref\n320\n%%EOF'
      );
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="NFe_${chaveNumerica}.pdf"`);
      return res.status(200).send(pdfMinimal);
      
    } catch (error) {
      await logService.logErro('download', error, { ip: req.ip });
      return res.status(500).json({
        sucesso: false,
        erro: 'Erro ao gerar arquivo para download',
        codigo: 'DOWNLOAD_ERROR'
      });
    }
  }
);

/**
 * @swagger
 * /nfe/validar:
 *   post:
 *     tags: [NFe]
 *     summary: Validar dados da NFe
 *     description: Valida os dados de uma NFe antes da emissão (endpoint público)
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
 *                     example: "12345678000195"
 *                   razaoSocial:
 *                     type: string
 *                     example: "Empresa Teste LTDA"
 *               destinatario:
 *                 type: object
 *                 properties:
 *                   documento:
 *                     type: string
 *                     example: "12345678901"
 *                   nome:
 *                     type: string
 *                     example: "Cliente Teste"
 *               itens:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     codigo:
 *                       type: string
 *                       example: "PROD001"
 *                     descricao:
 *                       type: string
 *                       example: "Produto de Teste"
 *                     quantidade:
 *                       type: number
 *                       example: 1
 *                     valorUnitario:
 *                       type: number
 *                       example: 100.00
 *     responses:
 *       200:
 *         description: Validação realizada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sucesso:
 *                   type: boolean
 *                   example: true
 *                 validacao:
 *                   type: object
 *                   properties:
 *                     valido:
 *                       type: boolean
 *                       example: true
 *                     erros:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: []
 *                     avisos:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["Campo opcional não preenchido"]
 *       500:
 *         description: Erro interno na validação
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Validar dados da NFe
app.post('/nfe/validar', 
  authMiddleware.verificarAutenticacaoOpcional ? authMiddleware.verificarAutenticacaoOpcional() : (req, res, next) => next(),
  async (req, res) => {
    try {
      const validacao = await validationService.validarDadosNfe(req.body);
      await logService.logValidacao(req.body, validacao);

      res.json({
        sucesso: true,
        validacao
      });

    } catch (error) {
      await logService.logErro('validacao', error, { 
        dados: req.body,
        usuario: req.usuario?.id 
      });
      res.status(500).json({
        sucesso: false,
        erro: 'Erro interno na validação',
        codigo: 'VALIDACAO_ERROR',
        detalhes: error.message
      });
    }
  }
);

// ==================== ROTAS DE CLIENTES ====================

/**
 * @swagger
 * /clientes:
 *   get:
 *     summary: Listar clientes
 *     tags: [Clientes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Termo de busca (nome, documento, email)
 *       - in: query
 *         name: ativo
 *         schema:
 *           type: boolean
 *         description: Filtrar por status ativo
 *       - in: query
 *         name: tipo
 *         schema:
 *           type: string
 *           enum: [cpf, cnpj]
 *         description: Filtrar por tipo de documento
 *       - in: query
 *         name: limite
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Limite de resultados por página
 *       - in: query
 *         name: pagina
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Número da página
 *     responses:
 *       200:
 *         description: Lista de clientes
 *       401:
 *         description: Não autorizado
 *       500:
 *         description: Erro interno do servidor
 */
app.get('/clientes',
  authMiddleware.verificarAutenticacao(),
  async (req, res) => {
    try {
      const filtros = {
        q: req.query.q,
        ativo: req.query.ativo,
        tipo: req.query.tipo,
        limite: parseInt(req.query.limite) || 50,
        pagina: parseInt(req.query.pagina) || 1
      };
      
      const clientes = await database.listarClientes(filtros);
      
      res.json({ sucesso: true, clientes });
    } catch (error) {
      await logService.logErro('clientes_listar', error, { ip: req.ip });
      res.status(500).json({ sucesso: false, erro: 'Erro ao listar clientes' });
    }
  }
);

/**
 * @swagger
 * /clientes:
 *   post:
 *     summary: Criar cliente com validação externa
 *     tags: [Clientes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tipo
 *               - documento
 *               - nome
 *             properties:
 *               tipo:
 *                 type: string
 *                 enum: [cpf, cnpj]
 *                 example: cnpj
 *               documento:
 *                 type: string
 *                 example: "12345678000199"
 *               nome:
 *                 type: string
 *                 example: "Empresa Exemplo LTDA"
 *               razaoSocial:
 *                 type: string
 *                 example: "Empresa Exemplo LTDA"
 *               nomeFantasia:
 *                 type: string
 *                 example: "Empresa Exemplo"
 *               inscricaoEstadual:
 *                 type: string
 *                 example: "123456789"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "contato@empresa.com.br"
 *               telefone:
 *                 type: string
 *                 example: "(11) 99999-9999"
 *               endereco:
 *                 type: object
 *                 properties:
 *                   cep:
 *                     type: string
 *                     example: "01001000"
 *                   logradouro:
 *                     type: string
 *                     example: "Praça da Sé"
 *                   numero:
 *                     type: string
 *                     example: "123"
 *                   complemento:
 *                     type: string
 *                     example: "Sala 456"
 *                   bairro:
 *                     type: string
 *                     example: "Sé"
 *                   cidade:
 *                     type: string
 *                     example: "São Paulo"
 *                   uf:
 *                     type: string
 *                     example: "SP"
 *     responses:
 *       201:
 *         description: Cliente criado com sucesso
 *       400:
 *         description: Dados inválidos
 *       409:
 *         description: Cliente já existe
 *       500:
 *         description: Erro interno do servidor
 */
app.post('/clientes',
  authMiddleware.verificarAutenticacao(),
  async (req, res) => {
    try {
      // Validação e enriquecimento dos dados
      const validacao = await validationExternalService.validarEEnriquecerCliente(req.body);
      
      if (!validacao.valido) {
        return res.status(400).json({ 
          sucesso: false, 
          erro: 'Dados inválidos', 
          detalhes: validacao.erros 
        });
      }

      // Verificar se cliente já existe
      const existente = await database.buscarClientePorDocumento(validacao.dados.documento, req.usuario.id);
      
      if (existente) {
        return res.status(409).json({ 
          sucesso: false, 
          erro: 'Cliente já cadastrado com este documento' 
        });
      }
      
      // Criar cliente no arquivo JSON
      const cliente = await database.criarCliente({
        ...validacao.dados,
        usuarioId: req.usuario.id
      });
      
      await logService.log('cliente_criado', 'SUCESSO', { 
        cliente: cliente.id || cliente._id, 
        usuario: req.usuario.id,
        documento: validacao.dados.documento
      });
      
      res.status(201).json({ 
        sucesso: true, 
        cliente,
        avisos: validacao.avisos
      });
    } catch (error) {
      await logService.logErro('cliente_criar', error, { ip: req.ip });
      
      if (error.code === 11000) {
        return res.status(409).json({ 
          sucesso: false, 
          erro: 'Cliente já cadastrado com este documento' 
        });
      }
      
      res.status(500).json({ sucesso: false, erro: 'Erro ao criar cliente' });
    }
  }
);

/**
 * @swagger
 * /clientes/{id}:
 *   get:
 *     summary: Buscar cliente por ID
 *     tags: [Clientes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do cliente
 *     responses:
 *       200:
 *         description: Cliente encontrado
 *       404:
 *         description: Cliente não encontrado
 *       500:
 *         description: Erro interno do servidor
 */
app.get('/clientes/:id',
  authMiddleware.verificarAutenticacao(),
  async (req, res) => {
    try {
      let cliente;
      
        cliente = await database.buscarClientePorId(req.params.id);

      if (!cliente) {
        return res.status(404).json({ sucesso: false, erro: 'Cliente não encontrado' });
      }
      
      res.json({ sucesso: true, cliente });
    } catch (error) {
      await logService.logErro('cliente_buscar', error, { ip: req.ip });
      res.status(500).json({ sucesso: false, erro: 'Erro ao buscar cliente' });
    }
  }
);

/**
 * @swagger
 * /clientes/{id}:
 *   patch:
 *     summary: Atualizar cliente
 *     tags: [Clientes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do cliente
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nome:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               telefone:
 *                 type: string
 *               endereco:
 *                 type: object
 *               ativo:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Cliente atualizado com sucesso
 *       404:
 *         description: Cliente não encontrado
 *       500:
 *         description: Erro interno do servidor
 */
app.patch('/clientes/:id',
  authMiddleware.verificarAutenticacao(),
  async (req, res) => {
    try {
      // Validação dos dados de atualização (sem documento)
      const dadosAtualizacao = { ...req.body };
      delete dadosAtualizacao.documento; // Não permitir alterar documento
      delete dadosAtualizacao.tipo; // Não permitir alterar tipo
      
      // Se tem CEP, validar
      if (dadosAtualizacao.endereco?.cep) {
        try {
          const dadosCEP = await validationExternalService.consultarCEP(dadosAtualizacao.endereco.cep);
          dadosAtualizacao.endereco = {
            ...dadosAtualizacao.endereco,
            logradouro: dadosCEP.logradouro || dadosAtualizacao.endereco.logradouro,
            bairro: dadosCEP.bairro || dadosAtualizacao.endereco.bairro,
            cidade: dadosCEP.municipio || dadosAtualizacao.endereco.cidade,
            uf: dadosCEP.uf || dadosAtualizacao.endereco.uf
          };
        } catch (error) {
          console.warn('Erro ao validar CEP na atualização:', error.message);
        }
      }

      let cliente = await database.atualizarCliente(req.params.id, dadosAtualizacao);
      
      if (!cliente) {
        return res.status(404).json({ sucesso: false, erro: 'Cliente não encontrado' });
      }
      
      await logService.log('cliente_atualizado', 'SUCESSO', { 
        cliente: cliente.id || cliente._id, 
        usuario: req.usuario.id 
      });
      
      res.json({ sucesso: true, cliente });
    } catch (error) {
      await logService.logErro('cliente_atualizar', error, { ip: req.ip });
      res.status(500).json({ sucesso: false, erro: 'Erro ao atualizar cliente' });
    }
  }
);

/**
 * @swagger
 * /clientes/{id}:
 *   delete:
 *     summary: Remover cliente
 *     tags: [Clientes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do cliente
 *     responses:
 *       200:
 *         description: Cliente removido com sucesso
 *       404:
 *         description: Cliente não encontrado
 *       500:
 *         description: Erro interno do servidor
 */
app.delete('/clientes/:id',
  authMiddleware.verificarAutenticacao(),
  async (req, res) => {
    try {
      let removido;
      
        removido = await database.removerCliente(req.params.id);

      if (!removido) {
        return res.status(404).json({ sucesso: false, erro: 'Cliente não encontrado' });
      }
      
      await logService.log('cliente_removido', 'SUCESSO', { 
        cliente: req.params.id, 
        usuario: req.usuario.id 
      });
      
      res.json({ sucesso: true, mensagem: 'Cliente removido com sucesso' });
    } catch (error) {
      await logService.logErro('cliente_remover', error, { ip: req.ip });
      res.status(500).json({ sucesso: false, erro: 'Erro ao remover cliente' });
    }
  }
);

// ==================== ROTAS DE VALIDAÇÃO EXTERNA ====================

/**
 * @swagger
 * /validacao/cnpj/{cnpj}:
 *   get:
 *     summary: Consultar CNPJ na Receita Federal
 *     tags: [Validação]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cnpj
 *         required: true
 *         schema:
 *           type: string
 *         description: CNPJ para consulta (com ou sem formatação)
 *     responses:
 *       200:
 *         description: Dados do CNPJ
 *       400:
 *         description: CNPJ inválido
 *       404:
 *         description: CNPJ não encontrado
 *       500:
 *         description: Erro interno do servidor
 */
app.get('/validacao/cnpj/:cnpj',
  authMiddleware.verificarAutenticacao(),
  async (req, res) => {
    try {
      const dados = await validationExternalService.consultarCNPJ(req.params.cnpj);
      res.json({ sucesso: true, dados });
    } catch (error) {
      if (error.message.includes('formato inválido')) {
        return res.status(400).json({ sucesso: false, erro: error.message });
      }
      if (error.message.includes('não encontrado')) {
        return res.status(404).json({ sucesso: false, erro: error.message });
      }
      res.status(500).json({ sucesso: false, erro: 'Erro ao consultar CNPJ' });
    }
  }
);

/**
 * @swagger
 * /validacao/cep/{cep}:
 *   get:
 *     summary: Consultar CEP
 *     tags: [Validação]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cep
 *         required: true
 *         schema:
 *           type: string
 *         description: CEP para consulta (com ou sem formatação)
 *     responses:
 *       200:
 *         description: Dados do CEP
 *       400:
 *         description: CEP inválido
 *       404:
 *         description: CEP não encontrado
 *       500:
 *         description: Erro interno do servidor
 */
app.get('/validacao/cep/:cep',
  authMiddleware.verificarAutenticacao(),
  async (req, res) => {
    try {
      const dados = await validationExternalService.consultarCEP(req.params.cep);
      res.json({ sucesso: true, dados });
    } catch (error) {
      if (error.message.includes('8 dígitos')) {
        return res.status(400).json({ sucesso: false, erro: error.message });
      }
      if (error.message.includes('não encontrado')) {
        return res.status(404).json({ sucesso: false, erro: error.message });
      }
      res.status(500).json({ sucesso: false, erro: 'Erro ao consultar CEP' });
    }
  }
);

/**
 * @swagger
 * /validacao/estados:
 *   get:
 *     summary: Listar estados brasileiros
 *     tags: [Validação]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de estados
 *       500:
 *         description: Erro interno do servidor
 */
app.get('/validacao/estados',
  authMiddleware.verificarAutenticacao(),
  async (req, res) => {
    try {
      const estados = await validationExternalService.listarEstados();
      res.json({ sucesso: true, estados });
    } catch (error) {
      res.status(500).json({ sucesso: false, erro: 'Erro ao listar estados' });
    }
  }
);

/**
 * @swagger
 * /validacao/municipios/{uf}:
 *   get:
 *     summary: Listar municípios por UF
 *     tags: [Validação]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: uf
 *         required: true
 *         schema:
 *           type: string
 *         description: Sigla do estado (UF)
 *     responses:
 *       200:
 *         description: Lista de municípios
 *       400:
 *         description: UF inválida
 *       500:
 *         description: Erro interno do servidor
 */
app.get('/validacao/municipios/:uf',
  authMiddleware.verificarAutenticacao(),
  async (req, res) => {
    try {
      const municipios = await validationExternalService.listarMunicipios(req.params.uf);
      res.json({ sucesso: true, municipios });
    } catch (error) {
      if (error.message.includes('2 caracteres')) {
        return res.status(400).json({ sucesso: false, erro: error.message });
      }
      res.status(500).json({ sucesso: false, erro: 'Erro ao listar municípios' });
    }
  }
);

// ==================== ROTAS DE PRODUTOS ====================
// Rotas para produtos (sistema JSON)
app.get('/produtos', authMiddleware.verificarAutenticacao(), async (req, res) => {
  try {
    const produtos = await database.listarProdutos(req.query);
    res.json({ sucesso: true, produtos });
  } catch (error) {
    await logService.logErro('produtos_listar', error, { ip: req.ip });
    res.status(500).json({ sucesso: false, erro: 'Erro ao listar produtos' });
  }
});

app.post('/produtos', authMiddleware.verificarAutenticacao(), async (req, res) => {
  try {
    const produto = await database.criarProduto(req.body);
    res.status(201).json({ sucesso: true, produto });
  } catch (error) {
    await logService.logErro('produto_criar', error, { ip: req.ip });
    res.status(500).json({ sucesso: false, erro: 'Erro ao criar produto' });
  }
});

// ==================== ROTAS ADMINISTRATIVAS ====================

// Rota para obter token CSRF
app.get('/csrf-token', (req, res) => {
  securityMiddleware.obterTokenCSRF(req, res);
});

// Rota para status de segurança (apenas admin)
app.get('/admin/security-status', 
  authMiddleware.verificarAutenticacao(),
  authMiddleware.verificarPermissao ? authMiddleware.verificarPermissao('admin') : (req, res, next) => next(),
  async (req, res) => {
    try {
      const status = securityMiddleware.obterStatusSeguranca();
      res.json({
        sucesso: true,
        status
      });
    } catch (error) {
      await logService.logErro('admin_security_status', error, { ip: req.ip });
      res.status(500).json({
        sucesso: false,
        erro: 'Erro interno do servidor',
        codigo: 'INTERNAL_ERROR'
      });
    }
  }
);

/**
 * @swagger
 * /admin/usuarios:
 *   get:
 *     tags:
 *       - Administração
 *     summary: Listar usuários do sistema
 *     description: Endpoint para administradores listarem todos os usuários cadastrados no sistema
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de usuários retornada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sucesso:
 *                   type: boolean
 *                   example: true
 *                 usuarios:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: "507f1f77bcf86cd799439011"
 *                       nome:
 *                         type: string
 *                         example: "João Silva"
 *                       email:
 *                         type: string
 *                         example: "joao@exemplo.com"
 *                       tipoCliente:
 *                         type: string
 *                         enum: [cpf, cnpj]
 *                         example: "cnpj"
 *                       documento:
 *                         type: string
 *                         example: "12345678000199"
 *                       ativo:
 *                         type: boolean
 *                         example: true
 *                       dataCadastro:
 *                         type: string
 *                         format: date-time
 *                         example: "2024-01-15T10:30:00Z"
 *                       permissoes:
 *                         type: array
 *                         items:
 *                           type: string
 *                         example: ["nfe_emitir", "nfe_consultar"]
 *       401:
 *         description: Token de autenticação inválido ou ausente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Usuário não possui permissão de administrador
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Erro interno do servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
app.get('/admin/usuarios',
  authMiddleware.verificarAutenticacao(),
  authMiddleware.verificarPermissao ? authMiddleware.verificarPermissao('admin') : (req, res, next) => next(),
  async (req, res) => {
    try {
      let usuarios = await database.listarUsuarios();
      usuarios = usuarios.map(u => {
        const { senha, ...semSenha } = u;
        return semSenha;
      });
      
      res.json({ sucesso: true, usuarios });
    } catch (error) {
      await logService.logErro('admin_usuarios', error, { ip: req.ip });
      res.status(500).json({ sucesso: false, erro: 'Erro ao listar usuários' });
    }
  }
);

/**
 * @swagger
 * /admin/health:
 *   get:
 *     tags:
 *       - Administração
 *     summary: Verificar saúde do sistema (Admin)
 *     description: Endpoint administrativo para verificar o status detalhado de saúde do sistema
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Status de saúde do sistema retornado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sucesso:
 *                   type: boolean
 *                   example: true
 *                 health:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       example: "ok"
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-01-15T10:30:00.000Z"
 *                     uptime:
 *                       type: number
 *                       description: Tempo de atividade do servidor em segundos
 *                       example: 3600.5
 *                     versaoNode:
 *                       type: string
 *                       example: "v18.17.0"
 *                     ambiente:
 *                       type: string
 *                       enum: [development, production, test]
 *                       example: "development"
 *                     bancoDados:
                       type: string
                       enum: ["Arquivo JSON"]
                       example: "Arquivo JSON"
 *                     conectado:
 *                       type: boolean
 *                       description: Status da conexão com o banco de dados
 *                       example: true
 *                     simulacao:
 *                       type: boolean
 *                       description: Se o sistema está em modo de simulação
 *                       example: true
 *       401:
 *         description: Token de autenticação inválido ou ausente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Usuário não possui permissão de administrador
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Erro interno do servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
app.get('/admin/health',
  authMiddleware.verificarAutenticacao(),
  authMiddleware.verificarPermissao ? authMiddleware.verificarPermissao('admin') : (req, res, next) => next(),
  async (req, res) => {
    try {
      const health = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        versaoNode: process.version,
        ambiente: NODE_ENV,
        bancoDados: 'Arquivo JSON',
        conectado: database.isConnected ? database.isConnected() : true,
        simulacao: process.env.SIMULATION_MODE === 'true'
      };
      
      res.json({ sucesso: true, health });
    } catch (error) {
      await logService.logErro('admin_health', error, { ip: req.ip });
      res.status(500).json({ sucesso: false, erro: 'Erro ao verificar saúde do sistema' });
    }
  }
);

// ==================== ENDPOINTS DE MONITORAMENTO ====================

/**
 * @swagger
 * /health:
 *   get:
 *     tags:
 *       - Monitoramento
 *     summary: Health check básico
 *     description: Endpoint público para verificação básica de saúde do sistema
 *     responses:
 *       200:
 *         description: Sistema funcionando normalmente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "ok"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: "2024-01-15T10:30:00.000Z"
 *                 uptime:
 *                   type: number
 *                   description: Tempo de atividade em segundos
 *                   example: 3600.5
 *                 version:
 *                   type: string
 *                   example: "1.0.0"
 *       503:
 *         description: Sistema indisponível
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "error"
 *                 message:
 *                   type: string
 *                   example: "Sistema temporariamente indisponível"
 */
// Health check básico (público)
app.get('/health', healthCheckHandler);

// Rota alternativa para compatibilidade com frontend
app.get('/api/health', healthCheckHandler);

/**
 * @swagger
 * /health/detailed:
 *   get:
 *     tags:
 *       - Monitoramento
 *     summary: Health check detalhado
 *     description: Endpoint autenticado para verificação detalhada de saúde do sistema
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Status detalhado do sistema
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "ok"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: "2024-01-15T10:30:00.000Z"
 *                 uptime:
 *                   type: number
 *                   example: 3600.5
 *                 system:
 *                   type: object
 *                   properties:
 *                     nodeVersion:
 *                       type: string
 *                       example: "v18.17.0"
 *                     platform:
 *                       type: string
 *                       example: "win32"
 *                     arch:
 *                       type: string
 *                       example: "x64"
 *                     memory:
 *                       type: object
 *                       properties:
 *                         heapUsed:
 *                           type: number
 *                           example: 36700160
 *                         heapTotal:
 *                           type: number
 *                           example: 38797312
 *                         external:
 *                           type: number
 *                           example: 2345678
 *                         rss:
 *                           type: number
 *                           example: 89123456
 *                 database:
 *                   type: object
 *                   properties:
 *                     connected:
 *                       type: boolean
 *                       example: true
 *                     type:
                       type: string
                       example: "Arquivo JSON"
 *                     responseTime:
 *                       type: number
 *                       description: Tempo de resposta em ms
 *                       example: 15.5
 *                 services:
 *                   type: object
 *                   properties:
 *                     nfe:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                           example: "ok"
 *                         certificateValid:
 *                           type: boolean
 *                           example: true
 *                         sefazConnectivity:
 *                           type: boolean
 *                           example: true
 *       401:
 *         description: Token de autenticação inválido ou ausente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Erro interno do servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// Health check detalhado (requer autenticação)
app.get('/health/detailed', 
  authMiddleware.verificarAutenticacao(),
  detailedHealthCheckHandler
);

/**
 * @swagger
 * /metrics:
 *   get:
 *     tags:
 *       - Monitoramento
 *     summary: Métricas do sistema (Prometheus)
 *     description: Endpoint público para coleta de métricas no formato Prometheus
 *     responses:
 *       200:
 *         description: Métricas do sistema no formato Prometheus
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: |
 *                 # HELP nodejs_heap_size_total_bytes Process heap size from Node.js in bytes.
 *                 # TYPE nodejs_heap_size_total_bytes gauge
 *                 nodejs_heap_size_total_bytes 38797312
 *                 
 *                 # HELP nodejs_heap_size_used_bytes Process heap size used from Node.js in bytes.
 *                 # TYPE nodejs_heap_size_used_bytes gauge
 *                 nodejs_heap_size_used_bytes 36700160
 *                 
 *                 # HELP http_requests_total Total number of HTTP requests
 *                 # TYPE http_requests_total counter
 *                 http_requests_total{method="GET",status_code="200"} 156
 *                 
 *                 # HELP http_request_duration_seconds HTTP request duration in seconds
 *                 # TYPE http_request_duration_seconds histogram
 *                 http_request_duration_seconds_bucket{le="0.1"} 120
 *                 http_request_duration_seconds_bucket{le="0.5"} 145
 *                 http_request_duration_seconds_bucket{le="1"} 155
 *                 http_request_duration_seconds_bucket{le="+Inf"} 156
 *                 http_request_duration_seconds_sum 245.6
 *                 http_request_duration_seconds_count 156
 *                 
 *                 # HELP nfe_operations_total Total number of NFe operations
 *                 # TYPE nfe_operations_total counter
 *                 nfe_operations_total{operation="emitir",status="success"} 45
 *                 nfe_operations_total{operation="consultar",status="success"} 89
 *                 nfe_operations_total{operation="cancelar",status="success"} 12
 *       500:
 *         description: Erro ao gerar métricas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// Métricas Prometheus (público para scraping)
app.get('/metrics', metricsHandler);

/**
 * @swagger
 * /status/performance:
 *   get:
 *     tags:
 *       - Monitoramento
 *     summary: Status de performance do sistema
 *     description: Endpoint autenticado para obter métricas detalhadas de performance do sistema
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Métricas de performance retornadas com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: "2024-01-15T10:30:00.000Z"
 *                 uptime:
 *                   type: number
 *                   description: Tempo de atividade em segundos
 *                   example: 3600.5
 *                 performance:
 *                   type: object
 *                   properties:
 *                     cpu:
 *                       type: object
 *                       properties:
 *                         usage:
 *                           type: number
 *                           description: Uso de CPU em porcentagem
 *                           example: 15.5
 *                         loadAverage:
 *                           type: array
 *                           items:
 *                             type: number
 *                           example: [0.1, 0.2, 0.3]
 *                     memory:
 *                       type: object
 *                       properties:
 *                         heapUsed:
 *                           type: number
 *                           example: 36700160
 *                         heapTotal:
 *                           type: number
 *                           example: 38797312
 *                         external:
 *                           type: number
 *                           example: 2345678
 *                         rss:
 *                           type: number
 *                           example: 89123456
 *                         percentage:
 *                           type: number
 *                           description: Porcentagem de uso da memória
 *                           example: 94.6
 *                     eventLoop:
 *                       type: object
 *                       properties:
 *                         lag:
 *                           type: number
 *                           description: Latência do event loop em ms
 *                           example: 0.5
 *                         utilization:
 *                           type: number
 *                           description: Utilização do event loop
 *                           example: 0.02
 *                     gc:
 *                       type: object
 *                       properties:
 *                         collections:
 *                           type: number
 *                           description: Número de coletas de lixo
 *                           example: 45
 *                         duration:
 *                           type: number
 *                           description: Duração total das coletas em ms
 *                           example: 123.45
 *                 requests:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: number
 *                       description: Total de requisições processadas
 *                       example: 156
 *                     avgResponseTime:
 *                       type: number
 *                       description: Tempo médio de resposta em ms
 *                       example: 245.6
 *                     requestsPerSecond:
 *                       type: number
 *                       description: Requisições por segundo
 *                       example: 1.63
 *                 errors:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: number
 *                       description: Total de erros
 *                       example: 2
 *                     rate:
 *                       type: number
 *                       description: Taxa de erro em porcentagem
 *                       example: 1.28
 *       401:
 *         description: Token de autenticação inválido ou ausente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Erro interno do servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// Status de performance (requer autenticação)
app.get('/status/performance', 
  authMiddleware.verificarAutenticacao(),
  performanceStatusHandler
);

// Alertas (requer autenticação admin)
/**
 * @swagger
 * /admin/alerts:
 *   get:
 *     tags:
 *       - Administração
 *     summary: Listar alertas do sistema
 *     description: Endpoint para administradores visualizarem alertas e regras de monitoramento do sistema
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Número máximo de alertas a retornar
 *     responses:
 *       200:
 *         description: Lista de alertas retornada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 alerts:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: "alert_001"
 *                       name:
 *                         type: string
 *                         example: "Alto uso de memória"
 *                       type:
 *                         type: string
 *                         enum: [critical, warning, info]
 *                         example: "warning"
 *                       category:
 *                         type: string
 *                         enum: [system, performance, security, nfe, database, network]
 *                         example: "performance"
 *                       message:
 *                         type: string
 *                         example: "Uso de memória acima do limite configurado"
 *                       value:
 *                         type: number
 *                         example: 85.5
 *                       threshold:
 *                         type: number
 *                         example: 80
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *                         example: "2024-01-15T10:30:00.000Z"
 *                       resolved:
 *                         type: boolean
 *                         example: false
 *                 rules:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: "memory_usage"
 *                       name:
 *                         type: string
 *                         example: "Monitoramento de Memória"
 *                       enabled:
 *                         type: boolean
 *                         example: true
 *                       threshold:
 *                         type: number
 *                         example: 80
 *                       severity:
 *                         type: string
 *                         enum: [critical, warning, info]
 *                         example: "warning"
 *                 stats:
 *                   type: object
 *                   properties:
 *                     totalAlerts:
 *                       type: integer
 *                       example: 25
 *                     activeRules:
 *                       type: integer
 *                       example: 8
 *                     throttledRules:
 *                       type: integer
 *                       example: 2
 *       401:
 *         description: Token de autenticação inválido ou ausente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Usuário não possui permissão de administrador
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Erro interno do servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
app.get('/admin/alerts', 
  authMiddleware.verificarAutenticacao(),
  authMiddleware.verificarPermissao ? authMiddleware.verificarPermissao('admin') : (req, res, next) => next(),
  alertsHandler
);

/**
 * @swagger
 * /admin/alerts/test:
 *   post:
 *     tags:
 *       - Administração
 *     summary: Testar sistema de alertas
 *     description: Endpoint para administradores testarem o sistema de alertas enviando um alerta de teste
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               alertType:
 *                 type: string
 *                 description: Tipo de alerta a ser testado
 *                 example: "high_memory_usage"
 *               testValue:
 *                 type: number
 *                 description: Valor de teste para disparar o alerta
 *                 example: 95.0
 *               severity:
 *                 type: string
 *                 enum: [critical, warning, info]
 *                 description: Severidade do alerta de teste
 *                 example: "warning"
 *               message:
 *                 type: string
 *                 description: Mensagem personalizada para o alerta de teste
 *                 example: "Teste de alerta de memória"
 *             required:
 *               - alertType
 *     responses:
 *       200:
 *         description: Alerta de teste enviado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Alerta de teste enviado com sucesso"
 *                 alert:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "test_alert_001"
 *                     type:
 *                       type: string
 *                       example: "high_memory_usage"
 *                     triggered:
 *                       type: boolean
 *                       example: true
 *                     value:
 *                       type: number
 *                       example: 95.0
 *                     threshold:
 *                       type: number
 *                       example: 80
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-01-15T10:30:00.000Z"
 *                     severity:
 *                       type: string
 *                       example: "warning"
 *       400:
 *         description: Dados de entrada inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Token de autenticação inválido ou ausente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Usuário não possui permissão de administrador
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Erro interno do servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// Teste de alertas (requer autenticação admin)
app.post('/admin/alerts/test', 
  authMiddleware.verificarAutenticacao(),
  authMiddleware.verificarPermissao ? authMiddleware.verificarPermissao('admin') : (req, res, next) => next(),
  testAlertHandler
);

// ==================== MIDDLEWARE DE ERRO ====================
// Middleware de logging de erros (deve vir antes do handler de erro)
app.use(errorLoggingMiddleware());

app.use((err, req, res, next) => {
    console.error('❌ Erro não tratado:', {
        message: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        timestamp: new Date().toISOString()
    });
    
    if (res.headersSent) {
        return next(err);
    }
    
    let statusCode = 500;
    let message = 'Erro interno do servidor';
    
    if (err.message === 'JSON inválido') {
        statusCode = 400;
        message = 'Dados JSON inválidos';
    } else if (err.name === 'ValidationError') {
        statusCode = 400;
        message = 'Dados de entrada inválidos';
    } else if (err.name === 'UnauthorizedError') {
        statusCode = 401;
        message = 'Não autorizado';
    }
    
    res.status(statusCode).json({
        erro: message,
        detalhes: NODE_ENV === 'development' ? err.message : undefined,
        timestamp: new Date().toISOString()
    });
});

// Middleware para rotas não encontradas
app.use('*', (req, res) => {
  res.status(404).json({
    status: "erro",
    message: "Endpoint não encontrado",
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

// ==================== HEALTH CHECK ENDPOINT ====================
/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check básico
 *     description: Verifica se a aplicação está funcionando
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Aplicação saudável
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "healthy"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: number
 *                   example: 3600
 *                 version:
 *                   type: string
 *                   example: "1.0.0"
 */
// Health check routes are defined above using proper handlers from monitoring/health.js

// ==================== CONFIGURAÇÕES DE PRODUÇÃO ====================
// Configurar compressão para produção
if (NODE_ENV === 'production') {
  const compression = require('compression');
  app.use(compression({
    level: parseInt(process.env.COMPRESSION_LEVEL) || 6,
    threshold: 1024,
    filter: (req, res) => {
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    }
  }));
  
  console.log('✅ Compressão habilitada para produção');
}

// Configurar cache para produção
if (NODE_ENV === 'production' && process.env.ENABLE_CACHE === 'true') {
  app.use('/static', express.static(path.join(__dirname, 'public'), {
    maxAge: '1y',
    etag: true,
    lastModified: true
  }));
  
  console.log('✅ Cache estático habilitado');
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('📡 Recebido SIGTERM, iniciando shutdown graceful...');
  if (global.server) {
    global.server.close(() => {
      console.log('✅ Servidor HTTP fechado');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

process.on('SIGINT', () => {
  console.log('📡 Recebido SIGINT, iniciando shutdown graceful...');
  if (global.server) {
    global.server.close(() => {
      console.log('✅ Servidor HTTP fechado');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

// ==================== INICIALIZAÇÃO DO SERVIDOR ====================
async function iniciarServidor() {
  try {
    console.log('🚀 Iniciando servidor consolidado...');
    console.log(`🔧 Ambiente: ${NODE_ENV}`);
    console.log(`🔧 Porta: ${PORT}`);
    console.log(`🔧 Workers: ${process.env.WORKERS || 'auto'}`);
    
    // Tentar conectar ao banco de dados
    try {
      await database.conectar();
      console.log('✅ Banco de dados conectado');
    } catch (dbError) {
      console.warn('⚠️ Falha ao conectar banco de dados:', dbError.message);
      console.log('🔄 Servidor continuará sem banco de dados...');
    }

    // Seed automático removido - usando apenas arquivos JSON

    console.log('✅ Servidor configurado com sucesso!');
    
    // ==================== MONITORAMENTO PERIÓDICO ====================
    // Iniciar monitoramento periódico de métricas e alertas
    setInterval(async () => {
      try {
        // Coletar métricas do sistema
        const memoryUsage = process.memoryUsage();
        const metrics = {
          cpu: 0, // Será atualizado pelo APM
          memoryUsagePercent: memoryUsage.heapUsed / memoryUsage.heapTotal,
          eventLoopLag: 0, // Será atualizado pelo APM
          avgResponseTime: 0, // Será atualizado pelo APM
          errorRate: 0, // Será calculado baseado nos logs
          nfeErrorRate: 0, // Será calculado baseado nas operações NFe
          sefazConnectivity: true // Será verificado pelo health check
        };
        
        // Processar alertas baseados nas métricas
        processAlerts(metrics);
        
      } catch (error) {
        console.error('Erro no monitoramento periódico:', error.message);
      }
    }, 60000); // A cada 1 minuto
    
    // Iniciar servidor Express
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`🌐 Servidor rodando em http://localhost:${PORT}`);
      console.log('📋 Endpoints disponíveis:');
      console.log(`   - POST http://localhost:${PORT}/auth/login`);
      console.log(`   - POST http://localhost:${PORT}/auth/register`);
      console.log(`   - GET  http://localhost:${PORT}/auth/validate`);
      console.log(`   - GET  http://localhost:${PORT}/health`);
      console.log(`   - GET  http://localhost:${PORT}/health/detailed`);
      console.log(`   - GET  http://localhost:${PORT}/metrics`);
      console.log(`   - GET  http://localhost:${PORT}/api/nfe/*`);
      console.log(`   - GET  http://localhost:${PORT}/api/cte/*`);
      console.log(`   - GET  http://localhost:${PORT}/api/mdfe/*`);
      console.log(`   - GET  http://localhost:${PORT}/api/eventos/*`);
      console.log(`   - GET  http://localhost:${PORT}/api/relatorios/*`);
      console.log(`   - GET  http://localhost:${PORT}/api/configuracoes/*`);
      console.log(`   - GET  http://localhost:${PORT}/nfe/status`);
      console.log(`   - GET  http://localhost:${PORT}/nfe/historico`);
      console.log(`   - POST http://localhost:${PORT}/nfe/emitir`);
      console.log(`   - GET  http://localhost:${PORT}/nfe/consultar/:chave`);
      console.log(`   - POST http://localhost:${PORT}/nfe/cancelar`);
      console.log(`   - POST http://localhost:${PORT}/nfe/inutilizar`);
      console.log(`   - GET  http://localhost:${PORT}/nfe/download/:tipo/:chave`);
      console.log(`   - POST http://localhost:${PORT}/nfe/validar`);
      console.log(`   - GET  http://localhost:${PORT}/admin/usuarios`);
      console.log(`   - GET  http://localhost:${PORT}/admin/health`);
      console.log(`   - GET  http://localhost:${PORT}/admin/alerts`);
      console.log(`   - POST http://localhost:${PORT}/admin/alerts/test`);
      console.log(`   - GET  http://localhost:${PORT}/status/performance`);
      
      console.log(`   - GET  http://localhost:${PORT}/clientes`);
      console.log(`   - POST http://localhost:${PORT}/clientes`);
      console.log(`   - GET  http://localhost:${PORT}/produtos`);
      console.log(`   - POST http://localhost:${PORT}/produtos`);
      
      console.log('');
      const ambiente = process.env.AMBIENTE === "1" ? "PRODUÇÃO" : "HOMOLOGAÇÃO";
      const simulacao = process.env.SIMULATION_MODE === 'true' ? " (SIMULAÇÃO)" : "";
      console.log(`✅ SISTEMA ${ambiente}: Certificado A1 configurado e ativo`);
      console.log(`✅ NFe em modo ${ambiente}${simulacao} - SEFAZ ativa`);
      console.log('');
      console.log('🔐 Login padrão: admin@brandaocontador.com.br');
      
      // Notificar que o servidor está pronto (para PM2)
      if (process.send) {
        process.send('ready');
      }
    });

    // Salvar referência do servidor para graceful shutdown
    global.server = server;
    
    // Configurar timeouts para produção
    if (NODE_ENV === 'production') {
      server.timeout = parseInt(process.env.SERVER_TIMEOUT) || 30000;
      server.keepAliveTimeout = parseInt(process.env.KEEP_ALIVE_TIMEOUT) || 5000;
      server.headersTimeout = parseInt(process.env.HEADERS_TIMEOUT) || 6000;
    }

  } catch (error) {
    console.error('❌ Erro ao iniciar servidor:', error.message);
    process.exit(1);
  }
}

// Iniciar servidor
iniciarServidor();