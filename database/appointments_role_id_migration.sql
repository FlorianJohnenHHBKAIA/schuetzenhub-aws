-- Adds the role reference used by appointment assignment APIs.
-- Existing rows keep their title; role_id can be backfilled manually if needed.

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES roles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_role_id ON appointments(role_id);
