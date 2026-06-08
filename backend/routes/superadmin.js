const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireSuperAdmin } = require("../middleware/auth");

// GET /api/superadmin/stats – Plattformweite KPIs
router.get("/stats", requireSuperAdmin, async (req, res) => {
  try {
    const [
      clubsTotal, clubsActive, clubsFree,
      usersTotal, superadminsRes, openReportsRes,
      publishedPostsRes, publishedEventsRes,
      recentPostsRes, recentEventsRes,
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
        c.plan,
        c.plan_started_at,
        c.created_at,
        (SELECT COUNT(*)::int FROM members WHERE club_id = c.id AND status = 'active') AS active_members,
        (SELECT COUNT(*)::int FROM members WHERE club_id = c.id)                       AS total_members,
        (SELECT COUNT(*)::int FROM user_roles WHERE club_id = c.id AND role = 'admin') AS admin_count
      FROM clubs c
      ORDER BY c.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Superadmin clubs error:", err);
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
          (SELECT COUNT(*)::int FROM awards)         AS awards,
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

module.exports = router;
