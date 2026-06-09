-- Ausführen mit: psql $DATABASE_URL -f database/superadmin_clubs_salesinfo_migration.sql
-- Ergänzt die clubs-Tabelle um Sales-Pipeline-Felder und Sichtbarkeits-/Status-Felder,
-- die von backend/routes/superadmin.js und api.js referenziert werden.

ALTER TABLE clubs
  ADD COLUMN IF NOT EXISTS acquisition_source  TEXT,
  ADD COLUMN IF NOT EXISTS acquisition_owner   TEXT,
  ADD COLUMN IF NOT EXISTS last_contact_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_contact_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_public           BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_internal         BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS claim_status        TEXT    NOT NULL DEFAULT 'unclaimed';

CREATE INDEX IF NOT EXISTS idx_clubs_is_public    ON clubs(is_public);
CREATE INDEX IF NOT EXISTS idx_clubs_claim_status ON clubs(claim_status);
