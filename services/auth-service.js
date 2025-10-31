const database = require('../config/database');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

class AuthService {
  constructor() {
    this.JWT_SECRET = process.env.JWT_SECRET || 'sua-chave-secreta-super-segura';
    this.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
  }

  async login(email, senha) {
    try {
      // Buscar usuário no arquivo JSON
      const usuario = await database.buscarUsuarioPorEmail(email.toLowerCase());

      if (!usuario || !usuario.ativo) {
        throw new Error('Usuário não encontrado ou inativo');
      }

      // Verificar senha
      const senhaValida = await bcrypt.compare(senha, usuario.senha);
      if (!senhaValida) {
        throw new Error('Senha incorreta');
      }

      // Atualizar último acesso
      await database.atualizarUsuario(usuario.id, {
        ultimoAcesso: new Date().toISOString(),
        totalLogins: (usuario.totalLogins || 0) + 1
      });

      // Gerar token JWT
      const token = this.gerarToken(usuario);

      return {
        sucesso: true,
        token,
        usuario: this.formatarUsuario(usuario),
        expiresIn: this.JWT_EXPIRES_IN
      };

    } catch (error) {
      console.error('❌ Erro no login:', error.message);
      throw error;
    }
  }

  async register(dadosUsuario) {
    try {
      // Verificar se email já existe
      const emailExistente = await database.buscarUsuarioPorEmail(dadosUsuario.email.toLowerCase());

      if (emailExistente) {
        throw new Error('Email já cadastrado');
      }

      // Verificar se documento já existe (se fornecido)
      if (dadosUsuario.documento) {
        const documentoExistente = await database.buscarUsuarioPorDocumento(dadosUsuario.documento);
        if (documentoExistente) {
          throw new Error(`${(dadosUsuario.tipoCliente || 'cpf').toUpperCase()} já cadastrado`);
        }
      }

      // Criptografar senha
      const senhaHash = await bcrypt.hash(dadosUsuario.senha, 10);

      // Criar novo usuário
      const novoUsuario = {
        id: uuidv4(),
        nome: dadosUsuario.nome,
        email: dadosUsuario.email.toLowerCase(),
        senha: senhaHash,
        documento: dadosUsuario.documento,
        tipoCliente: dadosUsuario.tipoCliente || 'cpf',
        telefone: dadosUsuario.telefone,
        endereco: dadosUsuario.endereco,
        permissoes: dadosUsuario.permissoes || [
          'nfe_emitir', 
          'nfe_consultar', 
          'cte_emitir', 
          'cte_consultar', 
          'mdfe_emitir', 
          'mdfe_consultar'
        ],
        perfil: dadosUsuario.perfil || 'usuario',
        ativo: true,
        criadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString(),
        ultimoAcesso: null,
        totalLogins: 0
      };

      await database.criarUsuario(novoUsuario);

      // Gerar token para login automático
      const token = this.gerarToken(novoUsuario);

      return {
        sucesso: true,
        mensagem: 'Usuário cadastrado com sucesso',
        token,
        usuario: this.formatarUsuario(novoUsuario),
        expiresIn: this.JWT_EXPIRES_IN
      };

    } catch (error) {
      console.error('❌ Erro no registro:', error.message);
      throw error;
    }
  }

  async socialLogin({ provider, providerId, email, name, image }) {
    try {
      // Tentar encontrar usuário pelo email
      let usuario = await database.buscarUsuarioPorEmail(email?.toLowerCase());

      if (!usuario) {
        // Criar usuário básico sem senha obrigatória (gera senha aleatória)
        const senhaTemporaria = Math.random().toString(36).slice(-10);
        const senhaHash = await bcrypt.hash(senhaTemporaria, 10);
        
        usuario = {
          id: uuidv4(),
          nome: name || email?.split('@')[0] || 'Usuário',
          email: email?.toLowerCase(),
          senha: senhaHash,
          tipoCliente: 'cpf',
          documento: undefined,
          socialProvider: provider,
          socialProviderId: providerId,
          image,
          permissoes: [
            'nfe_emitir', 
            'nfe_consultar', 
            'cte_emitir', 
            'cte_consultar', 
            'mdfe_emitir', 
            'mdfe_consultar'
          ],
          perfil: 'usuario',
          ativo: true,
          criadoEm: new Date().toISOString(),
          atualizadoEm: new Date().toISOString(),
          ultimoAcesso: null,
          totalLogins: 0
        };
        
        await database.criarUsuario(usuario);
      } else {
        // Atualizar dados sociais
        await database.atualizarUsuario(usuario.id, {
          socialProvider: provider,
          socialProviderId: providerId,
          image: image || usuario.image,
          atualizadoEm: new Date().toISOString()
        });
        
        // Buscar usuário atualizado
        usuario = await database.buscarUsuarioPorId(usuario.id);
      }

      const token = this.gerarToken(usuario);
      return {
        sucesso: true,
        token,
        usuario: this.formatarUsuario(usuario),
        expiresIn: this.JWT_EXPIRES_IN
      };
    } catch (error) {
      console.error('❌ Erro no login social:', error.message);
      throw error;
    }
  }

  async verificarEmailExistente(email) {
    try {
      const usuario = await database.buscarUsuarioPorEmail(email.toLowerCase());
      return !!usuario;
    } catch (error) {
      console.error('❌ Erro ao verificar email:', error.message);
      throw error;
    }
  }

  async verificarDocumentoExistente(documento) {
    try {
      const usuario = await database.buscarUsuarioPorDocumento(documento);
      return !!usuario;
    } catch (error) {
      console.error('❌ Erro ao verificar documento:', error.message);
      throw error;
    }
  }

  gerarToken(usuario) {
    const payload = {
      id: usuario.id,
      email: usuario.email,
      nome: usuario.nome,
      permissoes: usuario.permissoes,
      perfil: usuario.perfil
    };

    return jwt.sign(payload, this.JWT_SECRET, {
      expiresIn: this.JWT_EXPIRES_IN
    });
  }

  verificarToken(token) {
    try {
      return jwt.verify(token, this.JWT_SECRET);
    } catch (error) {
      throw new Error('Token inválido ou expirado');
    }
  }

  async buscarUsuarioPorId(id) {
    try {
      const usuario = await database.buscarUsuarioPorId(id);
      return usuario ? this.formatarUsuario(usuario) : null;
    } catch (error) {
      console.error('❌ Erro ao buscar usuário por ID:', error.message);
      throw error;
    }
  }

  async limparUsuarios() {
    try {
      console.log('🧹 Limpando todos os usuários...');
      const usuarios = await database.listarUsuarios();
      const totalUsuarios = usuarios.length;
      
      // Limpar arquivo de usuários
      await database.limparUsuarios();
      
      console.log(`✅ ${totalUsuarios} usuários removidos`);
      return { deletedCount: totalUsuarios };
    } catch (error) {
      console.error('❌ Erro ao limpar usuários:', error.message);
      throw error;
    }
  }

  formatarUsuario(usuario) {
    const { senha, ...usuarioSemSenha } = usuario;
    return usuarioSemSenha;
  }
}

module.exports = new AuthService();