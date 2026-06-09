-- ─── Club-Archivierung Migration ─────────────────────────────────────────────
-- Markiert Vereine als archiviert ohne Datenverlust.
-- Archivierung hat keine Auswirkungen auf Portal- oder Öffentlichkeitszugriff.

ALTER TABLE clubs
  ADD COLUMN IF NOT EXISTS archived_at    TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS archived_by    UUID        NULL REFERENCES auth_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS archive_reason TEXT        NULL;

CREATE INDEX IF NOT EXISTS idx_clubs_archived_at ON clubs(archived_at)
  WHERE archived_at IS NOT NULL;
