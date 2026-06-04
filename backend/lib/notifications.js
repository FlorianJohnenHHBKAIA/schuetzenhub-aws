const { v4: uuidv4 } = require("uuid");

/**
 * Bulk-insert notifications for a list of recipients.
 * Silently skips if memberIds is empty.
 */
async function insertNotifications(
  pool,
  memberIds,
  { type, title, message, relatedEntityType, relatedEntityId, link, excludeMemberId }
) {
  const recipients = excludeMemberId
    ? memberIds.filter((id) => id !== excludeMemberId)
    : memberIds;

  console.log("[insertNotifications] type:", type, "memberIds:", memberIds.length, "nach excludeMemberId:", recipients.length);

  if (!recipients.length) {
    console.log("[insertNotifications] keine Empfänger → kein INSERT");
    return;
  }

  const values = [];
  const params = [];
  let idx = 1;

  for (const memberId of recipients) {
    values.push(
      `($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`
    );
    params.push(
      uuidv4(),
      memberId,
      type,
      title,
      message || null,
      relatedEntityType || null,
      relatedEntityId || null,
      link || null
    );
  }

  await pool.query(
    `INSERT INTO notifications
       (id, recipient_member_id, type, title, message, related_entity_type, related_entity_id, link)
     VALUES ${values.join(", ")}`,
    params
  );
  console.log("[insertNotifications] INSERT erfolgreich für", recipients.length, "Empfänger");
}

/**
 * Returns IDs of all active members in a club who are admins or have
 * club.members.manage / club.admin.full permissions.
 */
async function getAdminMemberIds(pool, clubId) {
  const result = await pool.query(
    `SELECT DISTINCT m.id
     FROM members m
     WHERE m.club_id = $1
       AND m.status = 'active'
       AND (
         EXISTS (
           SELECT 1 FROM user_roles ur
           WHERE ur.user_id = m.user_id AND ur.club_id = $1 AND ur.role = 'admin'
         )
         OR EXISTS (
           SELECT 1
           FROM member_role_assignments mra
           JOIN role_permissions rp ON rp.role_id = mra.role_id
           WHERE mra.member_id = m.id
             AND rp.permission_key IN ('club.admin.full', 'club.members.manage')
         )
       )`,
    [clubId]
  );
  return result.rows.map((r) => r.id);
}

/**
 * Returns IDs of all active members of a company (via member_company_memberships).
 */
async function getCompanyMemberIds(pool, companyId) {
  const result = await pool.query(
    `SELECT m.id
     FROM member_company_memberships mcm
     JOIN members m ON m.id = mcm.member_id
     WHERE mcm.company_id = $1
       AND mcm.valid_to IS NULL
       AND m.status = 'active'`,
    [companyId]
  );
  return result.rows.map((r) => r.id);
}

/**
 * Returns IDs of all active members of a club.
 */
async function getClubMemberIds(pool, clubId) {
  const result = await pool.query(
    "SELECT id FROM members WHERE club_id = $1 AND status = 'active'",
    [clubId]
  );
  return result.rows.map((r) => r.id);
}

/**
 * Trigger post-published notifications based on audience.
 * audience = 'company_only' → company members
 * audience = 'club_internal' → all club members
 * audience = 'public' → no notification
 */
async function notifyPostPublished(pool, post) {
  const { id, club_id, owner_type, owner_id, audience, title, created_by_member_id } = post;
  console.log("[notifyPostPublished] audience:", audience, "owner_type:", owner_type, "owner_id:", owner_id, "club_id:", club_id, "excludeMemberId:", created_by_member_id);
  const link = `/portal/posts/${id}`;
  const notifData = {
    type: "new_post",
    title: "Neuer Aushang",
    message: `${title} wurde veröffentlicht.`,
    relatedEntityType: "post",
    relatedEntityId: id,
    link,
    excludeMemberId: created_by_member_id,
  };

  if (audience === "company_only" && owner_type === "company") {
    const memberIds = await getCompanyMemberIds(pool, owner_id);
    console.log("[notifyPostPublished] company_only memberIds:", memberIds.length, memberIds);
    await insertNotifications(pool, memberIds, notifData);
  } else if (audience === "club_internal") {
    const memberIds = await getClubMemberIds(pool, club_id);
    console.log("[notifyPostPublished] club_internal memberIds:", memberIds.length, memberIds);
    await insertNotifications(pool, memberIds, notifData);
  } else {
    console.log("[notifyPostPublished] audience=public oder unbekannt, kein Notify");
  }
  // public → no notification
}

/**
 * Trigger event-published notifications based on audience/owner_type.
 */
async function notifyEventPublished(pool, event) {
  const { id, club_id, owner_type, owner_id, audience, title, created_by_member_id } = event;
  const notifData = {
    type: "new_event",
    title: "Neuer Termin",
    message: `${title} wurde angelegt.`,
    relatedEntityType: "event",
    relatedEntityId: id,
    link: "/portal/events",
    excludeMemberId: created_by_member_id,
  };

  if (owner_type === "company" && audience === "company_only") {
    const memberIds = await getCompanyMemberIds(pool, owner_id);
    await insertNotifications(pool, memberIds, notifData);
  } else if (audience !== "public") {
    const memberIds = await getClubMemberIds(pool, club_id);
    await insertNotifications(pool, memberIds, notifData);
  }
}

module.exports = {
  insertNotifications,
  getAdminMemberIds,
  getCompanyMemberIds,
  getClubMemberIds,
  notifyPostPublished,
  notifyEventPublished,
};
