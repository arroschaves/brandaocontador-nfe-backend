const bcrypt = require('bcrypt');
const fs = require('fs');

async function addAdmin() {
    try {
        // Gerar hash da senha
        const senha = '@Pa2684653#';
        const hash = await bcrypt.hash(senha, 12);
        
        // Ler arquivo de usuários
        const usuarios = JSON.parse(fs.readFileSync('data/usuarios.json', 'utf8'));
        
        // Criar novo usuário administrador
        const novoAdmin = {
            "id": 5,
            "nome": "Brandão Contador",
            "email": "bcrandaocontador@gmail.com",
            "senha": hash,
            "tipoCliente": "pessoa_juridica",
            "documento": "12345678000199",
            "telefone": "",
            "razaoSocial": "Brandão Contador LTDA",
            "nomeFantasia": "Brandão Contador",
            "endereco": {
                "logradouro": "",
                "numero": "",
                "complemento": "",
                "bairro": "",
                "cidade": "",
                "uf": "",
                "cep": ""
            },
            "permissoes": [
                "all",
                "admin",
                "admin_total",
                "nfe_emitir",
                "nfe_consultar",
                "nfe_cancelar",
                "cte_emitir",
                "cte_consultar",
                "mdfe_emitir",
                "mdfe_consultar",
                "clientes_gerenciar",
                "produtos_gerenciar",
                "relatorios_acessar",
                "configuracoes_gerenciar",
                "usuarios_gerenciar",
                "dashboard_acessar",
                "emitente_configurar",
                "sistema_administrar"
            ],
            "ativo": true,
            "isAdmin": true,
            "tipo": "admin",
            "accessLevel": "full",
            "criadoEm": new Date().toISOString(),
            "dataAtualizacao": new Date().toISOString(),
            "ultimoLogin": null,
            "totalLogins": 0
        };
        
        // Adicionar novo usuário
        usuarios.push(novoAdmin);
        
        // Salvar arquivo
        fs.writeFileSync('data/usuarios.json', JSON.stringify(usuarios, null, 2));
        
        console.log('✅ Usuário administrador criado com sucesso!');
        console.log('Email:', novoAdmin.email);
        console.log('Hash da senha:', hash);
        
    } catch (error) {
        console.error('❌ Erro ao criar usuário:', error);
    }
}

addAdmin();
