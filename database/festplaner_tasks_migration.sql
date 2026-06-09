-- ─── Festplaner Tasks Migration ──────────────────────────────────────────────
-- Aufgaben und Checklisten für Festplaner-Projekte

CREATE TABLE IF NOT EXISTS festival_tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_id UUID NOT NULL REFERENCES festival_projects(id) ON DELETE CASCADE,
  club_id     UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  category    TEXT,
  status      TEXT NOT NULL DEFAULT 'open',
  priority    TEXT NOT NULL DEFAULT 'normal',
  assigned_to UUID REFERENCES members(id) ON DELETE SET NULL,
  due_date    DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ft_festival ON festival_tasks(festival_id);
CREATE INDEX IF NOT EXISTS idx_ft_status   ON festival_tasks(status);
CREATE INDEX IF NOT EXISTS idx_ft_due      ON festival_tasks(due_date);
