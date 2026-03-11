/**
 * RPC & Functions Endpoints
 * Ersetzt Supabase RPC-Calls und Edge Functions
 */
const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");

// ─── RPC Emulation ────────────────────────────────────────────────────────────

// POST /api/rpc/get_user_permissions
router.post("/get_user_permissions", requireAuth, async (req, res) => {
  try {
    const { _user_id, _club_id } = req.body;
    const clubId = _club_id || req.clubId;

    // Hole Mitglied
    const memberResult = await pool.query(
      "SELECT id FROM members WHERE club_id = $1 AND user_id = $2 LIMIT 1",
      [clubId, req.userId]
    );
    if (!memberResult.rows[0]) return res.json([]);
    const memberId = memberResult.rows[0].id;

    // Hole Rolle des Mitglieds
    const appointmentResult = await pool.query(
      `SELECT r.id as role_id, r.name as role_name, rp.permission_id, p.key as permission_key
       FROM appointments a
       JOIN roles r ON r.id = a.role_id
       JOIN role_permissions rp ON rp.role_id = r.id
       JOIN permissions p ON p.id = rp.permission_id
       WHERE a.member_id = $1
         AND (a.valid_to IS NULL OR a.valid_to > NOW())
         AND a.club_id = $2`,
      [memberId, clubId]
    );

    // Füge company-scope Permissions hinzu
    const companyResult = await pool.query(
      `SELECT mcm.company_id, rp.permission_id, p.key as permission_key
       FROM member_company_memberships mcm
       JOIN appointments a ON a.member_id = mcm.member_id
       JOIN role_permissions rp ON rp.role_id = a.role_id
       JOIN permissions p ON p.id = rp.permission_id
       WHERE mcm.member_id = $1
         AND mcm.valid_to IS NULL`,
      [memberId]
    );

    const clubPerms = appointmentResult.rows.map(r => ({
      permission_key: r.permission_key,
      scope_type: "club",
      scope_id: clubId,
    }));

    const companyPerms = companyResult.rows.map(r => ({
      permission_key: r.permission_key,
      scope_type: "company",
      scope_id: r.company_id,
    }));

    res.json([...clubPerms, ...companyPerms]);
  } catch (err) {
    console.error("RPC get_user_permissions error:", err);
    res.json([]);
  }
});

// POST /api/rpc/get_work_hours
router.post("/get_work_hours", requireAuth, async (req, res) => {
  try {
    const { _club_id, _year } = req.body;
    const year = _year || new Date().getFullYear();
    const clubId = _club_id || req.clubId;

    const result = await pool.query(
      `SELECT 
         m.id as member_id,
         m.first_name,
         m.last_name,
         COUNT(wsa.id) as shift_count,
         COALESCE(SUM(
           CASE WHEN wsa.hours_override IS NOT NULL 
             THEN wsa.hours_override::numeric
             ELSE EXTRACT(EPOCH FROM (ws.end_at - ws.start_at)) / 3600
           END
         ), 0) as total_hours
       FROM members m
       LEFT JOIN work_shift_assignments wsa ON wsa.member_id = m.id AND wsa.status = 'completed'
       LEFT JOIN work_shifts ws ON ws.id = wsa.work_shift_id 
         AND EXTRACT(YEAR FROM ws.start_at) = $2
       WHERE m.club_id = $1 AND m.status = 'active'
       GROUP BY m.id, m.first_name, m.last_name
       ORDER BY total_hours DESC`,
      [clubId, year]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("RPC get_work_hours error:", err);
    res.json([]);
  }
});

// POST /api/rpc/get_company_work_stats
router.post("/get_company_work_stats", requireAuth, async (req, res) => {
  try {
    const { _club_id, _year } = req.body;
    const year = _year || new Date().getFullYear();
    const clubId = _club_id || req.clubId;

    const result = await pool.query(
      `SELECT 
         c.id as company_id,
         c.name as company_name,
         COUNT(DISTINCT wsa.member_id) as members_participated,
         COALESCE(SUM(
           CASE WHEN wsa.hours_override IS NOT NULL 
             THEN wsa.hours_override::numeric
             ELSE EXTRACT(EPOCH FROM (ws.end_at - ws.start_at)) / 3600
           END
         ), 0) as total_hours
       FROM companies c
       LEFT JOIN member_company_memberships mcm ON mcm.company_id = c.id AND mcm.valid_to IS NULL
       LEFT JOIN work_shift_assignments wsa ON wsa.member_id = mcm.member_id AND wsa.status = 'completed'
       LEFT JOIN work_shifts ws ON ws.id = wsa.work_shift_id 
         AND EXTRACT(YEAR FROM ws.start_at) = $2
       WHERE c.club_id = $1
       GROUP BY c.id, c.name
       ORDER BY total_hours DESC`,
      [clubId, year]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("RPC get_company_work_stats error:", err);
    res.json([]);
  }
});

// ─── Functions Emulation (Edge Functions) ─────────────────────────────────────
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// POST /api/functions/create-member-account
router.post("/create-member-account", requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { memberId, email, password } = req.body;
    if (!memberId || !email || !password) {
      return res.status(400).json({ error: "Fehlende Parameter" });
    }

    // Prüfe ob Mitglied existiert und zum Club gehört
    const memberResult = await client.query(
      "SELECT id, club_id FROM members WHERE id = $1 AND club_id = $2",
      [memberId, req.clubId]
    );
    if (!memberResult.rows[0]) {
      return res.status(404).json({ error: "Mitglied nicht gefunden" });
    }

    // Prüfe ob Email bereits verwendet
    const existingUser = await client.query(
      "SELECT id FROM users WHERE email = $1",
      [email]
    );
    if (existingUser.rows[0]) {
      return res.status(409).json({ error: "E-Mail bereits vergeben" });
    }

    await client.query("BEGIN");

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = require("crypto").randomUUID();

    await client.query(
      "INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)",
      [userId, email, hashedPassword]
    );

    await client.query(
      "UPDATE members SET user_id = $1, email = $2 WHERE id = $3",
      [userId, email, memberId]
    );

    await client.query("COMMIT");
    res.json({ success: true, userId });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("create-member-account error:", err);
    res.status(500).json({ error: "Fehler beim Erstellen des Accounts" });
  } finally {
    client.release();
  }
});

module.exports = router;
