// Notification Categories & Types Configuration
// This centralizes all notification logic for the portal

export type NotificationCategory = 'important' | 'info' | 'reminder' | 'system';

export type NotificationType = 
  // Important (default ON for in-app + email)
  | 'event_cancelled'
  | 'event_changed'
  | 'workshift_assigned'
  | 'workshift_removed'
  | 'workshift_changed'
  | 'action_required'
  | 'approval_request'
  // Info (default ON for in-app only)
  | 'new_post'
  | 'post_comment'
  | 'new_document'
  | 'gallery_shared'
  // Reminder (default OFF)
  | 'event_reminder'
  | 'workshift_reminder'
  // System
  | 'role_changed'
  | 'delegation_granted'
  | 'delegation_revoked'
  | 'event_updated';

export interface NotificationTypeConfig {
  type: NotificationType;
  category: NotificationCategory;
  labelDe: string;
  icon: string;
  defaultInApp: boolean;
  defaultEmail: boolean;
  defaultPush: boolean;
  // If true, notification can bypass quiet hours
  urgent: boolean;
  // Deep link pattern - use {id} for reference_id
  deepLinkPattern: string;
}

export const NOTIFICATION_TYPES: Record<NotificationType, NotificationTypeConfig> = {
  // === IMPORTANT ===
  event_cancelled: {
    type: 'event_cancelled',
    category: 'important',
    labelDe: 'Termin abgesagt',
    icon: 'calendar-x',
    defaultInApp: true,
    defaultEmail: true,
    defaultPush: true,
    urgent: true,
    deepLinkPattern: '/portal/events',
  },
  event_changed: {
    type: 'event_changed',
    category: 'important',
    labelDe: 'Termin geändert',
    icon: 'calendar-clock',
    defaultInApp: true,
    defaultEmail: true,
    defaultPush: true,
    urgent: false,
    deepLinkPattern: '/portal/events/{id}/organize',
  },
  workshift_assigned: {
    type: 'workshift_assigned',
    category: 'important',
    labelDe: 'Du wurdest eingeteilt',
    icon: 'user-check',
    defaultInApp: true,
    defaultEmail: true,
    defaultPush: true,
    urgent: false,
    deepLinkPattern: '/portal/workshifts?event={id}',
  },
  workshift_removed: {
    type: 'workshift_removed',
    category: 'important',
    labelDe: 'Einteilung entfernt',
    icon: 'user-x',
    defaultInApp: true,
    defaultEmail: true,
    defaultPush: true,
    urgent: false,
    deepLinkPattern: '/portal/workshifts',
  },
  workshift_changed: {
    type: 'workshift_changed',
    category: 'important',
    labelDe: 'Arbeitsdienst geändert',
    icon: 'clock',
    defaultInApp: true,
    defaultEmail: true,
    defaultPush: false,
    urgent: false,
    deepLinkPattern: '/portal/workshifts?event={id}',
  },
  action_required: {
    type: 'action_required',
    category: 'important',
    labelDe: 'Aktion erforderlich',
    icon: 'alert-circle',
    defaultInApp: true,
    defaultEmail: true,
    defaultPush: true,
    urgent: true,
    deepLinkPattern: '/portal/admin',
  },
  approval_request: {
    type: 'approval_request',
    category: 'important',
    labelDe: 'Freigabe angefordert',
    icon: 'check-square',
    defaultInApp: true,
    defaultEmail: true,
    defaultPush: false,
    urgent: false,
    deepLinkPattern: '/portal/event-approvals',
  },

  // === INFO ===
  new_post: {
    type: 'new_post',
    category: 'info',
    labelDe: 'Neuer Beitrag',
    icon: 'megaphone',
    defaultInApp: true,
    defaultEmail: false,
    defaultPush: false,
    urgent: false,
    deepLinkPattern: '/portal/posts/{id}',
  },
  post_comment: {
    type: 'post_comment',
    category: 'info',
    labelDe: 'Neuer Kommentar',
    icon: 'message-square',
    defaultInApp: true,
    defaultEmail: false,
    defaultPush: false,
    urgent: false,
    deepLinkPattern: '/portal/posts/{id}',
  },
  new_document: {
    type: 'new_document',
    category: 'info',
    labelDe: 'Neues Dokument',
    icon: 'file-text',
    defaultInApp: true,
    defaultEmail: false,
    defaultPush: false,
    urgent: false,
    deepLinkPattern: '/portal/documents',
  },
  gallery_shared: {
    type: 'gallery_shared',
    category: 'info',
    labelDe: 'Foto geteilt',
    icon: 'image',
    defaultInApp: true,
    defaultEmail: false,
    defaultPush: false,
    urgent: false,
    deepLinkPattern: '/portal/shared-gallery',
  },
  event_updated: {
    type: 'event_updated',
    category: 'info',
    labelDe: 'Event aktualisiert',
    icon: 'calendar',
    defaultInApp: true,
    defaultEmail: false,
    defaultPush: false,
    urgent: false,
    deepLinkPattern: '/portal/events/{id}/organize',
  },

  // === REMINDER ===
  event_reminder: {
    type: 'event_reminder',
    category: 'reminder',
    labelDe: 'Erinnerung: Termin',
    icon: 'bell-ring',
    defaultInApp: false,
    defaultEmail: false,
    defaultPush: false,
    urgent: false,
    deepLinkPattern: '/portal/events/{id}/organize',
  },
  workshift_reminder: {
    type: 'workshift_reminder',
    category: 'reminder',
    labelDe: 'Erinnerung: Arbeitsdienst',
    icon: 'alarm-clock',
    defaultInApp: false,
    defaultEmail: false,
    defaultPush: false,
    urgent: false,
    deepLinkPattern: '/portal/workshifts?event={id}',
  },

  // === SYSTEM ===
  role_changed: {
    type: 'role_changed',
    category: 'system',
    labelDe: 'Rolle geändert',
    icon: 'shield',
    defaultInApp: true,
    defaultEmail: true,
    defaultPush: false,
    urgent: false,
    deepLinkPattern: '/portal/profile',
  },
  delegation_granted: {
    type: 'delegation_granted',
    category: 'system',
    labelDe: 'Delegation erhalten',
    icon: 'key',
    defaultInApp: true,
    defaultEmail: true,
    defaultPush: false,
    urgent: false,
    deepLinkPattern: '/portal/profile',
  },
  delegation_revoked: {
    type: 'delegation_revoked',
    category: 'system',
    labelDe: 'Delegation entzogen',
    icon: 'key',
    defaultInApp: true,
    defaultEmail: true,
    defaultPush: false,
    urgent: false,
    deepLinkPattern: '/portal/profile',
  },
};

export const CATEGORY_LABELS: Record<NotificationCategory, { label: string; description: string }> = {
  important: {
    label: 'Wichtig',
    description: 'Terminänderungen, Einteilungen, Handlungsbedarf',
  },
  info: {
    label: 'Information',
    description: 'Neue Beiträge, Kommentare, Dokumente',
  },
  reminder: {
    label: 'Erinnerungen',
    description: 'Kommende Termine und Arbeitsdienste',
  },
  system: {
    label: 'System',
    description: 'Rollen- und Rechteänderungen',
  },
};

// Get deep link for a notification
export const getNotificationDeepLink = (type: NotificationType, referenceId: string): string => {
  const config = NOTIFICATION_TYPES[type];
  if (!config) return '/portal';
  return config.deepLinkPattern.replace('{id}', referenceId);
};

// Get category for a notification type
export const getNotificationCategory = (type: NotificationType): NotificationCategory => {
  return NOTIFICATION_TYPES[type]?.category || 'info';
};

// Check if a notification type is urgent (can bypass quiet hours)
export const isUrgentNotification = (type: NotificationType): boolean => {
  return NOTIFICATION_TYPES[type]?.urgent || false;
};

// Get localized label for notification type
export const getNotificationLabel = (type: NotificationType): string => {
  return NOTIFICATION_TYPES[type]?.labelDe || 'Benachrichtigung';
};
