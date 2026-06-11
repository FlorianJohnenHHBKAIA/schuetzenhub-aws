-- ============================================================
-- E-Mail-Verifizierung: neue Spalten in auth_users
-- Ausführen: psql -U <user> -d schuetzenhub -f email_verification_migration.sql
-- ============================================================

ALTER TABLE auth_users
  ADD COLUMN IF NOT EXISTS email_verification_token TEXT,
  ADD COLUMN IF NOT EXISTS email_verified_at        TIMESTAMPTZ;
