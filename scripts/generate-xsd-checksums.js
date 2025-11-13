const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function sha256(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function generate() {
  const base = path.join(process.cwd(), "xsd");
  const out = { producao: {}, homologacao: {} };
  for (const env of ["producao", "homologacao"]) {
    const dir = path.join(base, env);
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".xsd"));
    for (const f of files) out[env][f] = sha256(path.join(dir, f));
  }
  fs.writeFileSync(path.join(base, "checksums.json"), JSON.stringify(out, null, 2));
  console.log("Checksums atualizados");
}

generate();
