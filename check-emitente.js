const db = require('./backend/config/database-simples');

async function checkEmitente() {
  try {
    const config = await db.getConfiguration('emitente');
    console.log('Configuração emitente:', JSON.stringify(config, null, 2));
  } catch (error) {
    console.error('Erro:', error);
  }
}

checkEmitente();