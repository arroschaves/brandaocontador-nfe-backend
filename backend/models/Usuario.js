const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const enderecoSchema = new mongoose.Schema({
  cep: { type: String },
  logradouro: { type: String },
  numero: { type: String },
  complemento: { type: String, default: '' },
  bairro: { type: String },
  cidade: { type: String },
  uf: { type: String, maxlength: 2 }
}, { _id: false });

const usuarioSchema = new mongoose.Schema({
  nome: {
    type: String,
    required: [true, 'Nome é obrigatório'],
    trim: true,
    maxlength: [100, 'Nome não pode ter mais de 100 caracteres']
  },
  email: {
    type: String,
    required: [true, 'Email é obrigatório'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Email inválido']
  },
  senha: {
    type: String,
    required: [true, 'Senha é obrigatória'],
    minlength: [6, 'Senha deve ter pelo menos 6 caracteres']
  },
  tipoCliente: {
    type: String,
    enum: {
      values: ['cpf', 'cnpj'],
      message: 'Tipo de cliente deve ser cpf ou cnpj'
    },
    default: 'cpf'
  },
  documento: {
    type: String,
    unique: true,
    trim: true,
    validate: {
      validator: function(v) {
        if (!v) return true; // opcional
        if (this.tipoCliente === 'cpf') {
          return /^\d{11}$/.test(v); // CPF: 11 dígitos
        } else {
          return /^\d{14}$/.test(v); // CNPJ: 14 dígitos
        }
      },
      message: 'Documento inválido para o tipo de cliente'
    }
  },
  telefone: {
    type: String,
    trim: true
  },
  razaoSocial: {
    type: String,
    trim: true,
    maxlength: [200, 'Razão social não pode ter mais de 200 caracteres']
  },
  nomeFantasia: {
    type: String,
    trim: true,
    maxlength: [100, 'Nome fantasia não pode ter mais de 100 caracteres']
  },
  inscricaoEstadual: {
    type: String,
    trim: true
  },
  // Campos opcionais para login social
  socialProvider: {
    type: String,
    trim: true
  },
  socialProviderId: {
    type: String,
    trim: true
  },
  image: {
    type: String,
    trim: true
  },
  endereco: {
    type: enderecoSchema
  },
  permissoes: {
    type: [String],
    default: ['nfe_emitir', 'nfe_consultar']
  },
  ativo: {
    type: Boolean,
    default: true
  },
  dataCadastro: {
    type: Date,
    default: Date.now
  },
  ultimoAcesso: {
    type: Date
  },
  certificadoDigital: {
    caminho: String,
    validade: Date,
    ativo: { type: Boolean, default: false }
  }
}, {
  timestamps: true,
  collection: 'usuarios'
});

// Índices para melhor performance
usuarioSchema.index({ email: 1 }, { unique: true });
usuarioSchema.index({ documento: 1 }, { unique: true, sparse: true });
usuarioSchema.index({ ativo: 1 });

// Hash da senha antes de salvar
usuarioSchema.pre('save', async function(next) {
  if (!this.isModified('senha')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.senha = await bcrypt.hash(this.senha, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Método para comparar senhas
usuarioSchema.methods.compararSenha = async function(senhaCandidata) {
  return await bcrypt.compare(senhaCandidata, this.senha);
};

// Método para atualizar último acesso
usuarioSchema.methods.atualizarUltimoAcesso = function() {
  this.ultimoAcesso = new Date();
  return this.save();
};

// Remover senha ao retornar usuário
usuarioSchema.methods.toJSON = function() {
  const usuario = this.toObject();
  delete usuario.senha;
  delete usuario.__v;
  return usuario;
};

const Usuario = mongoose.model('Usuario', usuarioSchema);

module.exports = Usuario;