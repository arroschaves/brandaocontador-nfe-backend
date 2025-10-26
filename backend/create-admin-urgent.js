const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

async function createAdminUrgent() {
  try {
    console.log('🔐 Gerando hash da senha...');
    const senhaHash = await bcrypt.hash('admin123', 10);
    
    const admin = {
      id: 1,
      nome: 'Administrador',
      email: 'admin@brandaocontador.com.br',
      senha: senhaHash,
      tipoCliente: 'cnpj',
      documento: '12345678000199',
      telefone: '(11) 4000-0000',
      razaoSocial: 'Brandão Contador LTDA',
      nomeFantasia: 'Brandão Contador',
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
      ativo: true,
      dataCriacao: new Date().toISOString(),
      dataAtualizacao: new Date().toISOString()
    };
    
    const usuariosPath = path.join(__dirname, 'data', 'usuarios.json');
    
    console.log('💾 Salvando usuário admin...');
    fs.writeFileSync(usuariosPath, JSON.stringify([admin], null, 2));
    
    console.log('✅ USUÁRIO ADMIN CRIADO COM SUCESSO!');
    console.log('📧 Email: admin@brandaocontador.com.br');
    console.log('🔑 Senha: admin123');
    console.log('🎯 Permissões: admin, admin_total, nfe_emitir, nfe_consultar');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

createAdminUrgent();