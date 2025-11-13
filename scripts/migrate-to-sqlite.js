const { SQLiteManager } = require("../config/sqlite");
const fs = require("fs");
const path = require("path");

async function migrate() {
  const sqlite = new SQLiteManager();
  const ok = await sqlite.init();
  if (!ok) {
    console.log("SQLite desabilitado ou dependência ausente");
    return;
  }
  await sqlite.begin();
  try {
    await sqlite.run("CREATE TABLE IF NOT EXISTS nfes (id INTEGER PRIMARY KEY, chave TEXT, status TEXT, valor_total REAL, data_emissao TEXT);");
    const nfesPath = path.join(process.cwd(), "data", "nfes.json");
    if (fs.existsSync(nfesPath)) {
      const lista = JSON.parse(fs.readFileSync(nfesPath, "utf8"));
      for (const n of lista || []) {
        await sqlite.run("INSERT INTO nfes(id, chave, status, valor_total, data_emissao) VALUES(?, ?, ?, ?, ?);", [n.id || null, n.chave_acesso || n.chave || null, n.status || null, n.valor_total || 0, n.data_emissao || null]);
      }
    }
    await sqlite.commit();
    console.log("Migração concluída");
  } catch (e) {
    await sqlite.rollback();
    console.error("Erro na migração:", e.message);
  }
}

migrate();
