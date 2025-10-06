const Usuario = require('../models/Usuario');
const jwt = require('jsonwebtoken');

class AuthService {
  constructor() {
    this.JWT_SECRET = process.env.JWT_SECRET || 'sua-chave-secreta-super-segura';
    this.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
  }

  async login(email, senha) {
    try {
      // Buscar usuário no banco de dados
      const usuario = await Usuario.findOne({ 
        email: email.toLowerCase(), 
        ativo: true 
      });

      if (!usuario) {
        throw new Error('Usuário não encontrado ou inativo');
      }

      // Verificar senha
      const senhaValida = await usuario.compararSenha(senha);
      if (!senhaValida) {
        throw new Error('Senha incorreta');
      }

      // Atualizar último acesso
      await usuario.atualizarUltimoAcesso();

      // Gerar token JWT
      const token = this.gerarToken(usuario);

      return {
        sucesso: true,
        token,
        usuario: usuario.toJSON(),
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
      const emailExistente = await Usuario.findOne({ 
        email: dadosUsuario.email.toLowerCase() 
      });

      if (emailExistente) {
        throw new Error('Email já cadastrado');
      }

      // Verificar se documento já existe
      const documentoExistente = await Usuario.findOne({ 
        documento: dadosUsuario.documento 
      });

      if (documentoExistente) {
        throw new Error(`${dadosUsuario.tipoCliente.toUpperCase()} já cadastrado`);
      }

      // Criar novo usuário
      const novoUsuario = new Usuario(dadosUsuario);
      await novoUsuario.save();

      // Gerar token para login automático
      const token = this.gerarToken(novoUsuario);

      return {
        sucesso: true,
        mensagem: 'Usuário cadastrado com sucesso',
        token,
        usuario: novoUsuario.toJSON(),
        expiresIn: this.JWT_EXPIRES_IN
      };

    } catch (error) {
      console.error('❌ Erro no registro:', error.message);
      throw error;
    }
  }

  async verificarEmailExistente(email) {
    try {
      const usuario = await Usuario.findOne({ email: email.toLowerCase() });
      return !!usuario;
    } catch (error) {
      console.error('❌ Erro ao verificar email:', error.message);
      throw error;
    }
  }

  async verificarDocumentoExistente(documento) {
    try {
      const usuario = await Usuario.findOne({ documento });
      return !!usuario;
    } catch (error) {
      console.error('❌ Erro ao verificar documento:', error.message);
      throw error;
    }
  }

  gerarToken(usuario) {
    const payload = {
      id: usuario._id,
      email: usuario.email,
      nome: usuario.nome,
      permissoes: usuario.permissoes
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
      const usuario = await Usuario.findById(id);
      return usuario ? usuario.toJSON() : null;
    } catch (error) {
      console.error('❌ Erro ao buscar usuário por ID:', error.message);
      throw error;
    }
  }

  async limparUsuarios() {
    try {
      console.log('🧹 Limpando todos os usuários...');
      const resultado = await Usuario.deleteMany({});
      console.log(`✅ ${resultado.deletedCount} usuários removidos`);
      return resultado;
    } catch (error) {
      console.error('❌ Erro ao limpar usuários:', error.message);
      throw error;
    }
  }
}

module.exports = new AuthService();