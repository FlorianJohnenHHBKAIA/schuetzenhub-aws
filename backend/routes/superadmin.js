const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const multer = require("multer");
const pool = require("../db");
const { requireSuperAdmin } = require("../middleware/auth");
const { saveFile, getPublicUrl } = require("../storage");
const { logAuditEvent, ACTIONS } = require("../utils/auditLog");

const upload = multer({ dest: "tmp/" });

function nameToSlug(name) {
  return name.toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").substring(0, 80);
}

async function uniqueSlug(base) {
  let slug = base;
  let n = 2;
  while (true) {
    const { rows } = await pool.query("SELECT id FROM clubs WHERE slug = $1", [slug]);
    if (!rows[0]) return slug;
    slug = `${base}-${n++}`;
  }
}

async function uniqueProviderSlug(base) {
  let slug = base;
  let n = 2;
  while (true) {
    const { rows } = await pool.query("SELECT id FROM providers WHERE slug = $1", [slug]);
    if (!rows[0]) return slug;
    slug = `${base}-${n++}`;
  }
}

// GET /api/superadmin/stats – Plattformweite KPIs
router.get("/stats", requireSuperAdmin, async (req, res) => {
  try {
    const [
      clubsTotal, clubsActive, clubsFree,
      usersTotal, superadminsRes, openReportsRes,
      publishedPostsRes, publishedEventsRes,
      recentPostsRes, recentEventsRes,
      openClaimRequestsRes, publicClubsRes, publicEventsRes,
      totalProvidersRes, verifiedProvidersRes, totalProviderInquiriesRes,
      newInterestRequestsRes, openContactRequestsRes, openMembershipRequestsRes,
      openAccessRequestsRes,
    ] = await Promise.all([
      pool.query("SELECT COUNT(*)::int AS count FROM clubs"),
      pool.query("SELECT COUNT(*)::int AS count FROM clubs WHERE plan IS DISTINCT FROM 'free'"),
      pool.query("SELECT COUNT(*)::int AS count FROM clubs WHERE plan = 'free' OR plan IS NULL"),
      pool.query("SELECT COUNT(*)::int AS count FROM auth_users WHERE is_superadmin = false"),
      pool.query("SELECT COUNT(*)::int AS count FROM auth_users WHERE is_superadmin = true"),
      pool.query("SELECT COUNT(*)::int AS count FROM reports WHERE status = 'open'"),
      pool.query("SELECT COUNT(*)::int AS count FROM posts WHERE publication_status = 'published'"),
      pool.query("SELECT COUNT(*)::int AS count FROM events WHERE publication_status = 'published'"),
      pool.query(`
        SELECT p.id, p.title, p.created_at, 'post' AS type, c.name AS club_name
        FROM posts p JOIN clubs c ON c.id = p.club_id
        WHERE p.publication_status = 'published'
        ORDER BY p.created_at DESC LIMIT 5
      `),
      pool.query(`
        SELECT e.id, e.title, e.created_at, 'event' AS type, c.name AS club_name
        FROM events e JOIN clubs c ON c.id = e.club_id
        WHERE e.publication_status = 'published'
        ORDER BY e.created_at DESC LIMIT 5
      `),
      pool.query("SELECT COUNT(*)::int AS count FROM club_claim_requests WHERE status = 'open'"),
      pool.query("SELECT COUNT(*)::int AS count FROM clubs WHERE is_public = true AND deleted_at IS NULL"),
      pool.query("SELECT COUNT(*)::int AS count FROM events WHERE audience = 'public' AND publication_status = 'approved'"),
      pool.query("SELECT COUNT(*)::int AS count FROM providers"),
      pool.query("SELECT COUNT(*)::int AS count FROM providers WHERE is_verified = true"),
      pool.query("SELECT COUNT(*)::int AS count FROM provider_inquiries"),
      pool.query("SELECT COUNT(*)::int AS count FROM club_interest_requests WHERE status = 'new'"),
      pool.query("SELECT COUNT(*)::int AS count FROM club_interest_requests WHERE request_type = 'club_contact' AND status IN ('new','in_progress')"),
      pool.query("SELECT COUNT(*)::int AS count FROM club_interest_requests WHERE request_type = 'membership_interest' AND status IN ('new','in_progress')"),
      pool.query("SELECT COUNT(*)::int AS count FROM club_access_requests WHERE status IN ('new','in_progress')"),
    ]);

    const recentActivity = [...recentPostsRes.rows, ...recentEventsRes.rows]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 6)
      .map((r) => ({
        id: r.id,
        title: r.title,
        type: r.type,
        clubName: r.club_name,
        createdAt: r.created_at,
      }));

    res.json({
      totalClubs: clubsTotal.rows[0].count,
      activeClubs: clubsActive.rows[0].count,
      freeClubs: clubsFree.rows[0].count,
      totalUsers: usersTotal.rows[0].count,
      superadmins: superadminsRes.rows[0].count,
      openReports: openReportsRes.rows[0].count,
      publishedPosts: publishedPostsRes.rows[0].count,
      publishedEvents: publishedEventsRes.rows[0].count,
      openClaimRequests: openClaimRequestsRes.rows[0].count,
      publicClubs: publicClubsRes.rows[0].count,
      publicEvents: publicEventsRes.rows[0].count,
      totalProviders: totalProvidersRes.rows[0].count,
      verifiedProviders: verifiedProvidersRes.rows[0].count,
      totalProviderInquiries: totalProviderInquiriesRes.rows[0].count,
      newInterestRequests: newInterestRequestsRes.rows[0].count,
      openContactRequests: openContactRequestsRes.rows[0].count,
      openMembershipRequests: openMembershipRequestsRes.rows[0].count,
      openAccessRequests: openAccessRequestsRes.rows[0].count,
      system: {
        env: process.env.NODE_ENV || "development",
        storageProvider: process.env.USE_S3 === "true" ? "s3" : "local",
        emailConfigured: false,
      },
      recentActivity,
    });
  } catch (err) {
    console.error("Superadmin stats error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// GET /api/superadmin/clubs/:id/members – Mitgliederliste eines Vereins
router.get("/clubs/:id/members", requireSuperAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(`
      SELECT
        m.id,
        m.first_name,
        m.last_name,
        m.email,
        m.status,
        m.member_since,
        m.created_at,
        ur.role                  AS system_role,
        co.name                  AS company_name,
        (
          SELECT STRING_AGG(r.name, ', ' ORDER BY r.name)
          FROM member_role_assignments mra
          JOIN roles r ON r.id = mra.role_id
          WHERE mra.member_id = m.id
        )                        AS role_names,
        (
          SELECT STRING_AGG(a.title, ', ' ORDER BY a.title)
          FROM appointments a
          WHERE a.member_id = m.id
            AND a.club_id   = m.club_id
            AND (a.valid_to IS NULL OR a.valid_to >= CURRENT_DATE)
        )                        AS appointment_titles
      FROM members m
      LEFT JOIN user_roles ur
             ON ur.user_id = m.user_id AND ur.club_id = m.club_id
      LEFT JOIN member_company_memberships mcm
             ON mcm.member_id = m.id AND mcm.valid_to IS NULL
      LEFT JOIN companies co ON co.id = mcm.company_id
      WHERE m.club_id = $1
      ORDER BY m.last_name, m.first_name
    `, [id]);

    res.json(result.rows);
  } catch (err) {
    console.error("Superadmin club members error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// GET /api/superadmin/clubs/:id – Vereinsdetails mit Aggregaten
router.get("/clubs/:id", requireSuperAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const [
      clubRes, memberStatsRes, adminRes,
      companiesRes, eventsCountRes, postsCountRes,
      appointmentsRes, recentEventsRes, recentPostsRes,
    ] = await Promise.all([
      pool.query("SELECT * FROM clubs WHERE id = $1", [id]),
      pool.query(
        "SELECT status, COUNT(*)::int AS count FROM members WHERE club_id = $1 GROUP BY status",
        [id]
      ),
      pool.query(
        "SELECT COUNT(*)::int AS count FROM user_roles WHERE club_id = $1 AND role = 'admin'",
        [id]
      ),
      pool.query(
        "SELECT id, name FROM companies WHERE club_id = $1 ORDER BY name",
        [id]
      ),
      pool.query(
        "SELECT COUNT(*)::int AS count FROM events WHERE club_id = $1 AND publication_status = 'published'",
        [id]
      ),
      pool.query(
        "SELECT COUNT(*)::int AS count FROM posts WHERE club_id = $1 AND publication_status = 'published'",
        [id]
      ),
      pool.query(
        `SELECT a.title, m.first_name || ' ' || m.last_name AS member_name
         FROM appointments a
         JOIN members m ON m.id = a.member_id
         WHERE a.club_id = $1
           AND (a.valid_to IS NULL OR a.valid_to >= CURRENT_DATE)
         ORDER BY a.title`,
        [id]
      ),
      pool.query(
        `SELECT id, title, start_at, publication_status
         FROM events WHERE club_id = $1 ORDER BY created_at DESC LIMIT 5`,
        [id]
      ),
      pool.query(
        `SELECT id, title, created_at, publication_status
         FROM posts WHERE club_id = $1 ORDER BY created_at DESC LIMIT 5`,
        [id]
      ),
    ]);

    if (!clubRes.rows[0]) {
      return res.status(404).json({ error: "Verein nicht gefunden" });
    }

    const memberStats = { total: 0, active: 0, passive: 0, prospect: 0, resigned: 0 };
    memberStatsRes.rows.forEach(({ status, count }) => {
      memberStats[status] = count;
      memberStats.total += count;
    });

    res.json({
      ...clubRes.rows[0],
      member_stats: memberStats,
      admin_count: adminRes.rows[0].count,
      companies: companiesRes.rows,
      events_published: eventsCountRes.rows[0].count,
      posts_published: postsCountRes.rows[0].count,
      active_appointments: appointmentsRes.rows,
      recent_events: recentEventsRes.rows,
      recent_posts: recentPostsRes.rows,
    });
  } catch (err) {
    console.error("Superadmin club detail error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// GET /api/superadmin/clubs – Liste aller Vereine mit Mitglieder- und Admin-Zählungen
router.get("/clubs", requireSuperAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        c.id,
        c.name,
        c.slug,
        COALESCE(c.location_city, c.city) AS city,
        c.location_zip,
        c.plan,
        c.plan_started_at,
        c.sales_status,
        c.archived_at,
        c.created_at,
        (SELECT COUNT(*)::int FROM members WHERE club_id = c.id AND status = 'active') AS active_members,
        (SELECT COUNT(*)::int FROM members WHERE club_id = c.id)                       AS total_members,
        (SELECT COUNT(*)::int FROM user_roles WHERE club_id = c.id AND role = 'admin') AS admin_count
      FROM clubs c
      WHERE c.deleted_at IS NULL
      ORDER BY c.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Superadmin clubs error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// POST /api/superadmin/clubs – Neuen Verein anlegen
router.post("/clubs", requireSuperAdmin, async (req, res) => {
  const {
    name, club_number, street, house_number, location_zip, location_city,
    state, country, contact_email, contact_phone, website_url,
    founded_year, description, sales_status,
  } = req.body;

  if (!name?.trim()) {
    return res.status(400).json({ error: "Vereinsname ist Pflichtfeld." });
  }

  try {
    const slug = await uniqueSlug(nameToSlug(name.trim()));
    const result = await pool.query(`
      INSERT INTO clubs
        (name, slug, club_number, street, house_number, location_zip, location_city,
         state, country, contact_email, contact_phone, website_url,
         founded_year, description, sales_status, plan)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'free')
      RETURNING id, name, slug, sales_status, created_at
    `, [
      name.trim(), slug,
      club_number || null, street || null, house_number || null,
      location_zip || null, location_city || null, state || null,
      country || "Deutschland",
      contact_email || null, contact_phone || null, website_url || null,
      founded_year ? parseInt(founded_year, 10) : null,
      description || null,
      sales_status || "recherchiert",
    ]);

    logAuditEvent(pool, {
      userId: req.userId, userEmail: req.userEmail,
      action: ACTIONS.CLUB_CREATED, entityType: 'club', entityId: result.rows[0].id,
      afterState: result.rows[0],
      req,
    });

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Superadmin create club error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// PATCH /api/superadmin/clubs/:id/logo – Logo eines Vereins hochladen
router.patch("/clubs/:id/logo", requireSuperAdmin, upload.single("file"), async (req, res) => {
  const { id } = req.params;
  if (!req.file) return res.status(400).json({ error: "Keine Datei hochgeladen." });

  try {
    const ext = (req.file.originalname.split(".").pop() || "jpg").toLowerCase();
    const destPath = `${id}/logo-${Date.now()}.${ext}`;
    await saveFile(req.file, "club-assets", destPath);
    await pool.query("UPDATE clubs SET logo_path = $1 WHERE id = $2", [destPath, id]);

    logAuditEvent(pool, {
      userId: req.userId, userEmail: req.userEmail,
      action: ACTIONS.CLUB_LOGO_UPLOADED, entityType: 'club', entityId: id,
      metadata: { path: destPath, url: getPublicUrl("club-assets", destPath) },
      req,
    });

    res.json({ logo_path: destPath, url: getPublicUrl("club-assets", destPath) });
  } catch (err) {
    console.error("Superadmin logo upload error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// PATCH /api/superadmin/clubs/:id – Stammdaten, Kontakt, Akquise, Sichtbarkeit etc.
router.patch("/clubs/:id", requireSuperAdmin, async (req, res) => {
  const { id } = req.params;

  const ALLOWED = [
    "name", "slug", "club_number", "street", "house_number", "location_zip",
    "location_city", "state", "country", "contact_email", "contact_phone", "website_url",
    "founded_year", "description", "sales_status", "acquisition_source", "acquisition_owner",
    "last_contact_at", "next_contact_at", "is_public", "is_internal", "claim_status",
  ];

  const fields = ALLOWED.filter((key) => key in req.body);
  if (fields.length === 0) {
    return res.status(400).json({ error: "Keine Felder zum Aktualisieren." });
  }

  if ("name" in req.body && !req.body.name?.trim()) {
    return res.status(400).json({ error: "Vereinsname darf nicht leer sein." });
  }

  try {
    if ("slug" in req.body) {
      const slug = req.body.slug?.trim();
      if (!slug) return res.status(400).json({ error: "Slug darf nicht leer sein." });
      const conflict = await pool.query(
        "SELECT id FROM clubs WHERE slug = $1 AND id != $2",
        [slug, id]
      );
      if (conflict.rows[0]) {
        return res.status(409).json({ error: "Dieser Slug wird bereits von einem anderen Verein verwendet." });
      }
    }

    const snapshotCols = fields.join(", ");
    const snapshot = await pool.query(`SELECT ${snapshotCols} FROM clubs WHERE id = $1`, [id]);
    if (!snapshot.rows[0]) return res.status(404).json({ error: "Verein nicht gefunden." });

    const values = fields.map((field) => {
      const val = req.body[field];
      if (field === "name") return typeof val === "string" ? val.trim() || null : null;
      if (field === "slug") return typeof val === "string" ? val.trim() || null : null;
      if (field === "founded_year") return val !== null && val !== "" ? parseInt(val, 10) : null;
      if (field === "last_contact_at" || field === "next_contact_at") return val || null;
      return val ?? null;
    });

    const setClauses = fields.map((f, i) => `${f} = $${i + 1}`).join(", ");
    values.push(id);

    const result = await pool.query(
      `UPDATE clubs SET ${setClauses}, updated_at = now() WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (!result.rows[0]) {
      return res.status(404).json({ error: "Verein nicht gefunden." });
    }

    logAuditEvent(pool, {
      userId: req.userId, userEmail: req.userEmail,
      action: ACTIONS.CLUB_UPDATED, entityType: 'club', entityId: id,
      beforeState: snapshot.rows[0],
      afterState: Object.fromEntries(fields.map((f, i) => [f, values[i]])),
      req,
    });

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Superadmin club update error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// PATCH /api/superadmin/clubs/:id/hero – Hero-Bild eines Vereins hochladen
router.patch("/clubs/:id/hero", requireSuperAdmin, upload.single("file"), async (req, res) => {
  const { id } = req.params;
  if (!req.file) return res.status(400).json({ error: "Keine Datei hochgeladen." });

  try {
    const ext = (req.file.originalname.split(".").pop() || "jpg").toLowerCase();
    const destPath = `${id}/hero-${Date.now()}.${ext}`;
    await saveFile(req.file, "club-assets", destPath);
    await pool.query("UPDATE clubs SET hero_image_path = $1 WHERE id = $2", [destPath, id]);

    logAuditEvent(pool, {
      userId: req.userId, userEmail: req.userEmail,
      action: ACTIONS.CLUB_HERO_UPLOADED, entityType: 'club', entityId: id,
      metadata: { path: destPath, url: getPublicUrl("club-assets", destPath) },
      req,
    });

    res.json({ hero_image_path: destPath, url: getPublicUrl("club-assets", destPath) });
  } catch (err) {
    console.error("Superadmin hero upload error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// GET /api/superadmin/clubs/:id/notes – Notizen eines Vereins
router.get("/clubs/:id/notes", requireSuperAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(`
      SELECT n.id, n.note, n.created_at, au.email AS created_by_email
      FROM club_notes n
      JOIN auth_users au ON au.id = n.created_by
      WHERE n.club_id = $1
      ORDER BY n.created_at DESC
    `, [id]);
    res.json(result.rows);
  } catch (err) {
    console.error("Superadmin club notes error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// POST /api/superadmin/clubs/:id/notes – Notiz anlegen
router.post("/clubs/:id/notes", requireSuperAdmin, async (req, res) => {
  const { id } = req.params;
  const { note } = req.body;
  if (!note?.trim()) return res.status(400).json({ error: "Notiz darf nicht leer sein." });

  try {
    const result = await pool.query(
      "INSERT INTO club_notes (club_id, note, created_by) VALUES ($1, $2, $3) RETURNING id, note, created_at",
      [id, note.trim(), req.userId]
    );
    logAuditEvent(pool, {
      userId: req.userId, userEmail: req.userEmail,
      action: ACTIONS.CLUB_NOTE_CREATED, entityType: 'club', entityId: id,
      afterState: { note_id: result.rows[0].id, note: result.rows[0].note },
      req,
    });

    res.status(201).json({ ...result.rows[0], created_by_email: req.userEmail });
  } catch (err) {
    console.error("Superadmin create note error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// DELETE /api/superadmin/clubs/:id/notes/:noteId – Notiz löschen
router.delete("/clubs/:id/notes/:noteId", requireSuperAdmin, async (req, res) => {
  const { id, noteId } = req.params;
  try {
    const noteRes = await pool.query("SELECT note FROM club_notes WHERE id = $1 AND club_id = $2", [noteId, id]);
    await pool.query("DELETE FROM club_notes WHERE id = $1 AND club_id = $2", [noteId, id]);

    logAuditEvent(pool, {
      userId: req.userId, userEmail: req.userEmail,
      action: ACTIONS.CLUB_NOTE_DELETED, entityType: 'club', entityId: id,
      beforeState: noteRes.rows[0] ? { note_id: noteId, note: noteRes.rows[0].note } : { note_id: noteId },
      req,
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("Superadmin delete note error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// GET /api/superadmin/users/:id – Benutzerdetail
router.get("/users/:id", requireSuperAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const [userRes, membershipsRes] = await Promise.all([
      pool.query(
        "SELECT id, email, is_superadmin, created_at FROM auth_users WHERE id = $1",
        [id]
      ),
      pool.query(`
        SELECT
          m.id            AS member_id,
          m.first_name,
          m.last_name,
          m.email         AS member_email,
          m.status,
          m.member_since,
          m.created_at    AS member_created_at,
          c.id            AS club_id,
          c.name          AS club_name,
          c.slug          AS club_slug,
          ur.role         AS system_role,
          co.name         AS company_name,
          (
            SELECT STRING_AGG(r.name, ', ' ORDER BY r.name)
            FROM member_role_assignments mra
            JOIN roles r ON r.id = mra.role_id
            WHERE mra.member_id = m.id
          ) AS role_names,
          (
            SELECT STRING_AGG(a.title, ', ' ORDER BY a.title)
            FROM appointments a
            WHERE a.member_id = m.id
              AND (a.valid_to IS NULL OR a.valid_to >= CURRENT_DATE)
          ) AS appointment_titles
        FROM members m
        JOIN clubs c ON c.id = m.club_id
        LEFT JOIN user_roles ur
               ON ur.user_id = m.user_id AND ur.club_id = m.club_id
        LEFT JOIN member_company_memberships mcm
               ON mcm.member_id = m.id AND mcm.valid_to IS NULL
        LEFT JOIN companies co ON co.id = mcm.company_id
        WHERE m.user_id = $1
        ORDER BY c.name
      `, [id]),
    ]);

    if (!userRes.rows[0]) {
      return res.status(404).json({ error: "Benutzer nicht gefunden" });
    }

    res.json({
      ...userRes.rows[0],
      memberships: membershipsRes.rows,
    });
  } catch (err) {
    console.error("Superadmin user detail error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// GET /api/superadmin/users – Plattformweite Benutzerliste
router.get("/users", requireSuperAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        au.id,
        au.email,
        au.is_superadmin,
        au.created_at,
        (SELECT COUNT(DISTINCT club_id)::int FROM members WHERE user_id = au.id) AS club_count,
        (
          SELECT m.first_name || ' ' || m.last_name
          FROM members m
          WHERE m.user_id = au.id
          ORDER BY m.created_at
          LIMIT 1
        ) AS display_name,
        (
          SELECT STRING_AGG(c.name, ', ' ORDER BY c.name)
          FROM (SELECT DISTINCT club_id FROM members WHERE user_id = au.id) dist
          JOIN clubs c ON c.id = dist.club_id
        ) AS club_names,
        (
          SELECT COUNT(*)::int FROM user_roles ur2
          WHERE ur2.user_id = au.id AND ur2.role = 'admin'
        ) AS admin_role_count
      FROM auth_users au
      ORDER BY au.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Superadmin users error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// GET /api/superadmin/roles – Plattformweite Rollenübersicht
router.get("/roles", requireSuperAdmin, async (req, res) => {
  try {
    const [statsRes, rolesRes] = await Promise.all([
      pool.query(`
        SELECT
          (SELECT COUNT(*)::int FROM roles)                                 AS total_roles,
          (SELECT COUNT(*)::int FROM member_role_assignments)               AS total_assignments,
          (SELECT COUNT(DISTINCT club_id)::int FROM roles)                  AS clubs_with_roles,
          (SELECT COUNT(*)::int FROM auth_users WHERE is_superadmin = true) AS superadmin_count
      `),
      pool.query(`
        SELECT
          r.name,
          r.level,
          COUNT(DISTINCT r.club_id)::int  AS club_count,
          COUNT(mra.id)::int              AS assignment_count,
          (
            SELECT COUNT(DISTINCT rp.permission_id)::int
            FROM roles r2
            JOIN role_permissions rp ON rp.role_id = r2.id
            WHERE r2.name = r.name AND r2.level = r.level
          )                               AS permission_count
        FROM roles r
        LEFT JOIN member_role_assignments mra ON mra.role_id = r.id
        GROUP BY r.name, r.level
        ORDER BY assignment_count DESC, r.name
      `),
    ]);

    res.json({
      stats: statsRes.rows[0],
      roles: rolesRes.rows,
    });
  } catch (err) {
    console.error("Superadmin roles error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// GET /api/superadmin/packages – Plattformweite Paketübersicht
router.get("/packages", requireSuperAdmin, async (req, res) => {
  try {
    const [statsRes, clubsRes] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*)::int                                              AS total_clubs,
          COUNT(*) FILTER (WHERE plan = 'free')::int                AS free_clubs,
          COUNT(*) FILTER (WHERE plan IS DISTINCT FROM 'free')::int AS paid_clubs,
          COUNT(*) FILTER (WHERE plan_started_at IS NULL)::int      AS no_start_date
        FROM clubs
      `),
      pool.query(`
        SELECT
          c.id,
          c.name,
          c.slug,
          c.plan,
          c.plan_started_at,
          c.created_at,
          (SELECT COUNT(*)::int FROM members WHERE club_id = c.id) AS total_members
        FROM clubs c
        ORDER BY
          CASE WHEN c.plan IS DISTINCT FROM 'free' THEN 0 ELSE 1 END,
          c.plan_started_at DESC NULLS LAST,
          c.name
      `),
    ]);

    res.json({
      stats: statsRes.rows[0],
      clubs: clubsRes.rows,
    });
  } catch (err) {
    console.error("Superadmin packages error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// PATCH /api/superadmin/clubs/:id/plan – Plan eines Vereins ändern
router.patch("/clubs/:id/plan", requireSuperAdmin, async (req, res) => {
  const { id } = req.params;
  const { plan } = req.body;

  const ALLOWED_PLANS = ["free", "starter", "premium", "enterprise"];
  if (!plan || !ALLOWED_PLANS.includes(plan)) {
    return res.status(400).json({ error: "Ungültiger Plan. Erlaubt: free, starter, premium, enterprise" });
  }

  try {
    const current = await pool.query(
      "SELECT plan, plan_started_at FROM clubs WHERE id = $1",
      [id]
    );
    if (!current.rows[0]) {
      return res.status(404).json({ error: "Verein nicht gefunden." });
    }

    const { plan: currentPlan, plan_started_at: currentStartedAt } = current.rows[0];

    let newStartedAt;
    if (plan === "free") {
      newStartedAt = null;
    } else if (!currentStartedAt || currentPlan === "free") {
      newStartedAt = new Date();
    } else {
      newStartedAt = currentStartedAt;
    }

    await pool.query(
      "UPDATE clubs SET plan = $1, plan_started_at = $2 WHERE id = $3",
      [plan, newStartedAt, id]
    );

    logAuditEvent(pool, {
      userId: req.userId, userEmail: req.userEmail,
      action: ACTIONS.CLUB_PLAN_CHANGED, entityType: 'club', entityId: id,
      beforeState: { plan: currentPlan, plan_started_at: currentStartedAt },
      afterState:  { plan, plan_started_at: newStartedAt },
      metadata:    { changed_from: currentPlan, changed_to: plan },
      req,
    });

    res.json({ plan, plan_started_at: newStartedAt });
  } catch (err) {
    console.error("Superadmin plan update error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// GET /api/superadmin/settings – Systemübersicht (lesend, keine Secrets)
router.get("/settings", requireSuperAdmin, async (req, res) => {
  try {
    const [modulesRes, openReportsRes] = await Promise.all([
      pool.query(`
        SELECT
          (SELECT COUNT(*)::int FROM events)         AS events,
          (SELECT COUNT(*)::int FROM posts)          AS posts,
          (SELECT COUNT(*)::int FROM gallery_images) AS gallery,
          (SELECT COUNT(*)::int FROM documents)      AS documents,
          (SELECT COUNT(*)::int FROM member_awards)  AS awards,
          (SELECT COUNT(*)::int FROM magazines)      AS magazines,
          (SELECT COUNT(*)::int FROM companies)      AS companies
      `),
      pool.query("SELECT COUNT(*)::int AS count FROM reports WHERE status = 'open'"),
    ]);

    const useS3 = process.env.USE_S3 === "true";

    res.json({
      platform: {
        env: process.env.NODE_ENV || "development",
        nodeVersion: process.version,
        port: parseInt(process.env.PORT || "5000"),
        frontendUrl: process.env.FRONTEND_URL || null,
        uptimeSeconds: Math.floor(process.uptime()),
      },
      modules: modulesRes.rows[0],
      storage: {
        provider: useS3 ? "s3" : "local",
        uploadDir: useS3 ? null : (process.env.UPLOAD_DIR || "uploads"),
        maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB || "10"),
        s3Bucket: useS3 ? (process.env.AWS_S3_BUCKET || null) : null,
        s3Region: useS3 ? (process.env.AWS_REGION || null) : null,
      },
      email: {
        configured: false,
        provider: null,
      },
      openReports: openReportsRes.rows[0].count,
    });
  } catch (err) {
    console.error("Superadmin settings error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// GET /api/superadmin/reports – Meldungsübersicht
router.get("/reports", requireSuperAdmin, async (req, res) => {
  try {
    const [statsRes, reportsRes] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'open')::int       AS open_count,
          COUNT(*) FILTER (WHERE status = 'in_review')::int  AS in_review_count,
          COUNT(*) FILTER (WHERE status = 'resolved')::int   AS resolved_count,
          COUNT(*) FILTER (WHERE status = 'dismissed')::int  AS dismissed_count,
          COUNT(*)::int                                      AS total_count
        FROM reports
      `),
      pool.query(`
        SELECT
          r.id,
          r.target_type,
          r.target_id,
          r.reason,
          r.description,
          r.status,
          r.created_at,
          r.resolved_at,
          c.name AS club_name,
          c.slug AS club_slug
        FROM reports r
        LEFT JOIN clubs c ON c.id = r.club_id
        ORDER BY
          CASE r.status WHEN 'open' THEN 0 WHEN 'in_review' THEN 1
                        WHEN 'resolved' THEN 2 ELSE 3 END,
          r.created_at DESC
        LIMIT 100
      `),
    ]);

    res.json({
      stats: statsRes.rows[0],
      reports: reportsRes.rows,
    });
  } catch (err) {
    console.error("Superadmin reports error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// ─── Claim Requests ────────────────────────────────────────────────────────────

// GET /api/superadmin/claim-requests
router.get("/claim-requests", requireSuperAdmin, async (req, res) => {
  const { status } = req.query;
  try {
    const where = status ? "WHERE cr.status = $1" : "";
    const params = status ? [status] : [];
    const result = await pool.query(`
      SELECT cr.id, cr.firstname, cr.lastname, cr.position, cr.email, cr.phone,
             cr.status, cr.created_at, c.name AS club_name, c.slug AS club_slug, c.id AS club_id
      FROM club_claim_requests cr
      JOIN clubs c ON c.id = cr.club_id
      ${where}
      ORDER BY CASE cr.status WHEN 'open' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END, cr.created_at DESC
    `, params);
    res.json(result.rows);
  } catch (err) {
    console.error("GET /claim-requests error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// GET /api/superadmin/claim-requests/:id
router.get("/claim-requests/:id", requireSuperAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(`
      SELECT cr.id, cr.club_id, cr.firstname, cr.lastname, cr.position,
             cr.email, cr.phone, cr.message, cr.status, cr.created_at,
             cr.reviewed_at,
             c.name AS club_name, c.slug AS club_slug, c.claim_status AS club_claim_status,
             au.email AS reviewed_by_email
      FROM club_claim_requests cr
      JOIN clubs c ON c.id = cr.club_id
      LEFT JOIN auth_users au ON au.id = cr.reviewed_by
      WHERE cr.id = $1
    `, [id]);
    if (!result.rows[0]) return res.status(404).json({ error: "Nicht gefunden." });
    res.json(result.rows[0]);
  } catch (err) {
    console.error("GET /claim-requests/:id error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// POST /api/superadmin/claim-requests/:id/approve
router.post("/claim-requests/:id/approve", requireSuperAdmin, async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const claimRes = await client.query(
      "SELECT id, club_id, email, firstname, lastname, status FROM club_claim_requests WHERE id = $1",
      [id]
    );
    if (!claimRes.rows[0]) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Nicht gefunden." }); }
    const claim = claimRes.rows[0];
    if (claim.status !== "open") { await client.query("ROLLBACK"); return res.status(409).json({ error: "Diese Anfrage wurde bereits bearbeitet." }); }

    const userRes = await client.query("SELECT id FROM auth_users WHERE email = $1", [claim.email]);
    let invitationCreated = false;

    if (userRes.rows[0]) {
      const userId = userRes.rows[0].id;
      const memberRes = await client.query(
        "SELECT id FROM members WHERE user_id = $1 AND club_id = $2",
        [userId, claim.club_id]
      );
      if (!memberRes.rows[0]) {
        await client.query(
          `INSERT INTO members (id, club_id, user_id, first_name, last_name, email, status)
           VALUES ($1, $2, $3, $4, $5, $6, 'active')`,
          [uuidv4(), claim.club_id, userId, claim.firstname, claim.lastname, claim.email]
        );
      }
      await client.query(
        `INSERT INTO user_roles (id, user_id, club_id, role)
         VALUES (gen_random_uuid(), $1, $2, 'admin')
         ON CONFLICT (user_id, club_id) DO UPDATE SET role = 'admin'`,
        [userId, claim.club_id]
      );
    } else {
      await client.query(
        `INSERT INTO club_invitations (club_id, email, role) VALUES ($1, $2, 'admin')`,
        [claim.club_id, claim.email]
      );
      invitationCreated = true;
    }

    await client.query(
      "UPDATE club_claim_requests SET status = 'approved', reviewed_at = now(), reviewed_by = $1 WHERE id = $2",
      [req.userId, id]
    );
    await client.query("UPDATE clubs SET claim_status = 'claimed' WHERE id = $1", [claim.club_id]);

    await client.query("COMMIT");

    logAuditEvent(pool, {
      userId: req.userId, userEmail: req.userEmail,
      action: ACTIONS.CLAIM_REQUEST_APPROVED, entityType: 'claim_request', entityId: id,
      metadata: { club_id: claim.club_id, email: claim.email, invitation_created: invitationCreated },
      req,
    });

    res.json({ ok: true, invitationCreated });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST /claim-requests/:id/approve error:", err);
    res.status(500).json({ error: "Serverfehler" });
  } finally {
    client.release();
  }
});

// POST /api/superadmin/claim-requests/:id/reject
router.post("/claim-requests/:id/reject", requireSuperAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const claimRes = await pool.query(
      "SELECT club_id, status FROM club_claim_requests WHERE id = $1",
      [id]
    );
    if (!claimRes.rows[0]) return res.status(404).json({ error: "Nicht gefunden." });
    if (claimRes.rows[0].status !== "open") return res.status(409).json({ error: "Diese Anfrage wurde bereits bearbeitet." });

    await pool.query(
      "UPDATE club_claim_requests SET status = 'rejected', reviewed_at = now(), reviewed_by = $1 WHERE id = $2",
      [req.userId, id]
    );
    await pool.query("UPDATE clubs SET claim_status = 'unclaimed' WHERE id = $1", [claimRes.rows[0].club_id]);

    logAuditEvent(pool, {
      userId: req.userId, userEmail: req.userEmail,
      action: ACTIONS.CLAIM_REQUEST_REJECTED, entityType: 'claim_request', entityId: id,
      metadata: { club_id: claimRes.rows[0].club_id },
      req,
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("POST /claim-requests/:id/reject error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// ─── Providers CRUD ───────────────────────────────────────────────────────────

// GET /api/superadmin/providers
router.get("/providers", requireSuperAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*,
        COALESCE(iq.cnt, 0)::int AS inquiry_count
      FROM providers p
      LEFT JOIN (
        SELECT provider_id, COUNT(*)::int AS cnt FROM provider_inquiries GROUP BY provider_id
      ) iq ON iq.provider_id = p.id
      ORDER BY p.company_name ASC
    `);
    const rows = result.rows.map((p) => ({
      ...p,
      logo_url: p.logo_path ? getPublicUrl("provider-assets", p.logo_path) : null,
      hero_image_url: p.hero_image_path ? getPublicUrl("provider-assets", p.hero_image_path) : null,
    }));
    res.json(rows);
  } catch (err) {
    console.error("GET /providers error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// GET /api/superadmin/providers/:id
router.get("/providers/:id", requireSuperAdmin, async (req, res) => {
  try {
    const [provRes, iqRes] = await Promise.all([
      pool.query("SELECT * FROM providers WHERE id = $1", [req.params.id]),
      pool.query("SELECT COUNT(*)::int AS count FROM provider_inquiries WHERE provider_id = $1", [req.params.id]),
    ]);
    if (!provRes.rows[0]) return res.status(404).json({ error: "Nicht gefunden." });
    const p = provRes.rows[0];
    if (p.logo_path) p.logo_url = getPublicUrl("provider-assets", p.logo_path);
    if (p.hero_image_path) p.hero_image_url = getPublicUrl("provider-assets", p.hero_image_path);
    p.inquiry_count = iqRes.rows[0].count;
    res.json(p);
  } catch (err) {
    console.error("GET /providers/:id error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// POST /api/superadmin/providers
router.post("/providers", requireSuperAdmin, async (req, res) => {
  const { company_name, provider_type, city, state } = req.body;
  if (!company_name?.trim()) return res.status(400).json({ error: "Firmenname ist Pflichtfeld." });
  if (!provider_type?.trim()) return res.status(400).json({ error: "Kategorie ist Pflichtfeld." });
  try {
    const slug = await uniqueProviderSlug(nameToSlug(company_name.trim()));
    const result = await pool.query(
      `INSERT INTO providers (company_name, slug, provider_type, city, state)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, company_name, slug, provider_type, city, state, is_public, is_verified, created_at`,
      [company_name.trim(), slug, provider_type.trim(), city?.trim() || null, state?.trim() || null]
    );
    logAuditEvent(pool, {
      userId: req.userId, userEmail: req.userEmail,
      action: ACTIONS.PROVIDER_CREATED, entityType: 'provider', entityId: result.rows[0].id,
      afterState: result.rows[0],
      req,
    });

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("POST /providers error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// PATCH /api/superadmin/providers/:id
router.patch("/providers/:id", requireSuperAdmin, async (req, res) => {
  const { id } = req.params;
  const ALLOWED = [
    "company_name", "slug", "provider_type", "description",
    "contact_name", "email", "phone", "website",
    "street", "zip", "city", "state",
    "is_public", "is_verified",
  ];
  const fields = ALLOWED.filter((key) => key in req.body);
  if (fields.length === 0) return res.status(400).json({ error: "Keine Felder zum Aktualisieren." });
  if ("company_name" in req.body && !req.body.company_name?.trim()) {
    return res.status(400).json({ error: "Firmenname darf nicht leer sein." });
  }
  try {
    if ("slug" in req.body) {
      const slug = req.body.slug?.trim();
      if (!slug) return res.status(400).json({ error: "Slug darf nicht leer sein." });
      const conflict = await pool.query("SELECT id FROM providers WHERE slug = $1 AND id != $2", [slug, id]);
      if (conflict.rows[0]) return res.status(409).json({ error: "Dieser Slug ist bereits vergeben." });
    }
    const snapshotCols = fields.join(", ");
    const snapshot = await pool.query(`SELECT ${snapshotCols} FROM providers WHERE id = $1`, [id]);
    if (!snapshot.rows[0]) return res.status(404).json({ error: "Nicht gefunden." });

    const setClauses = fields.map((f, i) => `${f} = $${i + 1}`).join(", ");
    const values = fields.map((f) => req.body[f] ?? null);
    values.push(id);
    const result = await pool.query(
      `UPDATE providers SET ${setClauses}, updated_at = now() WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Nicht gefunden." });

    logAuditEvent(pool, {
      userId: req.userId, userEmail: req.userEmail,
      action: ACTIONS.PROVIDER_UPDATED, entityType: 'provider', entityId: id,
      beforeState: snapshot.rows[0],
      afterState: Object.fromEntries(fields.map((f, i) => [f, values[i]])),
      req,
    });

    res.json(result.rows[0]);
  } catch (err) {
    console.error("PATCH /providers/:id error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// PATCH /api/superadmin/providers/:id/logo
router.patch("/providers/:id/logo", requireSuperAdmin, upload.single("file"), async (req, res) => {
  const { id } = req.params;
  if (!req.file) return res.status(400).json({ error: "Keine Datei hochgeladen." });
  try {
    const ext = (req.file.originalname.split(".").pop() || "jpg").toLowerCase();
    const destPath = `${id}/logo-${Date.now()}.${ext}`;
    await saveFile(req.file, "provider-assets", destPath);
    await pool.query("UPDATE providers SET logo_path = $1, updated_at = now() WHERE id = $2", [destPath, id]);

    logAuditEvent(pool, {
      userId: req.userId, userEmail: req.userEmail,
      action: ACTIONS.PROVIDER_LOGO_UPLOADED, entityType: 'provider', entityId: id,
      metadata: { path: destPath, url: getPublicUrl("provider-assets", destPath) },
      req,
    });

    res.json({ logo_path: destPath, url: getPublicUrl("provider-assets", destPath) });
  } catch (err) {
    console.error("PATCH /providers/:id/logo error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// PATCH /api/superadmin/providers/:id/hero
router.patch("/providers/:id/hero", requireSuperAdmin, upload.single("file"), async (req, res) => {
  const { id } = req.params;
  if (!req.file) return res.status(400).json({ error: "Keine Datei hochgeladen." });
  try {
    const ext = (req.file.originalname.split(".").pop() || "jpg").toLowerCase();
    const destPath = `${id}/hero-${Date.now()}.${ext}`;
    await saveFile(req.file, "provider-assets", destPath);
    await pool.query("UPDATE providers SET hero_image_path = $1, updated_at = now() WHERE id = $2", [destPath, id]);

    logAuditEvent(pool, {
      userId: req.userId, userEmail: req.userEmail,
      action: ACTIONS.PROVIDER_HERO_UPLOADED, entityType: 'provider', entityId: id,
      metadata: { path: destPath, url: getPublicUrl("provider-assets", destPath) },
      req,
    });

    res.json({ hero_image_path: destPath, url: getPublicUrl("provider-assets", destPath) });
  } catch (err) {
    console.error("PATCH /providers/:id/hero error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// PATCH /api/superadmin/clubs/:id/archive – Verein archivieren
router.patch("/clubs/:id/archive", requireSuperAdmin, async (req, res) => {
  const { reason } = req.body;
  try {
    const clubRes = await pool.query(
      "SELECT id, archived_at FROM clubs WHERE id = $1",
      [req.params.id]
    );
    if (!clubRes.rows[0]) return res.status(404).json({ error: "Verein nicht gefunden." });
    if (clubRes.rows[0].archived_at) {
      return res.status(409).json({ error: "Verein ist bereits archiviert." });
    }
    const result = await pool.query(
      `UPDATE clubs SET archived_at = now(), archived_by = $1, archive_reason = $2
       WHERE id = $3
       RETURNING id, archived_at, archived_by, archive_reason`,
      [req.userId, reason?.trim() || null, req.params.id]
    );

    logAuditEvent(pool, {
      userId: req.userId, userEmail: req.userEmail,
      action: ACTIONS.CLUB_ARCHIVED, entityType: 'club', entityId: req.params.id,
      metadata: { reason: reason?.trim() || null },
      req,
    });

    res.json(result.rows[0]);
  } catch (err) {
    console.error("PATCH /superadmin/clubs/:id/archive error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// PATCH /api/superadmin/clubs/:id/unarchive – Archivierung aufheben
router.patch("/clubs/:id/unarchive", requireSuperAdmin, async (req, res) => {
  try {
    const clubRes = await pool.query(
      "SELECT id, archived_at FROM clubs WHERE id = $1",
      [req.params.id]
    );
    if (!clubRes.rows[0]) return res.status(404).json({ error: "Verein nicht gefunden." });
    if (!clubRes.rows[0].archived_at) {
      return res.status(409).json({ error: "Verein ist nicht archiviert." });
    }
    const result = await pool.query(
      `UPDATE clubs SET archived_at = null, archived_by = null, archive_reason = null
       WHERE id = $1
       RETURNING id`,
      [req.params.id]
    );

    logAuditEvent(pool, {
      userId: req.userId, userEmail: req.userEmail,
      action: ACTIONS.CLUB_UNARCHIVED, entityType: 'club', entityId: req.params.id,
      req,
    });

    res.json(result.rows[0]);
  } catch (err) {
    console.error("PATCH /superadmin/clubs/:id/unarchive error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// ─── Audit-Log ────────────────────────────────────────────────────────────────

// GET /api/superadmin/audit-logs – Superadmin-Aktionen einsehen
router.get("/audit-logs", requireSuperAdmin, async (req, res) => {
  const {
    entity_type = null,
    entity_id   = null,
    action      = null,
    performed_by = null,
    from        = null,
    to          = null,
    limit       = "50",
    offset      = "0",
  } = req.query;

  const maxLimit = Math.min(parseInt(limit, 10) || 50, 200);
  const safeOffset = parseInt(offset, 10) || 0;

  try {
    const result = await pool.query(
      `SELECT
         al.id,
         al.action,
         al.entity_type,
         al.entity_id,
         al.actor_email,
         al.performed_by,
         al.before_state,
         al.after_state,
         al.metadata,
         al.ip_address,
         al.created_at,
         c.name  AS club_name,
         c.slug  AS club_slug,
         p.company_name AS provider_name,
         p.slug         AS provider_slug
       FROM superadmin_audit_logs al
       LEFT JOIN clubs c
         ON c.id = al.entity_id AND al.entity_type = 'club'
       LEFT JOIN providers p
         ON p.id = al.entity_id AND al.entity_type = 'provider'
       WHERE
         ($1::text IS NULL OR al.entity_type = $1)
         AND ($2::uuid IS NULL OR al.entity_id = $2::uuid)
         AND ($3::text IS NULL OR al.action = $3)
         AND ($4::uuid IS NULL OR al.performed_by = $4::uuid)
         AND ($5::timestamptz IS NULL OR al.created_at >= $5::timestamptz)
         AND ($6::timestamptz IS NULL OR al.created_at <= $6::timestamptz)
       ORDER BY al.created_at DESC
       LIMIT $7 OFFSET $8`,
      [entity_type, entity_id, action, performed_by, from, to, maxLimit, safeOffset]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("GET /superadmin/audit-logs error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// ── Superadmin Inbox ──────────────────────────────────────────────────────────

// GET /api/superadmin/inbox – UNION aus interest + claim requests
router.get("/inbox", requireSuperAdmin, async (req, res) => {
  const { type, status, club_id } = req.query;
  try {
    const conditions = [];
    const params = [];

    // Build interest filter
    const iConditions = ["1=1"];
    if (club_id) { params.push(club_id); iConditions.push(`cir.club_id = $${params.length}::uuid`); }
    if (status && status !== "all") { params.push(status); iConditions.push(`cir.status = $${params.length}`); }

    // Build claim filter – map status 'new'→'open', others direct
    const cConditions = ["1=1"];
    const cParams = [];
    if (club_id) { cParams.push(club_id); cConditions.push(`cr.club_id = $${cParams.length}::uuid`); }
    if (status && status !== "all") {
      const mappedStatus = status === "new" ? "open" : status;
      cParams.push(mappedStatus);
      cConditions.push(`cr.status = $${cParams.length}`);
    }

    // Build access filter
    const aConditions = ["1=1"];
    const aParams = [];
    if (club_id) { aParams.push(club_id); aConditions.push(`car.club_id = $${aParams.length}::uuid`); }
    if (status && status !== "all") { aParams.push(status); aConditions.push(`car.status = $${aParams.length}`); }

    // We use parameterised queries separately and merge in JS to avoid complex UNION param indexing
    const interestQuery = `
      SELECT cir.id, 'interest' AS source,
             cir.request_type AS type,
             cir.club_id, c.name AS club_name, c.slug AS club_slug,
             cir.name, cir.email, cir.phone, cir.message,
             cir.status, cir.created_at, cir.internal_note
      FROM club_interest_requests cir
      JOIN clubs c ON c.id = cir.club_id
      WHERE ${iConditions.join(" AND ")}
    `;

    const claimQuery = `
      SELECT cr.id, 'claim' AS source,
             'claim' AS type,
             cr.club_id, c.name AS club_name, c.slug AS club_slug,
             concat(cr.firstname, ' ', cr.lastname) AS name,
             cr.email, cr.phone, cr.message,
             cr.status, cr.created_at, NULL::text AS internal_note
      FROM club_claim_requests cr
      JOIN clubs c ON c.id = cr.club_id
      WHERE ${cConditions.join(" AND ")}
    `;

    const accessQuery = `
      SELECT car.id, 'access' AS source,
             'access_request' AS type,
             car.club_id, c.name AS club_name, c.slug AS club_slug,
             concat(car.firstname, ' ', car.lastname) AS name,
             car.email, car.phone, car.message,
             car.status, car.created_at, car.internal_note
      FROM club_access_requests car
      JOIN clubs c ON c.id = car.club_id
      WHERE ${aConditions.join(" AND ")}
    `;

    const [interestRes, claimRes, accessRes] = await Promise.all([
      pool.query(interestQuery, params),
      pool.query(claimQuery, cParams),
      pool.query(accessQuery, aParams),
    ]);

    let rows = [...interestRes.rows, ...claimRes.rows, ...accessRes.rows];

    // type filter (applied after merge)
    if (type && type !== "all") {
      rows = rows.filter((r) => r.type === type);
    }

    rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    rows = rows.slice(0, 100);

    res.json(rows);
  } catch (err) {
    console.error("GET /superadmin/inbox error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// GET /api/superadmin/inbox/stats
router.get("/inbox/stats", requireSuperAdmin, async (req, res) => {
  try {
    const [newInterest, openContact, openMembership, openClaims, openAccess] = await Promise.all([
      pool.query("SELECT COUNT(*)::int AS count FROM club_interest_requests WHERE status = 'new'"),
      pool.query("SELECT COUNT(*)::int AS count FROM club_interest_requests WHERE request_type = 'club_contact' AND status IN ('new','in_progress')"),
      pool.query("SELECT COUNT(*)::int AS count FROM club_interest_requests WHERE request_type = 'membership_interest' AND status IN ('new','in_progress')"),
      pool.query("SELECT COUNT(*)::int AS count FROM club_claim_requests WHERE status = 'open'"),
      pool.query("SELECT COUNT(*)::int AS count FROM club_access_requests WHERE status IN ('new','in_progress')"),
    ]);
    res.json({
      newInterestRequests: newInterest.rows[0].count,
      openContactRequests: openContact.rows[0].count,
      openMembershipRequests: openMembership.rows[0].count,
      openClaimRequests: openClaims.rows[0].count,
      openAccessRequests: openAccess.rows[0].count,
    });
  } catch (err) {
    console.error("GET /superadmin/inbox/stats error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// PATCH /api/superadmin/inbox/interest/:id
router.patch("/inbox/interest/:id", requireSuperAdmin, async (req, res) => {
  const { id } = req.params;
  const { status, internal_note } = req.body;
  const validStatuses = ["new", "in_progress", "done", "archived"];
  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({ error: "Ungültiger Status." });
  }
  try {
    const setClauses = [];
    const params = [];
    if (status !== undefined) {
      params.push(status); setClauses.push(`status = $${params.length}`);
      if (status === "done") {
        params.push(req.userId); setClauses.push(`handled_by = $${params.length}`);
        setClauses.push("handled_at = now()");
      }
    }
    if (internal_note !== undefined) {
      params.push(internal_note); setClauses.push(`internal_note = $${params.length}`);
    }
    if (setClauses.length === 0) return res.status(400).json({ error: "Keine Felder angegeben." });
    params.push(id);
    const result = await pool.query(
      `UPDATE club_interest_requests SET ${setClauses.join(", ")} WHERE id = $${params.length} RETURNING *`,
      params
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Nicht gefunden." });
    res.json(result.rows[0]);
  } catch (err) {
    console.error("PATCH /superadmin/inbox/interest/:id error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// PATCH /api/superadmin/inbox/claim/:id – nur internal_note (status via approve/reject)
router.patch("/inbox/claim/:id", requireSuperAdmin, async (req, res) => {
  const { id } = req.params;
  const { internal_note } = req.body;
  if (internal_note === undefined) return res.status(400).json({ error: "Keine Felder angegeben." });
  try {
    const result = await pool.query(
      "UPDATE club_claim_requests SET internal_note = $1 WHERE id = $2 RETURNING *",
      [internal_note, id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Nicht gefunden." });
    res.json(result.rows[0]);
  } catch (err) {
    console.error("PATCH /superadmin/inbox/claim/:id error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// PATCH /api/superadmin/inbox/access/:id
router.patch("/inbox/access/:id", requireSuperAdmin, async (req, res) => {
  const { id } = req.params;
  const { status, internal_note } = req.body;
  const validStatuses = ["new", "in_progress", "done", "archived"];
  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({ error: "Ungültiger Status." });
  }
  try {
    const setClauses = [];
    const params = [];
    if (status !== undefined) {
      params.push(status); setClauses.push(`status = $${params.length}`);
      if (status === "done") {
        params.push(req.userId); setClauses.push(`handled_by = $${params.length}`);
        setClauses.push("handled_at = now()");
      }
    }
    if (internal_note !== undefined) {
      params.push(internal_note); setClauses.push(`internal_note = $${params.length}`);
    }
    if (setClauses.length === 0) return res.status(400).json({ error: "Keine Felder angegeben." });
    params.push(id);
    const result = await pool.query(
      `UPDATE club_access_requests SET ${setClauses.join(", ")} WHERE id = $${params.length} RETURNING *`,
      params
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Nicht gefunden." });
    res.json(result.rows[0]);
  } catch (err) {
    console.error("PATCH /superadmin/inbox/access/:id error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// GET /api/superadmin/clubs/:id/requests – letzte Anfragen für einen Verein
router.get("/clubs/:id/requests", requireSuperAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const [interestRes, claimRes, accessRes] = await Promise.all([
      pool.query(`
        SELECT cir.id, 'interest' AS source, cir.request_type AS type,
               cir.club_id, c.name AS club_name, c.slug AS club_slug,
               cir.name, cir.email, cir.phone, cir.message,
               cir.status, cir.created_at, cir.internal_note
        FROM club_interest_requests cir
        JOIN clubs c ON c.id = cir.club_id
        WHERE cir.club_id = $1
        ORDER BY cir.created_at DESC LIMIT 10
      `, [id]),
      pool.query(`
        SELECT cr.id, 'claim' AS source, 'claim' AS type,
               cr.club_id, c.name AS club_name, c.slug AS club_slug,
               concat(cr.firstname, ' ', cr.lastname) AS name,
               cr.email, cr.phone, cr.message,
               cr.status, cr.created_at, NULL::text AS internal_note
        FROM club_claim_requests cr
        JOIN clubs c ON c.id = cr.club_id
        WHERE cr.club_id = $1
        ORDER BY cr.created_at DESC LIMIT 10
      `, [id]),
      pool.query(`
        SELECT car.id, 'access' AS source, 'access_request' AS type,
               car.club_id, c.name AS club_name, c.slug AS club_slug,
               concat(car.firstname, ' ', car.lastname) AS name,
               car.email, car.phone, car.message,
               car.status, car.created_at, car.internal_note
        FROM club_access_requests car
        JOIN clubs c ON c.id = car.club_id
        WHERE car.club_id = $1
        ORDER BY car.created_at DESC LIMIT 10
      `, [id]),
    ]);

    const rows = [...interestRes.rows, ...claimRes.rows, ...accessRes.rows]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10);

    res.json(rows);
  } catch (err) {
    console.error("GET /superadmin/clubs/:id/requests error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

module.exports = router;
