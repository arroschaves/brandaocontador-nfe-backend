const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const database = require('../config/database-simples');
const logService = require('../services/log-service');

const JWT_SECRET = process.env.JWT_SECRET || 'brandaocontador-nfe-secret-key-2024';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

class AuthMiddleware {
  // Método de login
  async login(req, res) {
    try {
      const { email, senha } = req.body;

      // Validações básicas
      if (!email || !senha) {
        return res.status(400).json({
          sucesso: false,
          erro: 'Email e senha são obrigatórios'
        });
      }

      // Buscar usuário no banco de dados
      const usuario = await database.buscarUsuarioPorEmail(email.toLowerCase());
      
      if (!usuario) {
        await logService.log('login_falha', 'USUARIO_NAO_ENCONTRADO', { email, ip: req.ip });
        return res.status(401).json({
          sucesso: false,
          erro: 'Credenciais inválidas'
        });
      }

      // Verificar senha
      const senhaValida = await bcrypt.compare(senha, usuario.senha);
      
      if (!senhaValida) {
        await logService.log('login_falha', 'SENHA_INVALIDA', { email, ip: req.ip });
        return res.status(401).json({
          sucesso: false,
          erro: 'Credenciais inválidas'
        });
      }

      // Atualizar último acesso
      await database.atualizarUsuario(usuario.id, {
        ultimoAcesso: new Date().toISOString()
      });

      // Gerar token JWT
      const token = jwt.sign(
        {
          id: usuario.id,
          email: usuario.email,
          nome: usuario.nome,
          tipo: usuario.tipo,
          permissoes: usuario.permissoes || []
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      await logService.log('login_sucesso', 'SUCESSO', { 
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
          tipo: usuario.tipo,
          permissoes: usuario.permissoes || []
        }
      });

    } catch (error) {
      await logService.logErro('login', error, { email: req.body?.email, ip: req.ip });
      res.status(500).json({
        sucesso: false,
        erro: 'Erro interno ao realizar login'
      });
    }
  }

  // Método de registro
  async register(req, res) {
    try {
      const {
        nome,
        email,
        senha,
        telefone,
        documento,
        tipoPessoa,
        tipoCliente,
        endereco
      } = req.body;

      // Validações básicas
      if (!nome || !email || !senha) {
        return res.status(400).json({
          sucesso: false,
          erro: 'Nome, email e senha são obrigatórios'
        });
      }

      if (senha.length < 6) {
        return res.status(400).json({
          sucesso: false,
          erro: 'A senha deve ter pelo menos 6 caracteres'
        });
      }

      // Verificar se o email já existe
      const emailExistente = await database.buscarUsuarioPorEmail(email.toLowerCase());
      if (emailExistente) {
        return res.status(400).json({
          sucesso: false,
          erro: 'Email já cadastrado'
        });
      }

      // Verificar se o documento já existe
      if (documento) {
        const documentoExistente = await database.buscarUsuarioPorDocumento(documento);
        if (documentoExistente) {
          return res.status(400).json({
            sucesso: false,
            erro: 'Documento já cadastrado'
          });
        }
      }

      // Criptografar senha
      const senhaHash = await bcrypt.hash(senha, 10);

      // Criar novo usuário
      const novoUsuario = await database.criarUsuario({
        nome: nome.trim(),
        email: email.toLowerCase().trim(),
        senha: senhaHash,
        telefone: telefone?.trim() || '',
        documento: documento?.trim() || '',
        tipoPessoa: tipoPessoa || 'PF',
        tipoCliente: tipoCliente || 'contador',
        endereco: endereco || {},
        permissoes: this.definirPermissoesPorTipo(tipoCliente || 'contador'),
        ativo: true,
        ultimoAcesso: null
      });

      // Remover senha do retorno
      const { senha: _, ...usuarioSemSenha } = novoUsuario;

      await logService.log('registro_sucesso', 'SUCESSO', { 
        usuario: novoUsuario.id, 
        email: novoUsuario.email,
        ip: req.ip 
      });

      res.status(201).json({
        sucesso: true,
        mensagem: 'Usuário criado com sucesso',
        usuario: usuarioSemSenha
      });

    } catch (error) {
      await logService.logErro('registro', error, { email: req.body?.email, ip: req.ip });
      res.status(500).json({
        sucesso: false,
        erro: 'Erro interno ao criar usuário'
      });
    }
  }

  // Middleware para verificar autenticação
  verificarAutenticacao() {
    return async (req, res, next) => {
      try {
        const token = this.extrairToken(req);
        
        if (!token) {
          return res.status(401).json({
            sucesso: false,
            erro: 'Token não fornecido'
          });
        }

        // Verificar e decodificar token
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Buscar usuário no banco de dados
        const usuario = await database.buscarUsuarioPorId(decoded.id);
        
        if (!usuario || !usuario.ativo) {
          return res.status(401).json({
            sucesso: false,
            erro: 'Usuário não encontrado ou inativo'
          });
        }

        // Adicionar usuário à requisição
        req.usuario = usuario;
        
        next();
      } catch (error) {
        if (error.name === 'JsonWebTokenError') {
          return res.status(401).json({
            sucesso: false,
            erro: 'Token inválido'
          });
        }
        
        if (error.name === 'TokenExpiredError') {
          return res.status(401).json({
            sucesso: false,
            erro: 'Token expirado'
          });
        }

        await logService.logErro('verificar_autenticacao', error, { ip: req.ip });
        res.status(401).json({
          sucesso: false,
          erro: 'Erro na autenticação'
        });
      }
    };
  }

  // Middleware para verificar permissões
  verificarPermissao(permissaoRequerida) {
    return (req, res, next) => {
      if (!req.usuario) {
        return res.status(401).json({
          sucesso: false,
          erro: 'Usuário não autenticado'
        });
      }

      const permissoesUsuario = req.usuario.permissoes || [];
      
      if (!permissoesUsuario.includes(permissaoRequerida)) {
        return res.status(403).json({
          sucesso: false,
          erro: 'Permissão insuficiente'
        });
      }

      next();
    };
  }

  // Validar token (endpoint)
  async validarToken(req, res) {
    try {
      const token = this.extrairToken(req);
      
      if (!token) {
        return res.status(401).json({
          sucesso: false,
          erro: 'Token não fornecido'
        });
      }

      const decoded = jwt.verify(token, JWT_SECRET);
      const usuario = await database.buscarUsuarioPorId(decoded.id);
      
      if (!usuario || !usuario.ativo) {
        return res.status(401).json({
          sucesso: false,
          erro: 'Token inválido'
        });
      }

      const { senha: _, ...usuarioSemSenha } = usuario;

      res.json({
        sucesso: true,
        valido: true,
        usuario: usuarioSemSenha
      });

    } catch (error) {
      res.status(401).json({
        sucesso: false,
        valido: false,
        erro: 'Token inválido ou expirado'
      });
    }
  }

  // Limpar usuários (apenas para desenvolvimento)
  async limparUsuarios(req, res) {
    try {
      if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({
          sucesso: false,
          erro: 'Operação não permitida em produção'
        });
      }

      await database.limparBanco();
      
      await logService.log('limpar_usuarios', 'SUCESSO', { 
        usuario: req.usuario?.id,
        ip: req.ip 
      });

      res.json({
        sucesso: true,
        mensagem: 'Todos os usuários foram removidos'
      });

    } catch (error) {
      await logService.logErro('limpar_usuarios', error, { ip: req.ip });
      res.status(500).json({
        sucesso: false,
        erro: 'Erro ao limpar usuários'
      });
    }
  }

  // Métodos auxiliares
  extrairToken(req) {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    
    return req.headers['x-access-token'] || req.headers['x-auth-token'];
  }

  definirPermissoesPorTipo(tipoCliente) {
    const permissoes = {
      'contador': [
        'nfe_emitir',
        'nfe_cancelar',
        'nfe_cart_correcao',
        'nfe_inutilizar',
        'nfe_consultar',
        'nfe_download',
        'relatorios_ver',
        'configuracoes_ver'
      ],
      'empresa': [
        'nfe_emitir',
        'nfe_consultar',
        'nfe_download',
        'relatorios_ver'
      ],
      'admin': [
        'admin',
        'nfe_emitir',
        'nfe_cancelar',
        'nfe_cart_correcao',
        'nfe_inutilizar',
        'nfe_consultar',
        'nfe_download',
        'relatorios_ver',
        'configuracoes_ver',
        'usuarios_ver',
        'usuarios_editar'
      ]
    };

    return permissoes[tipoCliente] || permissoes['contador'];
  }
}

module.exports = new AuthMiddleware();