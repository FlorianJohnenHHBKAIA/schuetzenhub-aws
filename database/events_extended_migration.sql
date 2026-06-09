-- Ausführen mit: psql $DATABASE_URL -f database/events_extended_migration.sql
-- Erweitert die bestehende events-Tabelle um event_type und strukturierte Ortsfelder.
-- Alle neuen Spalten nullable → rückwärtskompatibel.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS event_type      TEXT,
  ADD COLUMN IF NOT EXISTS location_name   TEXT,
  ADD COLUMN IF NOT EXISTS location_street TEXT,
  ADD COLUMN IF NOT EXISTS location_zip    TEXT,
  ADD COLUMN IF NOT EXISTS location_city   TEXT,
  ADD COLUMN IF NOT EXISTS location_state  TEXT;

CREATE INDEX IF NOT EXISTS idx_events_event_type     ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_location_state ON events(location_state);
