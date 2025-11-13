const database = require("../config/database");
const fs = require("fs");
const path = require("path");

async function run() {
  await database.conectar().catch(() => {});
  const u = await database.criarUsuario({ nome: "Teste", email: `teste_${Date.now()}@exemplo.com`, senha: "x" });
  await database.atualizarUsuario(u.id, { nome: "Teste Alterado" });
  const logDir = path.join(process.cwd(), "audit_logs");
  const today = new Date().toISOString().split("T")[0];
  const file = path.join(logDir, `${today}.log`);
  const ok = fs.existsSync(file);
  const reportDir = path.join(process.cwd(), "reports");
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(path.join(reportDir, "audit.json"), JSON.stringify({ success: ok }, null, 2));
  console.log("Audit test:", ok ? "OK" : "FAIL");
}

run();
