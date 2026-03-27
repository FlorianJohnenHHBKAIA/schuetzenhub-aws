import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Building2,
  Users,
  Clock,
  ClipboardList,
  UserCheck,
  AlertCircle,
  Plus,
  Edit,
  Trash2,
  CheckCircle2,
  XCircle,
  Shield,
  Globe,
  FileText,
  Save,
  Loader2,
  CheckCheck,
} from "lucide-react";
import PortalLayout from "@/components/portal/PortalLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/api/client";
import { toast } from "sonner";
import EventPostsSection from "@/components/portal/EventPostsSection";
import EventQuickActions from "@/components/portal/EventQuickActions";
import { notifyNewShift, notifyEventNotesChanged } from "@/lib/eventNotifications";

type EventAudience = "company_only" | "club_internal" | "public";
type PublicationStatus = "draft" | "submitted" | "approved" | "rejected";
type OwnerType = "club" | "company";

interface Event {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_at: string;
  end_at: string | null;
  category: string;
  owner_type: OwnerType;
  owner_id: string;
  audience: EventAudience;
  publication_status: PublicationStatus;
  internal_notes: string | null;
  responsible_member_id: string | null;
  club_id: string;
}

interface WorkShift {
  id: string;
  event_id: string;
  title: string;
  start_at: string;
  end_at: string;
  required_slots: number;
  owner_type: OwnerType;
  owner_id: string;
}

interface WorkShiftAssignment {
  id: string;
  work_shift_id: string;
  member_id: string;
  status: "signed_up" | "cancelled" | "completed" | "no_show";
  hours_override?: number | null;
  member?: {
    id: string;
    first_name: string;
    last_name: string;
  };
}

interface Member {
  id: string;
  first_name: string;
  last_name: string;
}

interface Company {
  id: string;
  name: string;
}

interface RawAssignment {
  id: string;
  work_shift_id: string;
  member_id: string;
  status: "signed_up" | "cancelled" | "completed" | "no_show";
  hours_override?: number | null;
  member: { id: string; first_name: string; last_name: string } | { id: string; first_name: string; last_name: string }[] | null;
}

const audienceLabels: Record<EventAudience, { label: string; icon: React.ElementType; color: string }> = {
  company_only: { label: "Kompanie-intern", icon: Building2, color: "bg-orange-500/10 text-orange-600" },
  club_internal: { label: "Schützen-intern", icon: Users, color: "bg-blue-500/10 text-blue-600" },
  public: { label: "Öffentlich", icon: Globe, color: "bg-green-500/10 text-green-600" },
};

const statusLabels: Record<PublicationStatus, { label: string; color: string }> = {
  draft: { label: "Entwurf", color: "bg-muted text-muted-foreground" },
  submitted: { label: "Eingereicht", color: "bg-amber-500/10 text-amber-600" },
  approved: { label: "Freigegeben", color: "bg-green-500/10 text-green-600" },
  rejected: { label: "Abgelehnt", color: "bg-destructive/10 text-destructive" },
};

const EventOrganize = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { member, hasPermission, permissions } = useAuth();

  const [event, setEvent] = useState<Event | null>(null);
  const [shifts, setShifts] = useState<WorkShift[]>([]);
  const [assignments, setAssignments] = useState<WorkShiftAssignment[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [internalNotes, setInternalNotes] = useState("");
  const [responsibleMemberId, setResponsibleMemberId] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const initialNotesRef = useRef<string>("");

  const [shiftDialogOpen, setShiftDialogOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<WorkShift | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formStartAt, setFormStartAt] = useState("");
  const [formEndAt, setFormEndAt] = useState("");
  const [formRequiredSlots, setFormRequiredSlots] = useState(1);
  const [formOwnerType, setFormOwnerType] = useState<OwnerType>("club");
  const [formOwnerId, setFormOwnerId] = useState("");

  const canManageClubEvents = hasPermission("club.events.manage") || hasPermission("club.admin.full");

  const canManageEvent = useCallback((evt: Event | null) => {
    if (!evt) return false;
    if (evt.owner_type === "club") return canManageClubEvents;
    return permissions.some(
      (p) => p.permission_key === "company.events.manage" && p.scope_type === "company" && p.scope_id === evt.owner_id
    ) || hasPermission("club.admin.full");
  }, [canManageClubEvents, permissions, hasPermission]);

  const canManageShift = useCallback((shift: WorkShift) => {
    if (shift.owner_type === "club") return canManageClubEvents;
    return permissions.some(
      (p) =>
        (p.permission_key === "company.workshifts.manage" || p.permission_key === "company.events.manage") &&
        p.scope_type === "company" &&
        p.scope_id === shift.owner_id
    ) || hasPermission("club.admin.full");
  }, [canManageClubEvents, permissions, hasPermission]);

  useEffect(() => {
    if (member?.club_id && id) fetchData();
  }, [member?.club_id, id]);

  const fetchData = async () => {
    if (!member || !id) return;
    setIsLoading(true);

    try {
      const { data: eventData, error: eventError } = await supabase
        .from("events")
        .select("*")
        .eq("id", id)
        .eq("club_id", member.club_id)
        .single();

      if (eventError) throw eventError;
      if (!eventData) {
        toast.error("Event nicht gefunden");
        navigate("/portal/events");
        return;
      }

      const evt = eventData as Event;
      setEvent(evt);
      setInternalNotes(evt.internal_notes || "");
      setResponsibleMemberId(evt.responsible_member_id || null);
      initialNotesRef.current = evt.internal_notes || "";

      const { data: companiesData } = await supabase
        .from("companies")
        .select("id, name")
        .eq("club_id", member.club_id);
      setCompanies((companiesData as Company[]) || []);

      const { data: membersData } = await supabase
        .from("members")
        .select("id, first_name, last_name")
        .eq("club_id", member.club_id)
        .order("last_name");
      setMembers((membersData as Member[]) || []);

      const { data: shiftsData } = await supabase
        .from("work_shifts")
        .select("*")
        .eq("event_id", id)
        .order("start_at");
      const shiftsList = (shiftsData as WorkShift[]) || [];
      setShifts(shiftsList);

      if (shiftsList.length > 0) {
        const shiftIds = shiftsList.map((s) => s.id);
        const { data: assignmentsData } = await supabase
          .from("work_shift_assignments")
          .select(`id, work_shift_id, member_id, status, hours_override, member:members(id, first_name, last_name)`)
          .in("work_shift_id", shiftIds);

        setAssignments(
          ((assignmentsData as RawAssignment[]) || []).map((a) => ({
            ...a,
            member: Array.isArray(a.member) ? a.member[0] : a.member ?? undefined,
          }))
        );
      } else {
        setAssignments([]);
      }
    } catch (error: unknown) {
      console.error("Error fetching data:", error);
      toast.error("Fehler beim Laden");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveDetails = async () => {
    if (!event || !member) return;
    setIsSaving(true);
    const notesChanged = internalNotes.trim() !== initialNotesRef.current;

    try {
      const { error } = await supabase
        .from("events")
        .update({
          internal_notes: internalNotes.trim() || null,
          responsible_member_id: responsibleMemberId,
        })
        .eq("id", event.id);

      if (error) throw error;
      
      if (notesChanged && internalNotes.trim()) {
        await notifyEventNotesChanged(member.club_id, event.id, event.title, member.id);
      }
      
      initialNotesRef.current = internalNotes.trim();
      toast.success("Änderungen gespeichert");
      setHasUnsavedChanges(false);
    } catch (error: unknown) {
      console.error("Error saving:", error);
      toast.error(error instanceof Error ? error.message : "Fehler beim Speichern");
    } finally {
      setIsSaving(false);
    }
  };

  const openNewShiftDialog = () => {
    if (!event) return;
    setEditingShift(null);
    setFormTitle("");
    setFormStartAt(event.start_at.slice(0, 16));
    setFormEndAt(event.end_at?.slice(0, 16) || event.start_at.slice(0, 16));
    setFormRequiredSlots(1);
    setFormOwnerType(event.owner_type);
    setFormOwnerId(event.owner_id);
    setShiftDialogOpen(true);
  };

  const openEditShiftDialog = (shift: WorkShift) => {
    setEditingShift(shift);
    setFormTitle(shift.title);
    setFormStartAt(shift.start_at.slice(0, 16));
    setFormEndAt(shift.end_at.slice(0, 16));
    setFormRequiredSlots(shift.required_slots);
    setFormOwnerType(shift.owner_type);
    setFormOwnerId(shift.owner_id);
    setShiftDialogOpen(true);
  };

  const handleSaveShift = async () => {
    if (!event || !member) return;

    const shiftData = {
      club_id: member.club_id,
      event_id: event.id,
      title: formTitle,
      start_at: new Date(formStartAt).toISOString(),
      end_at: new Date(formEndAt).toISOString(),
      required_slots: formRequiredSlots,
      owner_type: formOwnerType,
      owner_id: formOwnerId,
    };

    try {
      if (editingShift) {
        const { error } = await supabase.from("work_shifts").update(shiftData).eq("id", editingShift.id);
        if (error) throw error;
        toast.success("Schicht aktualisiert");
      } else {
        const { error } = await supabase.from("work_shifts").insert({ ...shiftData, created_by_member_id: member.id });
        if (error) throw error;
        await notifyNewShift(member.club_id, event.id, formTitle, event.title, member.id);
        toast.success("Schicht erstellt");
      }
      setShiftDialogOpen(false);
      fetchData();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Fehler beim Speichern");
    }
  };

  const handleDeleteShift = async (shift: WorkShift) => {
    if (!confirm(`Schicht "${shift.title}" wirklich löschen?`)) return;
    try {
      const { error } = await supabase.from("work_shifts").delete().eq("id", shift.id);
      if (error) throw error;
      toast.success("Schicht gelöscht");
      fetchData();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Fehler beim Löschen");
    }
  };

  const handleSignUp = async (shift: WorkShift) => {
    if (!member) return;
    try {
      const { error } = await supabase.from("work_shift_assignments").insert({
        club_id: member.club_id,
        work_shift_id: shift.id,
        member_id: member.id,
        status: "signed_up",
      });
      if (error) throw error;
      toast.success(`Für "${shift.title}" eingetragen`);
      fetchData();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Fehler beim Eintragen");
    }
  };

  const handleSignOut = async (shift: WorkShift) => {
    if (!member) return;
    const assignment = assignments.find(
      (a) => a.work_shift_id === shift.id && a.member_id === member.id && a.status === "signed_up"
    );
    if (!assignment) return;
    try {
      const { error } = await supabase.from("work_shift_assignments").update({ status: "cancelled" }).eq("id", assignment.id);
      if (error) throw error;
      toast.success(`Von "${shift.title}" ausgetragen`);
      fetchData();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Fehler beim Austragen");
    }
  };

  const handleSetStatus = async (assignmentId: string, status: "completed" | "no_show") => {
    try {
      const { error } = await supabase.from("work_shift_assignments").update({ status }).eq("id", assignmentId);
      if (error) throw error;
      toast.success(status === "completed" ? "Als erledigt markiert" : "Als No-Show markiert");
      fetchData();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Fehler");
    }
  };

  const handleMarkAllCompleted = async (shiftId: string) => {
    const shiftAssignments = assignments.filter((a) => a.work_shift_id === shiftId && a.status === "signed_up");
    if (shiftAssignments.length === 0) { toast.info("Keine offenen Einsätze zum Markieren"); return; }
    try {
      for (const a of shiftAssignments) {
        await supabase.from("work_shift_assignments").update({ status: "completed" }).eq("id", a.id);
      }
      toast.success(`${shiftAssignments.length} Einsätze als erledigt markiert`);
      fetchData();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Fehler beim Markieren");
    }
  };

  const handleMarkAllEventCompleted = async () => {
    const signedUpAssignments = assignments.filter((a) => a.status === "signed_up");
    if (signedUpAssignments.length === 0) { toast.info("Keine offenen Einsätze zum Markieren"); return; }
    try {
      for (const a of signedUpAssignments) {
        await supabase.from("work_shift_assignments").update({ status: "completed" }).eq("id", a.id);
      }
      toast.success(`${signedUpAssignments.length} Einsätze als erledigt markiert`);
      fetchData();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Fehler beim Markieren");
    }
  };

  const handleCreateEventPost = () => {
    if (!event) return;
    navigate(`/portal/posts?event=${event.id}`);
  };

  const getShiftAssignments = (shiftId: string) =>
    assignments.filter((a) => a.work_shift_id === shiftId && (a.status === "signed_up" || a.status === "completed"));

  const isSignedUp = (shiftId: string) =>
    member ? assignments.some((a) => a.work_shift_id === shiftId && a.member_id === member.id && (a.status === "signed_up" || a.status === "completed")) : false;

  const getMyAssignments = () =>
    member ? assignments.filter((a) => a.member_id === member.id && (a.status === "signed_up" || a.status === "completed")) : [];

  const getTotalSlots = () => shifts.reduce((sum, s) => sum + s.required_slots, 0);
  const getFilledSlots = () => shifts.reduce((sum, s) => sum + getShiftAssignments(s.id).length, 0);
  const getOpenSlots = () => getTotalSlots() - getFilledSlots();
  const getCompanyName = (companyId: string) => companies.find((c) => c.id === companyId)?.name || "Kompanie";
  const getResponsibleMember = () => responsibleMemberId ? members.find((m) => m.id === responsibleMemberId) : null;

  if (isLoading) {
    return (
      <PortalLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </PortalLayout>
    );
  }

  if (!event) {
    return (
      <PortalLayout>
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Event nicht gefunden</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/portal/events")}>
            Zurück zu Termine
          </Button>
        </div>
      </PortalLayout>
    );
  }

  const audienceInfo = audienceLabels[event.audience];
  const statusInfo = statusLabels[event.publication_status];
  const AudienceIcon = audienceInfo.icon;
  const canEdit = canManageEvent(event);
  const myAssignments = getMyAssignments();
  const responsibleMember = getResponsibleMember();

  return (
    <PortalLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-start gap-4 mb-6">
            <Button variant="ghost" size="sm" onClick={() => navigate("/portal/events")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Zurück
            </Button>
          </div>

          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <Badge className={audienceInfo.color}>
                  <AudienceIcon className="w-3 h-3 mr-1" />
                  {audienceInfo.label}
                </Badge>
                <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
                <Badge variant="outline">
                  {event.owner_type === "club" ? "Hauptverein" : getCompanyName(event.owner_id)}
                </Badge>
              </div>
              <h1 className="font-display text-3xl font-bold">{event.title}</h1>
              <div className="flex flex-wrap items-center gap-4 mt-2 text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {format(new Date(event.start_at), "EEEE, d. MMMM yyyy", { locale: de })}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {format(new Date(event.start_at), "HH:mm", { locale: de })}
                  {event.end_at && ` – ${format(new Date(event.end_at), "HH:mm", { locale: de })}`}
                </span>
                {event.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    {event.location}
                  </span>
                )}
              </div>
              {event.description && <p className="mt-3 text-muted-foreground">{event.description}</p>}
            </div>

            {canEdit && (
              <Button variant="outline" asChild>
                <Link to={`/portal/events?edit=${event.id}`}>
                  <Edit className="w-4 h-4 mr-2" />
                  Bearbeiten
                </Link>
              </Button>
            )}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-primary/10"><ClipboardList className="w-5 h-5 text-primary" /></div><div><p className="text-2xl font-bold">{shifts.length}</p><p className="text-sm text-muted-foreground">Schichten</p></div></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-amber-500/10"><AlertCircle className="w-5 h-5 text-amber-600" /></div><div><p className="text-2xl font-bold">{getOpenSlots()}</p><p className="text-sm text-muted-foreground">Offene Plätze</p></div></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-green-500/10"><UserCheck className="w-5 h-5 text-green-600" /></div><div><p className="text-2xl font-bold">{getFilledSlots()}</p><p className="text-sm text-muted-foreground">Eingeteilt</p></div></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-blue-500/10"><Shield className="w-5 h-5 text-blue-600" /></div><div><p className="text-2xl font-bold">{myAssignments.length}</p><p className="text-sm text-muted-foreground">Meine Einsätze</p></div></div></CardContent></Card>
        </motion.div>

        <EventQuickActions
          eventId={event.id}
          eventTitle={event.title}
          clubId={event.club_id}
          shiftCount={shifts.length}
          openSlots={getOpenSlots()}
          totalSlots={getTotalSlots()}
          daysUntilEvent={Math.ceil((new Date(event.start_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))}
          canManage={canEdit}
          canCreatePosts={hasPermission("club.posts.manage") || hasPermission("club.admin.full") || permissions.some(p => p.permission_key === "company.posts.manage")}
          canManageDocuments={hasPermission("club.documents.manage") || hasPermission("club.admin.full")}
          onCreatePost={handleCreateEventPost}
        />

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><UserCheck className="w-5 h-5" />Zuständigkeit</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {canEdit ? (
                <div className="space-y-2">
                  <Label>Hauptverantwortlicher</Label>
                  <Select value={responsibleMemberId || "none"} onValueChange={(val) => { setResponsibleMemberId(val === "none" ? null : val); setHasUnsavedChanges(true); }}>
                    <SelectTrigger><SelectValue placeholder="Auswählen..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nicht festgelegt</SelectItem>
                      {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.first_name} {m.last_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div>
                  {responsibleMember ? <p className="font-medium">{responsibleMember.first_name} {responsibleMember.last_name}</p> : <p className="text-muted-foreground">Nicht festgelegt</p>}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><FileText className="w-5 h-5" />Interne Hinweise</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {canEdit ? (
                <Textarea placeholder="Hinweise für Helfer..." value={internalNotes} onChange={(e) => { setInternalNotes(e.target.value); setHasUnsavedChanges(true); }} rows={4} />
              ) : internalNotes ? (
                <p className="whitespace-pre-wrap text-sm">{internalNotes}</p>
              ) : (
                <p className="text-muted-foreground text-sm">Keine Hinweise vorhanden</p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {canEdit && hasUnsavedChanges && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Button onClick={handleSaveDetails} disabled={isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Änderungen speichern
            </Button>
          </motion.div>
        )}

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <EventPostsSection eventId={event.id} clubId={event.club_id} canManage={canEdit} />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3">
              <CardTitle className="text-lg flex items-center gap-2"><ClipboardList className="w-5 h-5" />Arbeitsdienste ({shifts.length})</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                {canEdit && assignments.some(a => a.status === "signed_up") && (
                  <Button size="sm" variant="outline" onClick={handleMarkAllEventCompleted} className="text-green-600 hover:text-green-700 hover:bg-green-50">
                    <CheckCheck className="w-4 h-4 mr-2" />Alle erledigt
                  </Button>
                )}
                {canEdit && <Button size="sm" onClick={openNewShiftDialog}><Plus className="w-4 h-4 mr-2" />Schicht anlegen</Button>}
              </div>
            </CardHeader>
            <CardContent>
              {shifts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ClipboardList className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Noch keine Schichten angelegt</p>
                  {canEdit && <Button variant="outline" className="mt-4" onClick={openNewShiftDialog}><Plus className="w-4 h-4 mr-2" />Erste Schicht anlegen</Button>}
                </div>
              ) : (
                <div className="space-y-4">
                  {shifts.map((shift) => {
                    const shiftAssignments = getShiftAssignments(shift.id);
                    const filledSlots = shiftAssignments.length;
                    const hasOpenSlots = filledSlots < shift.required_slots;
                    const isFull = filledSlots >= shift.required_slots;
                    const isOverbooked = filledSlots > shift.required_slots;
                    const userSignedUp = isSignedUp(shift.id);
                    const canManage = canManageShift(shift);
                    const daysUntilEvent = Math.ceil((new Date(event.start_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                    const isCritical = hasOpenSlots && daysUntilEvent >= 0 && daysUntilEvent <= 7;

                    const getShiftStatusColor = () => {
                      if (isOverbooked) return "bg-purple-500/10 text-purple-600 border-purple-500";
                      if (isFull) return "bg-green-500/10 text-green-600 border-green-500";
                      if (isCritical) return "bg-destructive/10 text-destructive border-destructive";
                      return "bg-amber-500/10 text-amber-600 border-amber-500";
                    };

                    const getShiftBorderColor = () => {
                      if (isCritical) return "border-destructive/50 bg-destructive/5";
                      if (isFull) return "border-green-500/30";
                      return "";
                    };

                    return (
                      <div key={shift.id} className={`border rounded-lg p-4 hover:bg-muted/30 transition-colors ${getShiftBorderColor()}`}>
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <h4 className="font-medium">{shift.title}</h4>
                              <Badge className={getShiftStatusColor()}>{filledSlots}/{shift.required_slots} Plätze{isOverbooked && " (überbelegt)"}</Badge>
                              {isCritical && <Badge variant="destructive" className="flex items-center gap-1"><AlertCircle className="w-3 h-3" />Kritisch</Badge>}
                              {isFull && !isOverbooked && <Badge variant="secondary" className="bg-green-500/10 text-green-600"><CheckCircle2 className="w-3 h-3 mr-1" />Voll</Badge>}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              <Clock className="w-3 h-3 inline mr-1" />
                              {format(new Date(shift.start_at), "HH:mm", { locale: de })} – {format(new Date(shift.end_at), "HH:mm", { locale: de })}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {userSignedUp ? (
                              <Button variant="outline" size="sm" onClick={() => handleSignOut(shift)}><XCircle className="w-4 h-4 mr-1" />Austragen</Button>
                            ) : hasOpenSlots ? (
                              <Button size="sm" onClick={() => handleSignUp(shift)}><Plus className="w-4 h-4 mr-1" />Eintragen</Button>
                            ) : null}
                            {canManage && (
                              <>
                                <Button variant="ghost" size="sm" onClick={() => openEditShiftDialog(shift)}><Edit className="w-4 h-4" /></Button>
                                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDeleteShift(shift)}><Trash2 className="w-4 h-4" /></Button>
                              </>
                            )}
                          </div>
                        </div>
                        {shiftAssignments.length > 0 && (
                          <div className="mt-3 pt-3 border-t">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-xs text-muted-foreground">Eingetragen:</p>
                              {canManage && shiftAssignments.some(a => a.status === "signed_up") && (
                                <Button size="sm" variant="ghost" className="h-6 text-xs text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => handleMarkAllCompleted(shift.id)}>
                                  <CheckCheck className="w-3 h-3 mr-1" />Alle erledigt
                                </Button>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {shiftAssignments.map((a) => (
                                <div key={a.id} className="flex items-center gap-1 text-sm bg-muted px-2 py-1 rounded">
                                  <span>{a.member?.first_name} {a.member?.last_name}</span>
                                  {a.status === "completed" && <CheckCircle2 className="w-3 h-3 text-green-600" />}
                                  {canManage && a.status === "signed_up" && (
                                    <>
                                      <button className="ml-1 text-green-600 hover:text-green-700" onClick={() => handleSetStatus(a.id, "completed")} title="Als erledigt markieren"><CheckCircle2 className="w-3 h-3" /></button>
                                      <button className="text-destructive/60 hover:text-destructive" onClick={() => handleSetStatus(a.id, "no_show")} title="Als No-Show markieren"><XCircle className="w-3 h-3" /></button>
                                    </>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <Dialog open={shiftDialogOpen} onOpenChange={setShiftDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingShift ? "Schicht bearbeiten" : "Neue Schicht"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Titel</Label>
                <Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="z.B. Aufbau, Theke, Abbau..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Beginn</Label><Input type="datetime-local" value={formStartAt} onChange={(e) => setFormStartAt(e.target.value)} /></div>
                <div className="space-y-2"><Label>Ende</Label><Input type="datetime-local" value={formEndAt} onChange={(e) => setFormEndAt(e.target.value)} /></div>
              </div>
              <div className="space-y-2">
                <Label>Benötigte Helfer</Label>
                <Input type="number" min={1} value={formRequiredSlots} onChange={(e) => setFormRequiredSlots(parseInt(e.target.value) || 1)} />
              </div>
              <div className="space-y-2">
                <Label>Zuständigkeit</Label>
                <Select value={formOwnerType} onValueChange={(val: OwnerType) => { setFormOwnerType(val); if (val === "club" && member) setFormOwnerId(member.club_id); else if (val === "company" && companies.length > 0) setFormOwnerId(companies[0].id); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="club">Hauptverein</SelectItem>
                    <SelectItem value="company">Kompanie</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formOwnerType === "company" && (
                <div className="space-y-2">
                  <Label>Kompanie</Label>
                  <Select value={formOwnerId} onValueChange={setFormOwnerId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShiftDialogOpen(false)}>Abbrechen</Button>
              <Button onClick={handleSaveShift} disabled={!formTitle.trim()}>{editingShift ? "Speichern" : "Erstellen"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PortalLayout>
  );
};

export default EventOrganize;