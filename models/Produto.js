const mongoose = require('mongoose');

const produtoSchema = new mongoose.Schema({
  nome: {
    type: String,
    required: [true, 'Nome do produto é obrigatório'],
    trim: true,
    maxlength: [150, 'Nome não pode exceder 150 caracteres']
  },
  codigo: {
    type: String,
    trim: true,
    unique: true,
    sparse: true,
    maxlength: [50, 'Código não pode exceder 50 caracteres']
  },
  descricao: {
    type: String,
    trim: true,
    maxlength: [500, 'Descrição não pode exceder 500 caracteres']
  },
  ncm: {
    type: String,
    trim: true,
    match: [/^\d{2,8}$/ , 'NCM deve conter apenas dígitos (2 a 8)']
  },
  cfop: {
    type: String,
    trim: true,
    match: [/^\d{4}$/ , 'CFOP deve conter 4 dígitos'],
  },
  unidade: {
    type: String,
    trim: true,
    default: 'UN'
  },
  valorUnitario: {
    type: Number,
    min: [0, 'Valor deve ser maior ou igual a 0'],
    default: 0
  },
  cest: {
    type: String,
    trim: true
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
  collection: 'produtos'
});

// Índices para melhor performance (codigo já é único na definição do schema)
produtoSchema.index({ nome: 1 });
produtoSchema.index({ ativo: 1 });

produtoSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

const Produto = mongoose.model('Produto', produtoSchema);

module.exports = Produto;