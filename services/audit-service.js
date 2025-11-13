const fs = require("fs");
const path = require("path");
const { SQLiteManager } = require("../config/sqlite");

class AuditService {
  constructor() {
    this.sqlite = new SQLiteManager();
    this.initialized = false;
  }
  async init() {
    if (this.initialized) return;
    await this.sqlite.init();
    this.initialized = true;
  }
  async logChange(entidade, entidadeId, acao, before, after, meta = {}) {
    await this.init();
    const timestamp = new Date().toISOString();
    const detalhes = JSON.stringify({ before, after, meta });
    if (this.sqlite.enabled) {
      await this.sqlite.run(
        "INSERT INTO auditoria(entidade, entidade_id, acao, usuario_id, timestamp, detalhes) VALUES(?, ?, ?, ?, ?, ?);",
        [entidade, String(entidadeId || ""), acao, meta.usuarioId || null, timestamp, detalhes]
      );
    }
    const dir = path.join(process.cwd(), "audit_logs");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${timestamp.split("T")[0]}.log`);
    fs.appendFileSync(file, `${timestamp} ${entidade} ${acao} ${String(entidadeId || "")} ${detalhes}\n`);
  }
}

module.exports = new AuditService();
