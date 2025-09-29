const jwt = require('jsonwebtoken');
const logService = require('../services/log-service');

class AuthMiddleware {
  constructor() {
    this.JWT_SECRET = process.env.JWT_SECRET || 'nfe-secret-key-change-in-production';
    this.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
    this.API_KEYS = this.carregarApiKeys();
  }

  carregarApiKeys() {
    // API Keys para autenticação simples (ambiente de desenvolvimento)
    const apiKeys = process.env.API_KEYS ? process.env.API_KEYS.split(',') : [];
    
    // Adiciona uma chave padrão para desenvolvimento se não houver nenhuma
    if (apiKeys.length === 0) {
      apiKeys.push('nfe-dev-key-123456');
    }

    return apiKeys;
  }

  // ==================== MIDDLEWARE PRINCIPAL ====================

  verificarAutenticacao() {
    return async (req, res, next) => {
      try {
        const token = this.extrairToken(req);
        const apiKey = this.extrairApiKey(req);

        // Verifica se há pelo menos um método de autenticação
        if (!token && !apiKey) {
          await logService.logAcesso(req.path, req.method, req.ip, req.get('User-Agent'));
          await logService.logErro('autenticacao', new Error('Token ou API Key não fornecido'), {
            endpoint: req.path,
            ip: req.ip
          });

          return res.status(401).json({
            sucesso: false,
            erro: 'Acesso negado. Token JWT ou API Key necessário.',
            codigo: 'AUTH_REQUIRED'
          });
        }

        // Tenta autenticação por JWT primeiro
        if (token) {
          const usuarioJWT = await this.verificarJWT(token);
          if (usuarioJWT) {
            req.usuario = usuarioJWT;
            req.tipoAuth = 'JWT';
            await logService.logAcesso(req.path, req.method, req.ip, req.get('User-Agent'));
            return next();
          }
        }

        // Tenta autenticação por API Key
        if (apiKey) {
          const usuarioApiKey = await this.verificarApiKey(apiKey);
          if (usuarioApiKey) {
            req.usuario = usuarioApiKey;
            req.tipoAuth = 'API_KEY';
            await logService.logAcesso(req.path, req.method, req.ip, req.get('User-Agent'));
            return next();
          }
        }

        // Se chegou aqui, nenhum método funcionou
        await logService.logErro('autenticacao', new Error('Token/API Key inválido'), {
          endpoint: req.path,
          ip: req.ip,
          token: token ? 'presente' : 'ausente',
          apiKey: apiKey ? 'presente' : 'ausente'
        });

        return res.status(401).json({
          sucesso: false,
          erro: 'Token JWT ou API Key inválido.',
          codigo: 'AUTH_INVALID'
        });

      } catch (error) {
        await logService.logErro('autenticacao', error, {
          endpoint: req.path,
          ip: req.ip
        });

        return res.status(500).json({
          sucesso: false,
          erro: 'Erro interno de autenticação.',
          codigo: 'AUTH_ERROR'
        });
      }
    };
  }

  // ==================== MIDDLEWARE OPCIONAL ====================

  verificarAutenticacaoOpcional() {
    return async (req, res, next) => {
      try {
        const token = this.extrairToken(req);
        const apiKey = this.extrairApiKey(req);

        if (token) {
          const usuario = await this.verificarJWT(token);
          if (usuario) {
            req.usuario = usuario;
            req.tipoAuth = 'JWT';
          }
        } else if (apiKey) {
          const usuario = await this.verificarApiKey(apiKey);
          if (usuario) {
            req.usuario = usuario;
            req.tipoAuth = 'API_KEY';
          }
        }

        // Sempre continua, mesmo sem autenticação
        await logService.logAcesso(req.path, req.method, req.ip, req.get('User-Agent'));
        next();

      } catch (error) {
        // Em caso de erro, continua sem autenticação
        await logService.logErro('autenticacao_opcional', error, {
          endpoint: req.path,
          ip: req.ip
        });
        next();
      }
    };
  }

  // ==================== VERIFICAÇÃO DE PERMISSÕES ====================

  verificarPermissao(permissaoRequerida) {
    return (req, res, next) => {
      try {
        if (!req.usuario) {
          return res.status(401).json({
            sucesso: false,
            erro: 'Usuário não autenticado.',
            codigo: 'USER_NOT_AUTHENTICATED'
          });
        }

        const permissoesUsuario = req.usuario.permissoes || [];
        
        // Admin tem todas as permissões
        if (permissoesUsuario.includes('admin')) {
          return next();
        }

        // Verifica permissão específica
        if (!permissoesUsuario.includes(permissaoRequerida)) {
          logService.logErro('autorizacao', new Error(`Permissão negada: ${permissaoRequerida}`), {
            usuario: req.usuario.id,
            permissaoRequerida,
            permissoesUsuario,
            endpoint: req.path
          });

          return res.status(403).json({
            sucesso: false,
            erro: `Permissão insuficiente. Requerida: ${permissaoRequerida}`,
            codigo: 'PERMISSION_DENIED'
          });
        }

        next();

      } catch (error) {
        logService.logErro('autorizacao', error, {
          endpoint: req.path,
          usuario: req.usuario?.id
        });

        return res.status(500).json({
          sucesso: false,
          erro: 'Erro interno de autorização.',
          codigo: 'AUTHORIZATION_ERROR'
        });
      }
    };
  }

  // ==================== RATE LIMITING ====================

  limitarTaxa(maxRequests = 100, windowMs = 15 * 60 * 1000) { // 100 requests por 15 minutos
    const requests = new Map();

    return (req, res, next) => {
      const identificador = req.ip + (req.usuario?.id || 'anonimo');
      const agora = Date.now();
      const janela = Math.floor(agora / windowMs);
      const chave = `${identificador}:${janela}`;

      const contadorAtual = requests.get(chave) || 0;

      if (contadorAtual >= maxRequests) {
        logService.logErro('rate_limit', new Error('Rate limit excedido'), {
          ip: req.ip,
          usuario: req.usuario?.id,
          requests: contadorAtual,
          limite: maxRequests
        });

        return res.status(429).json({
          sucesso: false,
          erro: 'Muitas requisições. Tente novamente em alguns minutos.',
          codigo: 'RATE_LIMIT_EXCEEDED',
          limite: maxRequests,
          janela: windowMs / 1000 / 60 // em minutos
        });
      }

      requests.set(chave, contadorAtual + 1);

      // Limpa entradas antigas periodicamente
      if (Math.random() < 0.01) { // 1% de chance
        this.limparRequestsAntigos(requests, windowMs);
      }

      next();
    };
  }

  // ==================== MÉTODOS DE VERIFICAÇÃO ====================

  async verificarJWT(token) {
    try {
      const decoded = jwt.verify(token, this.JWT_SECRET);
      
      // Verifica se o token não expirou
      if (decoded.exp && decoded.exp < Date.now() / 1000) {
        return null;
      }

      return {
        id: decoded.id,
        nome: decoded.nome,
        email: decoded.email,
        permissoes: decoded.permissoes || ['user'],
        tipo: 'jwt'
      };

    } catch (error) {
      return null;
    }
  }

  async verificarApiKey(apiKey) {
    try {
      // Verifica se a API Key está na lista de chaves válidas
      if (!this.API_KEYS.includes(apiKey)) {
        return null;
      }

      // Para API Keys, retorna um usuário padrão do sistema
      return {
        id: 'api-key-user',
        nome: 'Sistema API',
        email: 'sistema@brandaocontador.com.br',
        permissoes: ['nfe_emitir', 'nfe_consultar', 'nfe_cancelar'],
        tipo: 'api_key',
        apiKey: apiKey.substring(0, 8) + '...' // Para logs
      };

    } catch (error) {
      return null;
    }
  }

  // ==================== GERAÇÃO DE TOKENS ====================

  gerarToken(usuario) {
    const payload = {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      permissoes: usuario.permissoes || ['user'],
      iat: Math.floor(Date.now() / 1000)
    };

    return jwt.sign(payload, this.JWT_SECRET, { 
      expiresIn: this.JWT_EXPIRES_IN 
    });
  }

  gerarApiKey() {
    // Gera uma API Key aleatória
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = 'nfe-';
    
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return result;
  }

  // ==================== MÉTODOS AUXILIARES ====================

  extrairToken(req) {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    
    // Também verifica query parameter para facilitar testes
    return req.query.token || null;
  }

  extrairApiKey(req) {
    // Verifica header personalizado
    let apiKey = req.headers['x-api-key'];
    
    // Também verifica query parameter
    if (!apiKey) {
      apiKey = req.query.apiKey || req.query.api_key;
    }
    
    return apiKey || null;
  }

  limparRequestsAntigos(requests, windowMs) {
    const agora = Date.now();
    const janelaAtual = Math.floor(agora / windowMs);
    
    for (const [chave] of requests) {
      const [, janela] = chave.split(':');
      if (parseInt(janela) < janelaAtual - 1) {
        requests.delete(chave);
      }
    }
  }

  // ==================== ENDPOINTS DE AUTENTICAÇÃO ====================

  async login(req, res) {
    try {
      const { email, senha } = req.body;

      if (!email || !senha) {
        return res.status(400).json({
          sucesso: false,
          erro: 'Email e senha são obrigatórios.',
          codigo: 'MISSING_CREDENTIALS'
        });
      }

      // Simulação de verificação de usuário (substituir por banco de dados)
      const usuario = await this.verificarCredenciais(email, senha);
      
      if (!usuario) {
        await logService.logErro('login', new Error('Credenciais inválidas'), {
          email,
          ip: req.ip
        });

        return res.status(401).json({
          sucesso: false,
          erro: 'Email ou senha inválidos.',
          codigo: 'INVALID_CREDENTIALS'
        });
      }

      const token = this.gerarToken(usuario);

      await logService.log('login', 'SUCESSO', {
        usuario: usuario.id,
        email: usuario.email,
        ip: req.ip
      });

      res.json({
        sucesso: true,
        token,
        usuario: {
          id: usuario.id,
          nome: usuario.nome,
          email: usuario.email,
          permissoes: usuario.permissoes
        },
        expiresIn: this.JWT_EXPIRES_IN
      });

    } catch (error) {
      await logService.logErro('login', error, {
        ip: req.ip
      });

      res.status(500).json({
        sucesso: false,
        erro: 'Erro interno no login.',
        codigo: 'LOGIN_ERROR'
      });
    }
  }

  async verificarCredenciais(email, senha) {
    // SIMULAÇÃO - Substituir por consulta ao banco de dados
    const usuariosDemo = [
      {
        id: 1,
        nome: 'Administrador',
        email: 'admin@brandaocontador.com.br',
        senha: 'admin123', // Em produção, usar hash
        permissoes: ['admin', 'nfe_emitir', 'nfe_consultar', 'nfe_cancelar']
      },
      {
        id: 2,
        nome: 'Operador NFe',
        email: 'operador@brandaocontador.com.br',
        senha: 'operador123',
        permissoes: ['nfe_emitir', 'nfe_consultar']
      },
      {
        id: 3,
        nome: 'Contador',
        email: 'contador@brandaocontador.com.br',
        senha: 'contador123',
        permissoes: ['nfe_emitir', 'nfe_consultar', 'nfe_cancelar']
      }
    ];

    const usuario = usuariosDemo.find(u => u.email === email && u.senha === senha);
    
    if (usuario) {
      // Remove a senha do objeto retornado
      const { senha: _, ...usuarioSemSenha } = usuario;
      return usuarioSemSenha;
    }

    return null;
  }

  // Endpoint para validar token
  async validarToken(req, res) {
    try {
      // O middleware já validou o token e adicionou o usuário ao req
      if (req.usuario) {
        res.json({
          sucesso: true,
          usuario: {
            id: req.usuario.id,
            nome: req.usuario.nome,
            email: req.usuario.email,
            permissoes: req.usuario.permissoes
          }
        });
      } else {
        res.status(401).json({
          sucesso: false,
          erro: 'Token inválido',
          codigo: 'INVALID_TOKEN'
        });
      }
    } catch (error) {
      await logService.logErro('validar_token', error, {
        ip: req.ip
      });

      res.status(500).json({
        sucesso: false,
        erro: 'Erro interno na validação do token',
        codigo: 'TOKEN_VALIDATION_ERROR'
      });
    }
  }

  // ==================== REGISTRO DE USUÁRIO ====================

  async register(req, res) {
    try {
      const { 
        tipoCliente, 
        nome, 
        email, 
        senha, 
        documento, 
        telefone, 
        endereco,
        razaoSocial,
        nomeFantasia,
        inscricaoEstadual
      } = req.body;

      // Validações básicas
      if (!nome || !email || !senha || !documento || !telefone) {
        return res.status(400).json({
          sucesso: false,
          erro: 'Dados obrigatórios não fornecidos',
          codigo: 'MISSING_REQUIRED_FIELDS'
        });
      }

      if (!tipoCliente || !['cpf', 'cnpj'].includes(tipoCliente)) {
        return res.status(400).json({
          sucesso: false,
          erro: 'Tipo de cliente inválido',
          codigo: 'INVALID_CLIENT_TYPE'
        });
      }

      // Validação de email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          sucesso: false,
          erro: 'Email inválido',
          codigo: 'INVALID_EMAIL'
        });
      }

      // Verificar se o email já existe
      const emailExistente = await this.verificarEmailExistente(email);
      if (emailExistente) {
        return res.status(409).json({
          sucesso: false,
          erro: 'Email já cadastrado',
          codigo: 'EMAIL_ALREADY_EXISTS'
        });
      }

      // Verificar se o documento já existe
      const documentoExistente = await this.verificarDocumentoExistente(documento);
      if (documentoExistente) {
        return res.status(409).json({
          sucesso: false,
          erro: `${tipoCliente.toUpperCase()} já cadastrado`,
          codigo: 'DOCUMENT_ALREADY_EXISTS'
        });
      }

      // Validação de senha
      if (senha.length < 6) {
        return res.status(400).json({
          sucesso: false,
          erro: 'Senha deve ter pelo menos 6 caracteres',
          codigo: 'WEAK_PASSWORD'
        });
      }

      // Validações específicas para CNPJ
      if (tipoCliente === 'cnpj') {
        if (!razaoSocial || !nomeFantasia) {
          return res.status(400).json({
            sucesso: false,
            erro: 'Razão Social e Nome Fantasia são obrigatórios para CNPJ',
            codigo: 'MISSING_CNPJ_FIELDS'
          });
        }
      }

      // Validação de endereço
      if (!endereco || !endereco.cep || !endereco.logradouro || !endereco.numero || 
          !endereco.bairro || !endereco.cidade || !endereco.uf) {
        return res.status(400).json({
          sucesso: false,
          erro: 'Dados de endereço incompletos',
          codigo: 'INCOMPLETE_ADDRESS'
        });
      }

      // Criar novo usuário
      const novoUsuario = await this.criarUsuario({
        tipoCliente,
        nome,
        email,
        senha, // Em produção, fazer hash da senha
        documento,
        telefone,
        endereco,
        razaoSocial,
        nomeFantasia,
        inscricaoEstadual,
        dataCadastro: new Date().toISOString(),
        ativo: true,
        permissoes: ['nfe_emitir', 'nfe_consultar'] // Permissões padrão para novos clientes
      });

      await logService.log('registro', 'SUCESSO', {
        usuario: novoUsuario.id,
        email: novoUsuario.email,
        tipoCliente,
        ip: req.ip
      });

      // Gerar token para login automático
      const token = this.gerarToken(novoUsuario);

      res.status(201).json({
        sucesso: true,
        mensagem: 'Usuário cadastrado com sucesso',
        token,
        usuario: {
          id: novoUsuario.id,
          nome: novoUsuario.nome,
          email: novoUsuario.email,
          tipoCliente: novoUsuario.tipoCliente,
          documento: novoUsuario.documento,
          permissoes: novoUsuario.permissoes
        },
        expiresIn: this.JWT_EXPIRES_IN
      });

    } catch (error) {
      await logService.logErro('registro', error, {
        ip: req.ip,
        email: req.body.email
      });

      res.status(500).json({
        sucesso: false,
        erro: 'Erro interno no cadastro',
        codigo: 'REGISTER_ERROR'
      });
    }
  }

  async verificarEmailExistente(email) {
    // SIMULAÇÃO - Em produção, consultar banco de dados
    const usuariosDemo = await this.obterUsuariosDemo();
    return usuariosDemo.find(user => user.email.toLowerCase() === email.toLowerCase());
  }

  async verificarDocumentoExistente(documento) {
    // SIMULAÇÃO - Em produção, consultar banco de dados
    const usuariosDemo = await this.obterUsuariosDemo();
    return usuariosDemo.find(user => user.documento === documento);
  }

  async criarUsuario(dadosUsuario) {
    // SIMULAÇÃO - Em produção, salvar no banco de dados
    const novoId = Date.now(); // ID temporário
    
    const novoUsuario = {
      id: novoId,
      ...dadosUsuario
    };

    // Em um sistema real, aqui salvaria no banco de dados
    console.log('📝 Novo usuário criado (simulação):', {
      id: novoUsuario.id,
      nome: novoUsuario.nome,
      email: novoUsuario.email,
      tipoCliente: novoUsuario.tipoCliente,
      documento: novoUsuario.documento
    });

    return novoUsuario;
  }

  async obterUsuariosDemo() {
    // SIMULAÇÃO - Lista de usuários demo (em produção seria consulta ao banco)
    return [
      {
        id: 1,
        nome: 'Administrador',
        email: 'admin@brandaocontador.com.br',
        senha: 'admin123',
        documento: '00000000000',
        tipoCliente: 'cpf',
        permissoes: ['admin', 'nfe_emitir', 'nfe_consultar', 'nfe_cancelar']
      },
      {
        id: 2,
        nome: 'Operador NFe',
        email: 'operador@brandaocontador.com.br',
        senha: 'operador123',
        documento: '11111111111',
        tipoCliente: 'cpf',
        permissoes: ['nfe_emitir', 'nfe_consultar']
      }
    ];
  }
}

module.exports = new AuthMiddleware();