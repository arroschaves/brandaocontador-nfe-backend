const mongoose = require('mongoose');
require('dotenv').config();

// Importar o modelo Usuario real
const Usuario = require('./backend/models/Usuario');

async function createAdminReal() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/brandaocontador_nfe');
    console.log('Conectado ao MongoDB');
    
    // Remover usuário admin existente
    await Usuario.deleteOne({ email: 'admin@brandaocontador.com.br' });
    console.log('Usuário admin removido');
    
    // Criar usuário admin usando o modelo real (que fará o hash automaticamente)
    const admin = new Usuario({
      nome: 'Administrador',
      email: 'admin@brandaocontador.com.br',
      senha: 'admin:123', // Senha em texto plano - o modelo fará o hash
      tipoCliente: 'cnpj',
      documento: '12345678000199',
      telefone: '(11) 4000-0000',
      permissoes: ['admin', 'nfe_emitir', 'nfe_consultar'],
      ativo: true
    });
    
    await admin.save();
    console.log('Usuário admin criado com sucesso usando modelo real!');
    console.log('Email: admin@brandaocontador.com.br');
    console.log('Senha: admin:123');
    
    // Testar comparação de senha
    const senhaCorreta = await admin.compararSenha('admin:123');
    console.log('Teste de senha:', senhaCorreta ? 'OK' : 'FALHOU');
    
    // Listar todos os usuários
    const users = await Usuario.find({});
    console.log('\nTodos os usuários:');
    users.forEach(user => {
      console.log(`- ${user.nome} (${user.email}) - Ativo: ${user.ativo}`);
    });
    
  } catch (error) {
    console.error('Erro:', error.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

createAdminReal()