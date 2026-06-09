-- Account settings extension.
-- Adds self-service notification preferences and account deletion request metadata.

ALTER TABLE auth_users
  ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deletion_reason TEXT;

ALTER TABLE member_notification_settings
  ADD COLUMN IF NOT EXISTS email_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS push_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS digest_frequency TEXT NOT NULL DEFAULT 'weekly',
  ADD COLUMN IF NOT EXISTS notify_posts BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_events BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_comments BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_workshifts BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_reminders BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notify_system BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_important BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_info BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS push_important BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS push_reminders BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS quiet_hours_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS quiet_hours_start TIME NOT NULL DEFAULT '21:00',
  ADD COLUMN IF NOT EXISTS quiet_hours_end TIME NOT NULL DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_auth_users_deletion_requested
  ON auth_users(deletion_requested_at)
  WHERE deletion_requested_at IS NOT NULL;
