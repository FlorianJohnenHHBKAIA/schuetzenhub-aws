-- ─── Festplaner Inquiries Migration ──────────────────────────────────────────
-- Angebotsanfragen: Vereinsadmins können Anbieter direkt aus dem Festplaner heraus anfragen

CREATE TABLE IF NOT EXISTS festival_provider_inquiries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_id UUID NOT NULL REFERENCES festival_projects(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  club_id     UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  subject     TEXT,
  message     TEXT,
  status      TEXT NOT NULL DEFAULT 'draft',
  sent_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fpi_festival ON festival_provider_inquiries(festival_id);
CREATE INDEX IF NOT EXISTS idx_fpi_provider ON festival_provider_inquiries(provider_id);
