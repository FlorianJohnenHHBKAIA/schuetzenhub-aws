-- Legt die initialen Superadmin-Accounts an bzw. aktualisiert sie.
-- Ausfuehren aus dem Projektroot:
--   psql $DATABASE_URL -f database/superadmin_anlegen.sql
--
-- Zugangsdaten:
--   florian@schuetzenhub.de / Florian0103#
--   tom@schuetzenhub.de     / Tom!Schiessen2026#7Kp

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

ALTER TABLE auth_users
  ADD COLUMN IF NOT EXISTS is_superadmin BOOLEAN NOT NULL DEFAULT false;

INSERT INTO auth_users (id, email, password_hash, is_superadmin, created_at, updated_at)
VALUES
  (
    gen_random_uuid(),
    'florian@schuetzenhub.de',
    '$2b$12$BCTowCrWVGzP8AUZiRdj6eD7rZWEx.eqnNb910BxGocQ72WghKuWq',
    true,
    now(),
    now()
  ),
  (
    gen_random_uuid(),
    'tom@schuetzenhub.de',
    '$2b$12$W7EVdmIe.9Xw079JAyzvU.TvYjTCpV.QuOfVRRrSSqtDowrnL6mtK',
    true,
    now(),
    now()
  )
ON CONFLICT (email)
DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  is_superadmin = true,
  updated_at = now();

COMMIT;
