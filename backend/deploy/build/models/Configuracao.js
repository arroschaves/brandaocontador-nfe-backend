const mongoose = require('mongoose');

const enderecoSchema = new mongoose.Schema({
  cep: { type: String, default: '' },
  logradouro: { type: String, default: '' },
  numero: { type: String, default: '' },
  complemento: { type: String, default: '' },
  bairro: { type: String, default: '' },
  municipio: { type: String, default: '' },
  uf: { type: String, default: '' }
}, { _id: false });

const certificadoDigitalSchema = new mongoose.Schema({
  arquivo: { type: String, default: '' },
  senha: { type: String, default: '' },
  validade: { type: String, default: '' },
  status: { type: String, enum: ['ativo', 'vencido', 'nao_configurado'], default: 'nao_configurado' }
}, { _id: false });

const emailEnvioSchema = new mongoose.Schema({
  servidor: { type: String, default: '' },
  porta: { type: Number, default: 587 },
  usuario: { type: String, default: '' },
  senha: { type: String, default: '' },
  ssl: { type: Boolean, default: true }
}, { _id: false });

const configuracaoSchema = new mongoose.Schema({
  chave: { type: String, default: 'padrao', unique: true },
  empresa: {
    razaoSocial: { type: String, default: '' },
    nomeFantasia: { type: String, default: '' },
    cnpj: { type: String, default: '' },
    inscricaoEstadual: { type: String, default: '' },
    inscricaoMunicipal: { type: String, default: '' },
    email: { type: String, default: '' },
    telefone: { type: String, default: '' },
    formaTributacao: { type: String, enum: ['simples_nacional', 'lucro_presumido', 'lucro_real', 'mei'], default: 'simples_nacional' },
    endereco: { type: enderecoSchema, default: () => ({}) }
  },
  nfe: {
    ambiente: { type: String, enum: ['producao', 'homologacao'], default: 'homologacao' },
    serie: { type: String, default: '1' },
    numeracaoInicial: { type: Number, default: 1 },
    certificadoDigital: { type: certificadoDigitalSchema, default: () => ({}) },
    emailEnvio: { type: emailEnvioSchema, default: () => ({}) }
  },
  notificacoes: {
    emailNFeEmitida: { type: Boolean, default: true },
    emailNFeCancelada: { type: Boolean, default: true },
    emailErroEmissao: { type: Boolean, default: true },
    emailVencimentoCertificado: { type: Boolean, default: true },
    whatsappNotificacoes: { type: Boolean, default: false },
    numeroWhatsapp: { type: String, default: '' }
  }
}, {
  timestamps: true,
  collection: 'configuracoes'
});

const Configuracao = mongoose.model('Configuracao', configuracaoSchema);

module.exports = Configuracao;