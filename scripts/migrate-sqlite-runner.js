const fs = require("fs");
const path = require("path");
const { SQLiteManager } = require("../config/sqlite");

async function applyMigrations() {
  const sqlite = new SQLiteManager();
  const ok = await sqlite.init();
  if (!ok) {
    console.log("SQLite desabilitado ou dependência ausente");
    return;
  }
  const dir = path.join(process.cwd(), "migrations");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  await sqlite.begin();
  try {
    for (const f of files) {
      const sql = fs.readFileSync(path.join(dir, f), "utf8");
      await sqlite.run(sql);
      const version = parseInt(f.split("_")[0]);
      await sqlite.run(
        "INSERT INTO schema_version(version, applied_at) VALUES(?, datetime('now'));",
        [version],
      );
      console.log("Aplicada migration:", f);
    }
    await sqlite.commit();
    console.log("Migrations aplicadas com sucesso");
  } catch (e) {
    await sqlite.rollback();
    console.error("Erro aplicando migrations:", e.message);
  }
}

applyMigrations();
