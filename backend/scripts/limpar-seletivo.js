require('dotenv').config();

const database = require('../config/database');
const mongoose = require('mongoose');
const Usuario = require('../models/Usuario');
const Cliente = require('../models/Cliente');
const Produto = require('../models/Produto');
const Configuracao = require('../models/Configuracao');

function parseDateEnv(name, fallback) {
  const raw = process.env[name];
  if (raw && !isNaN(Date.parse(raw))) return new Date(raw);
  return new Date(fallback);
}

function logResumo(resumo) {
  console.log('\n📊 Resumo da Limpeza Seletiva');
  Object.entries(resumo).forEach(([k, v]) => {
    console.log(`- ${k}: ${v}`);
  });
}

async function limparSeletivo() {
  const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'admin@brandaocontador.com.br';
  const START = parseDateEnv('PRESERVE_START', '2025-10-16T00:00:00-03:00');
  const END = parseDateEnv('PRESERVE_END', '2025-10-18T23:59:59-03:00');

  console.log('🧹 Iniciando limpeza seletiva do banco de dados...');
  console.log(`👤 Admin preservado: ${ADMIN_EMAIL}`);
  console.log(`🗓️ Janela de preservação: ${START.toISOString()} até ${END.toISOString()}`);

  const resumo = {
    usuarios_removidos: 0,
    usuarios_preservados: 0,
    clientes_removidos: 0,
    clientes_preservados: 0,
    produtos_removidos: 0,
    produtos_preservados: 0,
    configuracoes_removidas: 0,
    configuracoes_preservadas: 0,
  };

  try {
    await database.connect();
    if (!database.isConnected()) throw new Error('Conexão com MongoDB não estabelecida');

    // USUÁRIOS: preservar apenas o admin
    const admin = await Usuario.findOne({ email: ADMIN_EMAIL });
    if (!admin) {
      console.warn('⚠️ Admin não encontrado! Nenhum usuário será preservado além de critério de email.');
    }

    const usuarios = await Usuario.find();
    for (const u of usuarios) {
      const isAdmin = u.email === ADMIN_EMAIL || (Array.isArray(u.permissoes) && (u.permissoes.includes('admin') || u.permissoes.includes('admin_total')));
      if (isAdmin) {
        resumo.usuarios_preservados += 1;
        continue;
      }
      await Usuario.deleteOne({ _id: u._id });
      resumo.usuarios_removidos += 1;
    }

    // CLIENTES: preservar apenas os criados na janela
    const clientes = await Cliente.find();
    for (const c of clientes) {
      const created = c.createdAt || c.dataCadastro || c.criadoEm; // compatibilidade de campos
      const createdDate = created ? new Date(created) : null;
      const inWindow = createdDate && createdDate >= START && createdDate <= END;
      if (inWindow) {
        resumo.clientes_preservados += 1;
        continue;
      }
      await Cliente.deleteOne({ _id: c._id });
      resumo.clientes_removidos += 1;
    }

    // PRODUTOS: preservar apenas os criados na janela
    const produtos = await Produto.find();
    for (const p of produtos) {
      const created = p.createdAt || p.dataCadastro || p.criadoEm;
      const createdDate = created ? new Date(created) : null;
      const inWindow = createdDate && createdDate >= START && createdDate <= END;
      if (inWindow) {
        resumo.produtos_preservados += 1;
        continue;
      }
      await Produto.deleteOne({ _id: p._id });
      resumo.produtos_removidos += 1;
    }

    // CONFIGURAÇÕES: preservar as mais recentes dentro da janela, senão remover
    const configuracoes = await Configuracao.find();
    for (const conf of configuracoes) {
      const updated = conf.updatedAt || conf.createdAt;
      const inWindow = updated && new Date(updated) >= START && new Date(updated) <= END;
      if (inWindow) {
        resumo.configuracoes_preservadas += 1;
        continue;
      }
      await Configuracao.deleteOne({ _id: conf._id });
      resumo.configuracoes_removidas += 1;
    }

    logResumo(resumo);
    console.log('\n✅ Limpeza seletiva concluída com sucesso.');

    // Informar próximos passos
    console.log('\n📋 Próximos passos:');
    console.log('- Verifique se o admin consegue fazer login.');
    console.log('- Reconfigure certificados e parâmetros NFe se necessário.');
    console.log('- Teste emissão em homologação com SIMULATION_MODE=false e certificado real.');
  } catch (error) {
    console.error('❌ Erro durante limpeza seletiva:', error.message);
    console.error(error.stack);
    process.exitCode = 1;
  } finally {
    try { await database.disconnect(); } catch (_) {}
  }
}

if (require.main === module) {
  limparSeletivo();
}