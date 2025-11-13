const { SQLiteManager } = require("../config/sqlite");
const database = require("../config/database");

class Repository {
  constructor() {
    this.sqlite = new SQLiteManager();
    this.useSqlite = false;
  }
  async init() {
    this.useSqlite = await this.sqlite.init();
  }
  async getNFes() {
    if (this.useSqlite) {
      return await this.sqlite.all("SELECT * FROM nfes ORDER BY id ASC;");
    }
    return await database.buscarNFes();
  }
}

module.exports = new Repository();
