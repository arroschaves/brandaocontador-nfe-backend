BEGIN TRANSACTION;

CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_clientes_documento ON clientes(documento);
CREATE INDEX IF NOT EXISTS idx_produtos_codigo ON produtos(codigo);
CREATE INDEX IF NOT EXISTS idx_nfes_chave ON nfes(chave);
CREATE INDEX IF NOT EXISTS idx_nfes_status ON nfes(status);
CREATE INDEX IF NOT EXISTS idx_logs_dominio ON logs(dominio);
CREATE INDEX IF NOT EXISTS idx_logs_nivel ON logs(nivel);

COMMIT;
