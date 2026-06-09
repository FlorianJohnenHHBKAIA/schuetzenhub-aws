-- ─── Club Interest Requests Migration ───────────────────────────────────────
-- Speichert Interessenbekundungen von Besuchern der öffentlichen Vereinsseite

CREATE TABLE IF NOT EXISTS club_interest_requests (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id    UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  message    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cir_club ON club_interest_requests(club_id);
