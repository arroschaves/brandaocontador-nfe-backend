const { SQLiteManager } = require("../config/sqlite");
const fs = require("fs");
const path = require("path");

async function main() {
  const sqlite = new SQLiteManager();
  const ok = await sqlite.init();
  let rows = [];
  if (ok) {
    rows = await sqlite.all("SELECT entidade, entidade_id, acao, usuario_id, timestamp, detalhes FROM auditoria ORDER BY timestamp DESC LIMIT 1000;");
  }
  const reportDir = path.join(process.cwd(), "reports");
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(path.join(reportDir, "audit-report.json"), JSON.stringify(rows, null, 2));
  console.log("Relatório de auditoria gerado");
}

main();
