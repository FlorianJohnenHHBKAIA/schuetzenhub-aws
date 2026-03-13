import { api } from "@/integrations/api/client";

/**
 * Create notifications for work shift events
 */

export const notifyNewShift = async (
  clubId: string,
  eventId: string,
  shiftTitle: string,
  eventTitle: string,
  creatorMemberId: string
) => {
  try {
    const event = await api.json<{ audience: string; owner_type: string; owner_id: string }>(
      `/api/events/${eventId}`
    ).catch(() => null);
    if (!event) return;

    let memberIds: string[] = [];

    if (event.audience === "company_only" && event.owner_type === "company") {
      const memberships = await api.json<{ member_id: string }[]>(
        `/api/memberships?company_id=${event.owner_id}&active=true`
      ).catch(() => []);
      memberIds = memberships.map((m) => m.member_id);
    } else {
      const members = await api.json<{ id: string }[]>(
        `/api/members?status=active`
      ).catch(() => []);
      memberIds = members.map((m) => m.id);
    }

    const recipients = memberIds.filter((id) => id !== creatorMemberId);
    if (recipients.length === 0) return;

    const notifications = recipients.map((memberId) => ({
      club_id: clubId,
      recipient_member_id: memberId,
      type: "workshift_assigned",
      reference_id: eventId,
      reference_type: "event",
      payload: { shift_title: shiftTitle, event_title: eventTitle, action: "new_shift" },
    }));

    await api.json("/api/notifications", {
      method: "POST",
      body: JSON.stringify(notifications),
    });
  } catch (error) {
    console.error("Error creating shift notifications:", error);
  }
};

export const notifyShiftCritical = async (
  clubId: string,
  eventId: string,
  shiftId: string,
  shiftTitle: string,
  eventTitle: string,
  openSlots: number,
  daysUntilEvent: number
) => {
  try {
    const event = await api.json<{ audience: string; owner_type: string; owner_id: string }>(
      `/api/events/${eventId}`
    ).catch(() => null);
    if (!event) return;

    const [allShifts, signedUpAssignments] = await Promise.all([
      api.json<{ id: string }[]>(`/api/work-shifts?event_id=${eventId}`).catch(() => []),
      api.json<{ member_id: string; work_shift_id: string }[]>(
        `/api/work-shifts/assignments?status=signed_up,completed`
      ).catch(() => []),
    ]);

    const eventShiftIds = allShifts.map((s) => s.id);
    const alreadySignedUpIds = signedUpAssignments
      .filter((a) => eventShiftIds.includes(a.work_shift_id))
      .map((a) => a.member_id);

    let memberIds: string[] = [];
    if (event.audience === "company_only" && event.owner_type === "company") {
      const memberships = await api.json<{ member_id: string }[]>(
        `/api/memberships?company_id=${event.owner_id}&active=true`
      ).catch(() => []);
      memberIds = memberships.map((m) => m.member_id);
    } else {
      const members = await api.json<{ id: string }[]>(`/api/members?status=active`).catch(() => []);
      memberIds = members.map((m) => m.id);
    }

    const recipients = memberIds.filter((id) => !alreadySignedUpIds.includes(id));
    if (recipients.length === 0) return;

    const notifications = recipients.map((memberId) => ({
      club_id: clubId,
      recipient_member_id: memberId,
      type: "workshift_changed",
      reference_id: eventId,
      reference_type: "event",
      payload: { shift_title: shiftTitle, event_title: eventTitle, action: "shift_critical", open_slots: openSlots, days_until_event: daysUntilEvent },
    }));

    await api.json("/api/notifications", {
      method: "POST",
      body: JSON.stringify(notifications),
    });
  } catch (error) {
    console.error("Error creating critical shift notifications:", error);
  }
};

export const notifyEventNotesChanged = async (
  clubId: string,
  eventId: string,
  eventTitle: string,
  updaterMemberId: string
) => {
  try {
    const shifts = await api.json<{ id: string }[]>(`/api/work-shifts?event_id=${eventId}`).catch(() => []);
    if (!shifts.length) return;

    const shiftIds = shifts.map((s) => s.id);
    const assignments = await api.json<{ member_id: string }[]>(
      `/api/work-shifts/assignments?shift_ids=${shiftIds.join(",")}&status=signed_up,completed`
    ).catch(() => []);

    const memberIds = [...new Set(assignments.map((a) => a.member_id))];
    const recipients = memberIds.filter((id) => id !== updaterMemberId);
    if (recipients.length === 0) return;

    const notifications = recipients.map((memberId) => ({
      club_id: clubId,
      recipient_member_id: memberId,
      type: "event_updated",
      reference_id: eventId,
      reference_type: "event",
      payload: { event_title: eventTitle, action: "notes_changed" },
    }));

    await api.json("/api/notifications", {
      method: "POST",
      body: JSON.stringify(notifications),
    });
  } catch (error) {
    console.error("Error creating notes changed notifications:", error);
  }
};

export const notifyMemberAssigned = async (
  clubId: string,
  eventId: string,
  shiftId: string,
  memberId: string,
  shiftTitle: string,
  eventTitle: string
) => {
  try {
    await api.json("/api/notifications", {
      method: "POST",
      body: JSON.stringify([{
        club_id: clubId,
        recipient_member_id: memberId,
        type: "workshift_assigned",
        reference_id: eventId,
        reference_type: "event",
        payload: { shift_id: shiftId, shift_title: shiftTitle, event_title: eventTitle, action: "assigned" },
      }]),
    });
  } catch (error) {
    console.error("Error creating assignment notification:", error);
  }
};