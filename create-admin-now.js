const fs = require('fs');
const bcrypt = require('bcrypt');
const path = require('path');

async function createAdmin() {
  try {
    const senha = 'Admin@2025';
    const hash = await bcrypt.hash(senha, 12);
    
    const admin = {
      id: 1,
      nome: "Administrador Sistema",
      email: "admin@brandaocontador.com.br",
      senha: hash,
      perfil: "admin",
      tipoCliente: "cnpj",
      documento: "00000000000191",
      telefone: "(11) 99999-9999",
      razaoSocial: "Brandão Contador LTDA",
      nomeFantasia: "Brandão Contador",
      endereco: {
        cep: "01310-100",
        logradouro: "Avenida Paulista",
        numero: "1000",
        complemento: "Sala 100",
        bairro: "Bela Vista",
        cidade: "São Paulo",
        uf: "SP"
      },
      permissoes: [
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
      ativo: true,
      isAdmin: true,
      accessLevel: "full",
      criadoEm: new Date().toISOString(),
      dataAtualizacao: new Date().toISOString(),
      ultimoLogin: null,
      totalLogins: 0
    };

    const usuariosPath = path.join(__dirname, 'data', 'usuarios.json');
    fs.writeFileSync(usuariosPath, JSON.stringify([admin], null, 2));
    
    console.log('✅ Usuário administrador criado com sucesso!');
    console.log('📧 Email: admin@brandaocontador.com.br');
    console.log('🔑 Senha: Admin@2025');
    console.log('');
    console.log('⚠️  IMPORTANTE: Altere a senha após o primeiro login!');
  } catch (error) {
    console.error('❌ Erro ao criar administrador:', error);
    process.exit(1);
  }
}

createAdmin();
