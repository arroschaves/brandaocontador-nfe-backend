const authService = require('../services/auth-service');
const logService = require('../services/log-service');

class AuthMiddlewareReal {
  
  // Middleware de autenticação principal
  verificarAutenticacao() {
    return async (req, res, next) => {
      try {
        const token = this.extrairToken(req);
        
        if (!token) {
          await logService.logErro('autenticacao', new Error('Token não fornecido'), {
            endpoint: req.path,
            ip: req.ip
          });

          return res.status(401).json({
            sucesso: false,
            erro: 'Acesso negado. Token JWT necessário.',
            codigo: 'AUTH_REQUIRED'
          });
        }

        // Verificar token JWT
        const payload = authService.verificarToken(token);
        
        // Buscar usuário no banco de dados
        const usuario = await authService.buscarUsuarioPorId(payload.id);
        
        if (!usuario || !usuario.ativo) {
          await logService.logErro('autenticacao', new Error('Usuário não encontrado ou inativo'), {
            endpoint: req.path,
            ip: req.ip,
            usuarioId: payload.id
          });

          return res.status(401).json({
            sucesso: false,
            erro: 'Usuário não encontrado ou inativo',
            codigo: 'USER_NOT_FOUND'
          });
        }

        // Adicionar usuário ao request
        req.usuario = usuario;
        req.tipoAuth = 'JWT';
        
        // Registrar acesso
        await logService.logAcesso(req.path, req.method, req.ip, req.get('User-Agent'));
        
        next();

      } catch (error) {
        await logService.logErro('autenticacao', error, {
          endpoint: req.path,
          ip: req.ip
        });

        return res.status(401).json({
          sucesso: false,
          erro: 'Token inválido ou expirado',
          codigo: 'INVALID_TOKEN'
        });
      }
    };
  }

  // Middleware para login
  async login(req, res) {
    try {
      const { email, senha } = req.body;

      // Validações básicas
      if (!email || !senha) {
        return res.status(400).json({
          sucesso: false,
          erro: 'Email e senha são obrigatórios',
          codigo: 'MISSING_CREDENTIALS'
        });
      }

      // Realizar login através do serviço
      const resultado = await authService.login(email, senha);

      // Log de sucesso
      await logService.log('login', 'SUCESSO', {
        usuario: resultado.usuario.id,
        email: resultado.usuario.email,
        ip: req.ip
      });

      res.json(resultado);

    } catch (error) {
      await logService.logErro('login', error, {
        email: req.body.email,
        ip: req.ip
      });

      res.status(401).json({
        sucesso: false,
        erro: error.message || 'Credenciais inválidas',
        codigo: 'INVALID_CREDENTIALS'
      });
    }
  }

  // Middleware para registro
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

      // Realizar registro através do serviço
      const resultado = await authService.register({
        tipoCliente,
        nome,
        email,
        senha,
        documento,
        telefone,
        endereco,
        razaoSocial,
        nomeFantasia,
        inscricaoEstadual,
        dataCadastro: new Date().toISOString(),
        ativo: true,
        permissoes: ['nfe_emitir', 'nfe_consultar']
      });

      // Log de sucesso
      await logService.log('registro', 'SUCESSO', {
        usuario: resultado.usuario.id,
        email: resultado.usuario.email,
        tipoCliente,
        ip: req.ip
      });

      res.status(201).json(resultado);

    } catch (error) {
      await logService.logErro('registro', error, {
        ip: req.ip,
        email: req.body.email
      });

      // Verificar tipo de erro para retornar código apropriado
      let statusCode = 500;
      let codigo = 'REGISTER_ERROR';

      if (error.message.includes('Email já cadastrado')) {
        statusCode = 409;
        codigo = 'EMAIL_ALREADY_EXISTS';
      } else if (error.message.includes('já cadastrado')) {
        statusCode = 409;
        codigo = 'DOCUMENT_ALREADY_EXISTS';
      }

      res.status(statusCode).json({
        sucesso: false,
        erro: error.message || 'Erro interno no cadastro',
        codigo
      });
    }
  }

  // Middleware para validar token
  async validarToken(req, res) {
    try {
      if (req.usuario) {
        res.json({
          sucesso: true,
          usuario: req.usuario
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

  // Verificação de permissões
  verificarPermissao(permissaoRequerida) {
    return (req, res, next) => {
      try {
        if (!req.usuario) {
          return res.status(401).json({
            sucesso: false,
            erro: 'Usuário não autenticado',
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
          erro: 'Erro interno de autorização',
          codigo: 'AUTHORIZATION_ERROR'
        });
      }
    };
  }

  // Métodos auxiliares
  extrairToken(req) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    return null;
  }

  // Limpar todos os usuários (para testes)
  async limparUsuarios(req, res) {
    try {
      const resultado = await authService.limparUsuarios();
      
      res.json({
        sucesso: true,
        mensagem: 'Todos os usuários foram removidos',
        resultado
      });
    } catch (error) {
      res.status(500).json({
        sucesso: false,
        erro: 'Erro ao limpar usuários',
        codigo: 'CLEAR_USERS_ERROR'
      });
    }
  }
}

module.exports = new AuthMiddlewareReal();