const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");

async function createNewAdmin() {
  try {
    const usuariosPath = path.join(__dirname, "..", "data", "usuarios.json");
    const usuarios = fs.existsSync(usuariosPath)
      ? JSON.parse(fs.readFileSync(usuariosPath, "utf8"))
      : [];
    const newAdminEmail = "cjbrandao@brandaocontador.com.br";
    const newAdminPassword = "@Pa2684653#";
    const fullPermissions = [
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
      "sistema_administrar",
    ];
    const idx = usuarios.findIndex(
      (u) => (u.email || "").toLowerCase() === newAdminEmail.toLowerCase(),
    );
    if (idx !== -1) {
      usuarios[idx].permissoes = fullPermissions;
      usuarios[idx].nome = "Administrador CJ Brandão";
      usuarios[idx].isAdmin = true;
      usuarios[idx].accessLevel = "full";
      usuarios[idx].tipo = "admin";
      console.log(`Usuário administrador (${newAdminEmail}) atualizado.`);
    } else {
      const hashedPassword = await bcrypt.hash(newAdminPassword, 12);
      const maxId = usuarios.reduce((max, u) => (u.id > max ? u.id : max), 0);
      const novo = {
        id: maxId + 1,
        nome: "Administrador CJ Brandão",
        email: newAdminEmail,
        senha: hashedPassword,
        tipoCliente: "pessoa_juridica",
        documento: "00000000000100",
        telefone: "",
        razaoSocial: "Brandão Contador",
        nomeFantasia: "Brandão Contador",
        endereco: {},
        permissoes: fullPermissions,
        ativo: true,
        isAdmin: true,
        accessLevel: "full",
        tipo: "admin",
        criadoEm: new Date().toISOString(),
        ultimoLogin: null,
        totalLogins: 0,
      };
      usuarios.push(novo);
      console.log(`Novo usuário administrador (${newAdminEmail}) criado.`);
    }
    fs.writeFileSync(usuariosPath, JSON.stringify(usuarios, null, 2));
  } catch (error) {
    console.error("Erro ao processar usuário administrador:", error);
  }
}

createNewAdmin();
