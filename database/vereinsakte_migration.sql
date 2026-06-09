-- Ausführen mit: psql $DATABASE_URL -f database/vereinsakte_migration.sql
-- Fügt Akquise-, Sichtbarkeits- und Übernahmefelder hinzu sowie die Notizen-Tabelle.

ALTER TABLE clubs
  ADD COLUMN IF NOT EXISTS acquisition_source  TEXT,
  ADD COLUMN IF NOT EXISTS acquisition_owner   TEXT,
  ADD COLUMN IF NOT EXISTS last_contact_at     DATE,
  ADD COLUMN IF NOT EXISTS next_contact_at     DATE,
  ADD COLUMN IF NOT EXISTS is_public           BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_internal         BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS claim_status        TEXT NOT NULL DEFAULT 'unclaimed';

CREATE TABLE IF NOT EXISTS club_notes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id    UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  note       TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_club_notes_club_id ON club_notes(club_id);
