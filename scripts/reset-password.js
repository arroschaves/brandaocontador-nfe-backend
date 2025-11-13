const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");

async function resetPassword() {
  const usersPath = path.join(__dirname, "..", "data", "usuarios.json");
  const users = JSON.parse(fs.readFileSync(usersPath, "utf8"));

  const newPassword = "admin123";
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  users[0].senha = hashedPassword;
  users[0].email = "cjbrandao@brandaocontador.com.br";

  fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

  console.log("✅ Senha resetada com sucesso!");
  console.log("📧 Email: cjbrandao@brandaocontador.com.br");
  console.log("🔑 Senha: admin123");
}

resetPassword();
