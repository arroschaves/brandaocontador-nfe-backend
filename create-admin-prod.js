const mongoose = require('mongoose');
const Usuario = require('./models/Usuario');
require('dotenv').config();

async function createAdmin() {
  try {
    console.log('Conectando ao MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado ao MongoDB');
    
    const email = 'admin@brandaocontador.com.br';
    const senha = 'BrandaoNFe2024!';
    
    // Verificar se já existe
    const existing = await Usuario.findOne({ email });
    if (existing) {
      console.log('⚠️ Admin já existe, atualizando senha...');
      existing.senha = senha;
      await existing.save();
      console.log('✅ Senha atualizada');
    } else {
      console.log('Criando novo usuário admin...');
      const admin = await Usuario.create({
        nome: 'Brandão Contador',
        email: email,
        senha: senha,
        tipoCliente: 'cnpj',
        documento: '45669746000120',
        telefone: '(11) 4000-0000',
        razaoSocial: 'Brandão Contador LTDA',
        nomeFantasia: 'MAP LTDA',
        endereco: {
          cep: '01001-000',
          logradouro: 'Rua Exemplo',
          numero: '100',
          complemento: '',
          bairro: 'Centro',
          cidade: 'São Paulo',
          uf: 'SP'
        },
        permissoes: ['admin', 'admin_total', 'nfe_emitir', 'nfe_consultar'],
        ativo: true
      });
      console.log('✅ Admin criado:', admin.email);
    }
    
    console.log('✅ Processo concluído com sucesso!');
    process.exit(0);
  } catch (e) {
    console.error('❌ Erro:', e.message);
    process.exit(1);
  }
}

createAdmin();