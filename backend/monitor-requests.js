const express = require('express');
const app = express();

// Middleware para logar todas as requisições
app.use((req, res, next) => {
  const timestamp = new Date().toLocaleString('pt-BR');
  console.log(`[${timestamp}] ${req.method} ${req.url}`);
  
  if (req.headers.authorization) {
    console.log(`   🔐 Auth: ${req.headers.authorization.substring(0, 20)}...`);
  } else {
    console.log(`   🔓 Sem autenticação`);
  }
  
  next();
});

// Interceptar especificamente as requisições de status
app.use('/nfe/status*', (req, res, next) => {
  console.log(`\n🎯 REQUISIÇÃO DE STATUS DETECTADA!`);
  console.log(`   Endpoint: ${req.url}`);
  console.log(`   Método: ${req.method}`);
  console.log(`   Headers: ${JSON.stringify(req.headers, null, 2)}`);
  next();
});

console.log('🔍 Monitor de requisições iniciado...');
console.log('   Aguardando requisições do frontend...');
console.log('   Pressione Ctrl+C para parar\n');

// Não iniciar servidor, apenas mostrar como seria
// Este é apenas um exemplo de como monitorar