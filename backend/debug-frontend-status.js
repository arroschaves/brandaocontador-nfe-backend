// Carregar configurações de ambiente
require('dotenv').config({ path: '.env.desenvolvimento' });

const axios = require('axios');

async function debugFrontendStatus() {
  console.log('🔍 DEBUGANDO STATUS SEFAZ NO FRONTEND');
  console.log('='.repeat(50));
  
  const baseURL = 'http://localhost:3001';
  
  try {
    // 1. Testar endpoint de health (sem autenticação)
    console.log('\n1️⃣ Testando endpoint /health (sem auth)...');
    const healthResponse = await axios.get(`${baseURL}/health`);
    console.log('✅ Health Status:', healthResponse.status);
    console.log('📊 Health Data:', JSON.stringify(healthResponse.data, null, 2));
    
    // 2. Tentar fazer login para obter token
    console.log('\n2️⃣ Fazendo login para obter token...');
    const loginData = {
    email: 'admin@brandaocontador.com.br',
    senha: 'adminpassword'
  };
    
    const loginResponse = await axios.post(`${baseURL}/auth/login`, loginData);
    console.log('✅ Login Status:', loginResponse.status);
    
    if (loginResponse.data.sucesso && loginResponse.data.token) {
      const token = loginResponse.data.token;
      console.log('🔑 Token obtido:', token.substring(0, 20) + '...');
      
      // 3. Testar endpoint /nfe/status com autenticação
      console.log('\n3️⃣ Testando endpoint /nfe/status (com auth)...');
      const statusResponse = await axios.get(`${baseURL}/nfe/status`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('✅ Status Response:', statusResponse.status);
      console.log('📊 Status Data:', JSON.stringify(statusResponse.data, null, 2));
      
      // 4. Verificar especificamente o status da SEFAZ
      if (statusResponse.data && statusResponse.data.sefaz) {
        console.log('\n🏛️ ANÁLISE DO STATUS SEFAZ:');
        console.log(`   Disponível: ${statusResponse.data.sefaz.disponivel ? '✅ SIM' : '❌ NÃO'}`);
        console.log(`   Ambiente: ${statusResponse.data.sefaz.ambiente}`);
        console.log(`   UF: ${statusResponse.data.sefaz.uf}`);
        console.log(`   Simulação: ${statusResponse.data.sefaz.simulacao ? '✅ SIM' : '❌ NÃO'}`);
        
        if (statusResponse.data.sefaz.disponivel) {
          console.log('\n🎉 SEFAZ ESTÁ ONLINE! O problema pode estar no frontend.');
        } else {
          console.log('\n❌ SEFAZ ESTÁ OFFLINE! Problema confirmado no backend.');
        }
      }
      
    } else {
      console.log('❌ Falha no login:', loginResponse.data);
    }
    
  } catch (error) {
    console.error('💥 Erro durante o debug:', error.message);
    if (error.response) {
      console.error('📄 Response Status:', error.response.status);
      console.error('📄 Response Data:', error.response.data);
    }
  }
}

debugFrontendStatus().catch(console.error);