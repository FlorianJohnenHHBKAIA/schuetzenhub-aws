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
  const {
    name, city, description, founded_year, website,
    // ClubProfile Felder
    tagline, location_city, location_zip,
    logo_path, hero_image_path,
    contact_email, contact_phone, website_url,
    join_cta_text, join_cta_url,
    imprint_text, privacy_text,
  } = req.body;
  try {
    const result = await pool.query(
      `UPDATE clubs SET
        name = COALESCE($1, name),
        city = COALESCE($2, city),
        description = COALESCE($3, description),
        founded_year = COALESCE($4, founded_year),
        website = COALESCE($5, website),
        tagline = $6,
        location_city = $7,
        location_zip = $8,
        logo_path = COALESCE($9, logo_path),
        hero_image_path = COALESCE($10, hero_image_path),
        contact_email = $11,
        contact_phone = $12,
        website_url = $13,
        join_cta_text = $14,
        join_cta_url = $15,
        imprint_text = $16,
        privacy_text = $17,
        updated_at = now()
       WHERE id = $18 RETURNING *`,
      [
        name || null, city || null, description || null,
        founded_year || null, website || null,
        tagline || null, location_city || null, location_zip || null,
        logo_path || null, hero_image_path || null,
        contact_email || null, contact_phone || null, website_url || null,
        join_cta_text || null, join_cta_url || null,
        imprint_text || null, privacy_text || null,
        req.clubId,
      ]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("PUT /clubs/me error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// PUT /api/clubs/me/:id – ID wird ignoriert, Club kommt aus JWT (Shim-Kompatibilität)
router.put("/clubs/me/:id", requireAuth, async (req, res) => {
  const {
    name, city, description, founded_year, website,
    tagline, location_city, location_zip,
    logo_path, hero_image_path,
    contact_email, contact_phone, website_url,
    join_cta_text, join_cta_url,
    imprint_text, privacy_text,
  } = req.body;
  try {
    const result = await pool.query(
      `UPDATE clubs SET
        name = COALESCE($1, name),
        city = COALESCE($2, city),
        description = COALESCE($3, description),
        founded_year = COALESCE($4, founded_year),
        website = COALESCE($5, website),
        tagline = $6,
        location_city = $7,
        location_zip = $8,
        logo_path = COALESCE($9, logo_path),
        hero_image_path = COALESCE($10, hero_image_path),
        contact_email = $11,
        contact_phone = $12,
        website_url = $13,
        join_cta_text = $14,
        join_cta_url = $15,
        imprint_text = $16,
        privacy_text = $17,
        updated_at = now()
       WHERE id = $18 RETURNING *`,
      [
        name || null, city || null, description || null,
        founded_year || null, website || null,
        tagline || null, location_city || null, location_zip || null,
        logo_path || null, hero_image_path || null,
        contact_email || null, contact_phone || null, website_url || null,
        join_cta_text || null, join_cta_url || null,
        imprint_text || null, privacy_text || null,
        req.clubId,
      ]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("PUT /clubs/me/:id error:", err);
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
  const { title, description, is_visible } = req.body;
  const ext = req.file.originalname.split(".").pop();
  const id = uuidv4();
  const destPath = `${req.clubId}/${id}.${ext}`;
  await saveFile(req.file, "gallery-images", destPath);
  const visible = is_visible === "false" ? false : true; // default true
  const result = await pool.query(
    `INSERT INTO gallery_images (id, club_id, file_path, title, description, is_visible, uploaded_by_member_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [id, req.clubId, destPath, title || null, description || null, visible, req.member.id]
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

router.post("/award-types", requireAuth, async (req, res) => {
  try {
    const { name, description, icon } = req.body;
    const result = await pool.query(
      "INSERT INTO award_types (id, club_id, name, description, icon) VALUES (gen_random_uuid(), $1, $2, $3, $4) RETURNING *",
      [req.clubId, name, description || null, icon || null]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: "Serverfehler" }); }
});

router.put("/award-types/:id", requireAuth, async (req, res) => {
  try {
    const { name, description, icon } = req.body;
    const result = await pool.query(
      "UPDATE award_types SET name=$1, description=$2, icon=$3 WHERE id=$4 AND club_id=$5 RETURNING *",
      [name, description || null, icon || null, req.params.id, req.clubId]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: "Serverfehler" }); }
});

router.delete("/award-types/:id", requireAuth, async (req, res) => {
  try {
    await pool.query("DELETE FROM award_types WHERE id=$1 AND club_id=$2", [req.params.id, req.clubId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: "Serverfehler" }); }
});

router.post("/awards", requireAuth, async (req, res) => {
  try {
    const { member_id, award_type_id, awarded_at, notes, awarded_by_member_id } = req.body;
    const result = await pool.query(
      "INSERT INTO member_awards (id, club_id, member_id, award_type_id, awarded_at, notes, awarded_by_member_id) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6) RETURNING *",
      [req.clubId, member_id, award_type_id, awarded_at || new Date(), notes || null, awarded_by_member_id || null]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: "Serverfehler" }); }
});

router.put("/awards/:id", requireAuth, async (req, res) => {
  try {
    const { notes, awarded_at } = req.body;
    const result = await pool.query(
      "UPDATE member_awards SET notes=$1, awarded_at=$2 WHERE id=$3 AND club_id=$4 RETURNING *",
      [notes || null, awarded_at, req.params.id, req.clubId]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: "Serverfehler" }); }
});

router.delete("/awards/:id", requireAuth, async (req, res) => {
  try {
    await pool.query("DELETE FROM member_awards WHERE id=$1 AND club_id=$2", [req.params.id, req.clubId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: "Serverfehler" }); }
});

// ─── Roles & Permissions ─────────────────────────────────────────────────────

router.post("/roles", requireAuth, async (req, res) => {
  try {
    const { name, description } = req.body;
    const result = await pool.query(
      "INSERT INTO roles (id, club_id, name, description) VALUES (gen_random_uuid(), $1, $2, $3) RETURNING *",
      [req.clubId, name, description || null]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: "Serverfehler" }); }
});

router.put("/roles/:id", requireAuth, async (req, res) => {
  try {
    const { name, description } = req.body;
    const result = await pool.query(
      "UPDATE roles SET name=$1, description=$2 WHERE id=$3 AND club_id=$4 RETURNING *",
      [name, description || null, req.params.id, req.clubId]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: "Serverfehler" }); }
});

router.delete("/roles/:id", requireAuth, async (req, res) => {
  try {
    await pool.query("DELETE FROM roles WHERE id=$1 AND club_id=$2", [req.params.id, req.clubId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: "Serverfehler" }); }
});

router.put("/permissions/:id", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      "UPDATE permissions SET key=$1, description=$2 WHERE id=$3 RETURNING *",
      [req.body.key, req.body.description || null, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: "Serverfehler" }); }
});

// ─── Memberships ──────────────────────────────────────────────────────────────

router.put("/memberships/:id", requireAuth, async (req, res) => {
  try {
    const { valid_to, role } = req.body;
    const result = await pool.query(
      "UPDATE member_company_memberships SET valid_to=$1, role=$2 WHERE id=$3 AND club_id=$4 RETURNING *",
      [valid_to || null, role || null, req.params.id, req.clubId]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: "Serverfehler" }); }
});

router.delete("/memberships/:id", requireAuth, async (req, res) => {
  try {
    await pool.query("DELETE FROM member_company_memberships WHERE id=$1 AND club_id=$2", [req.params.id, req.clubId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: "Serverfehler" }); }
});

// ─── Notification Settings ────────────────────────────────────────────────────

router.get("/notification-settings", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM member_notification_settings WHERE member_id = (SELECT id FROM members WHERE user_id=$1 AND club_id=$2 LIMIT 1)",
      [req.userId, req.clubId]
    );
    res.json(result.rows[0] || null);
  } catch (err) { res.status(500).json({ error: "Serverfehler" }); }
});

router.post("/notification-settings", requireAuth, async (req, res) => {
  try {
    const fields = Object.keys(req.body).filter(k => k !== 'member_id');
    const values = fields.map(k => req.body[k]);
    const cols = ['member_id', ...fields].join(', ');
    const placeholders = ['(SELECT id FROM members WHERE user_id=$1 AND club_id=$2 LIMIT 1)', ...fields.map((_, i) => `$${i + 3}`)].join(', ');
    const result = await pool.query(
      `INSERT INTO member_notification_settings (${cols}) VALUES (${placeholders}) ON CONFLICT (member_id) DO UPDATE SET ${fields.map((f, i) => `${f}=$${i + 3}`).join(', ')} RETURNING *`,
      [req.userId, req.clubId, ...values]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("notification-settings error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

router.put("/notification-settings", requireAuth, async (req, res) => {
  try {
    const fields = Object.keys(req.body);
    if (fields.length === 0) return res.json({});
    const setClause = fields.map((f, i) => `${f}=$${i + 3}`).join(', ');
    const values = fields.map(k => req.body[k]);
    const result = await pool.query(
      `UPDATE member_notification_settings SET ${setClause} WHERE member_id=(SELECT id FROM members WHERE user_id=$1 AND club_id=$2 LIMIT 1) RETURNING *`,
      [req.userId, req.clubId, ...values]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: "Serverfehler" }); }
});

// ─── Member Gallery Images ────────────────────────────────────────────────────

router.get("/member-gallery", requireAuth, async (req, res) => {
  try {
    const { visibility, member_id } = req.query;

    let query = `
      SELECT mgi.*,
             m.first_name, m.last_name, m.avatar_url as member_avatar
      FROM member_gallery_images mgi
      LEFT JOIN members m ON m.id = mgi.member_id
      WHERE mgi.club_id = $1`;
    const params = [req.clubId];

    if (visibility) {
      params.push(visibility);
      query += ` AND mgi.visibility = $${params.length}`;
    }
    if (member_id) {
      params.push(member_id);
      query += ` AND mgi.member_id = $${params.length}`;
    }

    query += ` ORDER BY mgi.created_at DESC`;

    const result = await pool.query(query, params);
    const rows = result.rows.map(img => ({
      ...img,
      image_url: getPublicUrl("gallery-images", img.image_path),
      member: {
        first_name: img.first_name,
        last_name:  img.last_name,
        avatar_url: img.member_avatar,
      },
    }));
    res.json(rows);
  } catch (err) {
    console.error("member-gallery GET error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// Öffentlicher Endpoint – kein Auth nötig
router.get("/public/gallery/:clubSlug", async (req, res) => {
  try {
    const clubResult = await pool.query(
      "SELECT id FROM clubs WHERE slug=$1 LIMIT 1",
      [req.params.clubSlug]
    );
    if (!clubResult.rows[0]) return res.json([]);
    const clubId = clubResult.rows[0].id;
    const result = await pool.query(
      `SELECT id, title, description, file_path AS image_path, created_at
       FROM gallery_images
       WHERE club_id=$1 AND is_visible=true
       ORDER BY created_at DESC`,
      [clubId]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: "Serverfehler" }); }
});

router.put("/member-gallery/:id", requireAuth, async (req, res) => {
  try {
    const { title, description, visibility, usage_permission, status, rejection_reason, reviewed_by_member_id, reviewed_at } = req.body;
    const result = await pool.query(
      `UPDATE member_gallery_images SET 
        title=COALESCE($1,title), description=COALESCE($2,description),
        visibility=COALESCE($3,visibility), usage_permission=COALESCE($4,usage_permission),
        status=COALESCE($5,status), rejection_reason=$6,
        reviewed_by_member_id=COALESCE($7,reviewed_by_member_id),
        reviewed_at=COALESCE($8,reviewed_at)
       WHERE id=$9 AND club_id=$10 RETURNING *`,
      [title, description, visibility, usage_permission, status, rejection_reason || null,
       reviewed_by_member_id, reviewed_at, req.params.id, req.clubId]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: "Serverfehler" }); }
});

router.delete("/member-gallery/:id", requireAuth, async (req, res) => {
  try {
    await pool.query("DELETE FROM member_gallery_images WHERE id=$1 AND club_id=$2", [req.params.id, req.clubId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: "Serverfehler" }); }
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

// ─── Generischer Upload-Endpoint ─────────────────────────────────────────────
// POST /api/upload - universeller File-Upload (ersetzt supabase.storage.from(bucket).upload())
router.post("/upload", requireAuth, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Keine Datei" });
    const { bucket, path: filePath } = req.body;
    if (!bucket) return res.status(400).json({ error: "Bucket fehlt" });

    const savedPath = await saveFile(req.file, bucket, filePath || req.file.originalname);
    const publicUrl = getPublicUrl(bucket, savedPath);

    res.json({ path: savedPath, publicUrl });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Upload fehlgeschlagen" });
  }
});

// POST /api/storage/delete - Dateien löschen (ersetzt supabase.storage.from(bucket).remove())
router.post("/storage/delete", requireAuth, async (req, res) => {
  try {
    const { bucket, paths } = req.body;
    if (!bucket || !Array.isArray(paths)) {
      return res.status(400).json({ error: "Bucket und paths erforderlich" });
    }
    for (const p of paths) {
      try { await deleteFile(bucket, p); } catch (e) { /* ignorieren */ }
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Fehler beim Löschen" });
  }
});

// GET /api/documents/download - Datei herunterladen
router.get("/documents/download", requireAuth, async (req, res) => {
  try {
    const { path: filePath, bucket } = req.query;
    if (!filePath) return res.status(400).json({ error: "Pfad fehlt" });
    
    const { UPLOAD_BASE } = require("../storage");
    const fs = require("fs");
    const path = require("path");
    
    if (process.env.USE_S3 === "true") {
      // S3: Redirect zu presigned URL
      const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
      const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
      const s3 = new S3Client({ region: process.env.AWS_REGION });
      const command = new GetObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: `${bucket || "documents"}/${filePath}`,
      });
      const url = await getSignedUrl(s3, command, { expiresIn: 300 });
      return res.redirect(url);
    }
    
    // Lokal: Datei direkt senden
    const fullPath = path.join(UPLOAD_BASE, bucket || "documents", filePath);
    if (!fs.existsSync(fullPath)) return res.status(404).json({ error: "Datei nicht gefunden" });
    res.download(fullPath);
  } catch (err) {
    console.error("Download error:", err);
    res.status(500).json({ error: "Download fehlgeschlagen" });
  }
});

// POST /api/gallery/upload - Foto mit Metadaten hochladen (PhotoUploadDialog)
router.post("/gallery/upload", requireAuth, async (req, res) => {
  try {
    const { member_id, club_id, company_id, image_path, visibility, usage_permission, description, status } = req.body;
    const id = uuidv4();
    await pool.query(
      `INSERT INTO member_gallery_images 
       (id, member_id, club_id, company_id, image_path, visibility, usage_permission, description, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id, member_id, club_id, company_id || null, image_path, visibility, usage_permission || "internal", description || null, status || "pending"]
    );
    res.json({ id });
  } catch (err) {
    console.error("Gallery upload error:", err);
    res.status(500).json({ error: "Fehler beim Speichern" });
  }
});

// ─── Appointments / Leadership ─────────────────────────────────────────────────

router.get("/appointments/leadership", requireAuth, async (req, res) => {
  try {
    const { scope_type, scope_id, date } = req.query;
    const today = date || new Date().toISOString().split('T')[0];
    const result = await pool.query(
      `SELECT a.id, a.title,
        m.id as member_id, m.first_name, m.last_name, m.avatar_url, m.title as member_title
       FROM appointments a
       JOIN members m ON m.id = a.member_id
       WHERE a.club_id = $1
         AND a.scope_type = $2
         AND a.scope_id = $3
         AND (a.valid_from IS NULL OR a.valid_from <= $4)
         AND (a.valid_to IS NULL OR a.valid_to >= $4)
       ORDER BY a.created_at`,
      [req.clubId, scope_type || 'company', scope_id, today]
    );
    const leadership = result.rows.map(r => ({
      id: r.id,
      role_name: r.title,
      member: {
        id: r.member_id,
        first_name: r.first_name,
        last_name: r.last_name,
        avatar_url: r.avatar_url,
        title: r.member_title,
      }
    }));
    res.json(leadership);
  } catch (err) {
    console.error("appointments/leadership error:", err);
    res.json([]);
  }
});
// ─── Appointments (CRUD) ───────────────────────────────────────────────────────

// GET /api/appointments – alle Appointments des Clubs
router.get("/appointments", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.*,
              r.name as role_name,
              c.name as company_name,
              m.first_name,
              m.last_name
       FROM appointments a
       LEFT JOIN roles r ON r.id = a.role_id
       LEFT JOIN companies c ON c.id = a.scope_id AND a.scope_type = 'company'
       LEFT JOIN members m ON m.id = a.member_id
       WHERE a.club_id = $1
       ORDER BY a.valid_from DESC NULLS LAST`,
      [req.clubId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("appointments GET error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// POST /api/appointments
router.post("/appointments", requireAuth, async (req, res) => {
  try {
    const { member_id, role_id, title, scope_type, scope_id, valid_from, valid_to } = req.body;
    const id = require("crypto").randomUUID();
    const result = await pool.query(
      `INSERT INTO appointments (id, club_id, member_id, role_id, title, scope_type, scope_id, valid_from, valid_to, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now()) RETURNING *`,
      [id, req.clubId, member_id, role_id, title || null, scope_type || "club", scope_id, valid_from || null, valid_to || null]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("appointments POST error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// PUT /api/appointments/:id
router.put("/appointments/:id", requireAuth, async (req, res) => {
  try {
    const { member_id, role_id, title, scope_type, scope_id, valid_from, valid_to } = req.body;
    const result = await pool.query(
      `UPDATE appointments SET
         member_id   = COALESCE($1, member_id),
         role_id     = COALESCE($2, role_id),
         title       = COALESCE($3, title),
         scope_type  = COALESCE($4, scope_type),
         scope_id    = COALESCE($5, scope_id),
         valid_from  = $6,
         valid_to    = $7
       WHERE id = $8 AND club_id = $9
       RETURNING *`,
      [member_id || null, role_id || null, title || null, scope_type || null, scope_id || null,
       valid_from || null, valid_to || null, req.params.id, req.clubId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Nicht gefunden" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error("appointments PUT error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// DELETE /api/appointments/:id
router.delete("/appointments/:id", requireAuth, async (req, res) => {
  try {
    await pool.query(
      "DELETE FROM appointments WHERE id = $1 AND club_id = $2",
      [req.params.id, req.clubId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("appointments DELETE error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// ─── Role Permissions ──────────────────────────────────────────────────────────

// GET /api/role-permissions – alle role_permissions des Clubs
router.get("/role-permissions", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT rp.role_id, rp.permission_id
       FROM role_permissions rp
       JOIN roles r ON r.id = rp.role_id
       WHERE r.club_id = $1`,
      [req.clubId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("role-permissions GET error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// POST /api/role-permissions – einzeln oder als Array
router.post("/role-permissions", requireAuth, async (req, res) => {
  try {
    const records = Array.isArray(req.body) ? req.body : [req.body];
    for (const { role_id, permission_id } of records) {
      await pool.query(
        `INSERT INTO role_permissions (role_id, permission_id)
         VALUES ($1, $2) ON CONFLICT (role_id, permission_id) DO NOTHING`,
        [role_id, permission_id]
      );
    }
    res.json({ success: true });
  } catch (err) {
    console.error("role-permissions POST error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// DELETE /api/role-permissions – löscht eine spezifische Zuweisung per Body
router.delete("/role-permissions", requireAuth, async (req, res) => {
  try {
    const { role_id, permission_id } = req.body;
    await pool.query(
      "DELETE FROM role_permissions WHERE role_id = $1 AND permission_id = $2",
      [role_id, permission_id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("role-permissions DELETE error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// ─── Notifications (Bulk Insert) ───────────────────────────────────────────────

// POST /api/notifications – einzelne oder mehrere Notifications anlegen
router.post("/notifications", requireAuth, async (req, res) => {
  try {
    const records = Array.isArray(req.body) ? req.body : [req.body];
    for (const n of records) {
      const id = require("crypto").randomUUID();
      await pool.query(
        `INSERT INTO notifications
           (id, club_id, recipient_member_id, type, reference_id, reference_type, payload, is_read, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, false, now())`,
        [id, n.club_id, n.recipient_member_id, n.type,
         n.reference_id || null, n.reference_type || null,
         JSON.stringify(n.payload || {})]
      );
    }
    res.json({ success: true });
  } catch (err) {
    console.error("notifications POST error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// ─── Delegations ──────────────────────────────────────────────────────────────

// GET /api/delegations?to_member_id=... oder ?from_member_id=...
router.get("/delegations", requireAuth, async (req, res) => {
  try {
    const { to_member_id, from_member_id } = req.query;
    let query = `SELECT * FROM delegations WHERE club_id = $1`;
    const params = [req.clubId];

    if (to_member_id) {
      params.push(to_member_id);
      query += ` AND to_member_id = $${params.length}`;
    }
    if (from_member_id) {
      params.push(from_member_id);
      query += ` AND from_member_id = $${params.length}`;
    }

    query += ` ORDER BY valid_from DESC`;
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("delegations GET error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// POST /api/delegations
router.post("/delegations", requireAuth, async (req, res) => {
  try {
    const { from_member_id, to_member_id, title, valid_from, valid_to } = req.body;
    const id = require("crypto").randomUUID();
    const result = await pool.query(
      `INSERT INTO delegations (id, club_id, from_member_id, to_member_id, title, valid_from, valid_to, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now()) RETURNING *`,
      [id, req.clubId, from_member_id, to_member_id, title, valid_from || null, valid_to || null]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("delegations POST error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// PUT /api/delegations/:id
router.put("/delegations/:id", requireAuth, async (req, res) => {
  try {
    const { title, valid_from, valid_to } = req.body;
    const result = await pool.query(
      `UPDATE delegations SET
         title      = COALESCE($1, title),
         valid_from = COALESCE($2, valid_from),
         valid_to   = $3
       WHERE id = $4 AND club_id = $5 RETURNING *`,
      [title || null, valid_from || null, valid_to || null, req.params.id, req.clubId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Nicht gefunden" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error("delegations PUT error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// DELETE /api/delegations/:id
router.delete("/delegations/:id", requireAuth, async (req, res) => {
  try {
    await pool.query(
      "DELETE FROM delegations WHERE id = $1 AND club_id = $2",
      [req.params.id, req.clubId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("delegations DELETE error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

module.exports = router;