const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const userSchema = new mongoose.Schema({
  nome: String,
  email: String,
  senha: String,
  tipo: String,
  ativo: { type: Boolean, default: true },
  dataCriacao: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

async function createAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/brandaocontador_nfe');
    console.log('Conectado ao MongoDB');
    
    // Verificar se admin já existe
    const existingAdmin = await User.findOne({ email: 'admin@brandaocontador.com.br' });
    
    if (existingAdmin) {
      console.log('Usuário admin já existe');
      console.log('Email:', existingAdmin.email);
      console.log('Tipo:', existingAdmin.tipo);
      console.log('Ativo:', existingAdmin.ativo);
    } else {
      // Criar usuário admin
      const hashedPassword = await bcrypt.hash('admin:123', 10);
      
      const admin = new User({
        nome: 'Administrador',
        email: 'admin@brandaocontador.com.br',
        senha: hashedPassword,
        tipo: 'admin',
        ativo: true
      });
      
      await admin.save();
      console.log('Usuário admin criado com sucesso!');
      console.log('Email: admin@brandaocontador.com.br');
      console.log('Senha: admin:123');
    }
    
    // Listar todos os usuários
    const users = await User.find({});
    console.log('\nTodos os usuários:');
    users.forEach(user => {
      console.log(`- ${user.nome} (${user.email}) - ${user.tipo} - Ativo: ${user.ativo}`);
    });
    
  } catch (error) {
    console.error('Erro:', error.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

createAdmin();