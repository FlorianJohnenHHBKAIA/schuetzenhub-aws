import { apiJson } from "@/integrations/api/client";

type Scope = "company" | "club";

async function notifyAudience(params: {
  scope: Scope;
  companyId?: string;
  type: string;
  title: string;
  message?: string;
  link?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  excludeMemberId?: string;
}) {
  await apiJson("/api/notifications/notify-audience", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export const notifyNewShift = async (
  _clubId: string,
  eventId: string,
  shiftTitle: string,
  eventTitle: string,
  creatorMemberId: string,
  scope: Scope = "club",
  companyId?: string
) => {
  try {
    await notifyAudience({
      scope,
      companyId,
      type: "workshift_assigned",
      title: `Neuer Arbeitsdienst: ${shiftTitle}`,
      message: `Für den Termin „${eventTitle}" wurde ein neuer Arbeitsdienst angelegt.`,
      relatedEntityType: "event",
      relatedEntityId: eventId,
      link: `/portal/events/${eventId}/organize`,
      excludeMemberId: creatorMemberId,
    });
  } catch (error) {
    console.error("notifyNewShift error:", error);
  }
};

export const notifyShiftCritical = async (
  _clubId: string,
  eventId: string,
  _shiftId: string,
  shiftTitle: string,
  eventTitle: string,
  openSlots: number,
  _daysUntilEvent: number,
  scope: Scope = "club",
  companyId?: string
) => {
  try {
    await notifyAudience({
      scope,
      companyId,
      type: "workshift_changed",
      title: `Helfer gesucht: ${shiftTitle}`,
      message: `Für „${eventTitle}" werden noch ${openSlots} Helfer gesucht.`,
      relatedEntityType: "event",
      relatedEntityId: eventId,
      link: `/portal/events/${eventId}/organize`,
    });
  } catch (error) {
    console.error("notifyShiftCritical error:", error);
  }
};

export const notifyEventNotesChanged = async (
  _clubId: string,
  eventId: string,
  eventTitle: string,
  updaterMemberId: string,
  scope: Scope = "club",
  companyId?: string
) => {
  try {
    await notifyAudience({
      scope,
      companyId,
      type: "event_updated",
      title: `Termin aktualisiert: ${eventTitle}`,
      message: `Die internen Hinweise für „${eventTitle}" wurden aktualisiert.`,
      relatedEntityType: "event",
      relatedEntityId: eventId,
      link: `/portal/events/${eventId}/organize`,
      excludeMemberId: updaterMemberId,
    });
  } catch (error) {
    console.error("notifyEventNotesChanged error:", error);
  }
};

export const notifyMemberAssigned = async (
  _clubId: string,
  eventId: string,
  _shiftId: string,
  memberId: string,
  shiftTitle: string,
  eventTitle: string
) => {
  try {
    await apiJson("/api/notifications/bulk", {
      method: "POST",
      body: JSON.stringify({
        memberIds: [memberId],
        type: "workshift_assigned",
        title: `Du wurdest eingeteilt: ${shiftTitle}`,
        message: `Du wurdest für den Arbeitsdienst „${shiftTitle}" beim Termin „${eventTitle}" eingeteilt.`,
        relatedEntityType: "event",
        relatedEntityId: eventId,
        link: `/portal/events/${eventId}/organize`,
      }),
    });
  } catch (error) {
    console.error("notifyMemberAssigned error:", error);
  }
};
