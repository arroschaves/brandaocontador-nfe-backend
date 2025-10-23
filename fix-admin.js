const mongoose = require('mongoose');
require('dotenv').config();

const usuarioSchema = new mongoose.Schema({
  nome: String,
  email: String,
  senha: String,
  tipoCliente: String,
  documento: String,
  telefone: String,
  permissoes: [String],
  ativo: { type: Boolean, default: true },
  dataCadastro: { type: Date, default: Date.now }
});

const User = mongoose.model('User', usuarioSchema);

async function fixAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/brandaocontador_nfe');
    console.log('Conectado ao MongoDB');
    
    // Remover usuário admin existente
    await User.deleteOne({ email: 'admin@brandaocontador.com.br' });
    console.log('Usuário admin removido');
    
    // Criar usuário admin com senha em texto plano (o modelo fará o hash)
    const admin = new User({
      nome: 'Administrador',
      email: 'admin@brandaocontador.com.br',
      senha: 'admin:123', // Senha em texto plano
      tipoCliente: 'cnpj',
      documento: '12345678000199',
      telefone: '(11) 4000-0000',
      permissoes: ['admin', 'nfe_emitir', 'nfe_consultar'],
      ativo: true
    });
    
    await admin.save();
    console.log('Usuário admin criado com sucesso!');
    console.log('Email: admin@brandaocontador.com.br');
    console.log('Senha: admin:123');
    
    // Listar todos os usuários
    const users = await User.find({});
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

fixAdmin();