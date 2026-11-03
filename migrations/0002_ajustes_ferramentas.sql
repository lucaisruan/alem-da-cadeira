-- Fase 3: ajustes das ferramentas do método (pró-labore, metas, reserva, equipe)
ALTER TABLE salons ADD COLUMN settings TEXT NOT NULL DEFAULT '{}';
