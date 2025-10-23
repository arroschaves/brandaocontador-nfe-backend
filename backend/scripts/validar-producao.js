#!/usr/bin/env node
/**
 * Validador de Produção
 * - Carrega .env (production por padrão)
 * - Valida variáveis críticas
 * - Verifica certificado (.pfx) e conectividade MongoDB
 * - Confere documento Configuracao (chave='padrao')
 * - Gera relatório Markdown em backend/reports
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

const ROOT = path.resolve(__dirname, '..', '..');
const BACKEND = path.resolve(__dirname, '..');

function resolveEnvPath() {
  const args = process.argv.slice(2);
  const envArg = args.find(a => a.startsWith('--env='));
  const envFileArg = args.find(a => a.startsWith('--env-file='));

  if (envFileArg) {
    const p = envFileArg.split('=')[1];
    return path.isAbsolute(p) ? p : path.resolve(ROOT, p);
  }

  const mode = envArg ? envArg.split('=')[1] : 'production';
  const candidates = [
    path.join(BACKEND, `.env.${mode}`),
    path.join(BACKEND, `.env.${mode.toLowerCase()}`),
    path.join(BACKEND, `.env.${mode === 'producao' ? 'production' : mode}`),
    path.join(BACKEND, '.env.production'),
    path.join(BACKEND, '.env.producao'),
    path.join(ROOT, '.env')
  ];

  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

function loadEnv() {
  const envPath = resolveEnvPath();
  if (envPath) {
    dotenv.config({ path: envPath });
    console.log(`🔧 .env carregado: ${envPath}`);
  } else {
    console.warn('⚠️ Nenhum arquivo .env encontrado; usando variáveis do ambiente atual');
  }
}

function checkFileExists(p) {
  if (!p) return { exists: false, resolved: null };
  const resolved = path.isAbsolute(p) ? p : path.resolve(BACKEND, p);
  return { exists: fs.existsSync(resolved), resolved };
}

function section(title) {
  console.log(`\n=== ${title} ===`);
}

async function validateMongo(uri) {
  try {
    const opts = { serverSelectionTimeoutMS: 5000 };
    await mongoose.connect(uri, opts);
    const adminPing = await mongoose.connection.db.admin().command({ ping: 1 });
    const counts = {};
    const collections = ['usuarios', 'clientes', 'produtos', 'configuracoes', 'nfes', 'logs'];
    for (const col of collections) {
      try {
        counts[col] = await mongoose.connection.db.collection(col).countDocuments();
      } catch (e) {
        counts[col] = 'coleção ausente';
      }
    }
    return { ok: true, adminPing, counts };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function validateConfiguracaoModel() {
  try {
    const Configuracao = require(path.join(BACKEND, 'models', 'Configuracao'));
    const doc = await Configuracao.findOne({ chave: 'padrao' }).lean();
    if (!doc) return { ok: false, error: 'Documento com chave="padrao" não encontrado.' };

    const empresa = doc.empresa || {};
    const obrigatorios = ['razaoSocial', 'nomeFantasia', 'cnpj', 'email', 'telefone'];
    const enderecoCampos = ['cep', 'logradouro', 'numero', 'bairro', 'municipio', 'uf'];
    const faltantes = [];
    for (const k of obrigatorios) if (!empresa[k]) faltantes.push(`empresa.${k}`);
    for (const k of enderecoCampos) if (!(empresa.endereco && empresa.endereco[k])) faltantes.push(`empresa.endereco.${k}`);

    const nfe = doc.nfe || {};
    const nfeObrig = ['ambiente', 'serie', 'numeracaoInicial'];
    for (const k of nfeObrig) if (!nfe[k]) faltantes.push(`nfe.${k}`);
    const cert = (nfe.certificadoDigital || {});
    for (const k of ['arquivo', 'senha']) if (!cert[k]) faltantes.push(`nfe.certificadoDigital.${k}`);

    return { ok: faltantes.length === 0, faltantes, docResumo: { empresa: empresa.razaoSocial, cnpj: empresa.cnpj, ambiente: nfe.ambiente } };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function validateEnvVars() {
  section('Validação de variáveis de ambiente');
  const simpleMode = (process.env.APP_MODE === 'simple' || process.env.MODE === 'simple' || process.env.DATABASE_MODE === 'file');
  const required = ['AMBIENTE', 'NODE_ENV', 'SIMULATION_MODE', 'JWT_SECRET', 'UF', 'CNPJ_EMITENTE'];
  if (!simpleMode) required.push('MONGODB_URI');
  const optional = ['CERT_PATH', 'CERT_PASS', 'XML_OUTPUT_DIR', 'SAVE_XML_FILES', 'XML_SECURITY_VALIDATE', 'APP_MODE', 'MODE', 'DATABASE_MODE'];
  const missing = [];
  const report = { SIMPLE_MODE: simpleMode };

  for (const k of required) {
    const v = process.env[k];
    report[k] = v;
    if (!v || String(v).trim() === '') missing.push(k);
  }
  for (const k of optional) report[k] = process.env[k];

  console.log('Variáveis:', report);
  if (missing.length) console.log('❌ Faltando:', missing.join(', ')); else console.log('✅ Todas as variáveis obrigatórias presentes');
  return { missing, report, simpleMode };
}

function validateCertificate() {
  section('Validação de certificado digital');
  const { exists, resolved } = checkFileExists(process.env.CERT_PATH);
  const passSet = !!(process.env.CERT_PASS && process.env.CERT_PASS.trim());
  console.log({ CERT_PATH: resolved, exists, passSet });
  if (!exists) console.log('❌ Certificado não encontrado no caminho informado');
  if (!passSet) console.log('❌ Senha do certificado ausente');
  return { exists, resolved, passSet };
}

function checkModes() {
  section('Validação de modos');
  const ambiente = process.env.AMBIENTE;
  const simulation = process.env.SIMULATION_MODE === 'true';
  const nodeEnv = process.env.NODE_ENV;

  if (ambiente === '1' && simulation) console.log('⚠️ Produção com SIMULATION_MODE=true – desative para emissão real');
  if (ambiente !== '1') console.log('ℹ️ AMBIENTE diferente de 1 – não está em produção');
  if (nodeEnv !== 'production') console.log('ℹ️ NODE_ENV diferente de production');

  return { ambiente, simulation, nodeEnv };
}

function checkXmlSecurityFlag() {
  section('Validação de segurança XML');
  const flag = process.env.XML_SECURITY_VALIDATE === 'true';
  console.log(`XML_SECURITY_VALIDATE=${process.env.XML_SECURITY_VALIDATE}`);
  const nfeServicePath = path.join(BACKEND, 'services', 'nfe-service.js');
  const content = fs.readFileSync(nfeServicePath, 'utf-8');
  const hasCall = content.includes('validarXmlSeguranca');
  const commented = content.includes('// validarXmlSeguranca');
  console.log({ hasCall, commented });
  return { flag, hasCall, commented };
}

async function main() {
  console.log('🧪 Iniciando validação de produção...');
  loadEnv();

  const envRes = validateEnvVars();
  const certRes = validateCertificate();
  const modeRes = checkModes();

  section('Conectividade MongoDB');
  let mongoRes = { ok: false, skipped: false };
  if (envRes.simpleMode) {
    mongoRes.skipped = true;
    console.log('ℹ️ Modo simples ativo — pulando validação de MongoDB');
  } else {
    mongoRes = await validateMongo(process.env.MONGODB_URI);
    console.log(mongoRes.ok ? '✅ MongoDB OK' : `❌ MongoDB erro: ${mongoRes.error}`);
    if (mongoRes.ok) console.log('Contagens:', mongoRes.counts);
  }

  section('Documento de Configuração');
  let configRes = { ok: false, error: 'skip' };
  if (mongoRes.ok) {
    configRes = await validateConfiguracaoModel();
    if (configRes.ok) console.log('✅ Configuração OK:', configRes.docResumo);
    else console.log(`❌ Configuração incompleta: ${configRes.error || configRes.faltantes.join(', ')}`);
  } else {
    console.log('⚠️ Pulando validação de Configuracao: sem conexão MongoDB ou modo simples');
  }

  const xmlSec = checkXmlSecurityFlag();

  // Gerar relatório
  const reportsDir = path.join(BACKEND, 'reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(reportsDir, `validar-producao-report-${ts}.md`);

  const lines = [];
  lines.push(`# Relatório Validação de Produção (${ts})`);
  lines.push('');
  lines.push('## Ambiente');
  lines.push(`- AMBIENTE=${modeRes.ambiente}`);
  lines.push(`- NODE_ENV=${modeRes.nodeEnv}`);
  lines.push(`- SIMULATION_MODE=${modeRes.simulation}`);
  lines.push('');
  lines.push('## Variáveis');
  lines.push(`- Faltantes: ${envRes.missing.join(', ') || 'nenhuma'}`);
  lines.push('');
  lines.push('## Certificado');
  lines.push(`- Caminho: ${certRes.resolved}`);
  lines.push(`- Existe: ${certRes.exists}`);
  lines.push(`- Senha definida: ${certRes.passSet}`);
  lines.push('');
  lines.push('## MongoDB');
  if (mongoRes.skipped) {
    lines.push(`- Conexão: skipped (modo simples)`);
  } else {
    lines.push(`- Conexão: ${mongoRes.ok}`);
    if (mongoRes.ok) {
      for (const [k, v] of Object.entries(mongoRes.counts)) {
        lines.push(`- ${k}: ${v}`);
      }
    }
  }
  lines.push('');
  lines.push('## Configuração (chave="padrao")');
  lines.push(`- OK: ${configRes.ok}`);
  if (!configRes.ok) lines.push(`- Problemas: ${configRes.error || configRes.faltantes.join(', ')}`);
  lines.push('');
  lines.push('## Segurança XML');
  lines.push(`- Flag ativa: ${xmlSec.flag}`);
  lines.push(`- Chamada presente: ${xmlSec.hasCall} / Comentada: ${xmlSec.commented}`);
  lines.push('');
  fs.writeFileSync(reportPath, lines.join(os.EOL), 'utf-8');
  console.log(`📄 Relatório gerado em: ${reportPath}`);

  // Encerrar conexões
  try { await mongoose.disconnect(); } catch {}
  console.log('✅ Validação concluída');
}

main().catch(err => {
  console.error('❌ Falha na validação:', err);
  process.exit(1);
});