const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function sha256(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function verify() {
  const base = path.join(process.cwd(), "xsd");
  const checksums = JSON.parse(fs.readFileSync(path.join(base, "checksums.json"), "utf8"));
  const envs = ["producao", "homologacao"];
  for (const env of envs) {
    const dir = path.join(base, env);
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir).filter(f => f.endsWith(".xsd"));
    for (const f of files) {
      const full = path.join(dir, f);
      const sum = sha256(full);
      const expected = checksums[env]?.[f];
      if (!expected) {
        console.log(`[WARN] Sem checksum registrado para ${env}/${f}: ${sum}`);
      } else if (expected !== sum) {
        console.log(`[FAIL] Checksum divergente para ${env}/${f}: esperado ${expected}, obtido ${sum}`);
      } else {
        console.log(`[OK] ${env}/${f}`);
      }
    }
  }
}

verify();
