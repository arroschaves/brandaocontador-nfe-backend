// Script para simular o fluxo do frontend
require('dotenv').config({ path: '.env.desenvolvimento' });

const axios = require('axios');

async function simulateFrontendFlow() {
  console.log('🎭 SIMULANDO FLUXO DO FRONTEND');
  console.log('='.repeat(50));
  
  const baseURL = 'http://localhost:3001';
  
  try {
    // Aguardar um pouco para evitar rate limit
    console.log('⏳ Aguardando para evitar rate limit...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 1. Fazer login
    console.log('\n1️⃣ Fazendo login...');
    const loginData = {
      email: 'validuser@example.com',
      senha: 'adminpassword'
    };
    
    const loginResponse = await axios.post(`${baseURL}/auth/login`, loginData);
    
    if (!loginResponse.data.sucesso) {
      console.log('❌ Falha no login:', loginResponse.data);
      return;
    }
    
    const token = loginResponse.data.token;
    console.log('✅ Login realizado com sucesso!');
    console.log(`👤 Usuário: ${loginResponse.data.usuario.email}`);
    
    // 2. Buscar histórico (como o Dashboard faz)
    console.log('\n2️⃣ Buscando histórico de NFes...');
    const histResponse = await axios.get(`${baseURL}/nfe/historico?pagina=1&limite=10`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('✅ Histórico obtido:', histResponse.data.total || 0, 'NFes');
    
    // 3. Buscar status (como o Dashboard faz)
    console.log('\n3️⃣ Buscando status do sistema...');
    const statusResponse = await axios.get(`${baseURL}/nfe/status`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('✅ Status obtido com sucesso!');
    console.log('📄 Resposta completa:', JSON.stringify(statusResponse.data, null, 2));
    
    // 4. Analisar como o frontend processaria
    console.log('\n4️⃣ Simulando processamento do frontend...');
    const status = statusResponse.data?.status;
    const sefazOnline = !!status?.sefaz?.disponivel;
    
    console.log(`🔍 status?.sefaz?.disponivel = ${status?.sefaz?.disponivel}`);
    console.log(`🔍 !!status?.sefaz?.disponivel = ${sefazOnline}`);
    console.log(`🔍 Frontend definiria sefaz como: ${sefazOnline ? 'online' : 'offline'}`);
    
    // 5. Buscar health (como o Dashboard faz)
    console.log('\n5️⃣ Buscando health...');
    const healthResponse = await axios.get(`${baseURL}/health`);
    console.log('✅ Health obtido:', healthResponse.data.status);
    
    // 6. Simular o estado final do sistema
    console.log('\n6️⃣ Estado final do sistema (como o frontend veria):');
    const dbConnected = (healthResponse?.data?.bancoDados === 'conectado');
    const apiOnline = (healthResponse?.data?.status === 'ok');
    
    const systemStatus = {
      sefaz: sefazOnline ? 'online' : 'offline',
      database: dbConnected ? 'online' : 'offline',
      api: apiOnline ? 'online' : 'offline'
    };
    
    console.log('📊 System Status:', JSON.stringify(systemStatus, null, 2));
    
    if (systemStatus.sefaz === 'online') {
      console.log('\n🎉 SUCESSO! Frontend deveria mostrar SEFAZ como ONLINE!');
    } else {
      console.log('\n❌ PROBLEMA! Frontend mostraria SEFAZ como OFFLINE!');
      console.log('🔍 Investigando o problema...');
      console.log(`   status = ${JSON.stringify(status)}`);
      console.log(`   status?.sefaz = ${JSON.stringify(status?.sefaz)}`);
      console.log(`   status?.sefaz?.disponivel = ${status?.sefaz?.disponivel}`);
    }
    
  } catch (error) {
    console.error('💥 Erro durante a simulação:', error.message);
    if (error.response) {
      console.error('📄 Response Status:', error.response.status);
      console.error('📄 Response Data:', error.response.data);
    }
  }
}

simulateFrontendFlow().catch(console.error);