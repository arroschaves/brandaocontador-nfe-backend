BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS schema_version (
  id INTEGER PRIMARY KEY,
  version INTEGER NOT NULL,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  senha TEXT NOT NULL,
  documento TEXT,
  tipoCliente TEXT,
  ativo INTEGER DEFAULT 1,
  status TEXT,
  criadoEm TEXT,
  ultimoLogin TEXT,
  totalLogins INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS clientes (
  id INTEGER PRIMARY KEY,
  nome TEXT NOT NULL,
  documento TEXT,
  tipoCliente TEXT,
  criadoEm TEXT
);

CREATE TABLE IF NOT EXISTS produtos (
  id INTEGER PRIMARY KEY,
  codigo TEXT,
  descricao TEXT,
  ncm TEXT,
  cfop TEXT,
  criadoEm TEXT
);

CREATE TABLE IF NOT EXISTS nfes (
  id INTEGER PRIMARY KEY,
  chave TEXT UNIQUE,
  numero INTEGER,
  serie INTEGER,
  status TEXT,
  valor_total REAL,
  data_emissao TEXT,
  criadaEm TEXT,
  usuario_id INTEGER,
  cliente_id INTEGER,
  FOREIGN KEY(usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
  FOREIGN KEY(cliente_id) REFERENCES clientes(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS logs (
  id INTEGER PRIMARY KEY,
  timestamp TEXT,
  dominio TEXT,
  nivel TEXT,
  mensagem TEXT,
  meta TEXT
);

CREATE TABLE IF NOT EXISTS configuracoes (
  id INTEGER PRIMARY KEY,
  secao TEXT UNIQUE,
  conteudo TEXT
);

COMMIT;
