require('dotenv').config();

const express = require('express');
const cors = require('cors');
const database = require('./config/database');
const nfeService = require('./services/nfe-service');
const validationService = require('./services/validation-service');
const logService = require('./services/log-service');
const authMiddleware = require('./middleware/auth-real');

const app = express();
const PORT = process.env.PORT || 3001;

// ==================== CONEXÃO COM BANCO DE DADOS ====================

async function iniciarServidor() {
  try {
    console.log('🚀 Iniciando servidor com banco de dados real...');
    
    // Conectar ao MongoDB
    await database.connect();
    
    console.log('✅ Servidor configurado com sucesso!');
    console.log(`📡 Porta: ${PORT}`);
    
    // Iniciar servidor Express
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🌐 Servidor rodando em http://localhost:${PORT}`);
      console.log('📋 Endpoints disponíveis:');
      console.log(`   - POST http://localhost:${PORT}/auth/login`);
      console.log(`   - POST http://localhost:${PORT}/auth/register`);
      console.log(`   - GET  http://localhost:${PORT}/auth/validate`);
      console.log(`   - GET  http://localhost:${PORT}/nfe/teste`);
      console.log(`   - GET  http://localhost:${PORT}/nfe/status`);
      console.log(`   - GET  http://localhost:${PORT}/nfe/historico`);
      console.log(`   - POST http://localhost:${PORT}/nfe/emitir`);
      console.log(`   - GET  http://localhost:${PORT}/nfe/cancelar/:chave`);
      console.log(`   - GET  http://localhost:${PORT}/nfe/cart-correcao/:chave`);
      console.log(`   - GET  http://localhost:${PORT}/nfe/inutilizar`);
      console.log(`   - GET  http://localhost:${PORT}/nfe/download/:tipo/:chave`);
      console.log(`   - POST http://localhost:${PORT}/nfe/validar`);
      console.log(`   - GET  http://localhost:${PORT}/nfe/consultar/:chave`);
      console.log('');
      console.log('⚠️  MODO DESENVOLVIMENTO: Certificado A3 não configurado');
      console.log('⚠️  Usando simulação para operações NFe');
      console.log('');
      console.log('💡 Dica: Use o endpoint /auth/register para criar seu primeiro usuário!');
    });

  } catch (error) {
    console.error('❌ Erro ao iniciar servidor:', error.message);
    process.exit(1);
  }
}

// ==================== MIDDLEWARE ====================

// CORS configurado para permitir requisições do frontend
const corsOrigins = process.env.CORS_ORIGINS 
  ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
  : [
    'https://brandaocontador.com.br',
    'https://app.brandaocontador.com.br',
    'https://nfe.brandaocontador.com.br',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:3003',
    'http://localhost:5173' // Vite dev server
  ];

// Middleware para lidar com requisições OPTIONS (preflight)
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    const origin = req.headers.origin;
    // Se a origem estiver na lista permitida, use-a, caso contrário, use localhost:3002
    const allowedOrigin = corsOrigins.includes(origin) ? origin : 'http://localhost:3002';
    res.header('Access-Control-Allow-Origin', allowedOrigin);
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', '86400'); // 24 horas
    return res.status(200).end();
  }
  next();
});

app.use(cors({
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
}));

// Middleware para parsing JSON com tratamento de erros
app.use(express.json({ 
    limit: '10mb'
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware de logging para todas as requisições
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path} - IP: ${req.ip}`);
  next();
});

// ==================== ROTAS DE AUTENTICAÇÃO ====================
app.post('/auth/login', authMiddleware.login.bind(authMiddleware));
app.post('/auth/register', authMiddleware.register.bind(authMiddleware));
app.get('/auth/validate', 
  authMiddleware.verificarAutenticacao(), 
  authMiddleware.validarToken.bind(authMiddleware)
);

// Rota para limpar usuários (apenas para desenvolvimento)
if (process.env.NODE_ENV !== 'production') {
  app.delete('/auth/limpar-usuarios', 
    authMiddleware.limparUsuarios.bind(authMiddleware)
  );
}

// ==================== ENDPOINTS NFE ====================



// Status do sistema NFe (requer autenticação)
app.get('/nfe/status',
  authMiddleware.verificarAutenticacao(),
  async (req, res) => {
    try {
      const status = await nfeService.verificarStatusSistema();
      await logService.log('status', 'SUCESSO', { usuario: req.usuario?.id });
      res.json({ sucesso: true, status });
    } catch (error) {
      await logService.logErro('status', error, { ip: req.ip });
      res.status(500).json({ sucesso: false, erro: 'Erro ao obter status do sistema' });
    }
  }
);

// Histórico de NFes (simulação com paginação)
app.get('/nfe/historico', 
  authMiddleware.verificarAutenticacao(),
  async (req, res) => {
    try {
      const pagina = parseInt(req.query.pagina) || 1;
      const limite = parseInt(req.query.limite) || 10;

      // Simulação de dados (substituir por consulta ao banco em produção)
      const todasNfes = [
        {
          id: '1',
          numero: '000001234',
          serie: '001',
          chave: '35200714200166000187550010000000015123456789',
          destinatario: 'Empresa ABC Ltda',
          documento: '12.345.678/0001-90',
          valor: 15000.00,
          status: 'autorizada',
          dataEmissao: '2024-01-15T10:30:00Z'
        },
        {
          id: '2',
          numero: '000001235',
          serie: '001',
          chave: '35200714200166000187550010000000025123456789',
          destinatario: 'Comércio XYZ S/A',
          documento: '98.765.432/0001-00',
          valor: 8500.75,
          status: 'autorizada',
          dataEmissao: '2024-01-15T09:15:00Z'
        },
        {
          id: '3',
          numero: '000001236',
          serie: '001',
          chave: '35200714200166000187550010000000035123456789',
          destinatario: 'Indústria DEF Ltda',
          documento: '11.222.333/0001-44',
          valor: 32000.00,
          status: 'pendente',
          dataEmissao: '2024-01-15T08:45:00Z'
        }
      ];

      const total = todasNfes.length;
      const inicio = (pagina - 1) * limite;
      const fim = inicio + limite;
      const nfes = todasNfes.slice(inicio, fim);

      await logService.log('historico', 'SUCESSO', {
        usuario: req.usuario?.id,
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
      res.status(500).json({
        sucesso: false,
        erro: 'Erro ao obter histórico de NFes'
      });
    }
  }
);

// Download de XML/PDF da NFe (simulado para desenvolvimento)
app.get('/nfe/download/:tipo/:chave',
  authMiddleware.verificarAutenticacao(),
  authMiddleware.verificarPermissao('nfe_consultar'),
  async (req, res) => {
    try {
      const { tipo, chave } = req.params;
      
      if (!['xml', 'pdf'].includes(tipo)) {
        return res.status(400).json({
          sucesso: false,
          erro: 'Tipo de download inválido. Use "xml" ou "pdf".'
        });
      }

      // Simulação de download
      const conteudo = `Simulação de ${tipo.toUpperCase()} da NFe ${chave}`;
      const nomeArquivo = `NFe_${chave}.${tipo}`;
      
      await logService.log('download', 'SUCESSO', {
        usuario: req.usuario.id,
        chave,
        tipo,
        ip: req.ip
      });

      res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
      res.setHeader('Content-Type', tipo === 'xml' ? 'application/xml' : 'application/pdf');
      res.send(conteudo);

    } catch (error) {
      await logService.logErro('download', error, { ip: req.ip });
      res.status(500).json({
        sucesso: false,
        erro: 'Erro ao realizar download'
      });
    }
  }
);

// ==================== ROTAS ADMINISTRATIVAS ====================

// Limpar banco de dados (apenas desenvolvimento)
app.delete('/admin/limpar-banco',
  authMiddleware.verificarAutenticacao(),
  authMiddleware.verificarPermissao('admin'),
  async (req, res) => {
    try {
      await database.limparBanco();
      res.json({
        sucesso: true,
        mensagem: 'Banco de dados limpo com sucesso!'
      });
    } catch (error) {
      res.status(500).json({
        sucesso: false,
        erro: 'Erro ao limpar banco de dados'
      });
    }
  }
);

// Health check detalhado
app.get('/admin/health',
  authMiddleware.verificarAutenticacao(),
  authMiddleware.verificarPermissao('admin'),
  async (req, res) => {
    try {
      const health = {
        timestamp: new Date().toISOString(),
        status: 'ok',
        bancoDados: database.isConnected() ? 'conectado' : 'desconectado',
        memoria: process.memoryUsage(),
        uptime: process.uptime(),
        versao: process.version
      };
      
      res.json({ sucesso: true, health });
    } catch (error) {
      res.status(500).json({
        sucesso: false,
        erro: 'Erro ao verificar saúde do sistema'
      });
    }
  }
);

// ==================== TRATAMENTO DE ERROS ====================

// Middleware para tratamento de erros
app.use((error, req, res, next) => {
  console.error('❌ Erro não tratado:', error);
  
  logService.logErro('erro_geral', error, {
    endpoint: req.path,
    method: req.method,
    ip: req.ip
  });

  res.status(500).json({
    sucesso: false,
    erro: 'Erro interno do servidor',
    codigo: 'INTERNAL_ERROR'
  });
});

// Middleware para rotas não encontradas
app.use('*', (req, res) => {
  res.status(404).json({
    sucesso: false,
    erro: 'Rota não encontrada',
    codigo: 'ROUTE_NOT_FOUND',
    rota: req.originalUrl,
    metodo: req.method
  });
});

// ==================== INICIAR SERVIDOR ====================

iniciarServidor();

module.exports = app;