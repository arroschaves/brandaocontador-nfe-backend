// ==================== MIDDLEWARE DE AUTENTICAÇÃO CONSOLIDADO ====================
// Sistema JSON puro - MongoDB removido

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

// Configuração para sistema JSON
const NODE_ENV = process.env.NODE_ENV || 'development';

// Imports consolidados
const database = require('../config/database');

// Configurações JWT
const JWT_SECRET = process.env.JWT_SECRET || 'nfe-secret-key-brandao-contador-2024';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// Rate limiting para autenticação
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // máximo 5 tentativas por IP
  message: {
    sucesso: false,
    erro: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
    codigo: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Pular rate limiting em desenvolvimento se especificado
    return process.env.SKIP_AUTH_RATE_LIMIT === 'true';
  }
});

// ==================== CLASSE PRINCIPAL ====================
class AuthMiddleware {
  constructor() {
    this.apiKeys = new Set();
    this.blacklistedTokens = new Set();
    
    // Gerar API keys padrão em desenvolvimento
    if (NODE_ENV === 'development') {
      this.apiKeys.add('nfe-dev-key-2024');
      this.apiKeys.add('nfe-admin-key-2024');
    }
  }

  // ==================== MÉTODOS DE AUTENTICAÇÃO ====================

  /**
   * Login de usuário
   */
  async login(req, res) {
    try {
      const { email, senha, apiKey } = req.body;

      // Autenticação por API Key
      if (apiKey) {
        return this.loginComApiKey(req, res, apiKey);
      }

      // Validação de entrada
      if (!email || !senha) {
        return res.status(400).json({
          sucesso: false,
          erro: 'Email e senha são obrigatórios',
          codigo: 'DADOS_OBRIGATORIOS'
        });
      }

      // Buscar usuário (sistema JSON)
      const usuario = await database.buscarUsuarioPorEmail(email.toLowerCase());

      if (!usuario) {
        return res.status(401).json({
          sucesso: false,
          erro: 'Credenciais inválidas',
          codigo: 'CREDENCIAIS_INVALIDAS'
        });
      }

      // Verificar senha
      const senhaValida = await bcrypt.compare(senha, usuario.senha);
      if (!senhaValida) {
        return res.status(401).json({
          sucesso: false,
          erro: 'Credenciais inválidas',
          codigo: 'CREDENCIAIS_INVALIDAS'
        });
      }

      // Verificar se usuário está ativo
      if (usuario.ativo === false || usuario.status === 'inativo') {
        return res.status(401).json({
          sucesso: false,
          erro: 'Usuário inativo',
          codigo: 'USUARIO_INATIVO'
        });
      }

      // Gerar token JWT
      const token = this.gerarToken(usuario);

      // Atualizar último login (sistema JSON)
      const agora = new Date().toISOString();
      await database.atualizarUsuario(usuario.id, { 
        ultimoLogin: agora,
        totalLogins: (usuario.totalLogins || 0) + 1
      });

      // Resposta de sucesso
      const { senha: _, ...usuarioSemSenha } = usuario;
      res.json({
        sucesso: true,
        token,
        usuario: usuarioSemSenha,
        tipoAuth: 'jwt',
        expiresIn: JWT_EXPIRES_IN
      });

    } catch (error) {
      console.error('❌ Erro no login:', error);
      res.status(500).json({
        sucesso: false,
        erro: 'Erro interno no servidor',
        codigo: 'ERRO_INTERNO'
      });
    }
  }

  /**
   * Login com API Key
   */
  async loginComApiKey(req, res, apiKey) {
    try {
      if (!this.validarApiKey(apiKey)) {
        return res.status(401).json({
          sucesso: false,
          erro: 'API Key inválida',
          codigo: 'API_KEY_INVALIDA'
        });
      }

      // Usuário virtual para API Key
      const usuarioApiKey = {
        id: 'api-key-user',
        nome: 'API Key User',
        email: 'api@brandaocontador.com.br',
        tipo: 'api',
        permissoes: ['nfe_consultar', 'nfe_emitir', 'nfe_cancelar'],
        ativo: true
      };

      res.json({
        sucesso: true,
        usuario: usuarioApiKey,
        tipoAuth: 'api-key',
        apiKey: apiKey
      });

    } catch (error) {
      console.error('❌ Erro no login com API Key:', error);
      res.status(500).json({
        sucesso: false,
        erro: 'Erro interno no servidor',
        codigo: 'ERRO_INTERNO'
      });
    }
  }

  /**
   * Registro de usuário
   */
  async register(req, res) {
    try {
      const {
        nome,
        email,
        senha,
        tipoCliente,
        documento,
        telefone,
        razaoSocial,
        nomeFantasia,
        endereco
      } = req.body;

      // Validações básicas
      if (!nome || !email || !senha || !tipoCliente || !documento) {
        return res.status(400).json({
          sucesso: false,
          erro: 'Campos obrigatórios: nome, email, senha, tipoCliente, documento',
          codigo: 'DADOS_OBRIGATORIOS'
        });
      }

      // Validar formato do email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          sucesso: false,
          erro: 'Formato de email inválido',
          codigo: 'EMAIL_INVALIDO'
        });
      }

      // Validar força da senha
      if (senha.length < 6) {
        return res.status(400).json({
          sucesso: false,
          erro: 'Senha deve ter pelo menos 6 caracteres',
          codigo: 'SENHA_FRACA'
        });
      }

      // Verificar se usuário já existe (sistema JSON)
      const usuarioExistente = await database.buscarUsuarioPorEmail(email.toLowerCase()) ||
                               await database.buscarUsuarioPorDocumento(documento.replace(/\D/g, ''));

      if (usuarioExistente) {
        return res.status(409).json({
          sucesso: false,
          erro: 'Usuário já existe com este email ou documento',
          codigo: 'USUARIO_EXISTENTE'
        });
      }

      // Hash da senha
      const senhaHash = await bcrypt.hash(senha, 12);

      // Criar usuário
      const dadosUsuario = {
        nome: nome.trim(),
        email: email.toLowerCase().trim(),
        senha: senhaHash,
        tipoCliente,
        documento: documento.replace(/\D/g, ''),
        telefone: telefone?.trim(),
        razaoSocial: razaoSocial?.trim(),
        nomeFantasia: nomeFantasia?.trim(),
        endereco: endereco || {},
        permissoes: ['nfe_consultar', 'nfe_emitir'], // Permissões básicas
        ativo: true,
        status: 'ativo',
        criadoEm: new Date().toISOString(),
        ultimoLogin: null,
        totalLogins: 0
      };

      // Criar usuário (sistema JSON)
      const novoUsuario = await database.criarUsuario(dadosUsuario);

      // Gerar token para o novo usuário
      const token = this.gerarToken(novoUsuario);

      // Resposta de sucesso
      const { senha: _, ...usuarioSemSenha } = novoUsuario;
      res.status(201).json({
        sucesso: true,
        token,
        usuario: usuarioSemSenha,
        tipoAuth: 'jwt',
        expiresIn: JWT_EXPIRES_IN,
        mensagem: 'Usuário criado com sucesso'
      });

    } catch (error) {
      console.error('❌ Erro no registro:', error);
      res.status(500).json({
        sucesso: false,
        erro: 'Erro interno no servidor',
        codigo: 'ERRO_INTERNO'
      });
    }
  }

  /**
   * Login social removido - sistema JSON não suporta
   */
  async social(req, res) {
    return res.status(501).json({
      sucesso: false,
      erro: 'Login social não disponível - sistema JSON puro',
      codigo: 'FUNCIONALIDADE_INDISPONIVEL'
    });
  }

  // ==================== MIDDLEWARES DE VERIFICAÇÃO ====================

  /**
   * Verificar autenticação (obrigatória)
   */
  verificarAutenticacao() {
    return async (req, res, next) => {
      try {
        const authHeader = req.headers.authorization;
        const apiKey = req.headers['x-api-key'] || req.query.apiKey;

        // Verificar API Key primeiro
        if (apiKey) {
          if (this.validarApiKey(apiKey)) {
            req.usuario = {
              id: 'api-key-user',
              nome: 'API Key User',
              email: 'api@brandaocontador.com.br',
              tipo: 'api',
              permissoes: ['nfe_consultar', 'nfe_emitir', 'nfe_cancelar'],
              ativo: true
            };
            req.tipoAuth = 'api-key';
            return next();
          } else {
            return res.status(401).json({
              sucesso: false,
              erro: 'API Key inválida',
              codigo: 'API_KEY_INVALIDA'
            });
          }
        }

        // Verificar JWT Token
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return res.status(401).json({
            sucesso: false,
            erro: 'Token de acesso não fornecido',
            codigo: 'TOKEN_NAO_FORNECIDO'
          });
        }

        const token = authHeader.substring(7);

        // Verificar se token está na blacklist
        if (this.blacklistedTokens.has(token)) {
          return res.status(401).json({
            sucesso: false,
            erro: 'Token inválido',
            codigo: 'TOKEN_INVALIDO'
          });
        }

        // Verificar e decodificar token
        const decoded = jwt.verify(token, JWT_SECRET);

        // Buscar usuário (sistema JSON)
        let usuario = await database.buscarUsuarioPorId(decoded.id);
        if (usuario) {
          const { senha, ...semSenha } = usuario;
          usuario = semSenha;
        }

        if (!usuario) {
          return res.status(401).json({
            sucesso: false,
            erro: 'Usuário não encontrado',
            codigo: 'USUARIO_NAO_ENCONTRADO'
          });
        }

        // Verificar se usuário está ativo
        if (usuario.ativo === false || usuario.status === 'inativo') {
          return res.status(401).json({
            sucesso: false,
            erro: 'Usuário inativo',
            codigo: 'USUARIO_INATIVO'
          });
        }

        req.usuario = usuario;
        req.user = usuario; // Compatibilidade com código existente
        req.tipoAuth = 'jwt';
        next();

      } catch (error) {
        if (error.name === 'JsonWebTokenError') {
          return res.status(401).json({
            sucesso: false,
            erro: 'Token inválido',
            codigo: 'TOKEN_INVALIDO'
          });
        } else if (error.name === 'TokenExpiredError') {
          return res.status(401).json({
            sucesso: false,
            erro: 'Token expirado',
            codigo: 'TOKEN_EXPIRADO'
          });
        } else {
          console.error('❌ Erro na verificação de autenticação:', error);
          return res.status(500).json({
            sucesso: false,
            erro: 'Erro interno no servidor',
            codigo: 'ERRO_INTERNO'
          });
        }
      }
    };
  }

  /**
   * Verificar autenticação (opcional)
   */
  verificarAutenticacaoOpcional() {
    return async (req, res, next) => {
      try {
        const authHeader = req.headers.authorization;
        const apiKey = req.headers['x-api-key'] || req.query.apiKey;

        // Se não há autenticação, continuar sem usuário
        if (!authHeader && !apiKey) {
          req.usuario = null;
          req.tipoAuth = null;
          return next();
        }

        // Usar verificação normal se há autenticação
        const verificacao = this.verificarAutenticacao();
        verificacao(req, res, (err) => {
          if (err) {
            // Em caso de erro, continuar sem usuário
            req.usuario = null;
            req.tipoAuth = null;
          }
          next();
        });

      } catch (error) {
        // Em caso de erro, continuar sem usuário
        req.usuario = null;
        req.tipoAuth = null;
        next();
      }
    };
  }

  /**
   * Verificar permissão específica
   */
  verificarPermissao(permissaoRequerida) {
    return (req, res, next) => {
      try {
        if (!req.usuario) {
          return res.status(401).json({
            sucesso: false,
            erro: 'Autenticação necessária',
            codigo: 'AUTENTICACAO_NECESSARIA'
          });
        }

        // API Key tem permissões específicas
        if (req.tipoAuth === 'api-key') {
          const permissoesApiKey = ['nfe_consultar', 'nfe_emitir', 'nfe_cancelar'];
          if (!permissoesApiKey.includes(permissaoRequerida)) {
            return res.status(403).json({
              sucesso: false,
              erro: 'Permissão insuficiente para API Key',
              codigo: 'PERMISSAO_INSUFICIENTE'
            });
          }
          return next();
        }

        // Verificar permissões do usuário
        const permissoes = req.usuario.permissoes || [];
        
        // Admin tem todas as permissões
        if (permissoes.includes('all') || 
            permissoes.includes('admin') || 
            permissoes.includes('admin_total') ||
            req.usuario.isAdmin === true ||
            req.usuario.accessLevel === 'full') {
          return next();
        }

        // Verificar permissão específica
        if (!permissoes.includes(permissaoRequerida)) {
          return res.status(403).json({
            sucesso: false,
            erro: `Permissão '${permissaoRequerida}' necessária`,
            codigo: 'PERMISSAO_INSUFICIENTE'
          });
        }

        next();

      } catch (error) {
        console.error('❌ Erro na verificação de permissão:', error);
        res.status(500).json({
          sucesso: false,
          erro: 'Erro interno no servidor',
          codigo: 'ERRO_INTERNO'
        });
      }
    };
  }

  // ==================== MÉTODOS UTILITÁRIOS ====================

  /**
   * Gerar token JWT
   */
  gerarToken(usuario) {
    const payload = {
      id: usuario._id || usuario.id,
      email: usuario.email,
      tipo: usuario.tipoCliente || usuario.tipo,
      permissoes: usuario.permissoes || []
    };

    return jwt.sign(payload, JWT_SECRET, { 
      expiresIn: JWT_EXPIRES_IN,
      issuer: 'brandao-contador-nfe',
      audience: 'nfe-system'
    });
  }

  /**
   * Gerar API Key
   */
  gerarApiKey() {
    const apiKey = `nfe-${crypto.randomBytes(16).toString('hex')}-${Date.now()}`;
    this.apiKeys.add(apiKey);
    return apiKey;
  }

  /**
   * Validar API Key
   */
  validarApiKey(apiKey) {
    return this.apiKeys.has(apiKey);
  }

  /**
   * Invalidar token (logout)
   */
  invalidarToken(token) {
    this.blacklistedTokens.add(token);
    
    // Limpar blacklist periodicamente (manter apenas últimas 1000)
    if (this.blacklistedTokens.size > 1000) {
      const tokens = Array.from(this.blacklistedTokens);
      this.blacklistedTokens.clear();
      tokens.slice(-500).forEach(t => this.blacklistedTokens.add(t));
    }
  }

  /**
   * Validar token (para endpoint /auth/validate)
   */
  async validarToken(req, res) {
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
      console.error('❌ Erro na validação de token:', error);
      res.status(500).json({
        sucesso: false,
        erro: 'Erro ao validar token',
        codigo: 'ERRO_INTERNO'
      });
    }
  }
}

// ==================== EXPORTAÇÃO ====================
const authMiddleware = new AuthMiddleware();

module.exports = authMiddleware;