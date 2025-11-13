#!/bin/bash

echo "🔄 Resetando senha do administrador no servidor..."

cd /root/brandaocontador-nfe

# Criar script Node.js temporário
cat > /tmp/reset-pwd.js << 'EOF'
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

async function resetPassword() {
    const usersPath = path.join(__dirname, '..', 'root', 'brandaocontador-nfe', 'data', 'users.json');
    const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
    
    const newPassword = 'admin123';
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    users[0].senha = hashedPassword;
    
    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
    
    console.log('✅ Senha resetada com sucesso!');
    console.log('📧 Email: cjbrandao@brandaocontador.com.br');
    console.log('🔑 Senha: admin123');
}

resetPassword();
EOF

# Executar o script
node /tmp/reset-pwd.js

# Limpar
rm /tmp/reset-pwd.js

echo "✅ Concluído!"
