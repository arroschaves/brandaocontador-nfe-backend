const bcrypt = require('bcrypt');
const fs = require('fs');

// Verificar se existe arquivo de usuários
if (fs.existsSync('./backend/data/usuarios.json')) {
  const usuarios = JSON.parse(fs.readFileSync('./backend/data/usuarios.json', 'utf8'));
  console.log('📋 Usuários encontrados:');
  usuarios.forEach(user => {
    console.log(`- Email: ${user.email}`);
    console.log(`- Senha hash: ${user.senha.substring(0, 20)}...`);
  });
  
  // Testar senha
  const adminUser = usuarios.find(u => u.email === 'admin@brandaocontador.com.br');
  if (adminUser) {
    const senhaCorreta1 = bcrypt.compareSync('adminpassword', adminUser.senha);
    const senhaCorreta2 = bcrypt.compareSync('admin123', adminUser.senha);
    const senhaCorreta3 = bcrypt.compareSync('123456', adminUser.senha);
    console.log(`\n🔐 Teste de senhas para admin@brandaocontador.com.br:`);
    console.log(`- 'adminpassword': ${senhaCorreta1}`);
    console.log(`- 'admin123': ${senhaCorreta2}`);
    console.log(`- '123456': ${senhaCorreta3}`);
  }
} else {
  console.log('❌ Arquivo usuarios