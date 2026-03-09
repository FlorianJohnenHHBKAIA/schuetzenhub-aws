const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");

function signToken(userId, email) {
  return jwt.sign(
    { sub: userId, email },
    process.env.JWT_SECRET,
    { expiresIn: "30d" }
  );
}

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "E-Mail und Passwort erforderlich" });
  }

  try {
    const userRes = await pool.query(
      "SELECT * FROM auth_users WHERE email = $1",
      [email.toLowerCase().trim()]
    );
    const user = userRes.rows[0];

    if (!user) {
      return res.status(401).json({ error: "Ungültige Anmeldedaten" });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: "Ungültige Anmeldedaten" });
    }

    const token = signToken(user.id, user.email);
    res.json({ token, userId: user.id, email: user.email });
  } catch (err) {
    console.error("Login-Fehler:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// POST /api/auth/register – Selbstregistrierung als Interessent
router.post("/register", async (req, res) => {
  const { email, password, firstName, lastName, clubId } = req.body;
  if (!email || !password || !firstName || !lastName || !clubId) {
    return res.status(400).json({ error: "Alle Felder sind erforderlich" });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Passwort mindestens 6 Zeichen" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Club prüfen
    const clubRes = await client.query(
      "SELECT id, name FROM clubs WHERE id = $1",
      [clubId]
    );
    if (!clubRes.rows[0]) {
      return res.status(404).json({ error: "Verein nicht gefunden" });
    }

    // E-Mail-Duplikat prüfen
    const existingUser = await client.query(
      "SELECT id FROM auth_users WHERE email = $1",
      [email.toLowerCase().trim()]
    );
    if (existingUser.rows[0]) {
      return res
        .status(409)
        .json({ error: "Diese E-Mail-Adresse ist bereits registriert" });
    }

    const userId = uuidv4();
    const passwordHash = await bcrypt.hash(password, 12);

    await client.query(
      "INSERT INTO auth_users (id, email, password_hash) VALUES ($1, $2, $3)",
      [userId, email.toLowerCase().trim(), passwordHash]
    );

    const memberId = uuidv4();
    await client.query(
      `INSERT INTO members (id, club_id, user_id, first_name, last_name, email, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'prospect')`,
      [memberId, clubId, userId, firstName, lastName, email.toLowerCase().trim()]
    );

    await client.query(
      `INSERT INTO user_roles (id, user_id, club_id, role)
       VALUES ($1, $2, $3, 'member')`,
      [uuidv4(), userId, clubId]
    );

    await client.query("COMMIT");

    const token = signToken(userId, email.toLowerCase().trim());
    res.status(201).json({ token, userId, email: email.toLowerCase().trim() });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Registrierungs-Fehler:", err);
    res.status(500).json({ error: "Serverfehler" });
  } finally {
    client.release();
  }
});

// POST /api/auth/setup – Erstmalige Vereinseinrichtung
router.post("/setup", async (req, res) => {
  const { clubName, clubSlug, city, firstName, lastName, email, password } =
    req.body;

  if (!clubName || !clubSlug || !firstName || !lastName || !email || !password) {
    return res.status(400).json({ error: "Alle Pflichtfelder ausfüllen" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Slug prüfen
    const slugCheck = await client.query(
      "SELECT id FROM clubs WHERE slug = $1",
      [clubSlug]
    );
    if (slugCheck.rows[0]) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Dieser URL-Slug ist bereits vergeben" });
    }

    // E-Mail prüfen
    const emailCheck = await client.query(
      "SELECT id FROM auth_users WHERE email = $1",
      [email.toLowerCase().trim()]
    );
    if (emailCheck.rows[0]) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Diese E-Mail-Adresse ist bereits registriert" });
    }

    // Verein anlegen
    const clubId = uuidv4();
    await client.query(
      `INSERT INTO clubs (id, name, slug, city) VALUES ($1, $2, $3, $4)`,
      [clubId, clubName, clubSlug, city || null]
    );

    // Standard-Kompanie anlegen
    const companyId = uuidv4();
    await client.query(
      `INSERT INTO companies (id, club_id, name) VALUES ($1, $2, '1. Kompanie')`,
      [companyId, clubId]
    );

    // Admin-User anlegen
    const userId = uuidv4();
    const passwordHash = await bcrypt.hash(password, 12);
    await client.query(
      "INSERT INTO auth_users (id, email, password_hash) VALUES ($1, $2, $3)",
      [userId, email.toLowerCase().trim(), passwordHash]
    );

    // Admin-Mitglied anlegen
    const memberId = uuidv4();
    await client.query(
      `INSERT INTO members (id, club_id, user_id, first_name, last_name, email, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'active')`,
      [memberId, clubId, userId, firstName, lastName, email.toLowerCase().trim()]
    );

    // Admin-Rolle vergeben
    await client.query(
      `INSERT INTO user_roles (id, user_id, club_id, role) VALUES ($1, $2, $3, 'admin')`,
      [uuidv4(), userId, clubId]
    );

    await client.query("COMMIT");

    const token = signToken(userId, email.toLowerCase().trim());
    res.status(201).json({
      token,
      userId,
      clubId,
      clubSlug,
      message: "Verein erfolgreich eingerichtet",
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Setup-Fehler:", err);
    res.status(500).json({ error: "Serverfehler: " + err.message });
  } finally {
    client.release();
  }
});

// GET /api/auth/me – aktueller User + Member
router.get("/me", requireAuth, async (req, res) => {
  try {
    const permissions = await pool.query(
      `SELECT p.key as permission_key, mra.scope_type, mra.scope_id
       FROM member_role_assignments mra
       JOIN roles r ON r.id = mra.role_id
       JOIN role_permissions rp ON rp.role_id = r.id
       JOIN permissions p ON p.id = rp.permission_id
       WHERE mra.member_id = $1`,
      [req.member.id]
    );

    const roleRes = await pool.query(
      "SELECT role, club_id FROM user_roles WHERE user_id = $1 LIMIT 1",
      [req.userId]
    );

    res.json({
      member: req.member,
      userRole: roleRes.rows[0] || null,
      permissions: permissions.rows,
    });
  } catch (err) {
    console.error("Me-Fehler:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// POST /api/auth/create-member-account – Admin erstellt Konto für Mitglied
router.post("/create-member-account", requireAuth, async (req, res) => {
  if (!req.isAdmin) {
    return res.status(403).json({ error: "Administratorrechte erforderlich" });
  }

  const { memberId, password } = req.body;
  if (!memberId || !password) {
    return res.status(400).json({ error: "memberId und password erforderlich" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const memberRes = await client.query(
      "SELECT * FROM members WHERE id = $1 AND club_id = $2",
      [memberId, req.clubId]
    );
    const member = memberRes.rows[0];
    if (!member) {
      return res.status(404).json({ error: "Mitglied nicht gefunden" });
    }
    if (member.user_id) {
      return res.status(409).json({ error: "Mitglied hat bereits ein Konto" });
    }

    // Prüfen ob E-Mail bereits als User existiert
    const existingUser = await client.query(
      "SELECT id FROM auth_users WHERE email = $1",
      [member.email]
    );
    if (existingUser.rows[0]) {
      return res.status(409).json({ error: "E-Mail bereits vergeben" });
    }

    const userId = uuidv4();
    const passwordHash = await bcrypt.hash(password, 12);
    await client.query(
      "INSERT INTO auth_users (id, email, password_hash) VALUES ($1, $2, $3)",
      [userId, member.email, passwordHash]
    );

    await client.query("UPDATE members SET user_id = $1 WHERE id = $2", [
      userId,
      memberId,
    ]);

    await client.query(
      `INSERT INTO user_roles (id, user_id, club_id, role) VALUES ($1, $2, $3, 'member')
       ON CONFLICT (user_id, club_id) DO NOTHING`,
      [uuidv4(), userId, req.clubId]
    );

    await client.query("COMMIT");
    res.json({ message: "Konto erfolgreich erstellt" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Create-member-account-Fehler:", err);
    res.status(500).json({ error: "Serverfehler" });
  } finally {
    client.release();
  }
});

module.exports = router;
