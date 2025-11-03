const database = require('./config/database');
const bcrypt = require('bcrypt');

async function testarAuth() {
  try {
    console.log('🔍 Testando sistema de autenticação...');
    
    // Testar busca de usuário
    const email = 'admin@brandaocontador.com.br';
    console.log(`\n📧 Buscando usuário: ${email}`);
    
    const usuario = await database.buscarUsuarioPorEmail(email);
    
    if (!usuario) {
      console.log('❌ Usuário não encontrado');
      
      // Listar todos os usuários
      console.log('\n📋 Listando todos os usuários:');
      const usuarios = await database.lerArquivo('usuarios');
      usuarios.forEach((u, i) => {
        console.log(`${i + 1}. ID: ${u.id}, Email: ${u.email}, Nome: ${u.nome}, Ativo: ${u.ativo}`);
      });
      
      return;
    }
    
    console.log('✅ Usuário encontrado:');
    console.log(`   - ID: ${usuario.id}`);
    console.log(`   - Nome: ${usuario.nome}`);
    console.log(`   - Email: ${usuario.email}`);
    console.log(`   - Ativo: ${usuario.ativo}`);
    console.log(`   - Senha Hash: ${usuario.senha.substring(0, 20)}...`);
    
    // Testar senhas comuns
    const senhasParaTestar = ['admin123', '123456', 'admin', 'password'];
    
    console.log('\n🔐 Testando senhas:');
    for (const senha of senhasParaTestar) {
      const senhaValida = await bcrypt.compare(senha, usuario.senha);
      console.log(`   - "${senha}": ${senhaValida ? '✅ VÁLIDA' : '❌ Inválida'}`);
    }
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
  }
}

testarAuth();