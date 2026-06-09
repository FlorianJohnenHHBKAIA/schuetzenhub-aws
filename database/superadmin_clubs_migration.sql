-- Ausführen mit: psql $DATABASE_URL -f database/superadmin_clubs_migration.sql
-- Fügt Felder für Superadmin-Vereinsverwaltung (Adresse, Sales-Pipeline, Soft Delete) hinzu.

ALTER TABLE clubs
  ADD COLUMN IF NOT EXISTS club_number   TEXT,
  ADD COLUMN IF NOT EXISTS street        TEXT,
  ADD COLUMN IF NOT EXISTS house_number  TEXT,
  ADD COLUMN IF NOT EXISTS state         TEXT,
  ADD COLUMN IF NOT EXISTS country       TEXT NOT NULL DEFAULT 'Deutschland',
  ADD COLUMN IF NOT EXISTS sales_status  TEXT NOT NULL DEFAULT 'recherchiert',
  ADD COLUMN IF NOT EXISTS deleted_at    TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_clubs_sales_status ON clubs(sales_status);
CREATE INDEX IF NOT EXISTS idx_clubs_deleted_at   ON clubs(deleted_at) WHERE deleted_at IS NULL;
