const jwt = require("jsonwebtoken");
const pool = require("../db");

/**
 * Middleware: Prüft JWT-Token und hängt user + member an req.
 */
async function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Nicht autorisiert" });
  }

  const token = auth.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.sub;
    req.userEmail = payload.email;

    const userRes = await pool.query(
      "SELECT id, email, is_superadmin FROM auth_users WHERE id = $1",
      [req.userId]
    );
    const authUser = userRes.rows[0];
    if (!authUser) {
      return res.status(401).json({ error: "Benutzer nicht gefunden" });
    }

    req.userEmail = authUser.email;
    req.isSuperAdmin = authUser.is_superadmin === true;

    // Member + Rolle laden
    const memberRes = await pool.query(
      `SELECT m.*, ur.role as app_role
       FROM members m
       LEFT JOIN user_roles ur ON ur.user_id = m.user_id AND ur.club_id = m.club_id
       WHERE m.user_id = $1
       LIMIT 1`,
      [req.userId]
    );

    if (!memberRes.rows[0]) {
      // Superadmin-Fallback: kein Mitglied nötig
      if (req.isSuperAdmin) {
        req.isAdmin = false;
        return next();
      }
      return res.status(401).json({ error: "Mitglied nicht gefunden" });
    }

    req.member = memberRes.rows[0];
    req.clubId = req.member.club_id;
    req.isAdmin = req.member.app_role === "admin";

    next();
  } catch (err) {
    return res.status(401).json({ error: "Ungültiger Token" });
  }
}

/**
 * Middleware: Nur Admins dürfen weiter.
 */
function requireAdmin(req, res, next) {
  if (!req.isAdmin) {
    return res.status(403).json({ error: "Administratorrechte erforderlich" });
  }
  next();
}

/**
 * Hilfsfunktion: Berechtigungen eines Users abfragen.
 */
async function getUserPermissions(userId, clubId) {
  const res = await pool.query(
    `SELECT p.key as permission_key, rp_scope.scope_type, rp_scope.scope_id
     FROM members m
     JOIN member_role_assignments mra ON mra.member_id = m.id
     JOIN roles r ON r.id = mra.role_id
     JOIN role_permissions rp ON rp.role_id = r.id
     JOIN permissions p ON p.id = rp.permission_id
     LEFT JOIN LATERAL (
       SELECT mra2.scope_type, mra2.scope_id
       FROM member_role_assignments mra2
       WHERE mra2.id = mra.id
     ) rp_scope ON true
     WHERE m.user_id = $1 AND m.club_id = $2`,
    [userId, clubId]
  );
  return res.rows;
}

/**
 * Middleware: Blockiert prospect/resigned User von sensitiven Endpunkten.
 */
function requireActiveMember(req, res, next) {
  const status = req.member?.status;
  if (status === 'prospect') {
    return res.status(403).json({ error: "Dein Konto wartet noch auf Freigabe durch den Administrator" });
  }
  if (status === 'resigned') {
    return res.status(403).json({ error: "Dein Konto hat keinen aktiven Status" });
  }
  next();
}

/**
 * Middleware: Nur Superadmins (is_superadmin = true in auth_users) dürfen weiter.
 * Kein members-Join notwendig – direkte Prüfung auf auth_users.
 */
async function requireSuperAdmin(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Nicht autorisiert" });
  }
  const token = auth.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const userRes = await pool.query(
      "SELECT id, email FROM auth_users WHERE id = $1 AND is_superadmin = true",
      [payload.sub]
    );
    if (!userRes.rows[0]) {
      return res.status(403).json({ error: "Superadmin-Rechte erforderlich" });
    }
    req.userId = userRes.rows[0].id;
    req.userEmail = userRes.rows[0].email;
    req.isSuperAdmin = true;
    next();
  } catch {
    return res.status(401).json({ error: "Ungültiger Token" });
  }
}

module.exports = { requireAuth, requireAdmin, requireSuperAdmin, getUserPermissions, requireActiveMember };
