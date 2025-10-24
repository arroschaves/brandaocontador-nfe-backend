// Carregar configurações de ambiente
require('dotenv').config({ path: '.env.desenvolvimento' });

console.log('🔍 VERIFICANDO VARIÁVEIS DE AMBIENTE');
console.log('='.repeat(50));
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('AMBIENTE:', process.env.AMBIENTE);
console.log('UF:', process.env.UF);
console.log('SIMULATION_MODE:', process.env.SIMULATION_MODE);
console.log('CERT_PATH:', process.env.CERT_PATH);
console.log('CERT_PASS:', process.env.CERT_PASS);
console.log('PORT:', process.env.PORT);
console.log('='.repeat(50));