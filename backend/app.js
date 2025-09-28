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
app.use(cors({
  origin: ['https://brandaocontador.com.br', 'https://app.brandaocontador.com.br', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
}));

// Middleware para parsing de JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting global
app.use(authMiddleware.limitarTaxa(200, 15 * 60 * 1000)); // 200 requests por 15 minutos

// Middleware de logging para todas as requisições
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path} - IP: ${req.ip}`);
  next();
});

// ==================== ENDPOINTS DE AUTENTICAÇÃO ====================

// Login (público)
app.post('/auth/login', (req, res) => authMiddleware.login(req, res));

// Gerar API Key (requer autenticação)
app.post('/auth/api-key', 
  authMiddleware.verificarAutenticacao(),
  authMiddleware.verificarPermissao('admin'),
  (req, res) => {
    try {
      const novaApiKey = authMiddleware.gerarApiKey();
      
      logService.log('api_key_gerada', 'SUCESSO', {
        usuario: req.usuario.id,
        apiKey: novaApiKey.substring(0, 8) + '...'
      });

      res.json({
        sucesso: true,
        apiKey: novaApiKey,
        observacao: 'Guarde esta chave em local seguro. Ela não será exibida novamente.'
      });
    } catch (error) {
      logService.logErro('api_key_geracao', error);
      res.status(500).json({
        sucesso: false,
        erro: 'Erro ao gerar API Key'
      });
    }
  }
);

// ==================== ENDPOINTS NFE ====================

// Endpoint de teste (público para verificar conectividade)
app.get('/nfe/teste', async (req, res) => {
  try {
    await logService.log('teste', 'SUCESSO', { ip: req.ip });
    
    res.json({
      sucesso: true,
      mensagem: 'API NFe funcionando corretamente!',
      timestamp: new Date().toISOString(),
      versao: '1.0.0'
    });
  } catch (error) {
    await logService.logErro('teste', error);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro interno do servidor'
    });
  }
});

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
      const resultado = await nfeService.emitirNFe(req.body);
      
      await logService.logEmissao(req.body, resultado);

      if (resultado.sucesso) {
        res.json(resultado);
      } else {
        res.status(400).json(resultado);
      }

    } catch (error) {
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

      const resultado = await nfeService.cancelarNFe(chave, justificativa);
      
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

// Middleware de tratamento de erros
app.use((error, req, res, next) => {
  console.error('Erro não tratado:', error);
  
  res.status(500).json({
    status: "erro",
    message: "Erro interno do servidor",
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