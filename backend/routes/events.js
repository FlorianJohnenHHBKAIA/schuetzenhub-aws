const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");
const { notifyEventPublished } = require("../lib/notifications");

// GET /api/events – Termine des Vereins
router.get("/", requireAuth, async (req, res) => {
  const { from, public: isPublic, clubSlug } = req.query;

  try {
    let query, params;
    if (isPublic && clubSlug) {
      // Öffentliche Termine über Slug (kein Auth nötig, aber hier trotzdem)
      query = `SELECT e.* FROM events e
               JOIN clubs c ON c.id = e.club_id
               WHERE c.slug = $1 AND e.audience = 'public' AND e.publication_status = 'approved'
               AND e.start_at >= now() ORDER BY e.start_at ASC`;
      params = [clubSlug];
    } else {
      const startFrom = from || new Date().toISOString();
      query = `SELECT e.* FROM events e
               WHERE e.club_id = $1 AND e.start_at >= $2
               ORDER BY e.start_at ASC`;
      params = [req.clubId, startFrom];
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// GET /api/events/public/:clubSlug – Öffentliche Termine (kein Auth)
router.get("/public/:clubSlug", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT e.* FROM events e
       JOIN clubs c ON c.id = e.club_id
       WHERE c.slug = $1 AND e.audience = 'public' AND e.publication_status = 'approved'
       AND e.start_at >= now() ORDER BY e.start_at ASC LIMIT 50`,
      [req.params.clubSlug]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// GET /api/events/participant-counts?ids=id1,id2,...
router.get("/participant-counts", requireAuth, async (req, res) => {
  const ids = (req.query.ids || "").split(",").map(s => s.trim()).filter(Boolean);
  if (ids.length === 0) return res.json([]);

  const placeholders = ids.map((_, i) => `$${i + 2}`).join(",");
  try {
    const result = await pool.query(`
      SELECT
        e.id AS event_id,
        COALESCE(SUM(CASE WHEN ep.status = 'attending' THEN 1 ELSE 0 END), 0)::int AS attending_count,
        COALESCE(SUM(CASE WHEN ep.status = 'declined' THEN 1 ELSE 0 END), 0)::int AS declined_count,
        CASE
          WHEN e.owner_type = 'company' AND e.audience = 'company_only' THEN (
            SELECT COUNT(*)::int FROM member_company_memberships mcm
            JOIN members m ON m.id = mcm.member_id
            WHERE mcm.company_id = e.owner_id AND mcm.valid_to IS NULL AND m.status = 'active'
          )
          ELSE (
            SELECT COUNT(*)::int FROM members m WHERE m.club_id = e.club_id AND m.status = 'active'
          )
        END AS member_count
      FROM events e
      LEFT JOIN event_participants ep ON ep.event_id = e.id
      WHERE e.id IN (${placeholders}) AND e.club_id = $1
      GROUP BY e.id, e.owner_id, e.owner_type, e.audience, e.club_id
    `, [req.clubId, ...ids]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// GET /api/events/:id
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM events WHERE id = $1 AND club_id = $2",
      [req.params.id, req.clubId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Nicht gefunden" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// POST /api/events
router.post("/", requireAuth, async (req, res) => {
  const {
    title, description, location, start_at, end_at, category,
    owner_type, owner_id, audience, publication_status,
    approved_at, approved_by_member_id,
  } = req.body;

  if (!title || !start_at) {
    return res.status(400).json({ error: "Titel und Startzeit erforderlich" });
  }

  try {
    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO events (id, club_id, title, description, location, start_at, end_at,
        category, owner_type, owner_id, audience, publication_status,
        created_by_member_id, approved_at, approved_by_member_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      [id, req.clubId, title, description || null, location || null,
       start_at, end_at || null, category || "other",
       owner_type || "club", owner_id || req.clubId,
       audience || "club_internal", publication_status || "draft",
       req.member.id, approved_at || null, approved_by_member_id || null]
    );
    const event = result.rows[0];
    if (event.publication_status === "approved") {
      notifyEventPublished(pool, event).catch((err) =>
        console.error("notifyEventPublished error:", err)
      );
    }
    res.status(201).json(event);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// PUT /api/events/:id
router.put("/:id", requireAuth, async (req, res) => {
  const {
    title, description, location, start_at, end_at, category,
    owner_type, owner_id, audience, publication_status,
    approved_at, approved_by_member_id, rejection_reason,
    submitted_at, responsible_member_id,
  } = req.body;

  try {
    const prevRes = await pool.query(
      "SELECT publication_status FROM events WHERE id = $1 AND club_id = $2",
      [req.params.id, req.clubId]
    );
    if (!prevRes.rows[0]) return res.status(404).json({ error: "Nicht gefunden" });
    const prevStatus = prevRes.rows[0].publication_status;

    const result = await pool.query(
      `UPDATE events SET
        title = COALESCE($1, title),
        description = $2,
        location = $3,
        start_at = COALESCE($4, start_at),
        end_at = $5,
        category = COALESCE($6, category),
        owner_type = COALESCE($7, owner_type),
        owner_id = COALESCE($8, owner_id),
        audience = COALESCE($9, audience),
        publication_status = COALESCE($10, publication_status),
        approved_at = $11,
        approved_by_member_id = $12,
        rejection_reason = $13,
        submitted_at = $14,
        responsible_member_id = $15,
        updated_by_member_id = $16
       WHERE id = $17 AND club_id = $18
       RETURNING *`,
      [title, description ?? null, location ?? null, start_at, end_at ?? null,
       category, owner_type, owner_id, audience, publication_status,
       approved_at ?? null, approved_by_member_id ?? null,
       rejection_reason ?? null, submitted_at ?? null,
       responsible_member_id ?? null,
       req.member.id, req.params.id, req.clubId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Nicht gefunden" });
    const event = result.rows[0];
    if (prevStatus !== "approved" && event.publication_status === "approved") {
      notifyEventPublished(pool, event).catch((err) =>
        console.error("notifyEventPublished error:", err)
      );
    }
    res.json(event);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// DELETE /api/events/:id
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    await pool.query(
      "DELETE FROM events WHERE id = $1 AND club_id = $2",
      [req.params.id, req.clubId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

module.exports = router;
