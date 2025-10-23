const mongoose = require('mongoose');
const Usuario = require('./backend/models/Usuario');
require('dotenv').config({ path: './backend/.env' });

async function createAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, { 
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000 
    });
    console.log('Conectado');
    
    // Verificar se já existe
    const existing = await Usuario.findOne({ email: 'admin@brandaocontador.com.br' });
    if (existing) {
      console.log('Admin já existe, atualizando senha...');
      existing.senha = 'admin:123';
      await existing.save();
      console.log('Senha atualizada');
    } else {
      const admin = await Usuario.create({
        nome: 'Administrador',
        email: 'admin@brandaocontador.com.br',
        senha: 'admin:123',
        tipoCliente: 'cnpj',
        documento: '12345678000199',
        telefone: '(11) 4000-0000',
        permissoes: ['admin'],
        ativo: true
      });
      console.log('Admin criado:', admin.email);
    }
    
    process.exit(0);
  } catch (e) {
    console.error('Erro:', e.message);
    process.exit(1);
  }
}
createAdmin();