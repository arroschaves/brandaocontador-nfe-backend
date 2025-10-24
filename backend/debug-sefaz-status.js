const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

async function debugSefazStatus() {
  console.log('🔍 DEBUGANDO STATUS SEFAZ NO FRONTEND\n');
  
  try {
    // 1. Testar endpoint de debug sem autenticação
    console.log('1️⃣ Testando endpoint /debug/status (sem autenticação)...');
    const debugResponse = await axios.get(`${BASE_URL}/debug/status`);
    console.log('✅ Debug Status:', JSON.stringify(debugResponse.data, null, 2));
    console.log(`   SEFAZ Disponível: ${debugResponse.data.status.sefaz.disponivel}`);
    console.log('');

    // 2. Tentar fazer login
    console.log('2️⃣ Tentando fazer login...');
    const loginData = {
      email: 'admin@brandaocontador.com.br',
      senha: 'adminpassword'
    };
    
    let token = null;
    try {
      const loginResponse = await axios.post(`${BASE_URL}/auth/login`, loginData);
      token = loginResponse.data.token;
      console.log('✅ Login realizado com sucesso');
      console.log(`   Token: ${token.substring(0, 50)}...`);
    } catch (loginError) {
      console.log('❌ Erro no login:', loginError.response?.data || loginError.message);
      
      // Tentar com usuário alternativo
      console.log('   Tentando com usuário alternativo...');
      const altLoginData = {
        email: 'validuser@example.com',
        senha: 'validpassword'
      };
      
      try {
        const altLoginResponse = await axios.post(`${BASE_URL}/auth/login`, altLoginData);
        token = altLoginResponse.data.token;
        console.log('✅ Login alternativo realizado com sucesso');
        console.log(`   Token: ${token.substring(0, 50)}...`);
      } catch (altError) {
        console.log('❌ Erro no login alternativo:', altError.response?.data || altError.message);
        console.log('⚠️  Continuando sem token para testar endpoint sem auth...');
      }
    }
    console.log('');

    // 3. Testar endpoint /nfe/status com autenticação (se tiver token)
    if (token) {
      console.log('3️⃣ Testando endpoint /nfe/status (com autenticação)...');
      try {
        const statusResponse = await axios.get(`${BASE_URL}/nfe/status`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        console.log('✅ Status NFe:', JSON.stringify(statusResponse.data, null, 2));
        console.log(`   SEFAZ Disponível: ${statusResponse.data.status.sefaz.disponivel}`);
      } catch (statusError) {
        console.log('❌ Erro ao obter status NFe:', statusError.response?.data || statusError.message);
      }
    } else {
      console.log('3️⃣ ⚠️  Pulando teste /nfe/status - sem token válido');
    }
    console.log('');

    // 4. Simular requisição do frontend
    console.log('4️⃣ Simulando requisição do frontend...');
    try {
      const frontendResponse = await axios.get(`${BASE_URL}/debug/status`);
      const sefazStatus = frontendResponse.data.status?.sefaz?.disponivel;
      
      console.log('Frontend receberia:');
      console.log(`   status.sefaz.disponivel = ${sefazStatus}`);
      console.log(`   Tipo: ${typeof sefazStatus}`);
      
      // Simular lógica do Dashboard.tsx
      const sefazOnline = Boolean(sefazStatus);
      console.log(`   Dashboard interpretaria como: sefazOnline = ${sefazOnline}`);
      
    } catch (frontendError) {
      console.log('❌ Erro na simulação frontend:', frontendError.response?.data || frontendError.message);
    }
    console.log('');

    // 5. Verificar variáveis de ambiente
    console.log('5️⃣ Verificando configurações...');
    console.log(`   SIMULATION_MODE: ${process.env.SIMULATION_MODE}`);
    console.log(`   NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(`   PORT: ${process.env.PORT}`);

  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  }
}

// Executar o debug
debugSefazStatus().catch(console.error);