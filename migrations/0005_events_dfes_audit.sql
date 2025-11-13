BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS eventos (
  id INTEGER PRIMARY KEY,
  tipo TEXT NOT NULL,
  chave TEXT NOT NULL,
  protocolo TEXT,
  status TEXT,
  payload_xml TEXT,
  created_at TEXT NOT NULL,
  usuario_id INTEGER,
  FOREIGN KEY(usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_eventos_chave ON eventos(chave);
CREATE INDEX IF NOT EXISTS idx_eventos_tipo ON eventos(tipo);

CREATE TABLE IF NOT EXISTS dfe_docs (
  id INTEGER PRIMARY KEY,
  chave TEXT,
  nsu TEXT,
  versao TEXT,
  xml TEXT,
  source TEXT,
  hash TEXT,
  fetched_at TEXT,
  UNIQUE(chave, nsu)
);

CREATE INDEX IF NOT EXISTS idx_dfe_nsu ON dfe_docs(nsu);
CREATE INDEX IF NOT EXISTS idx_dfe_chave ON dfe_docs(chave);

CREATE TABLE IF NOT EXISTS auditoria (
  id INTEGER PRIMARY KEY,
  entidade TEXT NOT NULL,
  entidade_id TEXT,
  acao TEXT NOT NULL,
  usuario_id INTEGER,
  timestamp TEXT NOT NULL,
  detalhes TEXT
);

CREATE INDEX IF NOT EXISTS idx_aud_entidade ON auditoria(entidade);
CREATE INDEX IF NOT EXISTS idx_aud_acao ON auditoria(acao);

COMMIT;
