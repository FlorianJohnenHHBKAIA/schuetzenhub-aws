-- Migration: Superadmin Inbox – club_interest_requests erweitern
-- Führe diesen Block direkt gegen die Datenbank aus.

ALTER TABLE club_interest_requests
  ADD COLUMN IF NOT EXISTS status       TEXT        NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS request_type TEXT        NOT NULL DEFAULT 'membership_interest',
  ADD COLUMN IF NOT EXISTS phone        TEXT,
  ADD COLUMN IF NOT EXISTS assigned_to  UUID        REFERENCES auth_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS handled_by   UUID        REFERENCES auth_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS handled_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS internal_note TEXT;

CREATE INDEX IF NOT EXISTS idx_cir_status ON club_interest_requests(status);
CREATE INDEX IF NOT EXISTS idx_cir_type   ON club_interest_requests(request_type);

-- internal_note für Übernahmeanfragen
ALTER TABLE club_claim_requests
  ADD COLUMN IF NOT EXISTS internal_note TEXT;
