const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");

// ─── GET /api/messages/conversations ─────────────────────────────────────────

router.get("/conversations", requireAuth, async (req, res) => {
  if (!req.member) return res.json([]);
  try {
    const result = await pool.query(
      `SELECT
         c.id,
         c.type,
         c.name,
         c.scope,
         c.scope_id,
         comp.name            AS scope_company_name,
         c.updated_at,
         -- letzte Nachricht
         lm.content           AS last_message_content,
         lm.created_at        AS last_message_at,
         lm.sender_first      AS last_message_sender_name,
         -- ungelesene Nachrichten
         COALESCE((
           SELECT COUNT(*)::int
           FROM messages msg
           WHERE msg.conversation_id = c.id
             AND msg.sender_member_id <> $1
             AND (cp.last_read_at IS NULL OR msg.created_at > cp.last_read_at)
         ), 0) AS unread_count,
         -- Gesprächspartner bei Direktnachrichten
         om.id                AS other_member_id,
         om.first_name        AS other_member_first_name,
         om.last_name         AS other_member_last_name,
         om.avatar_url        AS other_member_avatar_url
       FROM conversations c
       JOIN conversation_participants cp
         ON cp.conversation_id = c.id AND cp.member_id = $1
       LEFT JOIN companies comp ON comp.id = c.scope_id
       LEFT JOIN LATERAL (
         SELECT m.content, m.created_at,
                mb.first_name || ' ' || mb.last_name AS sender_first
         FROM messages m
         JOIN members mb ON mb.id = m.sender_member_id
         WHERE m.conversation_id = c.id
         ORDER BY m.created_at DESC
         LIMIT 1
       ) lm ON true
       LEFT JOIN LATERAL (
         SELECT mem.id, mem.first_name, mem.last_name, mem.avatar_url
         FROM conversation_participants op
         JOIN members mem ON mem.id = op.member_id
         WHERE op.conversation_id = c.id AND op.member_id <> $1
         LIMIT 1
       ) om ON c.type = 'direct'
       WHERE c.club_id = $2
       ORDER BY c.updated_at DESC`,
      [req.member.id, req.clubId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("GET /messages/conversations:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// ─── GET /api/messages/unread-count ──────────────────────────────────────────

router.get("/unread-count", requireAuth, async (req, res) => {
  if (!req.member) return res.json({ count: 0 });
  try {
    const result = await pool.query(
      `SELECT COALESCE(SUM(
         (SELECT COUNT(*)::int
          FROM messages m
          WHERE m.conversation_id = cp.conversation_id
            AND m.sender_member_id <> $1
            AND (cp.last_read_at IS NULL OR m.created_at > cp.last_read_at)
         )
       ), 0)::int AS count
       FROM conversation_participants cp
       JOIN conversations c ON c.id = cp.conversation_id
       WHERE cp.member_id = $1 AND c.club_id = $2`,
      [req.member.id, req.clubId]
    );
    res.json({ count: result.rows[0]?.count ?? 0 });
  } catch (err) {
    console.error("GET /messages/unread-count:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// ─── GET /api/messages/company-members/:companyId ────────────────────────────
// Gibt aktuelle Mitglieder-IDs einer Kompanie zurück (für Dialog-Filterung)

router.get("/company-members/:companyId", requireAuth, async (req, res) => {
  if (!req.member) return res.status(403).json({ error: "Kein Zugriff" });
  const { companyId } = req.params;
  try {
    // Sicherstellen dass die Kompanie zum selben Verein gehört
    const compCheck = await pool.query(
      "SELECT 1 FROM companies WHERE id = $1 AND club_id = $2",
      [companyId, req.clubId]
    );
    if (!compCheck.rows.length) return res.status(404).json({ error: "Kompanie nicht gefunden" });

    const result = await pool.query(
      `SELECT mcm.member_id
       FROM member_company_memberships mcm
       JOIN members m ON m.id = mcm.member_id
       WHERE mcm.company_id = $1
         AND mcm.valid_to IS NULL
         AND m.status IN ('active', 'passive')`,
      [companyId]
    );
    res.json(result.rows.map((r) => r.member_id));
  } catch (err) {
    console.error("GET /messages/company-members:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// ─── GET /api/messages/conversations/:id/messages ────────────────────────────

router.get("/conversations/:id/messages", requireAuth, async (req, res) => {
  if (!req.member) return res.status(403).json({ error: "Kein Zugriff" });
  const { id } = req.params;
  const before = req.query.before;

  try {
    const partCheck = await pool.query(
      "SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND member_id = $2",
      [id, req.member.id]
    );
    if (!partCheck.rows.length) return res.status(403).json({ error: "Kein Zugriff" });

    const params = [id];
    let cursorClause = "";
    if (before) {
      params.push(before);
      cursorClause = `AND m.created_at < $${params.length}`;
    }

    const result = await pool.query(
      `SELECT
         m.id, m.conversation_id, m.sender_member_id,
         mem.first_name AS sender_first_name,
         mem.last_name  AS sender_last_name,
         mem.avatar_url AS sender_avatar_url,
         m.content, m.created_at
       FROM messages m
       JOIN members mem ON mem.id = m.sender_member_id
       WHERE m.conversation_id = $1 ${cursorClause}
       ORDER BY m.created_at DESC
       LIMIT 50`,
      params
    );
    res.json(result.rows.reverse());
  } catch (err) {
    console.error("GET /messages/conversations/:id/messages:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// ─── POST /api/messages/conversations ────────────────────────────────────────

router.post("/conversations", requireAuth, async (req, res) => {
  if (!req.member) return res.status(403).json({ error: "Kein Zugriff" });

  const {
    type,
    name,
    memberIds,
    scope = "club",
    scope_id,
    alle_mitglieder = false,
  } = req.body;

  if (!type || !["direct", "group"].includes(type)) {
    return res.status(400).json({ error: "Ungültiger Typ" });
  }
  if (!["company", "club", "external"].includes(scope)) {
    return res.status(400).json({ error: "Ungültiger Scope" });
  }
  if (type === "group" && !name?.trim()) {
    return res.status(400).json({ error: "Gruppenname erforderlich" });
  }
  if (scope === "company" && !scope_id) {
    return res.status(400).json({ error: "Kompanie erforderlich" });
  }

  try {
    // Kompanie-Validierung
    if (scope === "company" && scope_id) {
      const compCheck = await pool.query(
        "SELECT 1 FROM companies WHERE id = $1 AND club_id = $2",
        [scope_id, req.clubId]
      );
      if (!compCheck.rows.length) {
        return res.status(400).json({ error: "Kompanie nicht gefunden" });
      }
    }

    if (type === "direct") {
      const otherId = (memberIds || [])[0];
      if (!otherId) return res.status(400).json({ error: "Empfänger fehlt" });
      const existing = await pool.query(
        `SELECT c.id FROM conversations c
         JOIN conversation_participants cp1 ON cp1.conversation_id = c.id AND cp1.member_id = $1
         JOIN conversation_participants cp2 ON cp2.conversation_id = c.id AND cp2.member_id = $2
         WHERE c.type = 'direct' AND c.club_id = $3
         LIMIT 1`,
        [req.member.id, otherId, req.clubId]
      );
      if (existing.rows.length) {
        return res.json({ id: existing.rows[0].id, existing: true });
      }
    }

    const id = uuidv4();
    await pool.query(
      `INSERT INTO conversations (id, club_id, type, name, scope, scope_id, created_by_member_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, req.clubId, type, name?.trim() || null, scope, scope_id || null, req.member.id]
    );

    // Teilnehmer bestimmen
    let participantIds = [...new Set([req.member.id, ...(memberIds || [])])];

    if (alle_mitglieder) {
      if (scope === "company" && scope_id) {
        const compMembers = await pool.query(
          `SELECT mcm.member_id
           FROM member_company_memberships mcm
           JOIN members m ON m.id = mcm.member_id
           WHERE mcm.company_id = $1
             AND mcm.valid_to IS NULL
             AND m.status IN ('active', 'passive')`,
          [scope_id]
        );
        participantIds = [...new Set([req.member.id, ...compMembers.rows.map((r) => r.member_id)])];
      } else if (scope === "club") {
        const clubMembers = await pool.query(
          "SELECT id FROM members WHERE club_id = $1 AND status IN ('active', 'passive')",
          [req.clubId]
        );
        participantIds = clubMembers.rows.map((r) => r.id);
      }
    }

    for (const memberId of participantIds) {
      await pool.query(
        "INSERT INTO conversation_participants (id, conversation_id, member_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
        [uuidv4(), id, memberId]
      );
    }

    res.status(201).json({ id, existing: false });
  } catch (err) {
    console.error("POST /messages/conversations:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// ─── POST /api/messages/conversations/:id/messages ───────────────────────────

router.post("/conversations/:id/messages", requireAuth, async (req, res) => {
  if (!req.member) return res.status(403).json({ error: "Kein Zugriff" });

  const { id } = req.params;
  const { content } = req.body;

  if (!content?.trim()) return res.status(400).json({ error: "Inhalt fehlt" });
  if (content.length > 4000) return res.status(400).json({ error: "Nachricht zu lang" });

  try {
    const partCheck = await pool.query(
      "SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND member_id = $2",
      [id, req.member.id]
    );
    if (!partCheck.rows.length) return res.status(403).json({ error: "Kein Zugriff" });

    const msgId = uuidv4();
    const result = await pool.query(
      `INSERT INTO messages (id, conversation_id, sender_member_id, content)
       VALUES ($1, $2, $3, $4)
       RETURNING id, conversation_id, sender_member_id, content, created_at`,
      [msgId, id, req.member.id, content.trim()]
    );
    const msg = result.rows[0];

    res.status(201).json({
      ...msg,
      sender_first_name: req.member.first_name,
      sender_last_name: req.member.last_name,
      sender_avatar_url: req.member.avatar_url,
    });
  } catch (err) {
    console.error("POST /messages/conversations/:id/messages:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// ─── PUT /api/messages/conversations/:id/read ────────────────────────────────

router.put("/conversations/:id/read", requireAuth, async (req, res) => {
  if (!req.member) return res.json({ success: true });
  const { id } = req.params;
  try {
    await pool.query(
      `UPDATE conversation_participants SET last_read_at = now()
       WHERE conversation_id = $1 AND member_id = $2`,
      [id, req.member.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("PUT /messages/conversations/:id/read:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

module.exports = router;
