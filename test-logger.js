const AdvancedLogger = require('./services/advanced-logger');

console.log('Testando AdvancedLogger...');

const logger = new AdvancedLogger();

console.log('Logger criado, testando writeLog...');

logger.logError('system', 'Teste de erro manual', null, new Error('Erro de teste'), {
  teste: true,
  timestamp: new Date().toISOString()
});

logger.logInfo('system', 'Teste de info manual', null, {
  teste: true,
  timestamp: new Date().toISOString()
});

console.log('Logs escritos, verificando arquivos...');

const fs = require('fs');
const path = require('path');

const logsDir = path.join(__dirname, 'logs', 'system');
console.log('Diretório de logs:', logsDir);

if (fs.existsSync(logsDir)) {
  const files = fs.readdirSync(logsDir);
  console.log('Arquivos encontrados:', files);
  
  files.forEach(file => {
    const filePath = path.join(logsDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    console.log(`\nConteúdo de ${file}:`);
    console.log(content);
  });
} else {
  console.log('Diretório de logs não existe!');
}