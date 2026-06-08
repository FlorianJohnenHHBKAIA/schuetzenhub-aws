-- Migration: Meldungstabelle für Superadmin-Compliance-Modul
-- Ausführen mit: psql $DATABASE_URL -f database/reports_migration.sql

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_status') THEN
    CREATE TYPE report_status AS ENUM ('open', 'in_review', 'resolved', 'dismissed');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS reports (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id           UUID          REFERENCES clubs(id) ON DELETE SET NULL,
  reporter_user_id  UUID          REFERENCES auth_users(id) ON DELETE SET NULL,
  target_type       TEXT          NOT NULL,  -- 'post' | 'event' | 'comment' | 'member' | 'club'
  target_id         UUID,
  reason            TEXT          NOT NULL,
  description       TEXT,
  status            report_status NOT NULL DEFAULT 'open',
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
  resolved_at       TIMESTAMPTZ,
  resolved_by       UUID          REFERENCES auth_users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_reports_status  ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_club_id ON reports(club_id);
CREATE INDEX IF NOT EXISTS idx_reports_created ON reports(created_at DESC);
