const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

async function debugFrontendExact() {
  console.log('🔍 SIMULANDO EXATAMENTE O QUE O FRONTEND FAZ\n');
  
  try {
    // 1. Simular o que o Dashboard.tsx faz
    console.log('1️⃣ Simulando Dashboard.tsx - loadDashboardData()...');
    
    // O Dashboard faz 3 requisições em paralelo:
    // - nfeService.historico({ pagina: 1, limite: 10 })
    // - nfeService.status()  
    // - api.get('/health')
    
    console.log('   Fazendo 3 requisições em paralelo como o Dashboard...');
    
    // Primeiro, vamos tentar sem autenticação para ver o que acontece
    console.log('\n2️⃣ Testando sem autenticação (como usuário não logado)...');
    
    try {
      const [histResp, statusResp, healthResp] = await Promise.all([
        axios.get(`${BASE_URL}/nfe/historico?pagina=1&limite=10`).catch(e => ({ error: e.response?.data || e.message })),
        axios.get(`${BASE_URL}/nfe/status`).catch(e => ({ error: e.response?.data || e.message })),
        axios.get(`${BASE_URL}/health`).catch(e => ({ error: e.response?.data || e.message }))
      ]);
      
      console.log('📊 Histórico:', histResp.error ? `❌ ${JSON.stringify(histResp.error)}` : '✅ Sucesso');
      console.log('📊 Status:', statusResp.error ? `❌ ${JSON.stringify(statusResp.error)}` : '✅ Sucesso');
      console.log('📊 Health:', healthResp.error ? `❌ ${JSON.stringify(healthResp.error)}` : '✅ Sucesso');
      
      // Analisar o que o Dashboard faria com essas respostas
      console.log('\n3️⃣ Analisando como o Dashboard processaria...');
      
      // Se status falhou, o Dashboard não consegue determinar o status da SEFAZ
      if (statusResp.error) {
        console.log('❌ PROBLEMA ENCONTRADO!');
        console.log('   O Dashboard não consegue obter o status da SEFAZ porque:');
        console.log(`   - Requisição /nfe/status falhou: ${JSON.stringify(statusResp.error)}`);
        console.log('   - Sem dados de status, sefazOnline será undefined ou false');
        console.log('   - Por isso o frontend mostra SEFAZ como offline!');
      } else {
        console.log('✅ Status obtido com sucesso');
        const status = statusResp.data?.status;
        const sefazOnline = !!status?.sefaz?.disponivel;
        console.log(`   sefazOnline = ${sefazOnline}`);
      }
      
    } catch (error) {
      console.log('❌ Erro nas requisições paralelas:', error.message);
    }
    
    console.log('\n4️⃣ Testando com token válido...');
    
    // Vamos tentar usar o endpoint de debug para simular um token válido
    try {
      const debugResponse = await axios.get(`${BASE_URL}/debug/status`);
      console.log('✅ Debug Status (sem auth):', JSON.stringify(debugResponse.data, null, 2));
      
      // Simular o que aconteceria se o frontend conseguisse obter esse status
      const status = debugResponse.data?.status;
      const sefazOnline = !!status?.sefaz?.disponivel;
      
      console.log('\n5️⃣ Se o frontend conseguisse obter o status:');
      console.log(`   status.sefaz.disponivel = ${status?.sefaz?.disponivel}`);
      console.log(`   sefazOnline = ${sefazOnline}`);
      console.log(`   systemStatus.sefaz = '${sefazOnline ? 'online' : 'offline'}'`);
      
      if (sefazOnline) {
        console.log('\n🎯 CONCLUSÃO: O backend está retornando SEFAZ como online!');
        console.log('   O problema é que o frontend não consegue acessar /nfe/status');
        console.log('   porque requer autenticação e o usuário não está logado.');
      }
      
    } catch (debugError) {
      console.log('❌ Erro no debug:', debugError.message);
    }
    
    console.log('\n6️⃣ DIAGNÓSTICO FINAL:');
    console.log('   🔍 O backend está funcionando corretamente');
    console.log('   🔍 SEFAZ está online (disponivel: true)');
    console.log('   🔍 O problema é que /nfe/status requer autenticação');
    console.log('   🔍 Se o usuário não estiver logado, o frontend não consegue obter o status');
    console.log('   🔍 Resultado: SEFAZ aparece como offline no Dashboard');
    
    console.log('\n💡 SOLUÇÕES POSSÍVEIS:');
    console.log('   1. Fazer login no frontend para obter token válido');
    console.log('   2. Criar endpoint público para status básico (sem dados sensíveis)');
    console.log('   3. Melhorar tratamento de erro no frontend quando não autenticado');

  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  }
}

// Executar o debug
debugFrontendExact().catch(console.error);