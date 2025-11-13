let validator = null;
try {
  validator = require("xsd-schema-validator");
} catch {}

async function validate(xmlString, xsdPath) {
  if (!validator || !xsdPath) return { valid: true, errors: [] };
  return new Promise((resolve) => {
    validator.validateXML(xmlString, xsdPath, function (err, result) {
      if (err) return resolve({ valid: false, errors: [err.message] });
      resolve({ valid: !!result.valid, errors: [] });
    });
  });
}

function xsdForOperation(op, ambiente) {
  const baseDir = process.env.XSD_DIR || "xsd";
  const amb = ambiente === 1 ? "producao" : "homologacao";
  const map = {
    autorizacao: `${baseDir}/${amb}/enviNFe_v4.00.xsd`,
    consulta: `${baseDir}/${amb}/consSitNFe_v4.00.xsd`,
    cancelamento: `${baseDir}/${amb}/eventoCancNFe_v1.00.xsd`,
    inutilizacao: `${baseDir}/${amb}/inutNFe_v4.00.xsd`,
    dfe: `${baseDir}/${amb}/distDFe_v1.01.xsd`,
  };
  return map[op];
}

function fallbackXsd(op, ambiente) {
  try {
    const baseDir = process.env.XSD_DIR || "xsd";
    const amb = ambiente === 1 ? "producao" : "homologacao";
    const versions = require("../xsd/versions.json")[op] || [];
    for (const v of versions) {
      const p = `${baseDir}/${amb}/${v}`;
      if (require("fs").existsSync(p)) return p;
    }
  } catch {}
  return null;
}

function verifyChecksum(filePath) {
  try {
    const baseDir = process.env.XSD_DIR || "xsd";
    const env = filePath.includes("/producao/") ? "producao" : filePath.includes("/homologacao/") ? "homologacao" : null;
    const fname = require("path").basename(filePath);
    const checks = require("../xsd/checksums.json");
    const expected = env ? checks[env]?.[fname] : null;
    if (!expected) return { ok: false, reason: "missing" };
    const sum = require("crypto").createHash("sha256").update(require("fs").readFileSync(filePath)).digest("hex");
    return { ok: sum === expected, reason: sum };
  } catch { return { ok: false, reason: "error" }; }
}

module.exports = { validate, xsdForOperation, fallbackXsd, verifyChecksum };
