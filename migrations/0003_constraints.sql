BEGIN TRANSACTION;

PRAGMA foreign_keys=ON;

-- Exemplo de restrições adicionais (checks)
-- Status da NFe limitado a valores conhecidos
-- Nota: SQLite não aplica enum; usamos CHECK
CREATE TABLE IF NOT EXISTS nfes_tmp (
  id INTEGER PRIMARY KEY,
  chave TEXT UNIQUE,
  numero INTEGER,
  serie INTEGER,
  status TEXT CHECK(status IN ('autorizada','rejeitada','cancelada','pendente','processando','denegada')),
  valor_total REAL,
  data_emissao TEXT,
  criadaEm TEXT,
  usuario_id INTEGER,
  cliente_id INTEGER,
  FOREIGN KEY(usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
  FOREIGN KEY(cliente_id) REFERENCES clientes(id) ON DELETE SET NULL
);

INSERT INTO nfes_tmp SELECT id,chave,numero,serie,status,valor_total,data_emissao,criadaEm,usuario_id,cliente_id FROM nfes;
DROP TABLE nfes;
ALTER TABLE nfes_tmp RENAME TO nfes;

COMMIT;
