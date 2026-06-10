-- Migration: club_access_requests – Zugangsanfragen für bereits verwaltete Vereine

CREATE TABLE IF NOT EXISTS club_access_requests (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     UUID        NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  firstname   TEXT        NOT NULL,
  lastname    TEXT        NOT NULL,
  email       TEXT        NOT NULL,
  phone       TEXT,
  message     TEXT,
  status      TEXT        NOT NULL DEFAULT 'new',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  handled_at  TIMESTAMPTZ,
  handled_by  UUID        REFERENCES auth_users(id) ON DELETE SET NULL,
  internal_note TEXT
);

CREATE INDEX IF NOT EXISTS idx_car_club_id ON club_access_requests(club_id);
CREATE INDEX IF NOT EXISTS idx_car_status  ON club_access_requests(status);
