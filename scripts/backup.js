const fs = require("fs");
const path = require("path");

function copyDir(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const e of entries) {
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

async function backup() {
  const base = process.cwd();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const out = path.join(base, "backups", stamp);
  if (!fs.existsSync(path.join(base, "backups"))) fs.mkdirSync(path.join(base, "backups"), { recursive: true });
  const dataDir = path.join(base, "data");
  if (fs.existsSync(dataDir)) copyDir(dataDir, path.join(out, "data"));
  const sqliteFile = process.env.SQLITE_FILE || path.join(base, "data", "app.db");
  if (fs.existsSync(sqliteFile)) fs.copyFileSync(sqliteFile, path.join(out, path.basename(sqliteFile)));
  console.log("Backup concluído:", out);
}

backup();
