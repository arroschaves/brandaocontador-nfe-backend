const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

async function createNewAdmin() {
    try {
        const usuariosPath = path.join(__dirname, '..', 'data', 'usuarios.json');
        const usuarios = JSON.parse(fs.readFileSync(usuariosPath, 'utf8'));

        const newAdminEmail = 'cjbrandao@brandaocontador.com.br';

        // Verificar se o usuário já existe
        const userExists = usuarios.find(u => u.email.toLowerCase() === newAdminEmail.toLowerCase());
        if (userExists) {
            console.log(`❌ O usuário administrador com o email ${newAdminEmail} já existe.`);
            return;
        }

        // Criptografar a senha
        const senha = '@Pa2684653#';
        const hashedPassword = await bcrypt.hash(senha, 12);

        // Encontrar o maior ID para criar um novo
        const maxId = usuarios.reduce((max, u) => (u.id > max ? u.id : max), 0);

        const newAdmin = {
            "id": maxId + 1,
            "nome": "Administrador CJ Brandão",
            "email": newAdminEmail,
            "senha": hashedPassword,
            "tipoCliente": "pessoa_juridica",
            "documento": "00000000000100",
            "telefone": "",
            "razaoSocial": "Brandão Contador",
            "nomeFantasia": "Brandão Contador",
            "endereco": {},
            "permissoes": [
                "all",
                "admin",
                "admin_total"
            ],
            "ativo": true,
            "isAdmin": true,
            "accessLevel": "full",
            "tipo": "admin",
            "criadoEm": new Date().toISOString(),
            "ultimoLogin": null,
            "totalLogins": 0
        };

        usuarios.push(newAdmin);
        fs.writeFileSync(usuariosPath, JSON.stringify(usuarios, null, 2));

        console.log(`✅ Novo usuário administrador (${newAdminEmail}) criado com sucesso!`);

    } catch (error) {
        console.error('❌ Erro ao criar o novo usuário administrador:', error);
    }
}

createNewAdmin();
