const express = require("express");
const bcrypt = require("bcrypt");
const multer = require("multer");
const path = require("path");
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");
const { saveFile, getPublicUrl } = require("../storage");

const router = express.Router();
const upload = multer({ dest: "tmp/" });

const notificationDefaults = {
  email_enabled: true,
  push_enabled: false,
  digest_frequency: "weekly",
  notify_posts: true,
  notify_events: true,
  notify_comments: true,
  notify_workshifts: true,
  notify_reminders: false,
  notify_system: true,
  email_important: true,
  email_info: false,
  push_important: true,
  push_reminders: false,
  quiet_hours_enabled: true,
  quiet_hours_start: "21:00:00",
  quiet_hours_end: "08:00:00",
};

const notificationFields = Object.keys(notificationDefaults);
const booleanNotificationFields = notificationFields.filter((key) => typeof notificationDefaults[key] === "boolean");

function requireMemberAccount(req, res, next) {
  if (!req.member) {
    return res.status(403).json({ error: "Kontoeinstellungen sind nur fuer Mitglieder verfuegbar" });
  }
  next();
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

function validatePassword(password) {
  if (typeof password !== "string" || password.length < 8) {
    return "Das Passwort muss mindestens 8 Zeichen lang sein.";
  }
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
    return "Das Passwort muss Gross- und Kleinbuchstaben sowie eine Zahl enthalten.";
  }
  return null;
}

async function ensureNotificationSettings(memberId) {
  const existing = await pool.query(
    "SELECT * FROM member_notification_settings WHERE member_id = $1",
    [memberId]
  );
  if (existing.rows[0]) return existing.rows[0];

  const fields = Object.keys(notificationDefaults);
  const placeholders = fields.map((_, i) => `$${i + 2}`).join(", ");
  const result = await pool.query(
    `INSERT INTO member_notification_settings (member_id, ${fields.join(", ")})
     VALUES ($1, ${placeholders})
     RETURNING *`,
    [memberId, ...fields.map((field) => notificationDefaults[field])]
  );
  return result.rows[0];
}

async function getAccount(req) {
  const [memberRes, roleRes, notificationRes] = await Promise.all([
    pool.query(
      `SELECT id, club_id, user_id, first_name, last_name, email, phone, status, avatar_url,
              street, zip, city, birthday, member_since, title, bio, created_at
       FROM members
       WHERE id = $1 AND club_id = $2`,
      [req.member.id, req.clubId]
    ),
    pool.query("SELECT role, club_id FROM user_roles WHERE user_id = $1 AND club_id = $2 LIMIT 1", [req.userId, req.clubId]),
    ensureNotificationSettings(req.member.id),
  ]);

  return {
    member: memberRes.rows[0],
    role: roleRes.rows[0] || null,
    notifications: notificationRes,
  };
}

// GET /api/account - current member profile, role and notification preferences.
router.get("/", requireAuth, requireMemberAccount, async (req, res) => {
  try {
    res.json(await getAccount(req));
  } catch (err) {
    console.error("GET /account error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// PATCH /api/account/profile - update editable personal profile fields.
router.patch("/profile", requireAuth, requireMemberAccount, async (req, res) => {
  const firstName = String(req.body.first_name || "").trim();
  const lastName = String(req.body.last_name || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const phone = req.body.phone ? String(req.body.phone).trim() : null;

  if (!firstName || !lastName) return res.status(400).json({ error: "Vorname und Nachname sind erforderlich" });
  if (!validateEmail(email)) return res.status(400).json({ error: "Bitte geben Sie eine gueltige E-Mail-Adresse ein" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const duplicate = await client.query(
      "SELECT id FROM auth_users WHERE lower(email) = lower($1) AND id <> $2",
      [email, req.userId]
    );
    if (duplicate.rows[0]) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Diese E-Mail-Adresse wird bereits verwendet" });
    }

    await client.query("UPDATE auth_users SET email = $1 WHERE id = $2", [email, req.userId]);
    const updated = await client.query(
      `UPDATE members
       SET first_name = $1, last_name = $2, email = $3, phone = $4
       WHERE id = $5 AND club_id = $6
       RETURNING id, club_id, user_id, first_name, last_name, email, phone, status, avatar_url,
                 street, zip, city, birthday, member_since, title, bio, created_at`,
      [firstName, lastName, email, phone, req.member.id, req.clubId]
    );

    await client.query("COMMIT");
    res.json(updated.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("PATCH /account/profile error:", err);
    res.status(500).json({ error: "Profil konnte nicht gespeichert werden" });
  } finally {
    client.release();
  }
});

// POST /api/account/avatar - upload and attach the member profile image.
router.post("/avatar", requireAuth, requireMemberAccount, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Keine Datei hochgeladen" });
  if (!req.file.mimetype.startsWith("image/")) return res.status(400).json({ error: "Nur Bilddateien sind erlaubt" });

  const ext = path.extname(req.file.originalname).replace(".", "") || "jpg";
  const destPath = `${req.member.id}/avatar.${ext}`;

  try {
    const url = await saveFile(req.file, "avatars", destPath);
    await pool.query(
      "UPDATE members SET avatar_url = $1 WHERE id = $2 AND club_id = $3",
      [destPath, req.member.id, req.clubId]
    );
    res.json({ avatar_url: destPath, url });
  } catch (err) {
    console.error("POST /account/avatar error:", err);
    res.status(500).json({ error: "Profilbild konnte nicht gespeichert werden" });
  }
});

// POST /api/account/password - change password after current-password verification.
router.post("/password", requireAuth, requireMemberAccount, async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  if (!currentPassword || !newPassword || !confirmPassword) return res.status(400).json({ error: "Alle Passwortfelder sind erforderlich" });
  if (newPassword !== confirmPassword) return res.status(400).json({ error: "Die neuen Passwoerter stimmen nicht ueberein" });

  const passwordError = validatePassword(newPassword);
  if (passwordError) return res.status(400).json({ error: passwordError });

  try {
    const userRes = await pool.query("SELECT password_hash FROM auth_users WHERE id = $1", [req.userId]);
    const valid = await bcrypt.compare(currentPassword, userRes.rows[0]?.password_hash || "");
    if (!valid) return res.status(401).json({ error: "Das aktuelle Passwort ist falsch" });

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await pool.query("UPDATE auth_users SET password_hash = $1 WHERE id = $2", [passwordHash, req.userId]);
    res.json({ success: true });
  } catch (err) {
    console.error("POST /account/password error:", err);
    res.status(500).json({ error: "Passwort konnte nicht geaendert werden" });
  }
});

// PUT /api/account/notifications - save self-service notification preferences.
router.put("/notifications", requireAuth, requireMemberAccount, async (req, res) => {
  const updates = {};
  for (const field of notificationFields) {
    if (!(field in req.body)) continue;
    if (booleanNotificationFields.includes(field)) {
      updates[field] = req.body[field] === true;
    } else if (field === "digest_frequency") {
      if (!["none", "daily", "weekly"].includes(req.body[field])) {
        return res.status(400).json({ error: "Ungueltige Digest-Einstellung" });
      }
      updates[field] = req.body[field];
    } else {
      updates[field] = String(req.body[field]);
    }
  }

  if (Object.keys(updates).length === 0) return res.status(400).json({ error: "Keine gueltigen Felder" });

  try {
    await ensureNotificationSettings(req.member.id);
    const fields = Object.keys(updates);
    const setClause = fields.map((field, i) => `${field} = $${i + 2}`).join(", ");
    const result = await pool.query(
      `UPDATE member_notification_settings
       SET ${setClause}, updated_at = now()
       WHERE member_id = $1
       RETURNING *`,
      [req.member.id, ...fields.map((field) => updates[field])]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("PUT /account/notifications error:", err);
    res.status(500).json({ error: "Benachrichtigungen konnten nicht gespeichert werden" });
  }
});

// GET /api/account/export - JSON export of personal account data for GDPR access requests.
router.get("/export", requireAuth, requireMemberAccount, async (req, res) => {
  try {
    const [account, companiesRes, awardsRes, notificationsRes] = await Promise.all([
      getAccount(req),
      pool.query(
        `SELECT c.id, c.name, mcm.valid_from, mcm.valid_to
         FROM member_company_memberships mcm
         JOIN companies c ON c.id = mcm.company_id
         WHERE mcm.member_id = $1`,
        [req.member.id]
      ),
      pool.query(
        "SELECT id, title, award_type, status, awarded_at, created_at FROM member_awards WHERE member_id = $1",
        [req.member.id]
      ),
      pool.query(
        "SELECT id, type, title, message, is_read, created_at FROM notifications WHERE recipient_member_id = $1 ORDER BY created_at DESC",
        [req.member.id]
      ),
    ]);

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="konto-export-${req.member.id}.json"`);
    res.json({
      exported_at: new Date().toISOString(),
      account,
      memberships: companiesRes.rows,
      awards: awardsRes.rows,
      notifications: notificationsRes.rows,
      legal_note: "Vereins-, Buchhaltungs- und Nachweisdaten koennen gesetzlichen Aufbewahrungspflichten unterliegen.",
    });
  } catch (err) {
    console.error("GET /account/export error:", err);
    res.status(500).json({ error: "Export konnte nicht erstellt werden" });
  }
});

// POST /api/account/deactivate - request deletion and deactivate login while retaining legally relevant records.
router.post("/deactivate", requireAuth, requireMemberAccount, async (req, res) => {
  const { password, confirmText, reason } = req.body;
  if (confirmText !== "ACCOUNT LOESCHEN") {
    return res.status(400).json({ error: "Bitte geben Sie den Bestaetigungstext exakt ein" });
  }
  if (!password) return res.status(400).json({ error: "Passwortbestaetigung erforderlich" });

  const client = await pool.connect();
  try {
    const userRes = await client.query("SELECT password_hash FROM auth_users WHERE id = $1", [req.userId]);
    const valid = await bcrypt.compare(password, userRes.rows[0]?.password_hash || "");
    if (!valid) return res.status(401).json({ error: "Das Passwort ist falsch" });

    await client.query("BEGIN");
    await client.query(
      `UPDATE auth_users
       SET deactivated_at = now(), deletion_requested_at = now(), deletion_reason = $1
       WHERE id = $2`,
      [reason ? String(reason).trim() : null, req.userId]
    );
    await client.query(
      "UPDATE members SET status = 'resigned' WHERE id = $1 AND club_id = $2",
      [req.member.id, req.clubId]
    );
    await client.query("COMMIT");
    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST /account/deactivate error:", err);
    res.status(500).json({ error: "Account konnte nicht deaktiviert werden" });
  } finally {
    client.release();
  }
});

module.exports = router;
