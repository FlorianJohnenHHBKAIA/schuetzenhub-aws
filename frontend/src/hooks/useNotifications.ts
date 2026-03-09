import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { apiJson } from "@/integrations/api/client";
import {
  type NotificationType,
  type NotificationCategory,
  getNotificationCategory,
  getNotificationDeepLink,
  getNotificationLabel,
} from "@/lib/notificationTypes";

export interface Notification {
  id: string;
  club_id: string;
  recipient_member_id: string;
  type: NotificationType;
  category: NotificationCategory;
  reference_id: string;
  reference_type?: string;
  payload?: {
    event_title?: string;
    shift_title?: string;
    post_title?: string;
    action?: string;
    open_slots?: number;
    days_until_event?: number;
    [key: string]: unknown;
  };
  is_read: boolean;
  created_at: string;
}

export interface GroupedNotifications {
  key: string;
  type: NotificationType;
  category: NotificationCategory;
  count: number;
  notifications: Notification[];
  latestAt: string;
  label: string;
  deepLink: string;
}

export const useNotifications = () => {
  const { member } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    if (!member) return;
    setLoading(true);
    try {
      const data = await apiJson<Notification[]>("/api/notifications");
      const notifs = data || [];
      setNotifications(notifs);
      setUnreadCount(notifs.filter((n) => !n.is_read).length);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setLoading(false);
    }
  }, [member]);

  useEffect(() => {
    fetchNotifications();
    // Polling alle 30 Sekunden statt Supabase Realtime
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const groupedNotifications = useMemo((): GroupedNotifications[] => {
    const groups = new Map<string, GroupedNotifications>();

    notifications.forEach((notif) => {
      const date = new Date(notif.created_at).toDateString();
      const key = notif.is_read ? notif.id : `${notif.type}-${date}`;

      if (groups.has(key)) {
        const group = groups.get(key)!;
        group.count++;
        group.notifications.push(notif);
        if (new Date(notif.created_at) > new Date(group.latestAt)) {
          group.latestAt = notif.created_at;
        }
      } else {
        groups.set(key, {
          key,
          type: notif.type,
          category: notif.category || getNotificationCategory(notif.type),
          count: 1,
          notifications: [notif],
          latestAt: notif.created_at,
          label: getGroupLabel(notif),
          deepLink: getNotificationDeepLink(notif.type, notif.reference_id),
        });
      }
    });

    return Array.from(groups.values())
      .sort((a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime())
      .slice(0, 15);
  }, [notifications]);

  const markAsRead = async (notificationId: string) => {
    try {
      await apiJson(`/api/notifications/${notificationId}/read`, { method: "PUT" });
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Error marking notification as read:", error);
      fetchNotifications();
    }
  };

  const markGroupAsRead = async (group: GroupedNotifications) => {
    const unreadIds = group.notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    try {
      await Promise.all(
        unreadIds.map((id) => apiJson(`/api/notifications/${id}/read`, { method: "PUT" }))
      );
      setNotifications((prev) =>
        prev.map((n) => (unreadIds.includes(n.id) ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - unreadIds.length));
    } catch (error) {
      console.error("Error marking group as read:", error);
      fetchNotifications();
    }
  };

  const markAllAsRead = async () => {
    if (!member) return;
    try {
      await apiJson("/api/notifications/read-all", { method: "PUT" });
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Error marking all as read:", error);
      fetchNotifications();
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      const wasUnread = notifications.find((n) => n.id === notificationId)?.is_read === false;
      // Optimistic update
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      if (wasUnread) setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Error deleting notification:", error);
      fetchNotifications();
    }
  };

  return {
    notifications,
    groupedNotifications,
    loading,
    unreadCount,
    markAsRead,
    markGroupAsRead,
    markAllAsRead,
    deleteNotification,
    refetch: fetchNotifications,
  };
};

function getGroupLabel(notif: Notification): string {
  const payload = notif.payload || {};

  switch (notif.type) {
    case "new_post":
      return payload.post_title ? `Neuer Beitrag: ${payload.post_title}` : "Neuer Beitrag";
    case "post_comment":
      return "Neuer Kommentar zu deinem Beitrag";
    case "workshift_assigned":
      return payload.action === "new_shift"
        ? `Neuer Arbeitsdienst: ${payload.event_title || "Termin"}`
        : `Du wurdest eingeteilt: ${payload.shift_title || payload.event_title || "Arbeitsdienst"}`;
    case "workshift_changed":
      return payload.action === "shift_critical"
        ? `Helfer gesucht: ${payload.event_title || "Termin"}`
        : `Arbeitsdienst geaendert: ${payload.event_title || "Termin"}`;
    case "event_updated":
      return `Event aktualisiert: ${payload.event_title || "Termin"}`;
    case "event_cancelled":
      return `Termin abgesagt: ${payload.event_title || "Termin"}`;
    case "event_changed":
      return `Termin geaendert: ${payload.event_title || "Termin"}`;
    case "role_changed":
      return "Deine Rolle wurde geaendert";
    case "delegation_granted":
      return "Du hast eine Delegation erhalten";
    case "delegation_revoked":
      return "Eine Delegation wurde entzogen";
    case "approval_request":
      return "Freigabe erforderlich";
    case "new_document":
      return "Neues Dokument verfuegbar";
    case "gallery_shared":
      return "Foto mit dir geteilt";
    case "event_reminder":
      return `Erinnerung: ${payload.event_title || "Termin morgen"}`;
    case "workshift_reminder":
      return `Erinnerung: ${payload.shift_title || "Arbeitsdienst"}`;
    default:
      return getNotificationLabel(notif.type);
  }
}

export const createNotification = async (
  clubId: string,
  recipientMemberId: string,
  type: NotificationType,
  referenceId: string,
  payload?: Record<string, unknown>
) => {
  // Wird jetzt vom Backend ausgeloest, nicht vom Frontend
  console.log("createNotification called - handle server-side", { clubId, recipientMemberId, type });
};

export const createNotificationsForMembers = async (
  clubId: string,
  memberIds: string[],
  type: NotificationType,
  referenceId: string,
  excludeMemberId?: string,
  payload?: Record<string, unknown>
) => {
  console.log("createNotificationsForMembers called - handle server-side", { clubId, memberIds, type });
};