-- ─── Festplaner Migration ─────────────────────────────────────────────────────
-- Tabellen für das Festplaner-Modul: Projekte, Anbieter-Shortlist, Budget

CREATE TABLE IF NOT EXISTS festival_projects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  start_date  DATE,
  end_date    DATE,
  status      TEXT NOT NULL DEFAULT 'planning',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS festival_provider_shortlist (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_id UUID NOT NULL REFERENCES festival_projects(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'angefragt',
  notes       TEXT,
  rating      SMALLINT CHECK (rating BETWEEN 1 AND 5),
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(festival_id, provider_id)
);

CREATE TABLE IF NOT EXISTS festival_budget_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_id    UUID NOT NULL REFERENCES festival_projects(id) ON DELETE CASCADE,
  category       TEXT NOT NULL,
  description    TEXT,
  planned_amount NUMERIC(10,2),
  actual_amount  NUMERIC(10,2),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_festival_projects_club       ON festival_projects(club_id);
CREATE INDEX IF NOT EXISTS idx_festival_shortlist_festival  ON festival_provider_shortlist(festival_id);
CREATE INDEX IF NOT EXISTS idx_festival_budget_festival     ON festival_budget_items(festival_id);
