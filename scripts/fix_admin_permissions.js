const fs = require("fs");
const path = require("path");

async function fixAdminPermissions() {
  try {
    const usuariosPath = path.join(__dirname, "..", "data", "usuarios.json");
    const usuarios = JSON.parse(fs.readFileSync(usuariosPath, "utf8"));

    const adminEmail = "bcrandaocontador@gmail.com";
    const adminUser = usuarios.find((u) => u.email === adminEmail);

    if (adminUser) {
      adminUser.tipo = "admin";
      fs.writeFileSync(usuariosPath, JSON.stringify(usuarios, null, 2));
      console.log(
        `✅ Permissões do administrador (${adminEmail}) corrigidas com sucesso!`,
      );
    } else {
      console.log(
        `❌ Usuário administrador com email (${adminEmail}) não encontrado.`,
      );
    }
  } catch (error) {
    console.error("❌ Erro ao corrigir as permissões do administrador:", error);
  }
}

fixAdminPermissions();
