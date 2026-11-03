-- Senha provisória: obriga a trocar no primeiro acesso.
ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0;
