const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

async function createCorrectAdmin() {
    try {
        console.log('🔧 Criando usuário administrador correto...');
        
        // Gerar hash da senha
        const senha = '@Pa2684653#';
        const hash = await bcrypt.hash(senha, 12);
        console.log('✅ Hash da senha gerado');
        
        // Definir o caminho do arquivo
        const usuariosPath = path.join(__dirname, 'data', 'usuarios.json');
        
        // Ler arquivo de usuários
        let usuarios = [];
        if (fs.existsSync(usuariosPath)) {
            usuarios = JSON.parse(fs.readFileSync(usuariosPath, 'utf8'));
        }
        
        // Verificar se o usuário já existe
        const existingUserIndex = usuarios.findIndex(u => u.email === 'cjbrandao@brandaocontador.com.br');
        
        // Criar/atualizar usuário administrador
        const adminUser = {
            "id": existingUserIndex >= 0 ? usuarios[existingUserIndex].id : (usuarios.length > 0 ? Math.max(...usuarios.map(u => u.id)) + 1 : 1),
            "nome": "Carlos José Brandão",
            "email": "cjbrandao@brandaocontador.com.br",
            "senha": hash,
            "perfil": "admin",
            "tipo": "admin",
            "tipoCliente": "cnpj",
            "documento": "45669746000120",
            "telefone": "(11) 99999-9999",
            "razaoSocial": "Brandão Contador LTDA",
            "nomeFantasia": "Brandão Contador",
            "endereco": {
                "cep": "01000-000",
                "logradouro": "Rua Principal",
                "numero": "100",
                "complemento": "",
                "bairro": "Centro",
                "cidade": "São Paulo",
                "uf": "SP"
            },
            "permissoes": [
                "all",
                "admin",
                "admin_total",
                "nfe_emitir",
                "nfe_consultar",
                "nfe_inutilizar",
                "nfe_cancelar",
                "cte_emitir",
                "cte_consultar",
                "mdfe_emitir",
                "mdfe_consultar",
                "eventos_gerenciar",
                "relatorios_visualizar",
                "relatorios_acessar",
                "admin_configurar",
                "admin_auditoria",
                "admin_interface",
                "configuracoes_ver",
                "configuracoes_gerenciar",
                "configuracoes_avancadas",
                "seguranca_auditoria",
                "interface_temas",
                "usuarios_gerenciar",
                "clientes_gerenciar",
                "produtos_gerenciar",
                "dashboard_acessar",
                "emitente_configurar",
                "sistema_administrar"
            ],
            "ativo": true,
            "isAdmin": true,
            "accessLevel": "full",
            "criadoEm": new Date().toISOString(),
            "dataAtualizacao": new Date().toISOString(),
            "ultimoLogin": null,
            "totalLogins": 0
        };

        if (existingUserIndex >= 0) {
            usuarios[existingUserIndex] = adminUser;
            console.log('✅ Usuário existente atualizado');
        } else {
            usuarios.push(adminUser);
            console.log('✅ Novo usuário criado');
        }

        // Salvar arquivo
        fs.writeFileSync(usuariosPath, JSON.stringify(usuarios, null, 2));
        console.log('✅ Arquivo usuarios.json atualizado');
        console.log(`📧 Email: ${adminUser.email}`);
        console.log(`🔑 Senha: ${senha}`);
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
        process.exit(1);
    }
}

createCorrectAdmin();