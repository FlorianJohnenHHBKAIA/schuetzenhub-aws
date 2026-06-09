-- ─── Superadmin Audit-Log Migration ──────────────────────────────────────────
-- Protokolliert alle Schreibaktionen im Superadmin-Bereich nachvollziehbar.
-- Ausführen mit: psql $DATABASE_URL -f database/superadmin_audit_log_migration.sql

CREATE TABLE IF NOT EXISTS superadmin_audit_logs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  performed_by UUID        REFERENCES auth_users(id) ON DELETE SET NULL,
  actor_email  TEXT        NOT NULL,
  action       TEXT        NOT NULL,
  entity_type  TEXT        NOT NULL,
  entity_id    UUID,
  before_state JSONB,
  after_state  JSONB,
  metadata     JSONB,
  ip_address   INET,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_created_at ON superadmin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity     ON superadmin_audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor      ON superadmin_audit_logs(performed_by);
CREATE INDEX IF NOT EXISTS idx_audit_action     ON superadmin_audit_logs(action);
