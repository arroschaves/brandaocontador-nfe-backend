require('dotenv').config();

const express = require('express');
const cors = require('cors');
const nfeService = require('./services/nfe-service');
const validationService = require('./services/validation-service');
const logService = require('./services/log-service');
const authMiddleware = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3001;

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

// Rate limiting global
app.use(authMiddleware.limitarTaxa(200, 15 * 60 * 1000)); // 200 requests por 15 minutos

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
app.get('/auth/api-key', 
  authMiddleware.verificarAutenticacao(),
  authMiddleware.verificarPermissao('admin'), 
  (req, res) => {
    const apiKey = authMiddleware.gerarApiKey();
    res.json({ sucesso: true, apiKey });
  }
);

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

      await logService.log('download', 'SUCESSO', { tipo, chave, usuario: req.usuario?.id });

      // Conteúdo simulado para desenvolvimento
      if (tipo === 'xml') {
        const xmlContent = `<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<NFe>\n  <chaveAcesso>${chaveNumerica}</chaveAcesso>\n  <situacao>Autorizada</situacao>\n  <geradoEm>${new Date().toISOString()}</geradoEm>\n</NFe>`;
        res.setHeader('Content-Type', 'application/xml');
        res.setHeader('Content-Disposition', `attachment; filename=\"NFe_${chaveNumerica}.xml\"`);
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
      res.setHeader('Content-Disposition', `attachment; filename=\"NFe_${chaveNumerica}.pdf\"`);
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

// Emitir NFe (requer autenticação e permissão)
app.post('/nfe/emitir', 
  authMiddleware.verificarAutenticacao(),
  authMiddleware.verificarPermissao('nfe_emitir'),
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
      console.error('❌ Stack trace:', error.stack);
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

// Consultar NFe (requer autenticação)
app.get('/nfe/consultar/:chave', 
  authMiddleware.verificarAutenticacao(),
  authMiddleware.verificarPermissao('nfe_consultar'),
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

// Cancelar NFe (requer autenticação e permissão)
app.post('/nfe/cancelar', 
  authMiddleware.verificarAutenticacao(),
  authMiddleware.verificarPermissao('nfe_cancelar'),
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

// Histórico de NFes (requer autenticação)
app.get('/nfe/historico', 
  authMiddleware.verificarAutenticacao(),
  async (req, res) => {
    try {
      const { dataInicio, dataFim, situacao, limite = 50 } = req.query;
      
      const resultado = await nfeService.obterHistorico({
        dataInicio,
        dataFim,
        situacao,
        limite: parseInt(limite)
      });

      res.json(resultado);

    } catch (error) {
      await logService.logErro('historico', error, { 
        query: req.query,
        usuario: req.usuario.id 
      });
      res.status(500).json({
        sucesso: false,
        erro: 'Erro interno ao obter histórico',
        codigo: 'HISTORICO_ERROR'
      });
    }
  }
);

// Salvar rascunho de NFe (requer autenticação)
app.post('/nfe/rascunho', 
  authMiddleware.verificarAutenticacao(),
  async (req, res) => {
    try {
      // Validação básica dos dados
      const validacao = await validationService.validarDadosNfe(req.body, { rascunho: true });
      
      // Para rascunho, permitimos dados incompletos
      const rascunho = {
        id: Date.now().toString(),
        dados: req.body,
        usuario: req.usuario.id,
        dataUltimaAlteracao: new Date().toISOString(),
        validacao: validacao
      };
      
      // Simular salvamento do rascunho
      await logService.log('rascunho_salvo', 'SUCESSO', { 
        rascunho: rascunho.id,
        usuario: req.usuario.id 
      });

      res.json({
        sucesso: true,
        mensagem: 'Rascunho salvo com sucesso',
        id: rascunho.id,
        dataUltimaAlteracao: rascunho.dataUltimaAlteracao
      });

    } catch (error) {
      await logService.logErro('rascunho', error, { 
        dados: req.body,
        usuario: req.usuario.id 
      });
      res.status(500).json({
        sucesso: false,
        erro: 'Erro interno ao salvar rascunho',
        codigo: 'RASCUNHO_ERROR'
      });
    }
  }
);

// Endpoint de teste simples para debug
app.post('/nfe/validar-debug', async (req, res) => {
  try {
    console.log('=== DEBUG VALIDAÇÃO ===');
    console.log('Dados recebidos:', JSON.stringify(req.body, null, 2));
    
    const validacao = await validationService.validarDadosNfe(req.body);
    
    console.log('Resultado da validação:', JSON.stringify(validacao, null, 2));
    console.log('=== FIM DEBUG ===');
    
    res.json({
      sucesso: true,
      validacao
    });

  } catch (error) {
    console.error('=== ERRO DEBUG ===');
    console.error('Erro completo:', error);
    console.error('Stack trace:', error.stack);
    console.error('=== FIM ERRO ===');
    
    res.status(500).json({
      sucesso: false,
      erro: 'Erro interno na validação',
      codigo: 'VALIDACAO_ERROR',
      detalhes: error.message,
      stack: error.stack
    });
  }
});

// Validar dados da NFe (público para facilitar desenvolvimento)
app.post('/nfe/validar', 
  authMiddleware.verificarAutenticacaoOpcional(),
  async (req, res) => {
    try {
      console.log('Dados recebidos para validação:', JSON.stringify(req.body, null, 2));
      
      const validacao = await validationService.validarDadosNfe(req.body);
      
      console.log('Resultado da validação:', JSON.stringify(validacao, null, 2));
      
      await logService.logValidacao(req.body, validacao);

      res.json({
        sucesso: true,
        validacao
      });

    } catch (error) {
      console.error('Erro na validação:', error);
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

// ==================== ROTAS DE CONFIGURAÇÕES ====================

// Merge profundo simples para objetos
function mergeDeep(target, source) {
  if (!target || typeof target !== 'object') target = {};
  if (!source || typeof source !== 'object') return target;
  for (const key of Object.keys(source)) {
    const value = source[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      target[key] = mergeDeep(target[key] || {}, value);
    } else {
      target[key] = value;
    }
  }
  return target;
}

// Armazenamento simples em memória para configurações (sem persistência)
const configuracoesEstado = {
  empresa: {
    razaoSocial: 'Brandão Contador Ltda',
    nomeFantasia: 'Brandão Contador',
    cnpj: '12.345.678/0001-90',
    inscricaoEstadual: '123.456.789.012',
    inscricaoMunicipal: '12345678',
    emailCorporativo: 'contato@brandaocontador.com.br',
    telefoneComercial: '(11) 99999-9999',
    formaTributacao: 'Simples Nacional',
    endereco: {
      cep: '01234567',
      logradouro: 'Rua das Empresas',
      numero: '123',
      complemento: 'Sala 456',
      bairro: 'Centro',
      cidade: 'São Paulo',
      uf: 'SP'
    }
  },
  nfe: {},
  notificacoes: {},
  sistema: {}
};

// Obter configurações (requer permissão)
app.get('/configuracoes',
  authMiddleware.verificarAutenticacao(),
  authMiddleware.verificarPermissao('configuracoes_ver'),
  async (req, res) => {
    try {
      res.json({ sucesso: true, configuracoes: configuracoesEstado });
    } catch (error) {
      await logService.logErro('configuracoes_get', error, { ip: req.ip });
      res.status(500).json({ sucesso: false, erro: 'Erro ao obter configurações' });
    }
  }
);

// Atualizar configurações (apenas admin)
app.post('/configuracoes',
  authMiddleware.verificarAutenticacao(),
  authMiddleware.verificarPermissao('admin'),
  async (req, res) => {
    try {
      const dados = req.body || {};
      // Mescla dados enviados com estado atual
      mergeDeep(configuracoesEstado, dados);
      await logService.log('configuracoes_update', 'SUCESSO', {
        usuario: req.usuario?.id,
        camposAtualizados: Object.keys(dados)
      });
      res.json({ sucesso: true, configuracoes: configuracoesEstado });
    } catch (error) {
      await logService.logErro('configuracoes_update', error, { ip: req.ip });
      res.status(500).json({ sucesso: false, erro: 'Erro ao salvar configurações' });
    }
  }
);

// Status do sistema (público)
app.get('/nfe/status', async (req, res) => {
  try {
    const status = await nfeService.verificarStatusSistema();
    
    res.json({
      sucesso: true,
      status,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    await logService.logErro('status', error);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro ao verificar status do sistema',
      codigo: 'STATUS_ERROR'
    });
  }
});

// ==================== MIDDLEWARE DE ERRO ====================

// Middleware de tratamento de erros global
app.use((err, req, res, next) => {
    console.error('❌ Erro não tratado:', {
        message: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        body: req.body,
        timestamp: new Date().toISOString()
    });
    
    // Se o erro já foi enviado, não enviar novamente
    if (res.headersSent) {
        return next(err);
    }
    
    // Tratar diferentes tipos de erro
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
        detalhes: process.env.NODE_ENV === 'development' ? err.message : undefined,
        timestamp: new Date().toISOString()
    });
});

// ==================== HEALTH CHECK PÚBLICO ====================

// Endpoint simples de saúde para monitoramento externo
app.get('/health', async (req, res) => {
  try {
    res.json({
      sucesso: true,
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      versaoNode: process.version
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: 'Erro ao verificar saúde' });
  }
});

// Alias compatível com documentação antiga
app.get('/api/health', async (req, res) => {
  try {
    res.json({
      sucesso: true,
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      versaoNode: process.version
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: 'Erro ao verificar saúde' });
  }
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

// ==================== INICIALIZAÇÃO ====================

app.listen(PORT, () => {
  console.log(`🚀 Backend NFe rodando em http://localhost:${PORT}`);
  console.log(`📊 Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔐 Certificado: ${process.env.CERT_PATH ? 'Configurado' : 'NÃO CONFIGURADO'}`);
  console.log(`📋 Endpoints disponíveis:`);
  console.log(`   GET  /nfe/teste`);
  console.log(`   POST /nfe/teste`);
  console.log(`   POST /nfe/emitir`);
  console.log(`   GET  /nfe/consultar/:chave`);
  console.log(`   POST /nfe/cancelar`);
  console.log(`   GET  /nfe/historico`);
  console.log(`   POST /nfe/validar`);
  console.log(`   GET  /nfe/status`);
});