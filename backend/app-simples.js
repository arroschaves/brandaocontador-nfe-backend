require('dotenv').config();

const express = require('express');
const cors = require('cors');
const database = require('./config/database-simples');
const logService = require('./services/log-service');
const authMiddleware = require('./middleware/auth-simples');
const nfeService = require('./services/nfe-service');
const validationService = require('./services/validation-service');

const app = express();
const PORT = process.env.PORT || 3002;

// ==================== INICIALIZAÇÃO ====================

async function iniciarServidor() {
  try {
    console.log('🚀 Iniciando servidor com banco de dados simples...');
    
    // Conectar ao banco de dados
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
  console.log('💡 Dica: Use o endpoint /auth/register para criar seu primeiro usuário!');
  console.log('💾 Banco de dados: Modo arquivo (data/database.json)');
      console.log(`   - GET  http://localhost:${PORT}/admin/usuarios`);
      console.log(`   - GET  http://localhost:${PORT}/admin/health`);
      console.log(`   - GET  http://localhost:${PORT}/health`);
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
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
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
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
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


// ==================== ROTAS DE CONFIGURAÇÕES ====================

// Obter configurações (requer permissão)
app.get('/configuracoes',
  authMiddleware.verificarAutenticacao(),
  authMiddleware.verificarPermissao('configuracoes_ver'),
  async (req, res) => {
    try {
      const configuracoes = await database.getConfiguracoes();

      await logService.log('configuracoes_get', 'SUCESSO', { usuario: req.usuario?.id });
      res.json({ sucesso: true, configuracoes });
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

      // Atualiza e persiste configurações
      const configuracoesAtualizadas = await database.atualizarConfiguracoes(dados);

      await logService.log('configuracoes_post', 'SUCESSO', {
        usuario: req.usuario?.id,
        camposAtualizados: Object.keys(dados)
      });

      res.json({ sucesso: true, configuracoes: configuracoesAtualizadas });
    } catch (error) {
      await logService.logErro('configuracoes_post', error, { ip: req.ip });
      res.status(500).json({ sucesso: false, erro: 'Erro ao salvar configurações' });
    }
  }
);


// Status do sistema NFe (requer autenticação)
app.get('/nfe/status',
  authMiddleware.verificarAutenticacao(),
  async (req, res) => {
    try {
      // Utiliza o service para manter o mesmo formato esperado no frontend
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

      // Buscar NFes do banco de dados
      const nfes = await database.listarNfes({
        usuarioId: req.usuario?.id
      });

      const total = nfes.length;
      const inicio = (pagina - 1) * limite;
      const fim = inicio + limite;
      const nfesPaginadas = nfes.slice(inicio, fim);

      await logService.log('historico', 'SUCESSO', {
        usuario: req.usuario?.id,
        pagina,
        limite,
        retornadas: nfesPaginadas.length
      });

      res.json({
        sucesso: true,
        nfes: nfesPaginadas,
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

// Listar usuários (apenas admin)
app.get('/admin/usuarios',
  authMiddleware.verificarAutenticacao(),
  authMiddleware.verificarPermissao('admin'),
  async (req, res) => {
    try {
      const usuarios = await database.listarUsuarios();

      const usuariosMapeados = (usuarios || []).map((u) => {
        const documento = (u.documento || '').replace(/\D/g, '');
        const tipoCliente = u.tipoCliente && ['cpf', 'cnpj'].includes(u.tipoCliente)
          ? u.tipoCliente
          : (documento.length === 14 ? 'cnpj' : 'cpf');
        const perfil = Array.isArray(u.permissoes) && (u.permissoes.includes('admin') || u.permissoes.includes('admin_total')) ? 'admin' : 'usuario';
        const status = u.status ? u.status : (u.ativo === false ? 'inativo' : 'ativo');

        return {
          id: u.id?.toString() || u._id?.toString() || String(Date.now()),
          nome: u.nome || 'Usuário',
          email: u.email || '',
          documento: u.documento || '',
          tipoCliente,
          telefone: u.telefone || '',
          empresa: u.razaoSocial || u.nomeFantasia || '',
          perfil,
          permissoes: Array.isArray(u.permissoes) ? u.permissoes : [],
          status,
          dataCriacao: (u.criadoEm || u.dataCadastro || new Date().toISOString()),
          ultimoAcesso: u.ultimoAcesso || null
        };
      });

      await logService.log('admin_usuarios_list', 'SUCESSO', {
        usuario: req.usuario?.id,
        quantidade: usuariosMapeados.length
      });

      res.json({ sucesso: true, usuarios: usuariosMapeados });
    } catch (error) {
      await logService.logErro('admin_usuarios_list', error, { ip: req.ip });
      res.status(500).json({ sucesso: false, erro: 'Erro ao listar usuários' });
    }
  }
);

// Atualizar usuário (apenas admin)
app.patch('/admin/usuarios/:id',
  authMiddleware.verificarAutenticacao(),
  authMiddleware.verificarPermissao('admin'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const dados = req.body || {};

      // Sanitiza campos permitidos
      const camposPermitidos = ['nome', 'email', 'documento', 'tipoCliente', 'telefone', 'razaoSocial', 'nomeFantasia', 'permissoes', 'status'];
      const atualizacoes = Object.keys(dados)
        .filter(k => camposPermitidos.includes(k))
        .reduce((acc, k) => ({ ...acc, [k]: dados[k] }), {});

      const usuarioAtualizado = await database.atualizarUsuario(id, atualizacoes);
      if (!usuarioAtualizado) {
        return res.status(404).json({ sucesso: false, erro: 'Usuário não encontrado' });
      }

      await logService.log('admin_usuario_update', 'SUCESSO', { usuario: req.usuario?.id, alvo: id, campos: Object.keys(atualizacoes) });
      res.json({ sucesso: true, usuario: usuarioAtualizado });
    } catch (error) {
      await logService.logErro('admin_usuario_update', error, { ip: req.ip });
      res.status(500).json({ sucesso: false, erro: 'Erro ao atualizar usuário' });
    }
  }
);

// Alterar status do usuário (apenas admin)
app.patch('/admin/usuarios/:id/status',
  authMiddleware.verificarAutenticacao(),
  authMiddleware.verificarPermissao('admin'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body || {};
      if (!['ativo', 'inativo', 'bloqueado'].includes(status)) {
        return res.status(400).json({ sucesso: false, erro: 'Status inválido' });
      }
      const usuarioAtualizado = await database.atualizarUsuario(id, { status, ativo: status === 'ativo' });
      if (!usuarioAtualizado) {
        return res.status(404).json({ sucesso: false, erro: 'Usuário não encontrado' });
      }
      await logService.log('admin_usuario_status', 'SUCESSO', { usuario: req.usuario?.id, alvo: id, status });
      res.json({ sucesso: true, usuario: usuarioAtualizado });
    } catch (error) {
      await logService.logErro('admin_usuario_status', error, { ip: req.ip });
      res.status(500).json({ sucesso: false, erro: 'Erro ao alterar status do usuário' });
    }
  }
);

// Remover usuário (apenas admin)
app.delete('/admin/usuarios/:id',
  authMiddleware.verificarAutenticacao(),
  authMiddleware.verificarPermissao('admin'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const removido = await database.removerUsuario(id);
      if (!removido) {
        return res.status(404).json({ sucesso: false, erro: 'Usuário não encontrado' });
      }
      await logService.log('admin_usuario_delete', 'SUCESSO', { usuario: req.usuario?.id, alvo: id });
      res.json({ sucesso: true });
    } catch (error) {
      await logService.logErro('admin_usuario_delete', error, { ip: req.ip });
      res.status(500).json({ sucesso: false, erro: 'Erro ao remover usuário' });
    }
  }
);

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

// Estatísticas do sistema
app.get('/admin/estatisticas',
  authMiddleware.verificarAutenticacao(),
  authMiddleware.verificarPermissao('admin'),
  async (req, res) => {
    try {
      const estatisticas = await database.getEstatisticas();
      res.json({ sucesso: true, estatisticas });
    } catch (error) {
      res.status(500).json({
        sucesso: false,
        erro: 'Erro ao obter estatísticas'
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

// Health check público
app.get('/health', async (req, res) => {
  try {
    res.json({
      sucesso: true,
      status: 'ok',
      timestamp: new Date().toISOString(),
      bancoDados: database.isConnected() ? 'conectado' : 'desconectado',
      uptime: process.uptime(),
      versaoNode: process.version
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: 'Erro ao verificar saúde' });
  }
});

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