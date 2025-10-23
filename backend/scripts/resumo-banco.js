require('dotenv').config();

const database = require('../config/database');
const mongoose = require('mongoose');
const Usuario = require('../models/Usuario');
const Cliente = require('../models/Cliente');
const Produto = require('../models/Produto');
const Configuracao = require('../models/Configuracao');

async function resumo() {
  try {
    console.log('📊 Resumo do Banco (coleções principais)');
    await database.connect();
    if (!database.isConnected()) throw new Error('Conexão com MongoDB não estabelecida');

    const counts = {};
    counts.usuarios = await Usuario.countDocuments({});
    counts.clientes = await Cliente.countDocuments({});
    counts.produtos = await Produto.countDocuments({});
    counts.configuracoes = await Configuracao.countDocuments({});

    const db = mongoose.connection.db;
    const hasNfes = await db.listCollections({ name: 'nfes' }).hasNext();
    counts.nfes = hasNfes ? await db.collection('nfes').countDocuments({}) : 0;
    const hasLogs = await db.listCollections({ name: 'logs' }).hasNext();
    counts.logs = hasLogs ? await db.collection('logs').countDocuments({}) : 0;

    console.log(`- Usuários: ${counts.usuarios}`);
    console.log(`- Clientes: ${counts.clientes}`);
    console.log(`- Produtos: ${counts.produtos}`);
    console.log(`- Configurações: ${counts.configuracoes}`);
    console.log(`- NFes: ${counts.nfes}`);
    console.log(`- Logs: ${counts.logs}`);

  } catch (err) {
    console.error('❌ Erro no resumo:', err.message);
    process.exitCode = 1;
  } finally {
    try { await database.disconnect(); } catch (_) {}
  }
}

if (require.main === module) resumo();