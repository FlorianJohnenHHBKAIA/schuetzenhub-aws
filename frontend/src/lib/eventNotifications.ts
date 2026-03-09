import { supabase } from "@/integrations/supabase/client";

/**
 * Create notifications for work shift events
 */

// Notify when a new shift is created
export const notifyNewShift = async (
  clubId: string,
  eventId: string,
  shiftTitle: string,
  eventTitle: string,
  creatorMemberId: string
) => {
  try {
    // Get all members of the club for club-internal events
    const { data: event } = await supabase
      .from("events")
      .select("audience, owner_type, owner_id")
      .eq("id", eventId)
      .single();

    if (!event) return;

    let memberIds: string[] = [];

    if (event.audience === "company_only" && event.owner_type === "company") {
      // Get company members only
      const { data: memberships } = await supabase
        .from("member_company_memberships")
        .select("member_id")
        .eq("company_id", event.owner_id)
        .is("valid_to", null);

      memberIds = (memberships || []).map((m) => m.member_id);
    } else {
      // Get all club members for club_internal events
      const { data: members } = await supabase
        .from("members")
        .select("id")
        .eq("club_id", clubId)
        .eq("status", "active");

      memberIds = (members || []).map((m) => m.id);
    }

    // Exclude the creator
    const recipients = memberIds.filter((id) => id !== creatorMemberId);
    if (recipients.length === 0) return;

    const notifications = recipients.map((memberId) => ({
      club_id: clubId,
      recipient_member_id: memberId,
      type: "workshift_assigned" as const,
      reference_id: eventId,
      reference_type: "event",
      payload: {
        shift_title: shiftTitle,
        event_title: eventTitle,
        action: "new_shift",
      },
    }));

    await supabase.from("notifications").insert(notifications);
  } catch (error) {
    console.error("Error creating shift notifications:", error);
  }
};

// Notify when shift is almost full or critical
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
    // Get the event details
    const { data: event } = await supabase
      .from("events")
      .select("audience, owner_type, owner_id")
      .eq("id", eventId)
      .single();

    if (!event) return;

    // Get members who are already signed up for any shift of this event
    const { data: signedUpMembers } = await supabase
      .from("work_shift_assignments")
      .select("member_id, work_shift_id")
      .in("status", ["signed_up", "completed"]);

    // Get all shifts for this event
    const { data: eventShifts } = await supabase
      .from("work_shifts")
      .select("id")
      .eq("event_id", eventId);

    const eventShiftIds = (eventShifts || []).map((s) => s.id);
    const alreadySignedUpIds = (signedUpMembers || [])
      .filter((a) => eventShiftIds.includes(a.work_shift_id))
      .map((a) => a.member_id);

    let memberIds: string[] = [];

    if (event.audience === "company_only" && event.owner_type === "company") {
      const { data: memberships } = await supabase
        .from("member_company_memberships")
        .select("member_id")
        .eq("company_id", event.owner_id)
        .is("valid_to", null);

      memberIds = (memberships || []).map((m) => m.member_id);
    } else {
      const { data: members } = await supabase
        .from("members")
        .select("id")
        .eq("club_id", clubId)
        .eq("status", "active");

      memberIds = (members || []).map((m) => m.id);
    }

    // Notify members who are NOT yet signed up for this event
    const recipients = memberIds.filter((id) => !alreadySignedUpIds.includes(id));
    if (recipients.length === 0) return;

    const notifications = recipients.map((memberId) => ({
      club_id: clubId,
      recipient_member_id: memberId,
      type: "workshift_changed" as const,
      reference_id: eventId,
      reference_type: "event",
      payload: {
        shift_title: shiftTitle,
        event_title: eventTitle,
        action: "shift_critical",
        open_slots: openSlots,
        days_until_event: daysUntilEvent,
      },
    }));

    await supabase.from("notifications").insert(notifications);
  } catch (error) {
    console.error("Error creating critical shift notifications:", error);
  }
};

// Notify when event internal notes are changed
export const notifyEventNotesChanged = async (
  clubId: string,
  eventId: string,
  eventTitle: string,
  updaterMemberId: string
) => {
  try {
    // Get all members who are signed up for this event's shifts
    const { data: eventShifts } = await supabase
      .from("work_shifts")
      .select("id")
      .eq("event_id", eventId);

    if (!eventShifts || eventShifts.length === 0) return;

    const shiftIds = eventShifts.map((s) => s.id);

    const { data: assignments } = await supabase
      .from("work_shift_assignments")
      .select("member_id")
      .in("work_shift_id", shiftIds)
      .in("status", ["signed_up", "completed"]);

    // Get unique member IDs excluding the updater
    const memberIds = [...new Set((assignments || []).map((a) => a.member_id))];
    const recipients = memberIds.filter((id) => id !== updaterMemberId);

    if (recipients.length === 0) return;

    const notifications = recipients.map((memberId) => ({
      club_id: clubId,
      recipient_member_id: memberId,
      type: "event_updated" as const,
      reference_id: eventId,
      reference_type: "event",
      payload: {
        event_title: eventTitle,
        action: "notes_changed",
      },
    }));

    await supabase.from("notifications").insert(notifications);
  } catch (error) {
    console.error("Error creating notes changed notifications:", error);
  }
};

// Notify specific member when assigned to a shift
export const notifyMemberAssigned = async (
  clubId: string,
  eventId: string,
  shiftId: string,
  memberId: string,
  shiftTitle: string,
  eventTitle: string
) => {
  try {
    await supabase.from("notifications").insert({
      club_id: clubId,
      recipient_member_id: memberId,
      type: "workshift_assigned" as const,
      reference_id: eventId,
      reference_type: "event",
      payload: {
        shift_id: shiftId,
        shift_title: shiftTitle,
        event_title: eventTitle,
        action: "assigned",
      },
    });
  } catch (error) {
    console.error("Error creating assignment notification:", error);
  }
};
