const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");
const multer = require("multer");
const { saveFile, getPublicUrl, deleteFile } = require("../storage");

const upload = multer({ dest: "tmp/" });

// ─── Clubs ────────────────────────────────────────────────────────────────────

// GET /api/clubs/registration – öffentliche Liste für Registrierung
router.get("/clubs/registration", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, slug FROM clubs ORDER BY name"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Serverfehler" });
  }
});

// GET /api/clubs/by-slug/:slug – öffentliches Club-Profil
router.get("/clubs/by-slug/:slug", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, slug, city, logo_path, hero_image_path, description, founded_year, website FROM clubs WHERE slug = $1",
      [req.params.slug]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Nicht gefunden" });
    const club = result.rows[0];
    if (club.logo_path) club.logo_url = getPublicUrl("club-assets", club.logo_path);
    if (club.hero_image_path) club.hero_image_url = getPublicUrl("club-assets", club.hero_image_path);
    res.json(club);
  } catch (err) {
    res.status(500).json({ error: "Serverfehler" });
  }
});

// GET /api/clubs/me – eigener Club
router.get("/clubs/me", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM clubs WHERE id = $1",
      [req.clubId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Nicht gefunden" });
    const club = result.rows[0];
    if (club.logo_path) club.logo_url = getPublicUrl("club-assets", club.logo_path);
    if (club.hero_image_path) club.hero_image_url = getPublicUrl("club-assets", club.hero_image_path);
    res.json(club);
  } catch (err) {
    res.status(500).json({ error: "Serverfehler" });
  }
});

// PUT /api/clubs/me
router.put("/clubs/me", requireAuth, async (req, res) => {
  const { name, city, description, founded_year, website } = req.body;
  try {
    const result = await pool.query(
      `UPDATE clubs SET name = COALESCE($1, name), city = $2,
        description = $3, founded_year = $4, website = $5, updated_at = now()
       WHERE id = $6 RETURNING *`,
      [name, city || null, description || null, founded_year || null, website || null, req.clubId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Serverfehler" });
  }
});

// POST /api/clubs/me/logo
router.post("/clubs/me/logo", requireAuth, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Keine Datei" });
  const ext = req.file.originalname.split(".").pop();
  const destPath = `${req.clubId}/logo.${ext}`;
  try {
    await saveFile(req.file, "club-assets", destPath);
    await pool.query("UPDATE clubs SET logo_path = $1 WHERE id = $2", [destPath, req.clubId]);
    res.json({ url: getPublicUrl("club-assets", destPath) });
  } catch (err) {
    res.status(500).json({ error: "Upload fehlgeschlagen" });
  }
});

// POST /api/clubs/me/hero
router.post("/clubs/me/hero", requireAuth, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Keine Datei" });
  const ext = req.file.originalname.split(".").pop();
  const destPath = `${req.clubId}/hero.${ext}`;
  try {
    await saveFile(req.file, "club-assets", destPath);
    await pool.query("UPDATE clubs SET hero_image_path = $1 WHERE id = $2", [destPath, req.clubId]);
    res.json({ url: getPublicUrl("club-assets", destPath) });
  } catch (err) {
    res.status(500).json({ error: "Upload fehlgeschlagen" });
  }
});

// ─── Companies ────────────────────────────────────────────────────────────────

router.get("/companies", requireAuth, async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM companies WHERE club_id = $1 ORDER BY name",
    [req.clubId]
  );
  const companies = result.rows.map((c) => ({
    ...c,
    logo_url: c.logo_url ? getPublicUrl("company-assets", c.logo_url) : null,
    cover_url: c.cover_url ? getPublicUrl("company-assets", c.cover_url) : null,
  }));
  res.json(companies);
});

router.post("/companies", requireAuth, async (req, res) => {
  const { name, description, founded_year } = req.body;
  if (!name) return res.status(400).json({ error: "Name erforderlich" });
  const id = uuidv4();
  const result = await pool.query(
    "INSERT INTO companies (id, club_id, name, description, founded_year) VALUES ($1,$2,$3,$4,$5) RETURNING *",
    [id, req.clubId, name, description || null, founded_year || null]
  );
  res.status(201).json(result.rows[0]);
});

router.put("/companies/:id", requireAuth, async (req, res) => {
  const { name, description, founded_year } = req.body;
  const result = await pool.query(
    "UPDATE companies SET name = COALESCE($1,name), description = $2, founded_year = $3 WHERE id = $4 AND club_id = $5 RETURNING *",
    [name, description || null, founded_year || null, req.params.id, req.clubId]
  );
  if (!result.rows[0]) return res.status(404).json({ error: "Nicht gefunden" });
  res.json(result.rows[0]);
});

router.delete("/companies/:id", requireAuth, async (req, res) => {
  await pool.query("DELETE FROM companies WHERE id = $1 AND club_id = $2", [req.params.id, req.clubId]);
  res.json({ success: true });
});

router.post("/companies/:id/logo", requireAuth, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Keine Datei" });
  const ext = req.file.originalname.split(".").pop();
  const destPath = `${req.params.id}/logo.${ext}`;
  await saveFile(req.file, "company-assets", destPath);
  await pool.query("UPDATE companies SET logo_url = $1 WHERE id = $2 AND club_id = $3", [destPath, req.params.id, req.clubId]);
  res.json({ url: getPublicUrl("company-assets", destPath) });
});

// ─── Posts ────────────────────────────────────────────────────────────────────

router.get("/posts", requireAuth, async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM posts WHERE club_id = $1 ORDER BY created_at DESC",
    [req.clubId]
  );
  const posts = result.rows.map((p) => ({
    ...p,
    cover_image_url: p.cover_image_path ? getPublicUrl("post-images", p.cover_image_path) : null,
  }));
  res.json(posts);
});

router.get("/posts/public/:clubSlug", async (req, res) => {
  const result = await pool.query(
    `SELECT p.* FROM posts p JOIN clubs c ON c.id = p.club_id
     WHERE c.slug = $1 AND p.audience = 'public' AND p.publication_status = 'approved'
     ORDER BY p.created_at DESC LIMIT 20`,
    [req.params.clubSlug]
  );
  const posts = result.rows.map((p) => ({
    ...p,
    cover_image_url: p.cover_image_path ? getPublicUrl("post-images", p.cover_image_path) : null,
  }));
  res.json(posts);
});

router.get("/posts/:id", requireAuth, async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM posts WHERE id = $1 AND club_id = $2",
    [req.params.id, req.clubId]
  );
  if (!result.rows[0]) return res.status(404).json({ error: "Nicht gefunden" });
  const post = result.rows[0];
  if (post.cover_image_path) post.cover_image_url = getPublicUrl("post-images", post.cover_image_path);
  res.json(post);
});

router.post("/posts", requireAuth, async (req, res) => {
  const { title, content, category, audience, publication_status, owner_type, owner_id } = req.body;
  if (!title) return res.status(400).json({ error: "Titel erforderlich" });
  const id = uuidv4();
  const result = await pool.query(
    `INSERT INTO posts (id, club_id, title, content, category, audience, publication_status,
      owner_type, owner_id, created_by_member_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [id, req.clubId, title, content || null, category || "other",
     audience || "club_internal", publication_status || "draft",
     owner_type || "club", owner_id || req.clubId, req.member.id]
  );
  res.status(201).json(result.rows[0]);
});

router.put("/posts/:id", requireAuth, async (req, res) => {
  const { title, content, category, audience, publication_status, approved_at, approved_by_member_id, rejection_reason, submitted_at } = req.body;
  const result = await pool.query(
    `UPDATE posts SET
      title = COALESCE($1, title), content = $2, category = COALESCE($3, category),
      audience = COALESCE($4, audience), publication_status = COALESCE($5, publication_status),
      approved_at = $6, approved_by_member_id = $7, rejection_reason = $8,
      submitted_at = $9, updated_at = now()
     WHERE id = $10 AND club_id = $11 RETURNING *`,
    [title, content ?? null, category, audience, publication_status,
     approved_at ?? null, approved_by_member_id ?? null,
     rejection_reason ?? null, submitted_at ?? null,
     req.params.id, req.clubId]
  );
  if (!result.rows[0]) return res.status(404).json({ error: "Nicht gefunden" });
  res.json(result.rows[0]);
});

router.delete("/posts/:id", requireAuth, async (req, res) => {
  const post = (await pool.query("SELECT * FROM posts WHERE id = $1 AND club_id = $2", [req.params.id, req.clubId])).rows[0];
  if (post?.cover_image_path) await deleteFile("post-images", post.cover_image_path);
  await pool.query("DELETE FROM posts WHERE id = $1 AND club_id = $2", [req.params.id, req.clubId]);
  res.json({ success: true });
});

router.post("/posts/:id/cover", requireAuth, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Keine Datei" });
  const ext = req.file.originalname.split(".").pop();
  const destPath = `${req.params.id}/cover.${ext}`;
  await saveFile(req.file, "post-images", destPath);
  await pool.query("UPDATE posts SET cover_image_path = $1 WHERE id = $2 AND club_id = $3", [destPath, req.params.id, req.clubId]);
  res.json({ url: getPublicUrl("post-images", destPath) });
});

// ─── Notifications ────────────────────────────────────────────────────────────

router.get("/notifications", requireAuth, async (req, res) => {
  const result = await pool.query(
    `SELECT * FROM notifications WHERE recipient_member_id = $1
     ORDER BY created_at DESC LIMIT 50`,
    [req.member.id]
  );
  res.json(result.rows);
});

router.put("/notifications/:id/read", requireAuth, async (req, res) => {
  await pool.query(
    "UPDATE notifications SET is_read = true WHERE id = $1 AND recipient_member_id = $2",
    [req.params.id, req.member.id]
  );
  res.json({ success: true });
});

router.put("/notifications/read-all", requireAuth, async (req, res) => {
  await pool.query(
    "UPDATE notifications SET is_read = true WHERE recipient_member_id = $1",
    [req.member.id]
  );
  res.json({ success: true });
});

// ─── Gallery ──────────────────────────────────────────────────────────────────

router.get("/gallery", requireAuth, async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM gallery_images WHERE club_id = $1 ORDER BY created_at DESC",
    [req.clubId]
  );
  const images = result.rows.map((img) => ({
    ...img,
    url: getPublicUrl("gallery-images", img.file_path),
  }));
  res.json(images);
});

router.post("/gallery", requireAuth, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Keine Datei" });
  const { title, description } = req.body;
  const ext = req.file.originalname.split(".").pop();
  const id = uuidv4();
  const destPath = `${req.clubId}/${id}.${ext}`;
  await saveFile(req.file, "gallery-images", destPath);
  const result = await pool.query(
    `INSERT INTO gallery_images (id, club_id, file_path, title, description, uploaded_by_member_id)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [id, req.clubId, destPath, title || null, description || null, req.member.id]
  );
  res.status(201).json({ ...result.rows[0], url: getPublicUrl("gallery-images", destPath) });
});

router.put("/gallery/:id", requireAuth, upload.single("file"), async (req, res) => {
  const { title, description, is_visible } = req.body;
  const img = (await pool.query("SELECT * FROM gallery_images WHERE id = $1 AND club_id = $2", [req.params.id, req.clubId])).rows[0];
  if (!img) return res.status(404).json({ error: "Nicht gefunden" });

  let filePath = img.file_path;
  if (req.file) {
    const ext = req.file.originalname.split(".").pop();
    filePath = `${req.clubId}/${uuidv4()}.${ext}`;
    await saveFile(req.file, "gallery-images", filePath);
    if (img.file_path) await deleteFile("gallery-images", img.file_path);
  }

  const result = await pool.query(
    `UPDATE gallery_images SET title=$1, description=$2, is_visible=$3, file_path=$4 WHERE id=$5 AND club_id=$6 RETURNING *`,
    [title || null, description || null, is_visible === "false" ? false : Boolean(is_visible), filePath, req.params.id, req.clubId]
  );
  res.json({ ...result.rows[0], url: getPublicUrl("gallery-images", filePath) });
});

router.delete("/gallery/:id", requireAuth, async (req, res) => {
  const img = (await pool.query("SELECT * FROM gallery_images WHERE id = $1 AND club_id = $2", [req.params.id, req.clubId])).rows[0];
  if (img?.file_path) await deleteFile("gallery-images", img.file_path);
  await pool.query("DELETE FROM gallery_images WHERE id = $1 AND club_id = $2", [req.params.id, req.clubId]);
  res.json({ success: true });
});

// ─── Documents ────────────────────────────────────────────────────────────────

router.get("/documents", requireAuth, async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM documents WHERE (scope_type = 'club' AND scope_id = $1) ORDER BY created_at DESC",
    [req.clubId]
  );
  res.json(result.rows);
});

router.post("/documents", requireAuth, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Keine Datei" });
  const { title, scope_type, scope_id, visibility } = req.body;
  const ext = req.file.originalname.split(".").pop();
  const id = uuidv4();
  const destPath = `${req.clubId}/${id}.${ext}`;
  await saveFile(req.file, "documents", destPath);
  const result = await pool.query(
    `INSERT INTO documents (id, club_id, title, file_path, file_name, file_size,
      scope_type, scope_id, visibility, uploaded_by_member_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [id, req.clubId, title || req.file.originalname, destPath,
     req.file.originalname, req.file.size,
     scope_type || "club", scope_id || req.clubId,
     visibility || "internal", req.member.id]
  );
  res.status(201).json(result.rows[0]);
});

router.get("/documents/:id/download", requireAuth, async (req, res) => {
  const doc = (await pool.query("SELECT * FROM documents WHERE id = $1 AND club_id = $2", [req.params.id, req.clubId])).rows[0];
  if (!doc) return res.status(404).json({ error: "Nicht gefunden" });

  if (process.env.USE_S3 === "true") {
    res.json({ url: getPublicUrl("documents", doc.file_path) });
  } else {
    const path = require("path");
    const { UPLOAD_BASE } = require("../storage");
    res.download(path.join(UPLOAD_BASE, "documents", doc.file_path), doc.file_name);
  }
});

router.delete("/documents/:id", requireAuth, async (req, res) => {
  const doc = (await pool.query("SELECT * FROM documents WHERE id = $1 AND club_id = $2", [req.params.id, req.clubId])).rows[0];
  if (doc?.file_path) await deleteFile("documents", doc.file_path);
  await pool.query("DELETE FROM documents WHERE id = $1 AND club_id = $2", [req.params.id, req.clubId]);
  res.json({ success: true });
});

// ─── Work Shifts ──────────────────────────────────────────────────────────────

router.get("/work-shifts", requireAuth, async (req, res) => {
  const result = await pool.query(
    `SELECT ws.*, 
      json_agg(wsa.*) FILTER (WHERE wsa.id IS NOT NULL) as assignments
     FROM work_shifts ws
     LEFT JOIN work_shift_assignments wsa ON wsa.work_shift_id = ws.id
     WHERE ws.club_id = $1
     GROUP BY ws.id
     ORDER BY ws.start_at ASC`,
    [req.clubId]
  );
  res.json(result.rows);
});

router.post("/work-shifts", requireAuth, async (req, res) => {
  const { title, description, start_at, end_at, required_slots, owner_type, owner_id, event_id } = req.body;
  if (!title || !start_at) return res.status(400).json({ error: "Pflichtfelder fehlen" });
  const id = uuidv4();
  const result = await pool.query(
    `INSERT INTO work_shifts (id, club_id, title, description, start_at, end_at,
      required_slots, owner_type, owner_id, event_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [id, req.clubId, title, description || null, start_at, end_at || null,
     required_slots || 1, owner_type || "club", owner_id || req.clubId, event_id || null]
  );
  res.status(201).json(result.rows[0]);
});

router.delete("/work-shifts/:id", requireAuth, async (req, res) => {
  await pool.query("DELETE FROM work_shifts WHERE id = $1 AND club_id = $2", [req.params.id, req.clubId]);
  res.json({ success: true });
});

// POST /api/work-shifts/:id/sign-up
router.post("/work-shifts/:id/sign-up", requireAuth, async (req, res) => {
  const id = uuidv4();
  try {
    await pool.query(
      `INSERT INTO work_shift_assignments (id, work_shift_id, member_id, status)
       VALUES ($1,$2,$3,'signed_up') ON CONFLICT (work_shift_id, member_id) DO NOTHING`,
      [id, req.params.id, req.member.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Serverfehler" });
  }
});

// ─── Roles & Permissions ──────────────────────────────────────────────────────

router.get("/roles", requireAuth, async (req, res) => {
  const result = await pool.query(
    "SELECT r.*, json_agg(p.key) FILTER (WHERE p.key IS NOT NULL) as permissions FROM roles r LEFT JOIN role_permissions rp ON rp.role_id = r.id LEFT JOIN permissions p ON p.id = rp.permission_id WHERE r.club_id = $1 GROUP BY r.id ORDER BY r.name",
    [req.clubId]
  );
  res.json(result.rows);
});

router.get("/permissions", requireAuth, async (req, res) => {
  const result = await pool.query("SELECT * FROM permissions ORDER BY key");
  res.json(result.rows);
});

// ─── Member Company Memberships ───────────────────────────────────────────────

router.get("/memberships", requireAuth, async (req, res) => {
  const result = await pool.query(
    `SELECT mcm.* FROM member_company_memberships mcm
     JOIN members m ON m.id = mcm.member_id
     WHERE m.club_id = $1`,
    [req.clubId]
  );
  res.json(result.rows);
});

router.post("/memberships", requireAuth, async (req, res) => {
  const { member_id, company_id, valid_from } = req.body;
  if (!member_id || !company_id) return res.status(400).json({ error: "Pflichtfelder fehlen" });
  const id = uuidv4();
  // Bestehende aktive Mitgliedschaft beenden
  await pool.query(
    "UPDATE member_company_memberships SET valid_to = now() WHERE member_id = $1 AND valid_to IS NULL",
    [member_id]
  );
  const result = await pool.query(
    "INSERT INTO member_company_memberships (id, member_id, company_id, valid_from) VALUES ($1,$2,$3,$4) RETURNING *",
    [id, member_id, company_id, valid_from || new Date().toISOString().split("T")[0]]
  );
  res.status(201).json(result.rows[0]);
});

// ─── Dashboard Stats ──────────────────────────────────────────────────────────

router.get("/dashboard", requireAuth, async (req, res) => {
  try {
    const now = new Date().toISOString();
    const [
      membershipRes, eventsRes, postRes, notifRes, pendingAwardsRes
    ] = await Promise.all([
      pool.query(
        "SELECT company_id FROM member_company_memberships WHERE member_id = $1 AND valid_to IS NULL LIMIT 1",
        [req.member.id]
      ),
      pool.query(
        "SELECT id, title, start_at, location, owner_type, owner_id, audience FROM events WHERE club_id = $1 AND start_at >= $2 ORDER BY start_at ASC LIMIT 10",
        [req.clubId, now]
      ),
      pool.query(
        "SELECT id, title, created_at, cover_image_path FROM posts WHERE club_id = $1 AND publication_status = 'approved' ORDER BY created_at DESC LIMIT 1",
        [req.clubId]
      ),
      pool.query(
        "SELECT COUNT(*) FROM notifications WHERE recipient_member_id = $1 AND is_read = false",
        [req.member.id]
      ),
      pool.query(
        "SELECT COUNT(*) FROM member_awards WHERE member_id = $1 AND status = 'pending'",
        [req.member.id]
      ),
    ]);

    const companyId = membershipRes.rows[0]?.company_id || null;
    const events = eventsRes.rows;
    const companyEvents = companyId ? events.filter(e => e.owner_type === "company" && e.owner_id === companyId) : [];
    const clubEvents = events.filter(e => e.owner_type === "club");

    res.json({
      companyId,
      companyEvents,
      clubEvents,
      latestPost: postRes.rows[0] ? {
        ...postRes.rows[0],
        cover_image_url: postRes.rows[0].cover_image_path ? getPublicUrl("post-images", postRes.rows[0].cover_image_path) : null
      } : null,
      unreadNotifications: parseInt(notifRes.rows[0].count),
      pendingAwardRequests: parseInt(pendingAwardsRes.rows[0].count),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// ─── Awards ───────────────────────────────────────────────────────────────────

router.get("/awards", requireAuth, async (req, res) => {
  const result = await pool.query(
    "SELECT ma.*, at.name as award_type_name FROM member_awards ma LEFT JOIN award_types at ON at.id = ma.award_type_id WHERE ma.club_id = $1 ORDER BY ma.created_at DESC",
    [req.clubId]
  );
  res.json(result.rows);
});

router.get("/award-types", requireAuth, async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM award_types WHERE club_id = $1 ORDER BY name",
    [req.clubId]
  );
  res.json(result.rows);
});

// ─── Magazines ────────────────────────────────────────────────────────────────

router.get("/magazines", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT m.*, 
        mem.first_name as creator_first_name, mem.last_name as creator_last_name,
        (SELECT COUNT(*) FROM magazine_sections ms WHERE ms.magazine_id = m.id) as section_count
       FROM magazines m
       LEFT JOIN members mem ON mem.id = m.created_by_member_id
       WHERE m.club_id = $1
       ORDER BY m.year DESC, m.created_at DESC`,
      [req.clubId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Serverfehler" });
  }
});

router.post("/magazines", requireAuth, async (req, res) => {
  const { title, year } = req.body;
  if (!title || !year) return res.status(400).json({ error: "Titel und Jahr erforderlich" });
  try {
    const result = await pool.query(
      "INSERT INTO magazines (id, club_id, title, year, status, created_by_member_id) VALUES ($1,$2,$3,$4,'draft',$5) RETURNING *",
      [uuidv4(), req.clubId, title, year, req.member.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Serverfehler" });
  }
});

router.put("/magazines/:id", requireAuth, async (req, res) => {
  const { title, year, status } = req.body;
  try {
    const result = await pool.query(
      "UPDATE magazines SET title=COALESCE($1,title), year=COALESCE($2,year), status=COALESCE($3,status) WHERE id=$4 AND club_id=$5 RETURNING *",
      [title, year, status, req.params.id, req.clubId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Nicht gefunden" });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Serverfehler" });
  }
});

router.delete("/magazines/:id", requireAuth, async (req, res) => {
  try {
    await pool.query("DELETE FROM magazines WHERE id=$1 AND club_id=$2", [req.params.id, req.clubId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Serverfehler" });
  }
});

// ─── Magazine Sections ────────────────────────────────────────────────────────

router.get("/magazines/:id", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM magazines WHERE id=$1 AND club_id=$2",
      [req.params.id, req.clubId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Nicht gefunden" });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: "Serverfehler" }); }
});

router.get("/magazines/:id/sections", requireAuth, async (req, res) => {
  try {
    const sections = await pool.query(
      "SELECT *, sort_order as order_index FROM magazine_sections WHERE magazine_id=$1 ORDER BY sort_order",
      [req.params.id]
    );
    const items = await pool.query(
      "SELECT *, sort_order as order_index, content as custom_text, title as content_type FROM magazine_items WHERE section_id = ANY(SELECT id FROM magazine_sections WHERE magazine_id=$1) ORDER BY sort_order",
      [req.params.id]
    );
    res.json({ sections: sections.rows, items: items.rows });
  } catch (err) { res.status(500).json({ error: "Serverfehler" }); }
});

router.post("/magazines/:id/sections", requireAuth, async (req, res) => {
  const { title, type, sort_order } = req.body;
  if (!title) return res.status(400).json({ error: "Titel erforderlich" });
  try {
    const result = await pool.query(
      "INSERT INTO magazine_sections (id, magazine_id, title, sort_order) VALUES ($1,$2,$3,$4) RETURNING *",
      [uuidv4(), req.params.id, title, sort_order ?? 0]
    );
    res.status(201).json({ ...result.rows[0], type: type || "custom" });
  } catch (err) { res.status(500).json({ error: "Serverfehler" }); }
});

router.delete("/magazine-sections/:id", requireAuth, async (req, res) => {
  try {
    await pool.query("DELETE FROM magazine_sections WHERE id=$1", [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: "Serverfehler" }); }
});

router.put("/magazine-sections/:id", requireAuth, async (req, res) => {
  const { sort_order } = req.body;
  try {
    await pool.query("UPDATE magazine_sections SET sort_order=$1 WHERE id=$2", [sort_order, req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: "Serverfehler" }); }
});

router.post("/magazine-items", requireAuth, async (req, res) => {
  const { section_id, content_type, content_id, custom_text, company_id, sort_order } = req.body;
  try {
    const result = await pool.query(
      "INSERT INTO magazine_items (id, section_id, title, content, sort_order) VALUES ($1,$2,$3,$4,$5) RETURNING *",
      [uuidv4(), section_id, content_type || null, custom_text ?? null, sort_order ?? 0]
    );
    const row = result.rows[0];
    res.status(201).json({
      id: row.id,
      section_id: row.section_id,
      content_type: content_type || row.title,
      content_id: content_id || null,
      custom_text: row.content,
      company_id: company_id || null,
      order_index: row.sort_order,
    });
  } catch (err) {
    console.error("magazine-items POST error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

router.put("/magazine-items/:id", requireAuth, async (req, res) => {
  const { custom_text, sort_order } = req.body;
  try {
    await pool.query(
      "UPDATE magazine_items SET content=$1, sort_order=COALESCE($2,sort_order) WHERE id=$3",
      [custom_text ?? null, sort_order ?? null, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("magazine-items PUT error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

router.delete("/magazine-items/:id", requireAuth, async (req, res) => {
  try {
    await pool.query("DELETE FROM magazine_items WHERE id=$1", [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: "Serverfehler" }); }
});

// ─── Public URLs helper ───────────────────────────────────────────────────────

router.get("/storage-url", (req, res) => {
  const { bucket, path: filePath } = req.query;
  if (!bucket || !filePath) return res.status(400).json({ error: "bucket und path erforderlich" });
  res.json({ url: getPublicUrl(bucket, filePath) });
});

module.exports = router;