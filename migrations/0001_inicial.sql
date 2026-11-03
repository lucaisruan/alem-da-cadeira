-- Além da Cadeira: tabelas da Fase 1
PRAGMA foreign_keys = ON;

CREATE TABLE salons (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT,
  tax_rate REAL NOT NULL DEFAULT 0.067,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  salon_id TEXT REFERENCES salons(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner','admin')),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  failed_logins INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX users_salon ON users(salon_id);

-- Chave de ativação = acesso da cliente pelo tempo do plano
CREATE TABLE license_keys (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  plan TEXT NOT NULL CHECK (plan IN ('mensal','trimestral','semestral','anual')),
  months INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'disponivel' CHECK (status IN ('disponivel','ativa','bloqueada')),
  salon_id TEXT REFERENCES salons(id) ON DELETE SET NULL,
  activated_at TEXT,
  expires_at TEXT,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX license_keys_salon ON license_keys(salon_id);

CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  salon_id TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  dre_group TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('padrao','sugestao','manual')),
  active INTEGER NOT NULL DEFAULT 1,
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX categories_name ON categories(salon_id, name COLLATE NOCASE);

-- A data define o mês de competência
CREATE TABLE entries (
  id TEXT PRIMARY KEY,
  salon_id TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  description TEXT NOT NULL,
  category_id TEXT NOT NULL REFERENCES categories(id),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  note TEXT,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX entries_salon_date ON entries(salon_id, date);
CREATE INDEX entries_category ON entries(category_id);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY, -- hash do token
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  device TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX sessions_user ON sessions(user_id);

-- Logs só de acessos e vencimentos (sem lançamentos)
CREATE TABLE audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  salon_id TEXT,
  user_id TEXT,
  event TEXT NOT NULL,
  detail TEXT,
  device TEXT,
  is_failure INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX audit_logs_created ON audit_logs(created_at);
CREATE INDEX audit_logs_salon ON audit_logs(salon_id, created_at);

-- Tempo de uso: um sinal por minuto com o app aberto
CREATE TABLE usage_minutes (
  salon_id TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  minute TEXT NOT NULL, -- 'YYYY-MM-DDTHH:MM'
  PRIMARY KEY (salon_id, minute)
);
