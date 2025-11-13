BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS usuarios_tmp (
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
INSERT INTO usuarios_tmp SELECT id,nome,email,senha,documento,tipoCliente,ativo,status,criadoEm,ultimoLogin,totalLogins FROM usuarios;
DROP TABLE usuarios;
ALTER TABLE usuarios_tmp RENAME TO usuarios;

CREATE TABLE IF NOT EXISTS clientes_tmp (
  id INTEGER PRIMARY KEY,
  nome TEXT NOT NULL,
  documento TEXT,
  tipoCliente TEXT,
  criadoEm TEXT
);
INSERT INTO clientes_tmp SELECT id,nome,documento,tipoCliente,criadoEm FROM clientes;
DROP TABLE clientes;
ALTER TABLE clientes_tmp RENAME TO clientes;

CREATE TABLE IF NOT EXISTS produtos_tmp (
  id INTEGER PRIMARY KEY,
  codigo TEXT,
  descricao TEXT,
  ncm TEXT,
  cfop TEXT,
  criadoEm TEXT
);
INSERT INTO produtos_tmp SELECT id,codigo,descricao,ncm,cfop,criadoEm FROM produtos;
DROP TABLE produtos;
ALTER TABLE produtos_tmp RENAME TO produtos;

CREATE TABLE IF NOT EXISTS nfes_tmp (
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
INSERT INTO nfes_tmp SELECT id,chave,numero,serie,status,valor_total,data_emissao,criadaEm,usuario_id,cliente_id FROM nfes;
DROP TABLE nfes;
ALTER TABLE nfes_tmp RENAME TO nfes;

CREATE TABLE IF NOT EXISTS logs_tmp (
  id INTEGER PRIMARY KEY,
  timestamp TEXT,
  dominio TEXT,
  nivel TEXT,
  mensagem TEXT,
  meta TEXT
);
INSERT INTO logs_tmp SELECT id,timestamp,dominio,nivel,mensagem,meta FROM logs;
DROP TABLE logs;
ALTER TABLE logs_tmp RENAME TO logs;

CREATE TABLE IF NOT EXISTS configuracoes_tmp (
  id INTEGER PRIMARY KEY,
  secao TEXT UNIQUE,
  conteudo TEXT
);
INSERT INTO configuracoes_tmp SELECT id,secao,conteudo FROM configuracoes;
DROP TABLE configuracoes;
ALTER TABLE configuracoes_tmp RENAME TO configuracoes;

COMMIT;
