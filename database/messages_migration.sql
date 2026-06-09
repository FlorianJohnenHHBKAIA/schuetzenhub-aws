-- ─── Kommunikationsmodul ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS conversations (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id              UUID        NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  type                 TEXT        NOT NULL DEFAULT 'direct' CHECK (type IN ('direct', 'group')),
  name                 TEXT,
  created_by_member_id UUID        REFERENCES members(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversations_club    ON conversations(club_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC);

-- ─── Teilnehmer ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS conversation_participants (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  member_id       UUID        NOT NULL REFERENCES members(id)       ON DELETE CASCADE,
  last_read_at    TIMESTAMPTZ,
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(conversation_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_conv_participants_member ON conversation_participants(member_id);
CREATE INDEX IF NOT EXISTS idx_conv_participants_conv   ON conversation_participants(conversation_id);

-- ─── Nachrichten ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS messages (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id    UUID        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_member_id   UUID        NOT NULL REFERENCES members(id)       ON DELETE CASCADE,
  content            TEXT        NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_sender       ON messages(sender_member_id);

-- ─── Trigger: updated_at bei neuer Nachricht bumpen ──────────────────────────

CREATE OR REPLACE FUNCTION bump_conversation_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE conversations SET updated_at = now() WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_conversation_updated_at ON messages;
CREATE TRIGGER trg_bump_conversation_updated_at
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION bump_conversation_updated_at();
