-- ─── Chat-Ebenen: scope-Erweiterung ─────────────────────────────────────────
-- Erweitert die conversations-Tabelle um scope (Kommunikationsebene) und
-- scope_id (Referenz auf Kompanie bei scope = 'company').

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'club'
    CHECK (scope IN ('company', 'club', 'external'));

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS scope_id UUID REFERENCES companies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_scope ON conversations(scope);
