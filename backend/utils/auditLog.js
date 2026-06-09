const ACTIONS = {
  CLUB_CREATED:           'club.created',
  CLUB_UPDATED:           'club.updated',
  CLUB_PLAN_CHANGED:      'club.plan_changed',
  CLUB_ARCHIVED:          'club.archived',
  CLUB_UNARCHIVED:        'club.unarchived',
  CLUB_LOGO_UPLOADED:     'club.logo_uploaded',
  CLUB_HERO_UPLOADED:     'club.hero_uploaded',
  CLUB_NOTE_CREATED:      'club.note_created',
  CLUB_NOTE_DELETED:      'club.note_deleted',
  CLAIM_REQUEST_APPROVED: 'claim_request.approved',
  CLAIM_REQUEST_REJECTED: 'claim_request.rejected',
  PROVIDER_CREATED:       'provider.created',
  PROVIDER_UPDATED:       'provider.updated',
  PROVIDER_LOGO_UPLOADED: 'provider.logo_uploaded',
  PROVIDER_HERO_UPLOADED: 'provider.hero_uploaded',
};

function logAuditEvent(pool, {
  userId, userEmail, action, entityType,
  entityId = null, beforeState = null, afterState = null, metadata = null, req = null,
}) {
  const ipAddress = req
    ? (req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || null)
    : null;

  pool.query(
    `INSERT INTO superadmin_audit_logs
       (performed_by, actor_email, action, entity_type, entity_id,
        before_state, after_state, metadata, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::inet)`,
    [
      userId,
      userEmail,
      action,
      entityType,
      entityId || null,
      beforeState ? JSON.stringify(beforeState) : null,
      afterState  ? JSON.stringify(afterState)  : null,
      metadata    ? JSON.stringify(metadata)    : null,
      ipAddress,
    ]
  ).catch((err) => {
    console.error('[auditLog] Failed to write audit event:', action, entityType, entityId, err.message);
  });
}

module.exports = { logAuditEvent, ACTIONS };
