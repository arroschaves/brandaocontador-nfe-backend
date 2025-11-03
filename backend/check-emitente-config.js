const DatabaseService = require('./services/database-service');

async function checkEmitenteConfig() {
  try {
    const config = await DatabaseService.getConfiguration('emitente');
    console.log('Configuração do emitente:');
    console.log(JSON.stringify(config, null, 2));
  } catch (error) {
    console.error('Erro ao buscar configuração:', error);
  }
}

checkEmitenteConfig();