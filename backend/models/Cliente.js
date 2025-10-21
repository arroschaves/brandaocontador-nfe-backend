const mongoose = require('mongoose');

const enderecoSchema = new mongoose.Schema({
  cep: { type: String },
  logradouro: { type: String },
  numero: { type: String },
  complemento: { type: String, default: '' },
  bairro: { type: String },
  cidade: { type: String },
  uf: { type: String, maxlength: 2 }
}, { _id: false });

const clienteSchema = new mongoose.Schema({
  tipo: {
    type: String,
    enum: {
      values: ['cpf', 'cnpj'],
      message: 'Tipo deve ser cpf ou cnpj'
    },
    required: [true, 'Tipo (cpf/cnpj) é obrigatório']
  },
  documento: {
    type: String,
    unique: true,
    trim: true,
    required: [true, 'Documento é obrigatório'],
    set: v => (v || '').replace(/\D/g, ''),
    validate: {
      validator: function(v) {
        if (!v) return false;
        if (this.tipo === 'cpf') {
          return /^\d{11}$/.test(v);
        } else {
          return /^\d{14}$/.test(v);
        }
      },
      message: 'Documento inválido para o tipo informado'
    }
  },
  nome: {
    type: String,
    trim: true,
    required: [true, 'Nome é obrigatório'],
    maxlength: [120, 'Nome não pode exceder 120 caracteres']
  },
  razaoSocial: {
    type: String,
    trim: true,
    maxlength: [200, 'Razão social não pode exceder 200 caracteres']
  },
  nomeFantasia: {
    type: String,
    trim: true,
    maxlength: [120, 'Nome fantasia não pode exceder 120 caracteres']
  },
  inscricaoEstadual: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Email inválido']
  },
  telefone: {
    type: String,
    trim: true
  },
  endereco: {
    type: enderecoSchema
  },
  observacoes: {
    type: String,
    trim: true,
    maxlength: [500, 'Observações não podem exceder 500 caracteres']
  },
  ativo: {
    type: Boolean,
    default: true
  },
  usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', index: true },
  dataCadastro: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  collection: 'clientes'
});

clienteSchema.index({ documento: 1 }, { unique: true, sparse: true });
clienteSchema.index({ nome: 1 });
clienteSchema.index({ ativo: 1 });

clienteSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

const Cliente = mongoose.model('Cliente', clienteSchema);

module.exports = Cliente;

// Sanitização em operações de update
clienteSchema.pre('findOneAndUpdate', function(next) {
  const update = this.getUpdate() || {};
  const setObj = update.$set || update;
  if (setObj && typeof setObj.documento === 'string') {
    setObj.documento = setObj.documento.replace(/\D/g, '');
    if (update.$set) {
      update.$set.documento = setObj.documento;
    }
    this.setUpdate(update);
  }
  next();
});