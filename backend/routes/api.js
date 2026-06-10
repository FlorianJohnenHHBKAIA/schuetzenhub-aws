const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const pool = require("../db");
const { requireAuth, requireAdmin, requireActiveMember } = require("../middleware/auth");
const multer = require("multer");
const { saveFile, getPublicUrl, deleteFile } = require("../storage");
const { insertNotifications, notifyPostPublished, getClubMemberIds, getCompanyMemberIds } = require("../lib/notifications");

const upload = multer({ dest: "tmp/" });

// ─── Clubs ────────────────────────────────────────────────────────────────────

// GET /api/companies/for-registration/:clubId – öffentliche Kompanienliste für Registrierung
router.get("/companies/for-registration/:clubId", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name FROM companies WHERE club_id = $1 ORDER BY name",
      [req.params.clubId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Serverfehler" });
  }
});

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

// GET /api/clubs/by-slug/:slug – öffentliches Club-Profil (kein Auth)
router.get("/clubs/by-slug/:slug", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         id, name, slug,
         city, location_city, location_zip,
         tagline, description,
         logo_path, hero_image_path,
         contact_email, contact_phone, website_url,
         join_cta_text, join_cta_url,
         imprint_text, privacy_text,
         claim_status, plan,
         founded_year, street, house_number, state,
         archived_at
       FROM clubs
       WHERE slug = $1
         AND deleted_at IS NULL`,
      [req.params.slug]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Nicht gefunden" });

    const club = result.rows[0];

    if (club.archived_at) {
      return res.status(410).json({ error: "archived" });
    }
    delete club.archived_at;

    if (club.logo_path)       club.logo_url       = getPublicUrl("club-assets", club.logo_path);
    if (club.hero_image_path) club.hero_image_url  = getPublicUrl("club-assets", club.hero_image_path);

    res.json(club);
  } catch (err) {
    console.error("GET /clubs/by-slug error:", err);
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
  const toPublicUrl = (bucket, path) => {
    if (!path) return null;
    if (path.startsWith("/") || path.startsWith("http")) return path;
    return getPublicUrl(bucket, path);
  };
  const companies = result.rows.map((c) => ({
    ...c,
    logo_url: toPublicUrl("company-assets", c.logo_url),
    cover_url: toPublicUrl("company-assets", c.cover_url),
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
  const { name, description, founded_year, logo_path, cover_path } = req.body;
  const result = await pool.query(
    `UPDATE companies SET 
       name = COALESCE($1, name), description = $2, founded_year = $3,
       logo_url = COALESCE($4, logo_url), cover_url = COALESCE($5, cover_url)
     WHERE id = $6 AND club_id = $7 RETURNING *`,
    [name, description || null, founded_year || null, logo_path || null, cover_path || null, req.params.id, req.clubId]
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

// ─── Events ───────────────────────────────────────────────────────────────────

router.get("/events/:id/participants", requireAuth, requireActiveMember, async (req, res) => {
  try {
    const eventResult = await pool.query(
      "SELECT id FROM events WHERE id = $1 AND club_id = $2",
      [req.params.id, req.clubId]
    );
    if (!eventResult.rows[0]) return res.status(404).json({ error: "Event nicht gefunden" });

    const result = await pool.query(
      `SELECT ep.member_id, ep.status,
              m.first_name, m.last_name, m.avatar_url
       FROM event_participants ep
       JOIN members m ON m.id = ep.member_id
       WHERE ep.event_id = $1`,
      [req.params.id]
    );
    res.json(result.rows.map(r => ({
      member_id: r.member_id,
      status: r.status,
      member: { first_name: r.first_name, last_name: r.last_name, avatar_url: r.avatar_url }
    })));
  } catch (err) {
    console.error("GET /events/:id/participants error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

router.post("/events/:id/participants", requireAuth, requireActiveMember, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['attending', 'declined'].includes(status))
      return res.status(400).json({ error: "Status ungültig" });

    const eventResult = await pool.query(
      "SELECT * FROM events WHERE id = $1 AND club_id = $2",
      [req.params.id, req.clubId]
    );
    if (!eventResult.rows[0]) return res.status(404).json({ error: "Event nicht gefunden" });
    const event = eventResult.rows[0];

    if (event.audience === 'company_only') {
      const membership = await pool.query(
        "SELECT id FROM member_company_memberships WHERE member_id = $1 AND company_id = $2",
        [req.member.id, event.owner_id]
      );
      if (!membership.rows[0])
        return res.status(403).json({ error: "Nur Firmenmitglieder können teilnehmen" });
    }

    const result = await pool.query(
      `INSERT INTO event_participants (id, event_id, member_id, status, updated_at)
       VALUES ($1,$2,$3,$4,now())
       ON CONFLICT (event_id, member_id) DO UPDATE SET status=$4, updated_at=now()
       RETURNING *`,
      [uuidv4(), req.params.id, req.member.id, status]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("POST /events/:id/participants error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

router.delete("/events/:id/participants", requireAuth, requireActiveMember, async (req, res) => {
  try {
    await pool.query(
      "DELETE FROM event_participants WHERE event_id = $1 AND member_id = $2",
      [req.params.id, req.member.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("DELETE /events/:id/participants error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

router.get("/events", requireAuth, async (req, res) => {
  try {
    const { from, to, ids } = req.query;
    let query = "SELECT * FROM events WHERE club_id = $1";
    const params = [req.clubId];

    if (ids) {
      const idList = ids.split(",");
      const placeholders = idList.map((_, i) => `$${i + 2}`).join(",");
      query += ` AND id IN (${placeholders})`;
      params.push(...idList);
    } else {
      if (from) {
        params.push(from);
        query += ` AND start_at >= $${params.length}`;
      }
      if (to) {
        params.push(to);
        query += ` AND start_at <= $${params.length}`;
      }
    }

    query += " ORDER BY start_at ASC";
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("GET /events error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

router.get("/events/:id", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM events WHERE id = $1 AND club_id = $2",
      [req.params.id, req.clubId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Nicht gefunden" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error("GET /events/:id error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

router.post("/events", requireAuth, async (req, res) => {
  const { title, description, location, start_at, end_at, category, owner_type, owner_id, audience, publication_status } = req.body;
  if (!title || !start_at) return res.status(400).json({ error: "Titel und Startdatum erforderlich" });
  const VALID_AUDIENCES = ['club_internal', 'public', 'company_only'];
  if (audience && !VALID_AUDIENCES.includes(audience)) {
    return res.status(400).json({ error: "Ungültiger Wert für audience" });
  }
  const id = uuidv4();
  try {
    const result = await pool.query(
      `INSERT INTO events (id, club_id, title, description, location, start_at, end_at, category, owner_type, owner_id, audience, publication_status, created_by_member_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [id, req.clubId, title, description || null, location || null, start_at, end_at || null, category || 'other', owner_type || 'club', owner_id || req.clubId, audience || 'club_internal', publication_status || 'draft', req.member.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("POST /events error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

router.put("/events/:id", requireAuth, async (req, res) => {
  const { title, description, location, start_at, end_at, category, owner_type, owner_id, audience, publication_status, internal_notes, responsible_member_id } = req.body;
  const VALID_AUDIENCES = ['club_internal', 'public', 'company_only'];
  if (audience && !VALID_AUDIENCES.includes(audience)) {
    return res.status(400).json({ error: "Ungültiger Wert für audience" });
  }
  try {
    const result = await pool.query(
      `UPDATE events SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        location = COALESCE($3, location),
        start_at = COALESCE($4, start_at),
        end_at = COALESCE($5, end_at),
        category = COALESCE($6, category),
        owner_type = COALESCE($7, owner_type),
        owner_id = COALESCE($8, owner_id),
        audience = COALESCE($9, audience),
        publication_status = COALESCE($10, publication_status),
        internal_notes = COALESCE($11, internal_notes),
        responsible_member_id = COALESCE($12, responsible_member_id),
        updated_at = now()
       WHERE id = $13 AND club_id = $14 RETURNING *`,
      [title || null, description || null, location || null, start_at || null, end_at || null, category || null, owner_type || null, owner_id || null, audience || null, publication_status || null, internal_notes || null, responsible_member_id || null, req.params.id, req.clubId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Nicht gefunden" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error("PUT /events/:id error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

router.delete("/events/:id", requireAuth, async (req, res) => {
  try {
    await pool.query("DELETE FROM events WHERE id = $1 AND club_id = $2", [req.params.id, req.clubId]);
    res.json({ success: true });
  } catch (err) {
    console.error("DELETE /events/:id error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// ─── Posts ────────────────────────────────────────────────────────────────────
// TODO: visible_until – DB-Spalte fehlt noch in der posts-Tabelle.
// Sobald die Spalte existiert (ALTER TABLE posts ADD COLUMN visible_until TIMESTAMPTZ),
// muss visible_until in den Endpunkten aufgenommen werden:
//   POST /posts:    visible_until aus req.body übernehmen, in INSERT-Query ergänzen
//   PUT  /posts/:id: visible_until aus req.body übernehmen, in UPDATE SET ergänzen
//   GET  /posts:    optional abgelaufene Beiträge serverseitig ausfiltern
// TODO: is_pinned – DB-Spalte fehlt noch in der posts-Tabelle.
// Sobald die Spalte existiert (ALTER TABLE posts ADD COLUMN is_pinned BOOLEAN NOT NULL DEFAULT FALSE):
//   POST /posts:    is_pinned aus req.body übernehmen, in INSERT-Query ergänzen
//   PUT  /posts/:id: is_pinned aus req.body übernehmen, in UPDATE SET ergänzen
// TODO: post_category ENUM → TEXT (für Kategorien arbeit/ehrung/jugend/nachruf):
//   ALTER TABLE posts ALTER COLUMN category TYPE TEXT USING category::TEXT;
//   Danach: auskommentierte Einträge in CATEGORIES-Konstanten aller Frontend-Dateien aktivieren
// TODO: Reaktions-Endpunkte (aktuell via Supabase-Client direkt, reaction_types: attending/helping/read):
//   GET    /api/posts/:id/reactions      – Reaktionen mit Member-Daten
//   POST   /api/posts/:id/reactions      – Reaktion hinzufügen
//   DELETE /api/posts/:id/reactions/:rid – Reaktion entfernen
// TODO: Kommentar-Endpunkte (aktuell via Supabase-Client direkt umgesetzt):
//   GET    /api/posts/:id/comments       – alle Kommentare eines Beitrags
//   POST   /api/posts/:id/comments       – neuen Kommentar erstellen
//   DELETE /api/posts/:id/comments/:cid  – Kommentar löschen
//   Voraussetzung: ALTER TABLE post_comments ADD COLUMN club_id UUID REFERENCES clubs(id) ON DELETE CASCADE;
//                  ALTER TABLE post_comments ADD COLUMN deleted_at TIMESTAMPTZ;

router.get("/posts", requireAuth, async (req, res) => {
  const includeArchived = req.query.includeArchived === 'true';
  const result = await pool.query(
    `SELECT * FROM posts WHERE club_id = $1${includeArchived ? '' : " AND publication_status != 'archived'"} ORDER BY created_at DESC`,
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
  const { title, content, category, audience, publication_status, owner_type, owner_id,
          submitted_at, approved_at, approved_by_member_id, event_id, cover_image_path } = req.body;
  console.log("[POST /api/posts] reached:", { title, audience, publication_status, owner_type, owner_id });
  if (!title) return res.status(400).json({ error: "Titel erforderlich" });
  const id = uuidv4();
  const result = await pool.query(
    `INSERT INTO posts (id, club_id, title, content, category, audience, publication_status,
      owner_type, owner_id, created_by_member_id, cover_image_path,
      submitted_at, approved_at, approved_by_member_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
    [id, req.clubId, title, content || null, category || "other",
     audience || "club_internal", publication_status || "draft",
     owner_type || "club", owner_id || req.clubId, req.member.id,
     cover_image_path || null,
     submitted_at || null, approved_at || null, approved_by_member_id || null]
  );
  const post = result.rows[0];
  console.log("[POST /api/posts] post created:", { id: post.id, status: post.publication_status, audience: post.audience, owner_type: post.owner_type, owner_id: post.owner_id, club_id: post.club_id });
  if (post.publication_status === "approved") {
    console.log("[POST /api/posts] triggering notifyPostPublished");
    notifyPostPublished(pool, post).catch((err) =>
      console.error("[POST /api/posts] notifyPostPublished FEHLER:", err)
    );
  } else {
    console.log("[POST /api/posts] status nicht 'approved', kein Notify. Status:", post.publication_status);
  }
  res.status(201).json(post);
});

router.put("/posts/:id", requireAuth, async (req, res) => {
  const { title, content, category, audience, publication_status, approved_at, approved_by_member_id,
          rejection_reason, submitted_at, cover_image_path } = req.body;
  const prevRes = await pool.query(
    "SELECT publication_status FROM posts WHERE id = $1 AND club_id = $2",
    [req.params.id, req.clubId]
  );
  if (!prevRes.rows[0]) return res.status(404).json({ error: "Nicht gefunden" });
  const prevStatus = prevRes.rows[0].publication_status;
  const result = await pool.query(
    `UPDATE posts SET
      title = COALESCE($1, title), content = COALESCE($2, content), category = COALESCE($3, category),
      audience = COALESCE($4, audience), publication_status = COALESCE($5, publication_status),
      approved_at = $6, approved_by_member_id = $7, rejection_reason = $8,
      submitted_at = $9, cover_image_path = COALESCE($10, cover_image_path),
      updated_at = now()
     WHERE id = $11 AND club_id = $12 RETURNING *`,
    [title, content ?? null, category, audience, publication_status,
     approved_at ?? null, approved_by_member_id ?? null,
     rejection_reason ?? null, submitted_at ?? null,
     cover_image_path ?? null,
     req.params.id, req.clubId]
  );
  if (!result.rows[0]) return res.status(404).json({ error: "Nicht gefunden" });
  const post = result.rows[0];
  if (prevStatus !== "approved" && post.publication_status === "approved") {
    console.log("[PUT /api/posts/:id] triggering notifyPostPublished, prevStatus:", prevStatus);
    notifyPostPublished(pool, post).catch((err) =>
      console.error("[PUT /api/posts/:id] notifyPostPublished FEHLER:", err)
    );
  } else {
    console.log("[PUT /api/posts/:id] kein Notify. prevStatus:", prevStatus, "newStatus:", post.publication_status);
  }
  res.json(post);
});

router.delete("/posts/:id", requireAuth, async (req, res) => {
  const result = await pool.query(
    "UPDATE posts SET publication_status = 'archived', updated_at = now() WHERE id = $1 AND club_id = $2 RETURNING *",
    [req.params.id, req.clubId]
  );
  if (!result.rows[0]) return res.status(404).json({ error: "Nicht gefunden" });
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

// ─── Post Comments & Reactions ────────────────────────────────────────────────

router.get("/posts/:id/comments", requireAuth, requireActiveMember, async (req, res) => {
  try {
    const postRes = await pool.query(
      "SELECT * FROM posts WHERE id = $1 AND club_id = $2",
      [req.params.id, req.clubId]
    );
    if (!postRes.rows[0]) return res.status(404).json({ error: "Beitrag nicht gefunden" });
    const post = postRes.rows[0];
    if (post.audience === 'company_only') {
      const m = await pool.query(
        "SELECT id FROM member_company_memberships WHERE member_id = $1 AND company_id = $2",
        [req.member.id, post.owner_id]
      );
      if (!m.rows[0]) return res.status(403).json({ error: "Kein Zugriff" });
    }
    const result = await pool.query(
      `SELECT pc.id, pc.post_id, pc.author_member_id, pc.content, pc.created_at,
        json_build_object('first_name', m.first_name, 'last_name', m.last_name, 'avatar_url', m.avatar_url) AS author
       FROM post_comments pc
       JOIN members m ON m.id = pc.author_member_id
       WHERE pc.post_id = $1 ORDER BY pc.created_at ASC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("GET /posts/:id/comments error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

router.post("/posts/:id/comments", requireAuth, requireActiveMember, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ error: "Inhalt erforderlich" });
    const postRes = await pool.query(
      "SELECT * FROM posts WHERE id = $1 AND club_id = $2",
      [req.params.id, req.clubId]
    );
    if (!postRes.rows[0]) return res.status(404).json({ error: "Beitrag nicht gefunden" });
    const post = postRes.rows[0];
    if (post.comments_enabled === false)
      return res.status(403).json({ error: "Kommentare sind für diesen Beitrag deaktiviert" });
    if (post.audience === 'company_only') {
      const m = await pool.query(
        "SELECT id FROM member_company_memberships WHERE member_id = $1 AND company_id = $2",
        [req.member.id, post.owner_id]
      );
      if (!m.rows[0]) return res.status(403).json({ error: "Kein Zugriff" });
    }
    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO post_comments (id, post_id, author_member_id, content)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [id, req.params.id, req.member.id, content.trim()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("POST /posts/:id/comments error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

router.delete("/posts/:id/comments/:cid", requireAuth, requireActiveMember, async (req, res) => {
  try {
    const commentRes = await pool.query(
      `SELECT pc.* FROM post_comments pc
       JOIN posts p ON p.id = pc.post_id
       WHERE pc.id = $1 AND p.club_id = $2`,
      [req.params.cid, req.clubId]
    );
    if (!commentRes.rows[0]) return res.status(404).json({ error: "Kommentar nicht gefunden" });
    const comment = commentRes.rows[0];
    if (comment.author_member_id !== req.member.id && !req.isAdmin)
      return res.status(403).json({ error: "Keine Berechtigung" });
    await pool.query("DELETE FROM post_comments WHERE id = $1", [req.params.cid]);
    res.json({ success: true });
  } catch (err) {
    console.error("DELETE /posts/:id/comments/:cid error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

router.get("/posts/:id/reactions", requireAuth, requireActiveMember, async (req, res) => {
  try {
    const postRes = await pool.query(
      "SELECT * FROM posts WHERE id = $1 AND club_id = $2",
      [req.params.id, req.clubId]
    );
    if (!postRes.rows[0]) return res.status(404).json({ error: "Beitrag nicht gefunden" });
    const post = postRes.rows[0];
    if (post.audience === 'company_only') {
      const m = await pool.query(
        "SELECT id FROM member_company_memberships WHERE member_id = $1 AND company_id = $2",
        [req.member.id, post.owner_id]
      );
      if (!m.rows[0]) return res.status(403).json({ error: "Kein Zugriff" });
    }
    const result = await pool.query(
      `SELECT pr.id, pr.post_id, pr.member_id, pr.reaction, pr.created_at,
        json_build_object('first_name', m.first_name, 'last_name', m.last_name, 'avatar_url', m.avatar_url) AS member
       FROM post_reactions pr
       JOIN members m ON m.id = pr.member_id
       WHERE pr.post_id = $1 ORDER BY pr.created_at ASC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("GET /posts/:id/reactions error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

router.post("/posts/:id/reactions", requireAuth, requireActiveMember, async (req, res) => {
  try {
    const { reaction } = req.body;
    const allowed = ['attending', 'helping', 'read', 'like'];
    if (!reaction || !allowed.includes(reaction))
      return res.status(400).json({ error: "Ungültige Reaktion" });
    const postRes = await pool.query(
      "SELECT * FROM posts WHERE id = $1 AND club_id = $2",
      [req.params.id, req.clubId]
    );
    if (!postRes.rows[0]) return res.status(404).json({ error: "Beitrag nicht gefunden" });
    const post = postRes.rows[0];
    if (post.audience === 'company_only') {
      const m = await pool.query(
        "SELECT id FROM member_company_memberships WHERE member_id = $1 AND company_id = $2",
        [req.member.id, post.owner_id]
      );
      if (!m.rows[0]) return res.status(403).json({ error: "Kein Zugriff" });
    }
    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO post_reactions (id, post_id, member_id, reaction)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (post_id, member_id, reaction) DO NOTHING RETURNING *`,
      [id, req.params.id, req.member.id, reaction]
    );
    res.status(201).json(result.rows[0] || { post_id: req.params.id, member_id: req.member.id, reaction });
  } catch (err) {
    console.error("POST /posts/:id/reactions error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

router.delete("/posts/:id/reactions/:rid", requireAuth, requireActiveMember, async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM post_reactions WHERE id = $1 AND member_id = $2 AND post_id = $3",
      [req.params.rid, req.member.id, req.params.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: "Reaktion nicht gefunden" });
    res.json({ success: true });
  } catch (err) {
    console.error("DELETE /posts/:id/reactions/:rid error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// ─── Notifications ────────────────────────────────────────────────────────────

router.get("/notifications", requireAuth, async (req, res) => {
  if (!req.member) return res.json([]);

  const result = await pool.query(
    `SELECT id, recipient_member_id, type, title, message,
            related_entity_id AS reference_id,
            related_entity_type AS reference_type,
            link, is_read, created_at
     FROM notifications
     WHERE recipient_member_id = $1
     ORDER BY created_at DESC LIMIT 50`,
    [req.member.id]
  );
  res.json(result.rows);
});

router.put("/notifications/:id/read", requireAuth, async (req, res) => {
  if (!req.member) return res.json({ success: true });

  await pool.query(
    "UPDATE notifications SET is_read = true WHERE id = $1 AND recipient_member_id = $2",
    [req.params.id, req.member.id]
  );
  res.json({ success: true });
});

router.put("/notifications/read-all", requireAuth, async (req, res) => {
  if (!req.member) return res.json({ success: true });

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
  const { event_id } = req.query;
  try {
    let query = `
      SELECT ws.*, 
        json_agg(
          json_build_object(
            'id', wsa.id,
            'work_shift_id', wsa.work_shift_id,
            'member_id', wsa.member_id,
            'status', wsa.status,
            'member', CASE WHEN m.id IS NOT NULL THEN json_build_object('id', m.id, 'first_name', m.first_name, 'last_name', m.last_name) ELSE NULL END
          )
        ) FILTER (WHERE wsa.id IS NOT NULL) as assignments
      FROM work_shifts ws
      LEFT JOIN work_shift_assignments wsa ON wsa.work_shift_id = ws.id
      LEFT JOIN members m ON m.id = wsa.member_id
      WHERE ws.club_id = $1`;
    const params = [req.clubId];

    if (event_id) {
      params.push(event_id);
      query += ` AND ws.event_id = $${params.length}`;
    }

    query += ` GROUP BY ws.id ORDER BY ws.start_at ASC`;
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("GET /work-shifts error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
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

router.put("/work-shifts/:id", requireAuth, async (req, res) => {
  const { title, description, start_at, end_at, required_slots, owner_type, owner_id } = req.body;
  if (!title || !start_at) return res.status(400).json({ error: "Pflichtfelder fehlen" });
  try {
    await pool.query(
      `UPDATE work_shifts SET title=$1, description=$2, start_at=$3, end_at=$4, required_slots=$5, owner_type=$6, owner_id=$7 WHERE id=$8 AND club_id=$9`,
      [title, description || null, start_at, end_at || null, required_slots || 1, owner_type || "club", owner_id, req.params.id, req.clubId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("PUT /work-shifts/:id error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
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
       VALUES ($1, $2, $3, 'signed_up')
       ON CONFLICT (work_shift_id, member_id)
       DO UPDATE SET status = 'signed_up'`,
      [id, req.params.id, req.member.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Serverfehler" });
  }
});

// POST /api/work-shifts/:id/assignments – Admin weist Mitglied manuell zu
router.post("/work-shifts/:id/assignments", requireAuth, async (req, res) => {
  const { memberId } = req.body;
  if (!memberId) return res.status(400).json({ error: "memberId erforderlich" });
  try {
    const shiftCheck = await pool.query(
      "SELECT id FROM work_shifts WHERE id = $1 AND club_id = $2",
      [req.params.id, req.clubId]
    );
    if (!shiftCheck.rows[0]) return res.status(404).json({ error: "Schicht nicht gefunden" });

    const memberCheck = await pool.query(
      "SELECT id FROM members WHERE id = $1 AND club_id = $2",
      [memberId, req.clubId]
    );
    if (!memberCheck.rows[0]) return res.status(404).json({ error: "Mitglied nicht gefunden" });

    const id = uuidv4();
    await pool.query(
      `INSERT INTO work_shift_assignments (id, work_shift_id, member_id, status)
       VALUES ($1, $2, $3, 'signed_up')
       ON CONFLICT (work_shift_id, member_id)
       DO UPDATE SET status = 'signed_up'`,
      [id, req.params.id, memberId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("POST /work-shifts/:id/assignments error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// DELETE /api/work-shift-assignments/:id (Austragen)
router.delete("/work-shift-assignments/:id", requireAuth, async (req, res) => {
  try {
    await pool.query("DELETE FROM work_shift_assignments WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Serverfehler" });
  }
});

// PUT /api/work-shift-assignments/:id (Status ändern)
router.put("/work-shift-assignments/:id", requireAuth, async (req, res) => {
  const { status } = req.body;
  try {
    await pool.query("UPDATE work_shift_assignments SET status = $1 WHERE id = $2", [status, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Serverfehler" });
  }
});

// POST /api/work-shift-assignments/bulk-status (Mehrere als erledigt markieren)
router.post("/work-shift-assignments/bulk-status", requireAuth, async (req, res) => {
  const { ids, status } = req.body;
  if (!Array.isArray(ids) || !status) return res.status(400).json({ error: "Ungültige Daten" });
  try {
    await pool.query("UPDATE work_shift_assignments SET status = $1 WHERE id = ANY($2)", [status, ids]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Serverfehler" });
  }
});

// ─── Awards ───────────────────────────────────────────────────────────────────

router.get(["/awards", "/member_awards", "/awards/requests", "/award-requests"], requireAuth, async (req, res) => {
  try {
    const { member_id, status, award_type_id, category } = req.query;
    let query = `
      SELECT ma.*,
             at.name as award_type_name, at.icon as award_type_icon,
             at.category as award_type_category, at.is_bhds_standard as award_is_bhds_standard,
             m.first_name, m.last_name, m.avatar_url,
             r.first_name as requester_first_name, r.last_name as requester_last_name,
             appr.first_name as approver_first_name, appr.last_name as approver_last_name
      FROM member_awards ma
      LEFT JOIN award_types at ON at.id = ma.award_type_id
      LEFT JOIN members m ON m.id = ma.member_id
      LEFT JOIN members r ON r.id = ma.requested_by_member_id
      LEFT JOIN members appr ON appr.id = ma.approved_by_member_id
      WHERE ma.club_id = $1`;
    const params = [req.clubId];

    if (member_id) {
      query += ` AND ma.member_id = $${params.length + 1}`;
      params.push(member_id);
    }

    if (status) {
      query += ` AND ma.status = $${params.length + 1}`;
      params.push(status);
    }

    if (award_type_id) {
      query += ` AND ma.award_type_id = $${params.length + 1}`;
      params.push(award_type_id);
    }

    if (category) {
      query += ` AND at.category = $${params.length + 1}`;
      params.push(category);
    }

    query += " ORDER BY ma.awarded_at DESC, ma.created_at DESC";
    const result = await pool.query(query, params);

    const awards = result.rows.map(row => ({
      ...row,
      member: row.first_name ? {
        id: row.member_id,
        first_name: row.first_name,
        last_name: row.last_name,
        avatar_url: row.avatar_url
      } : null,
      requested_by: row.requester_first_name ? {
        id: row.requested_by_member_id,
        first_name: row.requester_first_name,
        last_name: row.requester_last_name
      } : null,
      approved_by: row.approver_first_name ? {
        id: row.approved_by_member_id,
        first_name: row.approver_first_name,
        last_name: row.approver_last_name
      } : null,
      award_type_info: row.award_type_id ? {
        id: row.award_type_id,
        name: row.award_type_name,
        icon: row.award_type_icon,
        category: row.award_type_category,
        is_bhds_standard: row.award_is_bhds_standard
      } : null
    }));

    res.json(awards);
  } catch (err) {
    console.error("GET /awards error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

router.get(["/award-types", "/award_types", "/awards/types"], requireAuth, async (req, res) => {
  try {
    let query = `SELECT id, club_id, name, description, icon, badge_color, scope_type, scope_id,
                        is_active, is_bhds_standard, category, requirements, special_notes, sort_order
                 FROM award_types WHERE club_id = $1`;
    const params = [req.clubId];

    if (req.query.is_active !== undefined) {
      params.push(req.query.is_active === "true");
      query += ` AND is_active = $${params.length}`;
    }

    query += " ORDER BY sort_order ASC, name ASC";
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) { console.error("Award types fetch error:", err); res.status(500).json({ error: "Serverfehler" }); }
});

router.post("/award-types", requireAuth, async (req, res) => {
  try {
    const { name, description, icon, badge_color, scope_type, scope_id, is_active, category } = req.body;
    const result = await pool.query(
      `INSERT INTO award_types (id, club_id, name, description, icon, badge_color, scope_type, scope_id, is_active, is_bhds_standard, category, sort_order)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, false, $9, 99)
       RETURNING id, club_id, name, description, icon, badge_color, scope_type, scope_id, is_active, is_bhds_standard, category, requirements, special_notes, sort_order`,
      [
        req.clubId,
        name,
        description || null,
        icon || 'medal',
        badge_color || 'gold',
        scope_type || 'club',
        scope_type === 'company' ? (scope_id || null) : null,
        is_active !== false,
        category || 'custom',
      ]
    );
    res.json(result.rows[0]);
  } catch (err) { console.error("Award type creation error:", err); res.status(500).json({ error: "Serverfehler" }); }
});

router.put("/award-types/:id", requireAuth, async (req, res) => {
  try {
    const { name, description, icon, badge_color, scope_type, scope_id, is_active, category } = req.body;

    // BHDS-Standard-Auszeichnungen dürfen nur in is_active geändert werden
    const existing = await pool.query(
      "SELECT is_bhds_standard FROM award_types WHERE id=$1 AND club_id=$2",
      [req.params.id, req.clubId]
    );
    if (!existing.rows[0]) return res.status(404).json({ error: "Nicht gefunden" });

    let result;
    if (existing.rows[0].is_bhds_standard) {
      result = await pool.query(
        `UPDATE award_types SET is_active=$1
         WHERE id=$2 AND club_id=$3
         RETURNING id, club_id, name, description, icon, badge_color, scope_type, scope_id,
                   is_active, is_bhds_standard, category, requirements, special_notes, sort_order`,
        [is_active !== false, req.params.id, req.clubId]
      );
    } else {
      result = await pool.query(
        `UPDATE award_types
         SET name=$1, description=$2, icon=$3, badge_color=$4, scope_type=$5, scope_id=$6, is_active=$7, category=$8
         WHERE id=$9 AND club_id=$10
         RETURNING id, club_id, name, description, icon, badge_color, scope_type, scope_id,
                   is_active, is_bhds_standard, category, requirements, special_notes, sort_order`,
        [
          name,
          description || null,
          icon || 'medal',
          badge_color || 'gold',
          scope_type || 'club',
          scope_type === 'company' ? (scope_id || null) : null,
          is_active !== false,
          category || 'custom',
          req.params.id,
          req.clubId,
        ]
      );
    }
    res.json(result.rows[0]);
  } catch (err) { console.error("Award type update error:", err); res.status(500).json({ error: "Serverfehler" }); }
});

router.delete("/award-types/:id", requireAuth, async (req, res) => {
  try {
    const check = await pool.query(
      "SELECT is_bhds_standard FROM award_types WHERE id=$1 AND club_id=$2",
      [req.params.id, req.clubId]
    );
    if (!check.rows[0]) return res.status(404).json({ error: "Nicht gefunden" });
    if (check.rows[0].is_bhds_standard) {
      return res.status(403).json({ error: "BHDS-Standardauszeichnungen können nicht gelöscht werden. Sie können jedoch deaktiviert werden." });
    }
    await pool.query("DELETE FROM award_types WHERE id=$1 AND club_id=$2", [req.params.id, req.clubId]);
    res.json({ success: true });
  } catch (err) { console.error("Award type deletion error:", err); res.status(500).json({ error: "Serverfehler" }); }
});

router.post("/awards", requireAuth, async (req, res) => {
  try {
    const {
      member_id, title, description, awarded_at, award_type,
      award_type_id, company_id, is_regiment, requested_by_member_id, status,
      awarded_by, notes
    } = req.body;

    if (!member_id) {
      return res.status(400).json({ error: "Mitglied-ID ist erforderlich" });
    }

    // Bestimme Titel: entweder explizit oder vom award_type_id ableiten
    let resolvedTitle = title;
    let resolvedIcon = award_type || 'medal';

    if (award_type_id) {
      const typeResult = await pool.query(
        "SELECT id, name, icon FROM award_types WHERE id = $1 AND club_id = $2 AND is_active = true",
        [award_type_id, req.clubId]
      );
      if (!typeResult.rows[0]) {
        return res.status(400).json({ error: "Dieser Auszeichnungstyp ist nicht aktiv und kann nicht verliehen werden" });
      }
      if (!resolvedTitle) resolvedTitle = typeResult.rows[0].name;
      resolvedIcon = typeResult.rows[0].icon || resolvedIcon;
    }

    if (!resolvedTitle) {
      return res.status(400).json({ error: "Titel oder Auszeichnungstyp ist erforderlich" });
    }

    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO member_awards (
        id, club_id, member_id, title, description, awarded_at,
        award_type, award_type_id, company_id, is_regiment,
        requested_by_member_id, status, approved_by_member_id, approved_at,
        awarded_by, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING *`,
      [
        id, req.clubId, member_id, resolvedTitle, description || null, awarded_at || new Date(),
        resolvedIcon, award_type_id || null, company_id || null,
        is_regiment === undefined ? true : is_regiment,
        requested_by_member_id || req.member.id,
        status || 'approved',
        status === 'approved' ? req.member.id : null,
        status === 'approved' ? new Date() : null,
        awarded_by || null,
        notes || null
      ]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("POST /awards error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

router.put("/awards/:id", requireAuth, async (req, res) => {
  try {
    const {
      title, description, awarded_at, award_type, award_type_id, company_id, is_regiment,
      status, rejection_reason, approved_by_member_id, approved_at,
      awarded_by, notes
    } = req.body;
    const result = await pool.query(
      `UPDATE member_awards SET
        title = COALESCE($1, title),
        description = $2,
        awarded_at = COALESCE($3, awarded_at),
        award_type = COALESCE($4, award_type),
        award_type_id = COALESCE($5, award_type_id),
        company_id = $6,
        is_regiment = COALESCE($7, is_regiment),
        status = COALESCE($8, status),
        rejection_reason = $9,
        approved_by_member_id = $10,
        approved_at = $11,
        awarded_by = $12,
        notes = $13
       WHERE id=$14 AND club_id=$15 RETURNING *`,
      [
        title || null, description || null, awarded_at || null, award_type || null,
        award_type_id || null, company_id || null,
        is_regiment !== undefined ? is_regiment : null,
        status || null, rejection_reason || null, approved_by_member_id || null, approved_at || null,
        awarded_by || null, notes || null,
        req.params.id, req.clubId
      ]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Nicht gefunden" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error("PUT /awards error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

router.delete("/awards/:id", requireAuth, async (req, res) => {
  try {
    await pool.query("DELETE FROM member_awards WHERE id=$1 AND club_id=$2", [req.params.id, req.clubId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: "Serverfehler" }); }
});

router.post("/awards/:id/certificate", requireAuth, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Keine Datei hochgeladen" });

    const award = await pool.query(
      "SELECT id, certificate_url FROM member_awards WHERE id=$1 AND club_id=$2",
      [req.params.id, req.clubId]
    );
    if (!award.rows[0]) return res.status(404).json({ error: "Auszeichnung nicht gefunden" });

    // Altes Zertifikat löschen falls vorhanden
    if (award.rows[0].certificate_url) {
      await deleteFile("documents", award.rows[0].certificate_url).catch(() => {});
    }

    const ext = req.file.originalname.split(".").pop();
    const fileName = `awards/${req.params.id}/certificate-${Date.now()}.${ext}`;
    const path = await saveFile("documents", fileName, req.file.path, req.file.mimetype);

    await pool.query(
      "UPDATE member_awards SET certificate_url=$1 WHERE id=$2 AND club_id=$3",
      [path, req.params.id, req.clubId]
    );
    res.json({ certificate_url: path });
  } catch (err) {
    console.error("POST /awards/:id/certificate error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
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

// ─── Magazine Ads ─────────────────────────────────────────────────────────────

router.get("/magazine-ads", requireAuth, async (req, res) => {
  try {
    const { magazine_id } = req.query;
    let query = "SELECT * FROM magazine_ads WHERE club_id = $1";
    const params = [req.clubId];
    if (magazine_id) {
      params.push(magazine_id);
      query += ` AND magazine_id = $${params.length}`;
    }
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Serverfehler" });
  }
});

router.post("/magazine-ads", requireAuth, async (req, res) => {
  try {
    const { magazine_id, title, advertiser_name, status, price } = req.body;
    const id = uuidv4();
    const result = await pool.query(
      "INSERT INTO magazine_ads (id, club_id, magazine_id, title, advertiser_name, status, price) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *",
      [id, req.clubId, magazine_id, title, advertiser_name, status || 'pending', price || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Serverfehler" });
  }
});

router.delete("/magazine-ads/:id", requireAuth, async (req, res) => {
  try {
    await pool.query("DELETE FROM magazine_ads WHERE id = $1 AND club_id = $2", [req.params.id, req.clubId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Serverfehler" });
  }
});

// ─── Public URLs helper ───────────────────────────────────────────────────────

router.get("/storage-url", requireAuth, (req, res) => {
  const { bucket, path: filePath } = req.query;
  if (!bucket || !filePath) return res.status(400).json({ error: "bucket und path erforderlich" });
  res.json({ url: getPublicUrl(bucket, filePath) });
});

// ─── Generischer Upload-Endpoint ─────────────────────────────────────────────
// POST /api/upload - universeller File-Upload (ersetzt supabase.storage.from(bucket).upload())
router.post("/upload", requireAuth, upload.single("file"), async (req, res) => {
  try {
    console.log("[API] /upload - Request received.");
    if (!req.file) return res.status(400).json({ error: "Keine Datei" });
    const { bucket, path: filePathFromClient } = req.body; // path ist hier filePathFromClient
    if (!bucket) return res.status(400).json({ error: "Bucket fehlt" });

    const filePath = filePathFromClient || req.file.originalname;
    console.log(`[API] /upload - Bucket: ${bucket}, FilePath: ${filePath}`);
    const savedPath = await saveFile(req.file, bucket, filePath);
    const publicUrl = getPublicUrl(bucket, savedPath);

    res.json({ path: savedPath, publicUrl, bucket, filePath });
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
    if (club_id && club_id !== req.clubId) {
      return res.status(403).json({ error: "Keine Berechtigung für diesen Verein" });
    }
    const id = uuidv4();
    await pool.query(
      `INSERT INTO member_gallery_images
       (id, member_id, club_id, company_id, image_path, visibility, usage_permission, description, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id, member_id, req.clubId, company_id || null, image_path, visibility, usage_permission || "internal", description || null, status || "pending"]
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
      role_name: r.title || 'Mitglied',
      member: {
        id: r.member_id,
        first_name: r.first_name,
        last_name: r.last_name,
        avatar_url: r.avatar_url,
        title: r.member_title,
      },
      roles: { name: r.title || 'Mitglied' } // Kompatibilität für Supabase-Join Syntax
    } ));
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
    const { member_id } = req.query;
    let query = `SELECT a.*,
              COALESCE(a.title, r.name, 'Mitglied') as resolved_role_name,
              r.id as resolved_role_id,
              c.name as company_name,
              m.first_name,
              m.last_name
       FROM appointments a
       LEFT JOIN roles r ON (r.name = a.title OR r.id::text = a.title) AND r.club_id = a.club_id
       LEFT JOIN companies c ON c.id = a.scope_id AND a.scope_type = 'company'
       LEFT JOIN members m ON m.id = a.member_id
       WHERE a.club_id = $1`;
    const params = [req.clubId];

    if (member_id) {
      params.push(member_id);
      query += ` AND a.member_id = $${params.length}`;
    }

    query += ` ORDER BY a.valid_from DESC NULLS LAST`;

    const result = await pool.query(query, params);
    const appointments = (result.rows || []).map(row => ({
      ...row,
      role_id: row.role_id || row.resolved_role_id,
      role_name: row.resolved_role_name,
      roles: { name: row.resolved_role_name, id: row.resolved_role_id } 
    }));
    res.json(appointments);
  } catch (err) {
    console.error("appointments GET error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// POST /api/appointments
router.post("/appointments", requireAuth, requireAdmin, async (req, res) => {
  try {
    let { member_id, title, role_id, scope_type, scope_id, valid_from, valid_to } = req.body;
    
    // Fallback: Wenn title fehlt, aber role_id vorhanden ist (Migration-Support)
    if (!title && role_id) {
      const roleRow = await pool.query("SELECT name FROM roles WHERE id = $1", [role_id]);
      if (roleRow.rows[0]) title = roleRow.rows[0].name;
    }

    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO appointments (id, club_id, member_id, title, role_id, scope_type, scope_id, valid_from, valid_to, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now()) RETURNING *`,
      [id, req.clubId, member_id, title || 'Mitglied', role_id || null, scope_type || "club", scope_id || req.clubId, valid_from || null, valid_to || null]
    );

    // Berechtigungen für dieses Amt sofort verknüpfen
    if (role_id && member_id) {
      const mraScopeId = (scope_type === 'company' ? scope_id : req.clubId) || req.clubId;
      await pool.query(
        `INSERT INTO member_role_assignments (id, member_id, role_id, scope_type, scope_id)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (member_id, role_id, scope_type, scope_id) DO NOTHING`,
        [uuidv4(), member_id, role_id, scope_type || 'club', mraScopeId]
      );
    }

    const newAppointment = {
      ...result.rows[0],
      role_name: result.rows[0].title,
      roles: { name: result.rows[0].title, id: role_id || null }
    };
    res.json(newAppointment);
  } catch (err) {
    console.error("appointments POST error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// PUT /api/appointments/:id
router.put("/appointments/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    let { member_id, title, role_id, scope_type, scope_id, valid_from, valid_to } = req.body;

    // Fallback für role_id lookup
    if (!title && role_id) {
      const roleRow = await pool.query("SELECT name FROM roles WHERE id = $1", [role_id]);
      if (roleRow.rows[0]) title = roleRow.rows[0].name;
    }

    const result = await pool.query(
      `UPDATE appointments SET
         member_id   = COALESCE($1, member_id),
         title       = COALESCE($2, title),
         scope_type  = COALESCE($3, scope_type),
         scope_id    = COALESCE($4, scope_id),
         valid_from  = $5,
         valid_to    = $6
       WHERE id = $7 AND club_id = $8
       RETURNING *`,
      [member_id || null, title || null, scope_type || null, scope_id || null,
       valid_from || null, valid_to || null, req.params.id, req.clubId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Nicht gefunden" });

    // member_role_assignments mit valid_to-Änderung synchronisieren
    const apt = result.rows[0];
    if (apt.role_id) {
      const mraScopeId = apt.scope_type === 'company' ? apt.scope_id : req.clubId;
      if (apt.valid_to) {
        await pool.query(
          `DELETE FROM member_role_assignments
           WHERE member_id=$1 AND role_id=$2 AND scope_type=$3 AND scope_id=$4`,
          [apt.member_id, apt.role_id, apt.scope_type, mraScopeId]
        );
      } else {
        await pool.query(
          `INSERT INTO member_role_assignments (id, member_id, role_id, scope_type, scope_id)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (member_id, role_id, scope_type, scope_id) DO NOTHING`,
          [uuidv4(), apt.member_id, apt.role_id, apt.scope_type, mraScopeId]
        );
      }
    }

    const updatedAppointment = {
      ...result.rows[0],
      role_name: result.rows[0].title,
      roles: { name: result.rows[0].title, id: role_id || null }
    };
    res.json(updatedAppointment);
  } catch (err) {
    console.error("appointments PUT error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// DELETE /api/appointments/:id
router.delete("/appointments/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    // Erst Appointment lesen, um member_role_assignments bereinigen zu können
    const aptRes = await pool.query(
      "SELECT member_id, role_id, scope_type, scope_id FROM appointments WHERE id=$1 AND club_id=$2",
      [req.params.id, req.clubId]
    );
    const apt = aptRes.rows[0];
    if (apt?.role_id) {
      const scopeId = apt.scope_type === 'company' ? apt.scope_id : req.clubId;
      await pool.query(
        `DELETE FROM member_role_assignments
         WHERE member_id=$1 AND role_id=$2 AND scope_type=$3 AND scope_id=$4`,
        [apt.member_id, apt.role_id, apt.scope_type, scopeId]
      );
    }

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
router.post("/delegations", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { from_member_id, to_member_id, title, valid_from, valid_to } = req.body;
    const id = uuidv4();
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
router.put("/delegations/:id", requireAuth, requireAdmin, async (req, res) => {
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
router.delete("/delegations/:id", requireAuth, requireAdmin, async (req, res) => {
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

// ─── Roles ────────────────────────────────────────────────────────────────────

// GET /api/roles
router.get("/roles", requireAuth, async (req, res) => {
  try {
    if (!req.clubId) {
      return res.status(401).json({ error: "Nicht authentifiziert oder Club-ID fehlt" });
    }
    
    const query = `
      SELECT id, club_id, name, level, is_default, created_at
      FROM roles
      WHERE club_id = $1
      ORDER BY name ASC
    `;
    const { rows } = await pool.query(query, [req.clubId]);
    res.json(rows);
  } catch (err) {
    console.error("roles GET error:", err);
    res.status(500).json({ error: "Serverfehler beim Abrufen der Ämter" });
  }
});

// GET /api/roles/:id
router.get("/roles/:id", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM roles WHERE id = $1 AND club_id = $2",
      [req.params.id, req.clubId]
    );
    if (!rows[0]) return res.status(404).json({ error: "Amt nicht gefunden" });
    res.json(rows[0]);
  } catch (err) {
    console.error("roles GET by ID error:", err);
    res.status(500).json({ error: "Serverfehler beim Abrufen des Amtes" });
  }
});

// POST /api/roles
router.post("/roles", requireAuth, async (req, res) => {
  try {
    const { name, level, is_default } = req.body;
    
    console.log(`[Roles POST] Erstelle Rolle: "${name}" für Club: ${req.clubId}`);
    
    // Validierung
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Amtsbezeichnung ist erforderlich" });
    }
    if (!level || !["club", "company"].includes(level)) {
      return res.status(400).json({ error: "Ebene muss 'club' oder 'company' sein" });
    }
    if (!req.clubId) {
      return res.status(401).json({ error: "Nicht authentifiziert oder Club-ID fehlt" });
    }
    
    const id = uuidv4();
    const { rows } = await pool.query(
      `INSERT INTO roles (id, club_id, name, level, is_default, created_at)
       VALUES ($1, $2, $3, $4, $5, now())
       RETURNING *`,
      [id, req.clubId, name.trim(), level, is_default === true ? true : false]
    );
    
    if (!rows[0]) {
      return res.status(500).json({ error: "Rolle konnte nicht erstellt werden" });
    }
    
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("roles POST error:", err);
    
    // Besseres Error-Handling
    if (err.code === "23505") {
      return res.status(400).json({ error: "Ein Amt mit diesem Namen existiert bereits für diesen Club" });
    }
    if (err.code === "23503") {
      return res.status(400).json({ error: "Club oder Level nicht gefunden" });
    }
    
    res.status(500).json({ error: `Fehler beim Erstellen des Amtes: ${err.message || "Unbekannter Fehler"}` });
  }
});

// PUT /api/roles/:id
router.put("/roles/:id", requireAuth, async (req, res) => {
  try {
    const { name, is_default } = req.body;
    
    if (name !== undefined && (!name || !name.trim())) {
      return res.status(400).json({ error: "Amtsbezeichnung darf nicht leer sein" });
    }
    
    const { rows } = await pool.query(
      `UPDATE roles SET
         name = COALESCE($1, name),
         is_default = COALESCE($2, is_default)
       WHERE id = $3 AND club_id = $4
       RETURNING *`,
      [name ? name.trim() : null, is_default !== undefined ? is_default : null, req.params.id, req.clubId]
    );
    if (!rows[0]) return res.status(404).json({ error: "Amt nicht gefunden" });
    res.json(rows[0]);
  } catch (err) {
    console.error("roles PUT error:", err);
    if (err.code === "23505") {
      return res.status(400).json({ error: "Ein Amt mit diesem Namen existiert bereits" });
    }
    res.status(500).json({ error: "Fehler beim Aktualisieren des Amtes" });
  }
});

// DELETE /api/roles/:id
router.delete("/roles/:id", requireAuth, async (req, res) => {
  try {
    // Prüfe ob Rolle noch Appointments hat
    const role = (await pool.query("SELECT name FROM roles WHERE id = $1", [req.params.id])).rows[0];
    
    const { rows: appointments } = await pool.query(
      "SELECT id FROM appointments WHERE title = $1 AND club_id = $2 AND valid_to IS NULL LIMIT 1",
      [role?.name, req.clubId]
    );
    if (appointments.length > 0) {
      return res.status(400).json({ error: "Amt ist noch besetzt und kann nicht gelöscht werden" });
    }
    
    const { rows: deleted } = await pool.query(
      "DELETE FROM roles WHERE id = $1 AND club_id = $2 RETURNING id",
      [req.params.id, req.clubId]
    );
    
    if (!deleted[0]) {
      return res.status(404).json({ error: "Amt nicht gefunden" });
    }
    
    res.json({ success: true });
  } catch (err) {
    console.error("roles DELETE error:", err);
    res.status(500).json({ error: "Fehler beim Löschen des Amtes" });
  }
});

// ─── Permissions ──────────────────────────────────────────────────────────────

// GET /api/permissions
router.get("/permissions", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, key, description, created_at FROM permissions ORDER BY key ASC"
    );
    res.json(rows);
  } catch (err) {
    console.error("permissions GET error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// ─── Role Permissions ─────────────────────────────────────────────────────────

// GET /api/role-permissions
router.get("/role-permissions", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT rp.id, rp.role_id, rp.permission_id, rp.created_at
       FROM role_permissions rp
       INNER JOIN roles r ON rp.role_id = r.id
       WHERE r.club_id = $1`,
      [req.clubId]
    );
    res.json(rows);
  } catch (err) {
    console.error("role-permissions GET error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// POST /api/role-permissions
router.post("/role-permissions", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { role_id, permission_id } = req.body;
    if (!role_id || !permission_id) {
      return res.status(400).json({ error: "role_id und permission_id sind erforderlich" });
    }
    
    // Verifiziere dass die Rolle zum Club des Users gehört
    const { rows: roleCheck } = await pool.query(
      "SELECT id FROM roles WHERE id = $1 AND club_id = $2",
      [role_id, req.clubId]
    );
    if (!roleCheck[0]) {
      return res.status(403).json({ error: "Keine Berechtigung" });
    }
    
    const id = uuidv4();
    const { rows } = await pool.query(
      `INSERT INTO role_permissions (id, role_id, permission_id, created_at)
       VALUES ($1, $2, $3, now())
       RETURNING *`,
      [id, role_id, permission_id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("role-permissions POST error:", err);
    if (err.code === "23505") { // Unique constraint violation
      return res.status(400).json({ error: "Permission ist bereits diesem Amt zugewiesen" });
    }
    res.status(500).json({ error: "Serverfehler" });
  }
});

// DELETE /api/role-permissions/:id
router.delete("/role-permissions/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    // Verifiziere dass die role_permission zum Club des Users gehört
    const { rows: rp } = await pool.query(
      `SELECT rp.id FROM role_permissions rp
       INNER JOIN roles r ON rp.role_id = r.id
       WHERE rp.id = $1 AND r.club_id = $2`,
      [req.params.id, req.clubId]
    );
    if (!rp[0]) {
      return res.status(403).json({ error: "Keine Berechtigung" });
    }
    
    await pool.query("DELETE FROM role_permissions WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error("role-permissions DELETE error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// ─── Notifications (Bulk Insert) ───────────────────────────────────────────────

// POST /api/notifications/bulk – Bulk-Notifications für mehrere Empfänger
router.post("/notifications/bulk", requireAuth, async (req, res) => {
  try {
    const {
      memberIds, type, title, message, link,
      relatedEntityType, relatedEntityId, excludeMemberId,
    } = req.body;
    if (!Array.isArray(memberIds) || !type || !title) {
      return res.status(400).json({ error: "memberIds[], type und title erforderlich" });
    }
    await insertNotifications(pool, memberIds, {
      type, title, message, link, relatedEntityType, relatedEntityId, excludeMemberId,
    });
    res.status(201).json({ created: memberIds.length });
  } catch (err) {
    console.error("POST /notifications/bulk error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// POST /api/notifications/notify-audience – Benachrichtigt Vereins- oder Kompanie-Mitglieder
router.post("/notifications/notify-audience", requireAuth, async (req, res) => {
  try {
    const {
      scope, companyId,
      type, title, message, link,
      relatedEntityType, relatedEntityId, excludeMemberId,
    } = req.body;

    if (!scope || !type || !title) {
      return res.status(400).json({ error: "scope, type und title erforderlich" });
    }

    let memberIds;
    if (scope === "company") {
      if (!companyId) return res.status(400).json({ error: "companyId erforderlich für scope=company" });
      memberIds = await getCompanyMemberIds(pool, companyId);
    } else {
      memberIds = await getClubMemberIds(pool, req.clubId);
    }

    await insertNotifications(pool, memberIds, {
      type, title, message, link, relatedEntityType, relatedEntityId, excludeMemberId,
    });

    console.log("[notify-audience] scope:", scope, "sent:", memberIds.length);
    res.status(201).json({ sent: memberIds.length });
  } catch (err) {
    console.error("POST /notifications/notify-audience error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// ============================================================
// Vereinsarchiv – Archiv-Einträge (Index-Schicht)
// ============================================================

router.get("/archive/entries", requireAuth, async (req, res) => {
  try {
    const { source_type, source_id } = req.query;

    let query =
      "SELECT id, source_type, source_id, title, archive_category, archive_year, visibility, created_at " +
      "FROM archive_entries WHERE club_id = $1";
    const params = [req.clubId];

    if (source_type) {
      query += ` AND source_type = $${params.length + 1}`;
      params.push(source_type);
    }
    if (source_id) {
      query += ` AND source_id = $${params.length + 1}`;
      params.push(source_id);
    }

    query += " ORDER BY created_at DESC";

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("GET /archive/entries error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

router.post("/archive/entries", requireAuth, async (req, res) => {
  try {
    const {
      source_type,
      source_id,
      title,
      description,
      archive_category,
      archive_year,
      event_date,
      visibility,
      is_public,
      tags,
      related_company_id,
    } = req.body;

    if (!source_type || !source_id || !title) {
      return res.status(400).json({ error: "source_type, source_id und title sind erforderlich" });
    }

    const validTypes = ["document", "post", "gallery_image", "protocol", "event", "magazine", "member_award", "appointment", "custom"];
    if (!validTypes.includes(source_type)) {
      return res.status(400).json({ error: "Ungültiger source_type" });
    }

    if (source_type === "post") {
      const postCheck = await pool.query(
        "SELECT id FROM posts WHERE id = $1 AND club_id = $2",
        [source_id, req.clubId]
      );
      if (!postCheck.rows[0]) {
        return res.status(404).json({ error: "Beitrag nicht gefunden" });
      }
    }

    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO archive_entries
        (id, club_id, source_type, source_id, title, description,
         archive_category, archive_year, event_date,
         visibility, is_public, tags,
         related_company_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [
        id,
        req.clubId,
        source_type,
        source_id,
        title.trim(),
        description ? description.trim() : null,
        archive_category || null,
        archive_year || null,
        event_date || null,
        visibility || "club_internal",
        is_public === true,
        tags || [],
        related_company_id || null,
        req.member.id,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "Dieser Inhalt ist bereits im Vereinsarchiv vorhanden." });
    }
    console.error("POST /archive/entries error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// ─── Public Providers ─────────────────────────────────────────────────────────

// GET /api/public/providers – Dienstleisterverzeichnis (kein Auth)
router.get("/public/providers", async (req, res) => {
  const {
    search, type, state, sort = "name_asc",
    page = "1", limit = "24",
  } = req.query;

  const pageNum  = Math.max(1, parseInt(page, 10) || 1);
  const pageSize = Math.min(200, Math.max(1, parseInt(limit, 10) || 24));
  const offset   = (pageNum - 1) * pageSize;

  const conditions = ["p.is_public = true"];
  const params = [];

  if (search?.trim()) {
    params.push(`%${search.trim()}%`);
    const n = params.length;
    conditions.push(`(p.company_name ILIKE $${n} OR p.city ILIKE $${n} OR p.description ILIKE $${n})`);
  }
  if (type?.trim()) {
    params.push(type.trim());
    conditions.push(`p.provider_type = $${params.length}`);
  }
  if (state?.trim()) {
    params.push(state.trim());
    conditions.push(`p.state = $${params.length}`);
  }

  const ORDER = { name_asc: "p.company_name ASC", created_desc: "p.created_at DESC" }[sort] ?? "p.company_name ASC";
  const where = conditions.join(" AND ");

  try {
    const [rowsRes, countRes] = await Promise.all([
      pool.query(`
        SELECT p.id, p.company_name, p.slug, p.provider_type, p.description,
               p.city, p.state, p.is_verified, p.logo_path
        FROM providers p
        WHERE ${where}
        ORDER BY ${ORDER}
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `, [...params, pageSize, offset]),
      pool.query(`SELECT COUNT(*)::int AS total FROM providers p WHERE ${where}`, params),
    ]);

    const items = rowsRes.rows.map((p) => ({
      ...p,
      logo_url: p.logo_path ? getPublicUrl("provider-assets", p.logo_path) : null,
    }));

    res.json({ items, total: countRes.rows[0].total, page: pageNum, pages: Math.ceil(countRes.rows[0].total / pageSize) });
  } catch (err) {
    console.error("GET /public/providers error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// GET /api/public/providers/:slug – Einzelner Anbieter (kein Auth)
router.get("/public/providers/:slug", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM providers WHERE slug = $1 AND is_public = true",
      [req.params.slug]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Nicht gefunden." });
    const p = result.rows[0];
    if (p.logo_path) p.logo_url = getPublicUrl("provider-assets", p.logo_path);
    if (p.hero_image_path) p.hero_image_url = getPublicUrl("provider-assets", p.hero_image_path);
    res.json(p);
  } catch (err) {
    console.error("GET /public/providers/:slug error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// POST /api/public/providers/:slug/inquire – Kontaktanfrage (kein Auth)
router.post("/public/providers/:slug/inquire", async (req, res) => {
  const { firstname, lastname, email, phone, message } = req.body;
  if (!firstname?.trim() || !lastname?.trim() || !email?.trim() || !message?.trim()) {
    return res.status(400).json({ error: "Vorname, Nachname, E-Mail und Nachricht sind Pflichtfelder." });
  }
  try {
    const providerRes = await pool.query(
      "SELECT id FROM providers WHERE slug = $1 AND is_public = true",
      [req.params.slug]
    );
    if (!providerRes.rows[0]) return res.status(404).json({ error: "Anbieter nicht gefunden." });
    await pool.query(
      `INSERT INTO provider_inquiries (provider_id, firstname, lastname, email, phone, message)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [providerRes.rows[0].id, firstname.trim(), lastname.trim(), email.trim(), phone?.trim() || null, message.trim()]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error("POST /public/providers/:slug/inquire error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// ─── Public Events ────────────────────────────────────────────────────────────

// GET /api/public/events – Öffentlicher Veranstaltungskalender (kein Auth)
router.get("/public/events", async (req, res) => {
  const {
    search, state, city, club_id, event_type,
    from, to, sort = "start_asc",
    page = "1", limit = "24",
  } = req.query;

  const pageNum  = Math.max(1, parseInt(page, 10) || 1);
  const pageSize = Math.min(200, Math.max(1, parseInt(limit, 10) || 24));
  const offset   = (pageNum - 1) * pageSize;

  const conditions = ["e.audience = 'public'", "e.publication_status = 'approved'", "c.deleted_at IS NULL"];
  const params = [];

  if (search?.trim()) {
    params.push(`%${search.trim()}%`);
    const n = params.length;
    conditions.push(`(e.title ILIKE $${n} OR e.description ILIKE $${n} OR c.name ILIKE $${n} OR COALESCE(e.location_city, e.location) ILIKE $${n})`);
  }
  if (state?.trim()) {
    params.push(state.trim());
    conditions.push(`COALESCE(e.location_state, c.state) = $${params.length}`);
  }
  if (city?.trim()) {
    params.push(`%${city.trim()}%`);
    conditions.push(`(e.location_city ILIKE $${params.length} OR e.location ILIKE $${params.length})`);
  }
  if (club_id?.trim()) {
    params.push(club_id.trim());
    conditions.push(`e.club_id = $${params.length}`);
  }
  if (event_type?.trim()) {
    params.push(event_type.trim());
    conditions.push(`e.event_type = $${params.length}`);
  }
  if (from?.trim()) {
    params.push(from.trim());
    conditions.push(`e.start_at >= $${params.length}`);
  }
  if (to?.trim()) {
    params.push(to.trim());
    conditions.push(`e.start_at <= $${params.length}`);
  }

  const ORDER = { start_asc: "e.start_at ASC", start_desc: "e.start_at DESC", created_desc: "e.created_at DESC" }[sort] ?? "e.start_at ASC";
  const where = conditions.join(" AND ");

  try {
    const [rowsRes, countRes] = await Promise.all([
      pool.query(`
        SELECT e.id, e.title, e.description, e.event_type,
               e.location, e.location_name, e.location_street, e.location_zip,
               e.location_city, e.location_state,
               e.start_at, e.end_at, e.club_id, e.created_at,
               c.name AS club_name, c.slug AS club_slug
        FROM events e
        JOIN clubs c ON c.id = e.club_id
        WHERE ${where}
        ORDER BY ${ORDER}
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `, [...params, pageSize, offset]),
      pool.query(`SELECT COUNT(*)::int AS total FROM events e JOIN clubs c ON c.id = e.club_id WHERE ${where}`, params),
    ]);

    res.json({
      items: rowsRes.rows,
      total: countRes.rows[0].total,
      page: pageNum,
      pages: Math.ceil(countRes.rows[0].total / pageSize),
    });
  } catch (err) {
    console.error("GET /public/events error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// GET /api/public/events/:id – Einzelne öffentliche Veranstaltung (kein Auth)
router.get("/public/events/:id", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT e.*, c.name AS club_name, c.slug AS club_slug, c.logo_path
      FROM events e
      JOIN clubs c ON c.id = e.club_id
      WHERE e.id = $1 AND e.audience = 'public' AND e.publication_status = 'approved'
        AND c.deleted_at IS NULL
    `, [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: "Nicht gefunden." });
    const row = result.rows[0];
    if (row.logo_path) row.logo_url = getPublicUrl("club-assets", row.logo_path);
    res.json(row);
  } catch (err) {
    console.error("GET /public/events/:id error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// ─── Public Clubs Directory ───────────────────────────────────────────────────

// GET /api/public/clubs/check – Vereinssuche & Duplikat-Prüfung (kein Auth)
// Supports: q (combined), name, city, zip
router.get("/public/clubs/check", async (req, res) => {
  const { q, name, city = "", zip = "" } = req.query;

  let searchText = name?.trim() ?? "";
  let searchZip  = zip?.trim() ?? "";
  const searchCity = city?.trim() ?? "";

  if (q?.trim()) {
    const zipMatch = q.trim().match(/\b(\d{4,5})\b/);
    if (zipMatch) {
      searchZip  = zipMatch[1];
      searchText = q.trim().replace(zipMatch[0], "").trim();
    } else {
      searchText = q.trim();
    }
  }

  if (!searchText && !searchZip && !searchCity) {
    return res.status(400).json({ error: "Mindestens ein Suchbegriff erforderlich." });
  }

  try {
    const params = [];
    const conditions = ["c.deleted_at IS NULL"];

    if (searchText) {
      params.push(`%${searchText}%`);
      const n = params.length;
      conditions.push(
        `(c.name ILIKE $${n} OR COALESCE(c.location_city, c.city) ILIKE $${n} OR c.slug ILIKE $${n} OR c.club_number ILIKE $${n})`
      );
    }
    if (searchCity) {
      params.push(`%${searchCity}%`);
      conditions.push(`COALESCE(c.location_city, c.city) ILIKE $${params.length}`);
    }
    if (searchZip) {
      params.push(searchZip);
      conditions.push(`(c.location_zip = $${params.length} OR c.location_zip ILIKE $${params.length} || '%')`);
    }

    const result = await pool.query(
      `SELECT c.id, c.name, c.slug,
              COALESCE(c.location_city, c.city) AS city,
              c.location_zip AS zip, c.claim_status, c.logo_path
       FROM clubs c
       WHERE ${conditions.join(" AND ")}
       ORDER BY c.name ASC
       LIMIT 10`,
      params
    );

    const matches = result.rows.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      city: c.city,
      zip: c.zip,
      claim_status: c.claim_status,
      logo_url: c.logo_path ? getPublicUrl("club-assets", c.logo_path) : null,
    }));

    // Keep backward-compat fields for the duplicate check in POST /api/auth/setup frontend
    const exactMatches = matches.filter(
      (m) => m.name.toLowerCase().trim() === searchText.toLowerCase().trim()
    );
    const similarMatches = matches.filter(
      (m) => m.name.toLowerCase().trim() !== searchText.toLowerCase().trim()
    );

    res.json({ matches, exactMatches, similarMatches });
  } catch (err) {
    console.error("GET /public/clubs/check error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// GET /api/public/clubs – Öffentliches Vereinsregister (kein Auth)
router.get("/public/clubs", async (req, res) => {
  const { search, state, city, status, sort = "name_asc", page = "1", limit = "24" } = req.query;

  const pageNum  = Math.max(1, parseInt(page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 24));
  const offset   = (pageNum - 1) * pageSize;

  const conditions = ["c.is_public = true", "c.deleted_at IS NULL"];
  const params = [];

  if (search?.trim()) {
    params.push(`%${search.trim()}%`);
    const n = params.length;
    conditions.push(`(c.name ILIKE $${n} OR c.location_city ILIKE $${n} OR c.location_zip ILIKE $${n} OR c.description ILIKE $${n})`);
  }
  if (state?.trim()) {
    params.push(state.trim());
    conditions.push(`c.state = $${params.length}`);
  }
  if (city?.trim()) {
    params.push(`%${city.trim()}%`);
    conditions.push(`COALESCE(c.location_city, c.city) ILIKE $${params.length}`);
  }
  if (status === "managed")   conditions.push("c.plan IS DISTINCT FROM 'free'");
  if (status === "unclaimed") conditions.push("c.claim_status = 'unclaimed'");

  const ORDER = { name_asc: "c.name ASC", created_desc: "c.created_at DESC", updated_desc: "c.updated_at DESC" }[sort] ?? "c.name ASC";
  const where = conditions.join(" AND ");

  try {
    const [rowsRes, countRes] = await Promise.all([
      pool.query(`
        SELECT c.id, c.name, c.slug,
               c.location_city, c.location_zip, c.city, c.state,
               c.description, c.founded_year, c.logo_path,
               c.claim_status, c.plan, c.created_at, c.updated_at
        FROM clubs c
        WHERE ${where}
        ORDER BY ${ORDER}
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `, [...params, pageSize, offset]),
      pool.query(`SELECT COUNT(*)::int AS total FROM clubs c WHERE ${where}`, params),
    ]);

    const items = rowsRes.rows.map((c) => ({
      ...c,
      logo_url: c.logo_path ? getPublicUrl("club-assets", c.logo_path) : null,
    }));

    res.json({
      items,
      total: countRes.rows[0].total,
      page: pageNum,
      pages: Math.ceil(countRes.rows[0].total / pageSize),
    });
  } catch (err) {
    console.error("GET /public/clubs error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// ─── Public Claim ─────────────────────────────────────────────────────────────

// POST /api/public/clubs/:slug/claim – Übernahmeanfrage einreichen (kein Auth)
router.post("/public/clubs/:slug/claim", async (req, res) => {
  const { slug } = req.params;
  const { firstname, lastname, position, email, phone, message } = req.body;

  if (!firstname?.trim() || !lastname?.trim() || !email?.trim()) {
    return res.status(400).json({ error: "Vorname, Nachname und E-Mail sind Pflichtfelder." });
  }

  try {
    const clubRes = await pool.query(
      "SELECT id, claim_status FROM clubs WHERE slug = $1 AND deleted_at IS NULL",
      [slug]
    );
    if (!clubRes.rows[0]) return res.status(404).json({ error: "Verein nicht gefunden." });
    if (clubRes.rows[0].claim_status !== "unclaimed") {
      return res.status(409).json({ error: "Für diesen Verein liegt bereits eine Anfrage vor oder er wurde bereits übernommen." });
    }

    const clubId = clubRes.rows[0].id;

    await pool.query(
      `INSERT INTO club_claim_requests (club_id, firstname, lastname, position, email, phone, message)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [clubId, firstname.trim(), lastname.trim(), position?.trim() || null, email.trim(), phone?.trim() || null, message?.trim() || null]
    );

    await pool.query("UPDATE clubs SET claim_status = 'requested' WHERE id = $1", [clubId]);

    res.status(201).json({ ok: true });
  } catch (err) {
    console.error("POST /public/clubs/:slug/claim error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// POST /api/public/clubs/:slug/interest – Interessenbekundung eines Besuchers (kein Auth)
router.post("/public/clubs/:slug/interest", async (req, res) => {
  const { name, email, message, phone, request_type = "membership_interest" } = req.body;
  if (!name?.trim() || !email?.trim()) {
    return res.status(400).json({ error: "Name und E-Mail sind Pflichtfelder." });
  }
  const validTypes = ["membership_interest", "club_contact"];
  if (!validTypes.includes(request_type)) {
    return res.status(400).json({ error: "Ungültiger request_type." });
  }
  try {
    const clubRes = await pool.query(
      "SELECT id FROM clubs WHERE slug = $1 AND deleted_at IS NULL",
      [req.params.slug]
    );
    if (!clubRes.rows[0]) return res.status(404).json({ error: "Verein nicht gefunden." });
    await pool.query(
      `INSERT INTO club_interest_requests (club_id, name, email, message, phone, request_type)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        clubRes.rows[0].id,
        name.trim(),
        email.trim(),
        message?.trim() || null,
        phone?.trim() || null,
        request_type,
      ]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error("POST /public/clubs/:slug/interest error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// POST /api/public/clubs/:slug/access-request – Zugangsanfrage für bereits verwalteten Verein (kein Auth)
router.post("/public/clubs/:slug/access-request", async (req, res) => {
  const { firstname, lastname, email, phone, message } = req.body;
  if (!firstname?.trim() || !lastname?.trim() || !email?.trim()) {
    return res.status(400).json({ error: "Vorname, Nachname und E-Mail sind Pflichtfelder." });
  }
  try {
    const clubRes = await pool.query(
      "SELECT id FROM clubs WHERE slug = $1 AND deleted_at IS NULL",
      [req.params.slug]
    );
    if (!clubRes.rows[0]) return res.status(404).json({ error: "Verein nicht gefunden." });
    await pool.query(
      `INSERT INTO club_access_requests (club_id, firstname, lastname, email, phone, message)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        clubRes.rows[0].id,
        firstname.trim(),
        lastname.trim(),
        email.trim(),
        phone?.trim() || null,
        message?.trim() || null,
      ]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error("POST /public/clubs/:slug/access-request error:", err);
    res.status(500).json({ error: "Serverfehler" });
  }
});

module.exports = router;
