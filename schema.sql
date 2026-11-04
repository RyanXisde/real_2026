PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS produto (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 nome TEXT NOT NULL,
 preco REAL NOT NULL CHECK(preco>=0),
 precoOriginal REAL,
 imagem TEXT NOT NULL DEFAULT '',
 categoria TEXT NOT NULL,
 estoque INTEGER NOT NULL DEFAULT 0 CHECK(estoque>=0),
 destaque INTEGER NOT NULL DEFAULT 0 CHECK(destaque IN (0,1))
);
CREATE TABLE IF NOT EXISTS cliente (
 id_cli INTEGER PRIMARY KEY AUTOINCREMENT,
 nome_cli TEXT NOT NULL,
 email_cli TEXT NOT NULL UNIQUE COLLATE NOCASE,
 senha_hash TEXT NOT NULL,
 telefone_cli TEXT DEFAULT '',
 endereco_cli TEXT DEFAULT '',
 criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sessao (
 token_hash TEXT PRIMARY KEY,
 cliente_id INTEGER NOT NULL REFERENCES cliente(id_cli) ON DELETE CASCADE,
 expira_em INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS pedido (
 id_ped INTEGER PRIMARY KEY AUTOINCREMENT,
 cliente_ped INTEGER NOT NULL REFERENCES cliente(id_cli),
 data_ped TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 valor_total REAL NOT NULL CHECK(valor_total>=0),
 status TEXT NOT NULL DEFAULT 'registrado'
);
CREATE TABLE IF NOT EXISTS conteudo_pedido (
 id_it INTEGER PRIMARY KEY AUTOINCREMENT,
 pedido_it INTEGER NOT NULL REFERENCES pedido(id_ped),
 produto_it INTEGER NOT NULL REFERENCES produto(id),
 quantidade_it INTEGER NOT NULL CHECK(quantidade_it>0),
 preco_it REAL NOT NULL CHECK(preco_it>=0)
);
CREATE INDEX IF NOT EXISTS idx_pedido_cliente ON pedido(cliente_ped);
CREATE INDEX IF NOT EXISTS idx_sessao_expira ON sessao(expira_em);
