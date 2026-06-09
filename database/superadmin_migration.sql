-- Superadmin-Erweiterung: is_superadmin Flag auf auth_users
-- Ausführen: psql -d schuetzenhub -f database/superadmin_migration.sql
--
-- Superadmin manuell setzen (nach Migration):
--   UPDATE auth_users SET is_superadmin = true WHERE email = 'deine@email.de';

ALTER TABLE auth_users
  ADD COLUMN IF NOT EXISTS is_superadmin BOOLEAN NOT NULL DEFAULT false;
