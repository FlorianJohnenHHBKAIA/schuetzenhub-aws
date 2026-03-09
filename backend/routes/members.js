const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");
const multer = require("multer");
const { saveFile, getPublicUrl } = require("../storage");

const upload = multer({ dest: "tmp/" });

// GET /api/members – alle Mitglieder des Vereins
router.get("/", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT m.*, 
        ARRAY_AGG(DISTINCT mcm.company_id) FILTER (WHERE mcm.company_id IS NOT NULL AND mcm.valid_to IS NULL) as company_ids
       FROM members m
       LEFT JOIN member_company_memberships mcm ON mcm.member_id = m.id AND mcm.valid_to IS NULL
       WHERE m.club_id = $1
       GROUP BY m.id
       ORDER BY m.last_name ASC`,
      [req.clubId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// GET /api/members/:id
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM members WHERE id = $1 AND club_id = $2",
      [req.params.id, req.clubId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Nicht gefunden" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// POST /api/members
router.post("/", requireAuth, async (req, res) => {
  const {
    first_name, last_name, email, phone, street, zip, city, status,
    birthday, member_since,
  } = req.body;

  if (!first_name || !last_name || !email) {
    return res.status(400).json({ error: "Pflichtfelder fehlen" });
  }

  try {
    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO members (id, club_id, first_name, last_name, email, phone, street, zip, city, status, birthday, member_since)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [id, req.clubId, first_name, last_name, email, phone || null,
       street || null, zip || null, city || null,
       status || "prospect", birthday || null, member_since || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "E-Mail bereits vorhanden" });
    }
    console.error(err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// PUT /api/members/:id
router.put("/:id", requireAuth, async (req, res) => {
  const {
    first_name, last_name, email, phone, street, zip, city, status,
    birthday, member_since,
  } = req.body;

  try {
    const result = await pool.query(
      `UPDATE members SET
        first_name = COALESCE($1, first_name),
        last_name = COALESCE($2, last_name),
        email = COALESCE($3, email),
        phone = $4, street = $5, zip = $6, city = $7,
        status = COALESCE($8, status),
        birthday = $9,
        member_since = $10,
        updated_at = now()
       WHERE id = $11 AND club_id = $12
       RETURNING *`,
      [first_name, last_name, email, phone || null, street || null,
       zip || null, city || null, status, birthday || null,
       member_since || null, req.params.id, req.clubId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Nicht gefunden" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// DELETE /api/members/:id
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    await pool.query(
      "DELETE FROM members WHERE id = $1 AND club_id = $2",
      [req.params.id, req.clubId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// POST /api/members/:id/avatar – Avatar hochladen
router.post("/:id/avatar", requireAuth, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Keine Datei" });

  const ext = req.file.originalname.split(".").pop();
  const destPath = `${req.params.id}/avatar.${ext}`;

  try {
    const url = await saveFile(req.file, "avatars", destPath);
    await pool.query(
      "UPDATE members SET avatar_url = $1 WHERE id = $2 AND club_id = $3",
      [destPath, req.params.id, req.clubId]
    );
    res.json({ url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Upload fehlgeschlagen" });
  }
});

// GET /api/members/:id/permissions
router.get("/:id/permissions", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.key as permission_key, mra.scope_type, mra.scope_id
       FROM member_role_assignments mra
       JOIN roles r ON r.id = mra.role_id
       JOIN role_permissions rp ON rp.role_id = r.id
       JOIN permissions p ON p.id = rp.permission_id
       WHERE mra.member_id = $1`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

module.exports = router;
