let sqlite3;
try {
  sqlite3 = require("sqlite3").verbose();
} catch {}

class SQLiteManager {
  constructor(filePath) {
    this.filePath = filePath || process.env.SQLITE_FILE || "data/app.db";
    this.enabled = process.env.USE_SQLITE === "true" && !!sqlite3;
    this.db = null;
  }
  async init() {
    if (!this.enabled) return false;
    this.db = new sqlite3.Database(this.filePath);
    await this.run("PRAGMA journal_mode=WAL;");
    await this.run("PRAGMA foreign_keys=ON;");
    return true;
  }
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      if (!this.db) return resolve(false);
      this.db.run(sql, params, function (err) {
        if (err) return reject(err);
        resolve(this);
      });
    });
  }
  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      if (!this.db) return resolve([]);
      this.db.all(sql, params, function (err, rows) {
        if (err) return reject(err);
        resolve(rows || []);
      });
    });
  }
  async begin() { await this.run("BEGIN TRANSACTION;"); }
  async commit() { await this.run("COMMIT;"); }
  async rollback() { await this.run("ROLLBACK;"); }
}

module.exports = { SQLiteManager };
