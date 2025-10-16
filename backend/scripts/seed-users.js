require('dotenv').config();

const mongoose = require('mongoose');
const database = require('../config/database');
const Usuario = require('../models/Usuario');

async function criarUsuarioAdmin() {
  const nome = process.env.SEED_ADMIN_NOME || process.env.ADMIN_NOME || 'Administrador';
  const email = process.env.SEED_ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'admin@example.com';
  const senha = process.env.SEED_ADMIN_SENHA || process.env.ADMIN_SENHA || 'adminpassword';

  const existente = await Usuario.findOne({ email });
  if (existente) {
    console.log(`⚠️  Usuário admin já existe: ${email}`);
    return existente;
  }

  const admin = new Usuario({
    nome,
    email,
    senha,
    tipoCliente: 'cnpj',
    documento: '12345678000199',
    telefone: '11999999999',
    razaoSocial: 'Empresa Admin Ltda',
    nomeFantasia: 'Admin LTDA',
    endereco: {
      cep: '01001000',
      logradouro: 'Praça da Sé',
      numero: '100',
      complemento: 'Sala 1',
      bairro: 'Sé',
      cidade: 'São Paulo',
      uf: 'SP'
    },
    permissoes: ['admin_total', 'admin', 'nfe_emitir', 'nfe_consultar'],
    ativo: true
  });

  await admin.save();
  console.log(`✅ Usuário admin criado: ${email}`);
  return admin;
}

async function criarUsuarioPadrao() {
  const email = process.env.USER_EMAIL || 'validuser@example.com';
  const senha = process.env.USER_SENHA || 'ValidPassword123!';

  const existente = await Usuario.findOne({ email });
  if (existente) {
    console.log(`⚠️  Usuário padrão já existe: ${email}`);
    return existente;
  }

  const user = new Usuario({
    nome: 'Usuário Válido',
    email,
    senha,
    tipoCliente: 'cpf',
    documento: '12345678901',
    telefone: '11988887777',
    endereco: {
      cep: '01310930',
      logradouro: 'Avenida Paulista',
      numero: '1578',
      complemento: 'Conj. 101',
      bairro: 'Bela Vista',
      cidade: 'São Paulo',
      uf: 'SP'
    },
    permissoes: ['nfe_emitir', 'nfe_consultar'],
    ativo: true
  });

  await user.save();
  console.log(`✅ Usuário padrão criado: ${email}`);
  return user;
}

async function main() {
  try {
    await database.connect();
    if (!mongoose.connection.readyState) {
      throw new Error('Conexão com MongoDB não estabelecida');
    }

    await criarUsuarioAdmin();
    await criarUsuarioPadrao();
  } catch (err) {
    console.error('❌ Erro ao executar seed:', err.message);
    process.exitCode = 1;
  } finally {
    try {
      await database.disconnect();
    } catch (e) {}
  }
}

if (require.main === module) {
  main();
}