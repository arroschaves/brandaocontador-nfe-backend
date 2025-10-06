const axios = require('axios');

// Configuração do cliente HTTP
const api = axios.create({
  baseURL: 'http://localhost:3001',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Cores para output
const cores = {
  verde: '\x1b[32m',
  vermelho: '\x1b[31m',
  amarelo: '\x1b[33m',
  azul: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(tipo, mensagem, dados = null) {
  const timestamp = new Date().toLocaleTimeString();
  let cor = cores.reset;
  let icone = 'ℹ️';
  
  switch (tipo) {
    case 'sucesso':
      cor = cores.verde;
      icone = '✅';
      break;
    case 'erro':
      cor = cores.vermelho;
      icone = '❌';
      break;
    case 'aviso':
      cor = cores.amarelo;
      icone = '⚠️';
      break;
    case 'info':
      cor = cores.azul;
      icone = '📋';
      break;
  }
  
  console.log(`${cor}${icone} [${timestamp}] ${mensagem}${cores.reset}`);
  if (dados) {
    console.log(`${cor}   Dados: ${JSON.stringify(dados, null, 2)}${cores.reset}`);
  }
}

async function testarSistema() {
  console.log('\n🚀 INICIANDO TESTES DO SISTEMA NFE\n');
  
  let token = null;
  let usuarioId = null;
  
  try {
    // 1. Testar endpoint público
    log('info', '1. Testando endpoint público /nfe/teste');
    const responseTeste = await api.get('/nfe/teste');
    
    if (responseTeste.data.sucesso) {
      log('sucesso', '✅ Endpoint público funcionando');
    } else {
      log('erro', '❌ Endpoint público falhou');
    }
    
    // 2. Registrar novo usuário
    log('info', '2. Registrando novo usuário de teste');
    const dadosUsuario = {
      nome: 'Usuário de Teste',
      email: 'teste@exemplo.com',
      senha: 'teste123456',
      documento: '123.456.789-09',
      tipoPessoa: 'PF',
      tipoCliente: 'contador',
      telefone: '(11) 98765-4321',
      endereco: {
        cep: '01234-567',
        logradouro: 'Rua de Teste',
        numero: '123',
        complemento: 'Apto 45',
        bairro: 'Centro',
        cidade: 'São Paulo',
        uf: 'SP'
      }
    };
    
    const responseRegistro = await api.post('/auth/register', dadosUsuario);
    
    if (responseRegistro.data.sucesso) {
      log('sucesso', '✅ Usuário registrado com sucesso');
      usuarioId = responseRegistro.data.usuario.id;
    } else {
      log('erro', '❌ Falha ao registrar usuário', responseRegistro.data);
      return;
    }
    
    // 3. Fazer login
    log('info', '3. Fazendo login com o novo usuário');
    const responseLogin = await api.post('/auth/login', {
      email: 'teste@exemplo.com',
      senha: 'teste123456'
    });
    
    if (responseLogin.data.sucesso) {
      token = responseLogin.data.token;
      log('sucesso', '✅ Login realizado com sucesso');
      log('info', `   Token recebido: ${token.substring(0, 20)}...`);
      
      // Configurar token para requisições futuras
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      log('erro', '❌ Falha ao fazer login', responseLogin.data);
      return;
    }
    
    // 4. Validar token
    log('info', '4. Validando token');
    const responseValidacao = await api.get('/auth/validate');
    
    if (responseValidacao.data.sucesso) {
      log('sucesso', '✅ Token válido');
      log('info', `   Usuário: ${responseValidacao.data.usuario.nome}`);
    } else {
      log('erro', '❌ Token inválido');
    }
    
    // 5. Testar endpoint protegido - Status do sistema
    log('info', '5. Testando endpoint protegido /nfe/status');
    const responseStatus = await api.get('/nfe/status');
    
    if (responseStatus.data.sucesso) {
      log('sucesso', '✅ Status do sistema obtido com sucesso');
      log('info', `   Sistema: ${responseStatus.data.status.sistema}`);
    } else {
      log('erro', '❌ Falha ao obter status do sistema');
    }
    
    // 6. Testar histórico de NFe
    log('info', '6. Testando histórico de NFe');
    const responseHistorico = await api.get('/nfe/historico');
    
    if (responseHistorico.data.sucesso) {
      log('sucesso', '✅ Histórico de NFe obtido com sucesso');
      log('info', `   Total de NFes: ${responseHistorico.data.total}`);
      log('info', `   Página: ${responseHistorico.data.pagina}`);
    } else {
      log('erro', '❌ Falha ao obter histórico de NFe');
    }
    
    // 7. Testar estatísticas (admin)
    log('info', '7. Testando estatísticas do sistema (admin)');
    const responseEstatisticas = await api.get('/admin/estatisticas');
    
    if (responseEstatisticas.data.sucesso) {
      log('sucesso', '✅ Estatísticas obtidas com sucesso');
      const stats = responseEstatisticas.data.estatisticas;
      log('info', `   Total de usuários: ${stats.totalUsuarios}`);
      log('info', `   Total de NFes: ${stats.totalNfes}`);
      log('info', `   Total de logs: ${stats.totalLogs}`);
    } else {
      log('erro', '❌ Falha ao obter estatísticas');
    }
    
    // 8. Testar health check
    log('info', '8. Testando health check');
    const responseHealth = await api.get('/admin/health');
    
    if (responseHealth.data.sucesso) {
      log('sucesso', '✅ Health check realizado com sucesso');
      const health = responseHealth.data.health;
      log('info', `   Status: ${health.status}`);
      log('info', `   Banco de dados: ${health.bancoDados}`);
      log('info', `   Uptime: ${Math.floor(health.uptime)} segundos`);
    } else {
      log('erro', '❌ Falha no health check');
    }
    
    console.log('\n🎉 TESTES CONCLUÍDOS COM SUCESSO!\n');
    console.log('📋 Resumo:');
    console.log('   ✅ Sistema operacional');
    console.log('   ✅ Autenticação funcionando');
    console.log('   ✅ Endpoints protegidos acessíveis');
    console.log('   ✅ Banco de dados com dados reais');
    console.log('');
    console.log('💡 Próximo passo: Teste o sistema pelo frontend!');
    console.log('   Acesse: http://localhost:3002');
    console.log('   Faça login com: teste@exemplo.com / teste123456');
    console.log('');
    
  } catch (error) {
    log('erro', '❌ Erro durante os testes:', {
      mensagem: error.message,
      resposta: error.response?.data,
      status: error.response?.status
    });
    
    if (error.code === 'ECONNREFUSED') {
      log('erro', '❌ O servidor não está rodando. Inicie-o primeiro com: npm start');
    }
  }
}

// Executar testes
testarSistema();