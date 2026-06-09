const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");
const { getPublicUrl } = require("../storage");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ownFestival(res, row) {
  if (!row) return res.status(404).json({ error: "Fest nicht gefunden" });
  return true;
}

// ─── Festival CRUD ─────────────────────────────────────────────────────────────

// GET /api/festplaner – alle Feste des Clubs
router.get("/", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         fp.*,
         COALESCE(sl.provider_count, 0)::int  AS provider_count,
         COALESCE(bi.planned_total, 0)::numeric AS planned_total,
         COALESCE(bi.actual_total, 0)::numeric  AS actual_total
       FROM festival_projects fp
       LEFT JOIN (
         SELECT festival_id, COUNT(*)::int AS provider_count
         FROM festival_provider_shortlist
         GROUP BY festival_id
       ) sl ON sl.festival_id = fp.id
       LEFT JOIN (
         SELECT festival_id,
                SUM(planned_amount) AS planned_total,
                SUM(actual_amount)  AS actual_total
         FROM festival_budget_items
         GROUP BY festival_id
       ) bi ON bi.festival_id = fp.id
       WHERE fp.club_id = $1
       ORDER BY fp.start_date DESC NULLS LAST, fp.created_at DESC`,
      [req.clubId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// POST /api/festplaner – neues Fest anlegen
router.post("/", requireAuth, async (req, res) => {
  const { title, description, start_date, end_date, status } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: "Titel erforderlich" });
  try {
    const result = await pool.query(
      `INSERT INTO festival_projects (club_id, title, description, start_date, end_date, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.clubId, title.trim(), description || null, start_date || null, end_date || null, status || "planning"]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// GET /api/festplaner/:id – Einzelfest mit Budget-Summary und Provider-Counts
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const [festRes, budgetRes, countsRes] = await Promise.all([
      pool.query(
        `SELECT * FROM festival_projects WHERE id = $1 AND club_id = $2`,
        [req.params.id, req.clubId]
      ),
      pool.query(
        `SELECT
           COALESCE(SUM(planned_amount), 0)::numeric AS planned_total,
           COALESCE(SUM(actual_amount), 0)::numeric  AS actual_total
         FROM festival_budget_items WHERE festival_id = $1`,
        [req.params.id]
      ),
      pool.query(
        `SELECT status, COUNT(*)::int AS count
         FROM festival_provider_shortlist
         WHERE festival_id = $1
         GROUP BY status`,
        [req.params.id]
      ),
    ]);

    const festival = festRes.rows[0];
    if (!festival) return res.status(404).json({ error: "Fest nicht gefunden" });

    const provider_counts = {};
    for (const row of countsRes.rows) {
      provider_counts[row.status] = row.count;
    }

    res.json({
      ...festival,
      planned_total: budgetRes.rows[0]?.planned_total ?? 0,
      actual_total: budgetRes.rows[0]?.actual_total ?? 0,
      provider_counts,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// PATCH /api/festplaner/:id – Fest aktualisieren
router.patch("/:id", requireAuth, async (req, res) => {
  const ALLOWED = ["title", "description", "start_date", "end_date", "status"];
  const updates = Object.fromEntries(
    Object.entries(req.body).filter(([k]) => ALLOWED.includes(k))
  );
  if (!Object.keys(updates).length) return res.status(400).json({ error: "Keine gültigen Felder" });

  try {
    const check = await pool.query(
      `SELECT id FROM festival_projects WHERE id = $1 AND club_id = $2`,
      [req.params.id, req.clubId]
    );
    if (!check.rows[0]) return res.status(404).json({ error: "Fest nicht gefunden" });

    const keys = Object.keys(updates);
    const vals = Object.values(updates);
    const setClauses = keys.map((k, i) => `${k} = $${i + 1}`).join(", ");
    const result = await pool.query(
      `UPDATE festival_projects SET ${setClauses}, updated_at = now() WHERE id = $${keys.length + 1} RETURNING *`,
      [...vals, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// DELETE /api/festplaner/:id – Fest löschen
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM festival_projects WHERE id = $1 AND club_id = $2 RETURNING id`,
      [req.params.id, req.clubId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Fest nicht gefunden" });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// ─── Provider-Shortlist ────────────────────────────────────────────────────────

// GET /api/festplaner/:id/providers
router.get("/:id/providers", requireAuth, async (req, res) => {
  try {
    const check = await pool.query(
      `SELECT id FROM festival_projects WHERE id = $1 AND club_id = $2`,
      [req.params.id, req.clubId]
    );
    if (!check.rows[0]) return res.status(404).json({ error: "Fest nicht gefunden" });

    const result = await pool.query(
      `SELECT
         sl.id, sl.festival_id, sl.provider_id, sl.status, sl.notes,
         sl.rating, sl.is_favorite, sl.created_at,
         p.company_name, p.provider_type, p.city, p.state, p.logo_path, p.slug
       FROM festival_provider_shortlist sl
       JOIN providers p ON p.id = sl.provider_id
       WHERE sl.festival_id = $1
       ORDER BY sl.created_at ASC`,
      [req.params.id]
    );
    const rows = result.rows.map((r) => ({
      ...r,
      logo_url: r.logo_path ? getPublicUrl("provider-assets", r.logo_path) : null,
    }));
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// POST /api/festplaner/:id/providers – Anbieter zur Shortlist hinzufügen
router.post("/:id/providers", requireAuth, async (req, res) => {
  const { provider_id } = req.body;
  if (!provider_id) return res.status(400).json({ error: "provider_id erforderlich" });

  try {
    const check = await pool.query(
      `SELECT id FROM festival_projects WHERE id = $1 AND club_id = $2`,
      [req.params.id, req.clubId]
    );
    if (!check.rows[0]) return res.status(404).json({ error: "Fest nicht gefunden" });

    const result = await pool.query(
      `INSERT INTO festival_provider_shortlist (festival_id, provider_id)
       VALUES ($1, $2)
       ON CONFLICT (festival_id, provider_id) DO NOTHING
       RETURNING *`,
      [req.params.id, provider_id]
    );
    res.status(201).json(result.rows[0] ?? { festival_id: req.params.id, provider_id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// PATCH /api/festplaner/:id/providers/:shortlistId – Status, Notes, Rating, Favorite
router.patch("/:id/providers/:shortlistId", requireAuth, async (req, res) => {
  const ALLOWED = ["status", "notes", "rating", "is_favorite"];
  const updates = Object.fromEntries(
    Object.entries(req.body).filter(([k]) => ALLOWED.includes(k))
  );
  if (!Object.keys(updates).length) return res.status(400).json({ error: "Keine gültigen Felder" });

  try {
    const check = await pool.query(
      `SELECT sl.id FROM festival_provider_shortlist sl
       JOIN festival_projects fp ON fp.id = sl.festival_id
       WHERE sl.id = $1 AND fp.club_id = $2`,
      [req.params.shortlistId, req.clubId]
    );
    if (!check.rows[0]) return res.status(404).json({ error: "Eintrag nicht gefunden" });

    const keys = Object.keys(updates);
    const vals = Object.values(updates);
    const setClauses = keys.map((k, i) => `${k} = $${i + 1}`).join(", ");
    const result = await pool.query(
      `UPDATE festival_provider_shortlist SET ${setClauses} WHERE id = $${keys.length + 1} RETURNING *`,
      [...vals, req.params.shortlistId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// DELETE /api/festplaner/:id/providers/:shortlistId
router.delete("/:id/providers/:shortlistId", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM festival_provider_shortlist sl
       USING festival_projects fp
       WHERE sl.id = $1 AND sl.festival_id = fp.id AND fp.club_id = $2
       RETURNING sl.id`,
      [req.params.shortlistId, req.clubId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Eintrag nicht gefunden" });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// ─── Budget ────────────────────────────────────────────────────────────────────

// GET /api/festplaner/:id/budget
router.get("/:id/budget", requireAuth, async (req, res) => {
  try {
    const check = await pool.query(
      `SELECT id FROM festival_projects WHERE id = $1 AND club_id = $2`,
      [req.params.id, req.clubId]
    );
    if (!check.rows[0]) return res.status(404).json({ error: "Fest nicht gefunden" });

    const result = await pool.query(
      `SELECT * FROM festival_budget_items WHERE festival_id = $1 ORDER BY category, created_at`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// POST /api/festplaner/:id/budget
router.post("/:id/budget", requireAuth, async (req, res) => {
  const { category, description, planned_amount, actual_amount } = req.body;
  if (!category?.trim()) return res.status(400).json({ error: "Kategorie erforderlich" });

  try {
    const check = await pool.query(
      `SELECT id FROM festival_projects WHERE id = $1 AND club_id = $2`,
      [req.params.id, req.clubId]
    );
    if (!check.rows[0]) return res.status(404).json({ error: "Fest nicht gefunden" });

    const result = await pool.query(
      `INSERT INTO festival_budget_items (festival_id, category, description, planned_amount, actual_amount)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.params.id, category.trim(), description || null, planned_amount ?? null, actual_amount ?? null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// PATCH /api/festplaner/:id/budget/:itemId
router.patch("/:id/budget/:itemId", requireAuth, async (req, res) => {
  const ALLOWED = ["category", "description", "planned_amount", "actual_amount"];
  const updates = Object.fromEntries(
    Object.entries(req.body).filter(([k]) => ALLOWED.includes(k))
  );
  if (!Object.keys(updates).length) return res.status(400).json({ error: "Keine gültigen Felder" });

  try {
    const check = await pool.query(
      `SELECT bi.id FROM festival_budget_items bi
       JOIN festival_projects fp ON fp.id = bi.festival_id
       WHERE bi.id = $1 AND fp.club_id = $2`,
      [req.params.itemId, req.clubId]
    );
    if (!check.rows[0]) return res.status(404).json({ error: "Position nicht gefunden" });

    const keys = Object.keys(updates);
    const vals = Object.values(updates);
    const setClauses = keys.map((k, i) => `${k} = $${i + 1}`).join(", ");
    const result = await pool.query(
      `UPDATE festival_budget_items SET ${setClauses} WHERE id = $${keys.length + 1} RETURNING *`,
      [...vals, req.params.itemId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// DELETE /api/festplaner/:id/budget/:itemId
router.delete("/:id/budget/:itemId", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM festival_budget_items bi
       USING festival_projects fp
       WHERE bi.id = $1 AND bi.festival_id = fp.id AND fp.club_id = $2
       RETURNING bi.id`,
      [req.params.itemId, req.clubId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Position nicht gefunden" });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// ─── Aufgaben ─────────────────────────────────────────────────────────────────

const TEMPLATE_TASKS = [
  { title: "Veranstaltungstermin festlegen",  category: "Allgemein",      priority: "urgent" },
  { title: "Genehmigungen prüfen",            category: "Genehmigungen",  priority: "high"   },
  { title: "Musik / Band / DJ anfragen",      category: "Musik",          priority: "high"   },
  { title: "Getränkeversorgung klären",       category: "Getränke",       priority: "normal" },
  { title: "Schausteller anfragen",           category: "Schausteller",   priority: "normal" },
  { title: "Sicherheitskonzept prüfen",       category: "Sicherheit",     priority: "high"   },
  { title: "Toilettenservice organisieren",   category: "Sonstiges",      priority: "normal" },
  { title: "Helferplan erstellen",            category: "Helfer",         priority: "normal" },
  { title: "Werbung / Plakate vorbereiten",   category: "Kommunikation",  priority: "normal" },
  { title: "Veranstaltung veröffentlichen",   category: "Kommunikation",  priority: "low"    },
];

// POST /api/festplaner/:id/tasks/template — VOR /:id/tasks/:taskId registrieren!
router.post("/:id/tasks/template", requireAuth, async (req, res) => {
  try {
    const check = await pool.query(
      `SELECT id FROM festival_projects WHERE id = $1 AND club_id = $2`,
      [req.params.id, req.clubId]
    );
    if (!check.rows[0]) return res.status(404).json({ error: "Fest nicht gefunden" });

    const values = TEMPLATE_TASKS.map((t, i) => {
      const base = i * 4;
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 4 + 1})`;
    }).join(", ");

    // Flatten params: [festival_id, club_id, title, category, priority, ...]
    const params = TEMPLATE_TASKS.flatMap((t) => [
      req.params.id, req.clubId, t.title, t.category, t.priority,
    ]);

    // Use a single multi-row insert
    let placeholders = [];
    let flat = [];
    TEMPLATE_TASKS.forEach((t, i) => {
      const b = i * 5 + 1;
      placeholders.push(`($${b}, $${b+1}, $${b+2}, $${b+3}, $${b+4})`);
      flat.push(req.params.id, req.clubId, t.title, t.category, t.priority);
    });

    await pool.query(
      `INSERT INTO festival_tasks (festival_id, club_id, title, category, priority)
       VALUES ${placeholders.join(", ")}`,
      flat
    );
    res.status(201).json({ created: TEMPLATE_TASKS.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// GET /api/festplaner/:id/tasks
router.get("/:id/tasks", requireAuth, async (req, res) => {
  try {
    const check = await pool.query(
      `SELECT id FROM festival_projects WHERE id = $1 AND club_id = $2`,
      [req.params.id, req.clubId]
    );
    if (!check.rows[0]) return res.status(404).json({ error: "Fest nicht gefunden" });

    const result = await pool.query(
      `SELECT
         ft.*,
         CASE ft.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END AS priority_order,
         CASE WHEN m.id IS NOT NULL THEN m.first_name || ' ' || m.last_name ELSE NULL END AS assigned_name
       FROM festival_tasks ft
       LEFT JOIN members m ON m.id = ft.assigned_to
       WHERE ft.festival_id = $1
       ORDER BY
         CASE ft.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END,
         ft.due_date NULLS LAST,
         ft.created_at`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// POST /api/festplaner/:id/tasks
router.post("/:id/tasks", requireAuth, async (req, res) => {
  const { title, description, category, status, priority, assigned_to, due_date } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: "Titel erforderlich" });

  try {
    const check = await pool.query(
      `SELECT id FROM festival_projects WHERE id = $1 AND club_id = $2`,
      [req.params.id, req.clubId]
    );
    if (!check.rows[0]) return res.status(404).json({ error: "Fest nicht gefunden" });

    const result = await pool.query(
      `INSERT INTO festival_tasks
         (festival_id, club_id, title, description, category, status, priority, assigned_to, due_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        req.params.id, req.clubId, title.trim(),
        description || null, category || null,
        status || "open", priority || "normal",
        assigned_to || null, due_date || null,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// PATCH /api/festplaner/:id/tasks/:taskId
router.patch("/:id/tasks/:taskId", requireAuth, async (req, res) => {
  const ALLOWED = ["title", "description", "category", "status", "priority", "assigned_to", "due_date"];
  const updates = Object.fromEntries(
    Object.entries(req.body).filter(([k]) => ALLOWED.includes(k))
  );
  if (!Object.keys(updates).length) return res.status(400).json({ error: "Keine gültigen Felder" });

  try {
    const check = await pool.query(
      `SELECT ft.id FROM festival_tasks ft
       JOIN festival_projects fp ON fp.id = ft.festival_id
       WHERE ft.id = $1 AND fp.club_id = $2`,
      [req.params.taskId, req.clubId]
    );
    if (!check.rows[0]) return res.status(404).json({ error: "Aufgabe nicht gefunden" });

    const keys = Object.keys(updates);
    const vals = Object.values(updates);
    const setClauses = keys.map((k, i) => `${k} = $${i + 1}`).join(", ");
    const result = await pool.query(
      `UPDATE festival_tasks SET ${setClauses}, updated_at = now() WHERE id = $${keys.length + 1} RETURNING *`,
      [...vals, req.params.taskId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// DELETE /api/festplaner/:id/tasks/:taskId
router.delete("/:id/tasks/:taskId", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM festival_tasks ft
       USING festival_projects fp
       WHERE ft.id = $1 AND ft.festival_id = fp.id AND fp.club_id = $2
       RETURNING ft.id`,
      [req.params.taskId, req.clubId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Aufgabe nicht gefunden" });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// ─── Anfragen (Angebotsanfragen) ───────────────────────────────────────────────

// GET /api/festplaner/:id/inquiries
router.get("/:id/inquiries", requireAuth, async (req, res) => {
  try {
    const check = await pool.query(
      `SELECT id FROM festival_projects WHERE id = $1 AND club_id = $2`,
      [req.params.id, req.clubId]
    );
    if (!check.rows[0]) return res.status(404).json({ error: "Fest nicht gefunden" });

    const result = await pool.query(
      `SELECT
         fpi.*,
         p.company_name,
         p.email
       FROM festival_provider_inquiries fpi
       JOIN providers p ON p.id = fpi.provider_id
       WHERE fpi.festival_id = $1
       ORDER BY fpi.created_at DESC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// POST /api/festplaner/:id/inquiries – Anfrage erstellen
router.post("/:id/inquiries", requireAuth, async (req, res) => {
  const { provider_id, subject, message, status } = req.body;
  if (!provider_id) return res.status(400).json({ error: "provider_id erforderlich" });

  const validStatus = ["draft", "sent", "replied", "accepted", "declined", "archived"];
  const reqStatus = status && validStatus.includes(status) ? status : "draft";

  try {
    const check = await pool.query(
      `SELECT id FROM festival_projects WHERE id = $1 AND club_id = $2`,
      [req.params.id, req.clubId]
    );
    if (!check.rows[0]) return res.status(404).json({ error: "Fest nicht gefunden" });

    const sentAt = reqStatus === "sent" ? new Date() : null;
    const result = await pool.query(
      `INSERT INTO festival_provider_inquiries
         (festival_id, provider_id, club_id, subject, message, status, sent_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [req.params.id, provider_id, req.clubId, subject || null, message || null, reqStatus, sentAt]
    );

    const row = result.rows[0];
    if (reqStatus === "sent") {
      return res.status(201).json({ ...row, info: "Anfrage gespeichert. E-Mail-Versand wird später ergänzt." });
    }
    res.status(201).json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// PATCH /api/festplaner/:id/inquiries/:inquiryId
router.patch("/:id/inquiries/:inquiryId", requireAuth, async (req, res) => {
  const ALLOWED = ["subject", "message", "status"];
  const updates = Object.fromEntries(
    Object.entries(req.body).filter(([k]) => ALLOWED.includes(k))
  );
  if (!Object.keys(updates).length) return res.status(400).json({ error: "Keine gültigen Felder" });

  try {
    const check = await pool.query(
      `SELECT fpi.id FROM festival_provider_inquiries fpi
       JOIN festival_projects fp ON fp.id = fpi.festival_id
       WHERE fpi.id = $1 AND fp.club_id = $2`,
      [req.params.inquiryId, req.clubId]
    );
    if (!check.rows[0]) return res.status(404).json({ error: "Anfrage nicht gefunden" });

    const keys = Object.keys(updates);
    const vals = Object.values(updates);
    const setClauses = keys.map((k, i) => `${k} = $${i + 1}`).join(", ");
    const result = await pool.query(
      `UPDATE festival_provider_inquiries SET ${setClauses}, updated_at = now() WHERE id = $${keys.length + 1} RETURNING *`,
      [...vals, req.params.inquiryId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// POST /api/festplaner/:id/inquiries/:inquiryId/send – Anfrage als gesendet markieren
router.post("/:id/inquiries/:inquiryId/send", requireAuth, async (req, res) => {
  try {
    const check = await pool.query(
      `SELECT fpi.id FROM festival_provider_inquiries fpi
       JOIN festival_projects fp ON fp.id = fpi.festival_id
       WHERE fpi.id = $1 AND fp.club_id = $2`,
      [req.params.inquiryId, req.clubId]
    );
    if (!check.rows[0]) return res.status(404).json({ error: "Anfrage nicht gefunden" });

    const result = await pool.query(
      `UPDATE festival_provider_inquiries
       SET status = 'sent', sent_at = now(), updated_at = now()
       WHERE id = $1 RETURNING *`,
      [req.params.inquiryId]
    );
    res.json({ ...result.rows[0], info: "Anfrage gespeichert. E-Mail-Versand wird später ergänzt." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

module.exports = router;
