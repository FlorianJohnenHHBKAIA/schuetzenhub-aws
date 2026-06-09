-- Ausführen mit: psql $DATABASE_URL -f database/feature_columns_migration.sql
-- Ergänzt Spalten für geplante Features, die im Backend-Code bereits referenziert werden.

-- Passwort-Reset-Flow (backend/routes/auth.js nutzt diese bereits)
ALTER TABLE auth_users
  ADD COLUMN IF NOT EXISTS reset_token            TEXT,
  ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMPTZ;

-- Posts: Ablaufdatum und Pinning (backend/routes/api.js: TODO-Kommentare)
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS visible_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_pinned     BOOLEAN NOT NULL DEFAULT FALSE;
