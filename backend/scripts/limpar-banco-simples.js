const database = require('../config/database-simples');
const logService = require('../services/log-service');

async function limparBancoSimples() {
  try {
    console.log('🧹 Iniciando limpeza do banco de dados simples...');
    
    // Conectar ao banco
    await database.connect();
    
    console.log('📊 Verificando conexão...');
    const isConnected = database.isConnected();
    
    if (isConnected) {
      console.log('✅ Conexão estabelecida com sucesso!');
      
      // Mostrar estatísticas antes da limpeza
      const stats = await database.getEstatisticas();
      console.log('📈 Estatísticas antes da limpeza:');
      console.log(`   - Total de usuários: ${stats.totalUsuarios}`);
      console.log(`   - Total de NFes: ${stats.totalNfes}`);
      console.log(`   - Total de logs: ${stats.totalLogs}`);
      
      // Limpar banco de dados
      console.log('🗑️  Limpando dados...');
      await database.limparBanco();
      
      console.log('✅ Banco de dados limpo com sucesso!');
      console.log('');
      console.log('📋 Próximos passos:');
      console.log('1. Inicie o servidor com: npm start');
      console.log('2. Crie seu primeiro usuário em: POST /auth/register');
      console.log('   Exemplo de body:');
      console.log('   {');
      console.log('     "nome": "Seu Nome",');
      console.log('     "email": "seu@email.com",');
      console.log('     "senha": "sua-senha-123",');
      console.log('     "documento": "123.456.789-09",');
      console.log('     "tipoPessoa": "PF",');
      console.log('     "tipoCliente": "contador"');
      console.log('   }');
      console.log('3. Faça login em: POST /auth/login');
      console.log('4. Teste todos os menus e funcionalidades');
      console.log('');
      console.log('💡 Dica: Use o frontend para facilitar o cadastro e testes!');
    } else {
      console.log('❌ Falha na conexão com o banco de dados');
    }
    
  } catch (error) {
    console.error('❌ Erro durante a limpeza:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    // Desconectar
    await database.disconnect();
    console.log('🔌 Conexão encerrada.');
    process.exit(0);
  }
}

// Executar limpeza
limparBancoSimples().catch(error => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});