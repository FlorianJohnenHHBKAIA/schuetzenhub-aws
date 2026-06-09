-- Ausführen mit: psql $DATABASE_URL -f database/providers_migration.sql
-- Erstellt das Schausteller- und Dienstleisterverzeichnis.

CREATE TABLE IF NOT EXISTS providers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name     TEXT NOT NULL,
  slug             TEXT UNIQUE NOT NULL,
  provider_type    TEXT NOT NULL,
  description      TEXT,
  contact_name     TEXT,
  email            TEXT,
  phone            TEXT,
  website          TEXT,
  logo_path        TEXT,
  hero_image_path  TEXT,
  street           TEXT,
  zip              TEXT,
  city             TEXT,
  state            TEXT,
  is_public        BOOLEAN NOT NULL DEFAULT true,
  is_verified      BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS provider_inquiries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  club_id     UUID REFERENCES clubs(id) ON DELETE SET NULL,
  firstname   TEXT NOT NULL,
  lastname    TEXT NOT NULL,
  email       TEXT NOT NULL,
  phone       TEXT,
  message     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_providers_slug         ON providers(slug);
CREATE INDEX IF NOT EXISTS idx_providers_type         ON providers(provider_type);
CREATE INDEX IF NOT EXISTS idx_providers_state        ON providers(state);
CREATE INDEX IF NOT EXISTS idx_providers_public       ON providers(is_public);
CREATE INDEX IF NOT EXISTS idx_provider_inquiries_pid ON provider_inquiries(provider_id);
