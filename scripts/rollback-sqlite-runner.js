const fs = require("fs");
const path = require("path");
const { SQLiteManager } = require("../config/sqlite");

async function rollback(version) {
  const sqlite = new SQLiteManager();
  const ok = await sqlite.init();
  if (!ok) {
    console.log("SQLite desabilitado ou dependência ausente");
    return;
  }
  const file = path.join(process.cwd(), "rollback", `${version}.sql`);
  if (!fs.existsSync(file)) {
    console.error("Arquivo de rollback não encontrado:", file);
    process.exit(1);
  }
  const sql = fs.readFileSync(file, "utf8");
  await sqlite.begin();
  try {
    await sqlite.run(sql);
    await sqlite.run("DELETE FROM schema_version WHERE version = ?;", [parseInt(version)]);
    await sqlite.commit();
    console.log("Rollback aplicado:", version);
  } catch (e) {
    await sqlite.rollback();
    console.error("Erro aplicando rollback:", e.message);
    process.exit(2);
  }
}

const versionArg = process.argv[2];
if (!versionArg) {
  console.error("Uso: node scripts/rollback-sqlite-runner.js <versao>");
  process.exit(1);
}
rollback(versionArg);
