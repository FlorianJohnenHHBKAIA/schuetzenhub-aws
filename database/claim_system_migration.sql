-- Ausführen mit: psql $DATABASE_URL -f database/claim_system_migration.sql
-- Erstellt club_claim_requests (Übernahmeanfragen) und club_invitations (Einladungen ohne Konto).

CREATE TABLE IF NOT EXISTS club_claim_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id      UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  firstname    TEXT NOT NULL,
  lastname     TEXT NOT NULL,
  position     TEXT,
  email        TEXT NOT NULL,
  phone        TEXT,
  message      TEXT,
  status       TEXT NOT NULL DEFAULT 'open',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at  TIMESTAMPTZ,
  reviewed_by  UUID REFERENCES auth_users(id)
);

CREATE INDEX IF NOT EXISTS idx_claim_requests_club_id ON club_claim_requests(club_id);
CREATE INDEX IF NOT EXISTS idx_claim_requests_status  ON club_claim_requests(status);

CREATE TABLE IF NOT EXISTS club_invitations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id    UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'admin',
  token      UUID NOT NULL DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  used_at    TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_club_invitations_token ON club_invitations(token);
