import { useEffect, useState } from "react";
import { format, startOfDay } from "date-fns";
import { de } from "date-fns/locale";
import { motion } from "framer-motion";
import {
  Plus,
  Edit,
  Trash2,
  Loader2,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  MapPin,
  Building2,
  Shield,
  Filter,
  Share2,
  Send,
  Globe,
  Users,
  Eye,
  ClipboardList,
} from "lucide-react";
import { Link } from "react-router-dom";
import PortalLayout from "@/components/portal/PortalLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { supabase, apiJson } from "@/integrations/api/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import EventPublicPreview from "@/components/portal/EventPublicPreview";

type EventCategory = "training" | "meeting" | "fest" | "work" | "other";
type OwnerType = "club" | "company";
type EventAudience = "company_only" | "club_internal" | "public";
type PublicationStatus = "draft" | "submitted" | "approved" | "rejected";

interface Event {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_at: string;
  end_at: string | null;
  category: EventCategory;
  owner_type: OwnerType;
  owner_id: string;
  owner_name?: string;
  audience: EventAudience;
  publication_status: PublicationStatus;
  created_by_member_id: string | null;
  rejection_reason: string | null;
}

interface Company {
  id: string;
  name: string;
}

interface RawClub {
  slug: string;
}

interface RawMembership {
  company_id: string;
}

interface RawEvent {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_at: string;
  end_at: string | null;
  category: EventCategory;
  owner_type: OwnerType;
  owner_id: string;
  audience: EventAudience;
  publication_status: PublicationStatus;
  created_by_member_id: string | null;
  rejection_reason: string | null;
}

interface EventUpdateData {
  club_id: string;
  owner_type: OwnerType;
  owner_id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_at: string;
  end_at: string | null;
  category: EventCategory;
  audience: EventAudience;
  updated_by_member_id?: string;
  publication_status?: string;
  approved_at?: string;
  approved_by_member_id?: string;
}

interface EventInsertData extends Omit<EventUpdateData, 'updated_by_member_id'> {
  created_by_member_id: string;
}

const categoryLabels: Record<EventCategory, { label: string; color: string }> = {
  training: { label: "Training", color: "bg-blue-500/10 text-blue-500" },
  meeting: { label: "Versammlung", color: "bg-purple-500/10 text-purple-500" },
  fest: { label: "Fest/Feier", color: "bg-amber-500/10 text-amber-500" },
  work: { label: "Arbeitsdienst", color: "bg-green-500/10 text-green-500" },
  other: { label: "Sonstiges", color: "bg-muted text-muted-foreground" },
};

const audienceLabels: Record<EventAudience, { label: string; icon: React.ElementType }> = {
  company_only: { label: "Kompanie-intern", icon: Building2 },
  club_internal: { label: "Schützen-intern", icon: Users },
  public: { label: "Öffentlich", icon: Globe },
};

const statusLabels: Record<PublicationStatus, { label: string; color: string }> = {
  draft: { label: "Entwurf", color: "bg-muted text-muted-foreground" },
  submitted: { label: "Eingereicht", color: "bg-amber-500/10 text-amber-600" },
  approved: { label: "Freigegeben", color: "bg-green-500/10 text-green-600" },
  rejected: { label: "Abgelehnt", color: "bg-destructive/10 text-destructive" },
};

const Events = () => {
  const { member, hasPermission, permissions, isAdmin } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [clubSlug, setClubSlug] = useState<string>("");
  const [userCompanyId, setUserCompanyId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [deletingEvent, setDeletingEvent] = useState<Event | null>(null);
  const [rejectingEvent, setRejectingEvent] = useState<Event | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formOwnerId, setFormOwnerId] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [category, setCategory] = useState<EventCategory>("other");
  const [ownerType, setOwnerType] = useState<OwnerType>("club");
  const [audience, setAudience] = useState<EventAudience>("club_internal");

  const [filterOwner, setFilterOwner] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const canManageClubEvents = isAdmin;
  const canApprove = isAdmin;
  const canManageCompanyEvents = isAdmin;
  const userCompanyScope = permissions.find(
    (p) => p.permission_key === "company.events.manage" && p.scope_type === "company"
  )?.scope_id;

  const canShareInternalForCompany = (companyId: string) =>
    isAdmin && (permissions.some(
      (p) => p.permission_key === "company.events.share_internal" && p.scope_type === "company" && p.scope_id === companyId
    ) || hasPermission("club.admin.full"));

  const canSubmitForPublicationForCompany = (companyId: string) =>
    isAdmin && (permissions.some(
      (p) => p.permission_key === "company.events.submit_publication" && p.scope_type === "company" && p.scope_id === companyId
    ) || hasPermission("club.admin.full"));

  useEffect(() => {
    if (member?.club_id) fetchData();
  }, [member?.club_id]);

  const fetchData = async () => {
    if (!member) return;
    setIsLoading(true);

    try {
      const { data: clubData } = await supabase
        .from("clubs")
        .select("slug")
        .eq("id", member.club_id)
        .single();
      setClubSlug((clubData as RawClub | null)?.slug || "");

      const { data: companiesData } = await supabase
        .from("companies")
        .select("id, name")
        .eq("club_id", member.club_id);
      const companiesList = (companiesData as Company[]) || [];
      setCompanies(companiesList);

      const { data: membershipData } = await supabase
        .from("member_company_memberships")
        .select("company_id")
        .eq("member_id", member.id)
        .is("valid_to", null)
        .maybeSingle();
      setUserCompanyId((membershipData as RawMembership | null)?.company_id || null);

      // Termine über den Backend-API-Endpunkt abrufen
      const eventsData = await apiJson<RawEvent[]>(
        `/api/events?from=${startOfDay(new Date()).toISOString()}`
      ) || [];

      const companyMap = new Map<string, string>(companiesList.map((c) => [c.id, c.name]));
      const enrichedEvents = ((eventsData as RawEvent[]) || []).map((e) => ({
        ...e,
        owner_name: e.owner_type === "club" ? "Hauptverein" : companyMap.get(e.owner_id) || "Kompanie",
      }));

      setEvents(enrichedEvents);
    } catch (error: unknown) {
      console.error("Error fetching data:", error);
      toast.error("Fehler beim Laden der Termine");
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setLocation("");
    setStartAt("");
    setEndAt("");
    setCategory("other");
    setOwnerType(canManageClubEvents ? "club" : "company");
    setAudience("club_internal");
    setFormOwnerId(userCompanyScope || userCompanyId || "");
    setEditingEvent(null);
  };

  const openNewDialog = () => { resetForm(); setIsDialogOpen(true); };

  const openEditDialog = (event: Event) => {
    setEditingEvent(event);
    setTitle(event.title);
    setDescription(event.description || "");
    setLocation(event.location || "");
    setStartAt(event.start_at.slice(0, 16));
    setEndAt(event.end_at?.slice(0, 16) || "");
    setCategory(event.category);
    setOwnerType(event.owner_type);
    setFormOwnerId(event.owner_id);
    setAudience(event.audience);
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!title.trim() || !startAt || !member) return;

    if (endAt && new Date(endAt) < new Date(startAt)) {
      toast.error("Endzeit muss nach Startzeit liegen");
      return;
    }

    setIsSubmitting(true);

    try {
      const ownerId = ownerType === "club" ? member.club_id : (canManageClubEvents ? formOwnerId : (userCompanyScope || userCompanyId));
      if (!ownerId) throw new Error("Keine Kompanie-Zuordnung gefunden");

      const effectiveAudience: EventAudience = ownerType === "club"
        ? audience
        : (audience === "public" ? "club_internal" : audience);

      if (editingEvent) {
        const updateData: EventUpdateData = {
          club_id: member.club_id,
          owner_type: ownerType,
          owner_id: ownerId,
          title: title.trim(),
          description: description.trim() || null,
          location: location.trim() || null,
          start_at: new Date(startAt).toISOString(),
          end_at: endAt ? new Date(endAt).toISOString() : null,
          category,
          audience: effectiveAudience,
          updated_by_member_id: member.id,
        };

        if (effectiveAudience === "public" && canManageClubEvents) {
          updateData.publication_status = "approved";
          updateData.approved_at = new Date().toISOString();
          updateData.approved_by_member_id = member.id;
        }

        // Termin über Backend-API aktualisieren
        await apiJson(`/api/events/${editingEvent.id}`, {
          method: "PUT",
          body: JSON.stringify(updateData),
        });
        toast.success("Termin aktualisiert");
      } else {
        // Neuen Termin über Backend-API erstellen
        const insertData: EventInsertData = {
          club_id: member.club_id,
          owner_type: ownerType,
          owner_id: ownerId,
          title: title.trim(),
          description: description.trim() || null,
          location: location.trim() || null,
          start_at: new Date(startAt).toISOString(),
          end_at: endAt ? new Date(endAt).toISOString() : null,
          category,
          audience: effectiveAudience,
          created_by_member_id: member.id,
          // Frontend bestimmt den initialen Publikationsstatus basierend auf Berechtigungen
          publication_status: effectiveAudience === "public" && canManageClubEvents ? "approved" : "draft",
        };

        if (effectiveAudience === "public" && canManageClubEvents) {
          insertData.approved_at = new Date().toISOString();
          insertData.approved_by_member_id = member.id;
        }
        await apiJson("/api/events", {
          method: "POST",
          body: JSON.stringify(insertData),
        });
        toast.success("Termin erstellt");
      }

      fetchData();
      setIsDialogOpen(false);
      resetForm();
    } catch (error: unknown) {
      console.error("Error saving event:", error);
      toast.error(error instanceof Error ? error.message : "Fehler beim Speichern");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingEvent) return;
    // Termin über Backend-API löschen
    try {
      await apiJson(`/api/events/${deletingEvent.id}`, {
        method: "DELETE",
      });
      toast.success("Termin gelöscht");
      fetchData();
    } catch (error: unknown) {
      console.error("Error deleting event:", error);
      toast.error(error instanceof Error ? error.message : "Fehler beim Löschen");
    } finally {
      setDeletingEvent(null);
    }
  };

  const handleShareInternal = async (event: Event) => {
    try {
      // Termin über Backend-API aktualisieren
      await apiJson(`/api/events/${event.id}`, {
        method: "PUT",
        body: JSON.stringify({ audience: "club_internal" }),
      });
      toast.success("Termin wird jetzt schützen-intern geteilt");
      fetchData();
    } catch (error: unknown) {
      console.error("Error sharing event:", error);
      toast.error(error instanceof Error ? error.message : "Fehler beim Teilen");
    }
  };

  const handleSubmitForPublication = async (event: Event) => {
    try {
      // Termin über Backend-API aktualisieren
      await apiJson(`/api/events/${event.id}`, {
        method: "PUT",
        body: JSON.stringify({
          publication_status: "submitted",
          submitted_at: new Date().toISOString(),
        }),
      });
      toast.success("Termin zur Veröffentlichung eingereicht");
      fetchData();
    } catch (error: unknown) {
      console.error("Error submitting event:", error);
      toast.error(error instanceof Error ? error.message : "Fehler beim Einreichen");
    }
  };

  const handleApprove = async (event: Event) => {
    if (!member) return;
    setIsSubmitting(true);
    try {
      await apiJson(`/api/events/${event.id}`, {
        method: "PUT",
        body: JSON.stringify({
          audience: "public",
          publication_status: "approved",
          approved_at: new Date().toISOString(),
          approved_by_member_id: member.id,
        }),
      });
      toast.success("Termin freigegeben und öffentlich geschaltet");
      fetchData();
    } catch (error: unknown) {
      toast.error("Fehler beim Freigeben");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!rejectingEvent || !rejectionReason.trim()) {
      toast.error("Bitte geben Sie einen Ablehnungsgrund ein");
      return;
    }
    setIsSubmitting(true);
    try {
      await apiJson(`/api/events/${rejectingEvent.id}`, {
        method: "PUT",
        body: JSON.stringify({
          publication_status: "rejected",
          rejection_reason: rejectionReason.trim(),
        }),
      });
      toast.success("Termin abgelehnt");
      setRejectingEvent(null);
      setRejectionReason("");
      fetchData();
    } catch (error: unknown) {
      toast.error("Fehler beim Ablehnen");
    } finally {
      setIsSubmitting(false);
    }
  };

  const canEditEvent = (event: Event) => {
    if (!isAdmin) return false;
    if (event.owner_type === "club") return canManageClubEvents;
    return permissions.some(
      (p) => p.permission_key === "company.events.manage" && p.scope_type === "company" && p.scope_id === event.owner_id
    ) || hasPermission("club.admin.full");
  };

  const filteredEvents = events.filter((e) => {
    if (filterOwner !== "all") {
      if (filterOwner === "club" && e.owner_type !== "club") return false;
      if (filterOwner === "company" && e.owner_type !== "company") return false;
    }
    if (filterCategory !== "all" && e.category !== filterCategory) return false;
    if (filterStatus !== "all" && e.publication_status !== filterStatus) return false;
    return true;
  });

  const canCreateAnyEvent = canManageClubEvents || canManageCompanyEvents;

  return (
    <PortalLayout>
      <div className="max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex justify-between items-center mb-8">
          <div>
            <h1 className="font-display text-3xl font-bold">Termine</h1>
            <p className="text-muted-foreground">Alle anstehenden Termine</p>
          </div>
          {canCreateAnyEvent && (
            <Button onClick={openNewDialog}><Plus className="w-4 h-4 mr-2" /> Termin erstellen</Button>
          )}
        </motion.div>

        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={filterOwner} onValueChange={setFilterOwner}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Alle Bereiche" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Bereiche</SelectItem>
                <SelectItem value="club">Hauptverein</SelectItem>
                <SelectItem value="company">Kompanien</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {canApprove && (
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Alle Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Status</SelectItem>
                <SelectItem value="approved">Freigegeben</SelectItem>
                <SelectItem value="submitted">Eingereicht</SelectItem>
                <SelectItem value="draft">Entwurf</SelectItem>
                <SelectItem value="rejected">Abgelehnt</SelectItem>
              </SelectContent>
            </Select>
          )}
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Alle Kategorien" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Kategorien</SelectItem>
              {Object.entries(categoryLabels).map(([key, { label }]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
        ) : filteredEvents.length === 0 ? (
          <Card><CardContent className="py-12 text-center"><Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" /><p className="text-muted-foreground">Keine Termine gefunden</p></CardContent></Card>
        ) : (
          <div className="space-y-4">
            {filteredEvents.map((event) => {
              const cat = categoryLabels[event.category];
              const startDate = new Date(event.start_at);
              const endDate = event.end_at ? new Date(event.end_at) : null;
              const audienceInfo = audienceLabels[event.audience];
              const statusInfo = statusLabels[event.publication_status];
              const AudienceIcon = audienceInfo.icon;
              const showShareButton = event.owner_type === "company" && event.audience === "company_only" && canShareInternalForCompany(event.owner_id);
              const showSubmitButton = event.owner_type === "company" && event.publication_status === "draft" && canSubmitForPublicationForCompany(event.owner_id);

              return (
                <motion.div key={event.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex gap-4">
                          <div className="flex-shrink-0 w-14 h-14 bg-primary/10 rounded-lg flex flex-col items-center justify-center">
                            <span className="text-xs text-primary font-medium">{format(startDate, "MMM", { locale: de })}</span>
                            <span className="text-xl font-bold text-primary">{format(startDate, "d")}</span>
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-medium text-foreground">{event.title}</h3>
                            <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-muted-foreground">
                              <span>{format(startDate, "HH:mm", { locale: de })}{endDate && ` – ${format(endDate, "HH:mm", { locale: de })}`}</span>
                              {event.location && (<><span>•</span><span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{event.location}</span></>)}
                            </div>
                            {event.description && <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{event.description}</p>}
                            {event.rejection_reason && event.publication_status === "rejected" && (
                              <p className="text-sm text-destructive mt-2">Ablehnungsgrund: {event.rejection_reason}</p>
                            )}
                            <div className="flex flex-wrap gap-2 mt-3">
                              <Badge variant="secondary" className={cat.color}>{cat.label}</Badge>
                              <Badge variant="outline" className="flex items-center gap-1">
                                {event.owner_type === "club" ? <Shield className="w-3 h-3" /> : <Building2 className="w-3 h-3" />}
                                {event.owner_name}
                              </Badge>
                              <Badge variant="secondary" className="flex items-center gap-1">
                                <AudienceIcon className="w-3 h-3" />{audienceInfo.label}
                              </Badge>
                              {event.publication_status !== "draft" && (
                                <Badge variant="secondary" className={statusInfo.color}>{statusInfo.label}</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {event.publication_status === "submitted" && canApprove && (
                            <div className="flex gap-1 mr-2 border-r pr-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-destructive border-destructive/30 hover:bg-destructive/10"
                                onClick={() => setRejectingEvent(event)}
                                disabled={isSubmitting}
                              >
                                <XCircle className="w-4 h-4 mr-1" />
                                Ablehnen
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleApprove(event)}
                                disabled={isSubmitting}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <CheckCircle className="w-4 h-4 mr-1" />
                                Freigeben
                              </Button>
                            </div>
                          )}
                          <Link to={`/portal/events/${event.id}/organize`} title="Organisieren">
                            <Button variant="ghost" size="sm"><Eye className="w-4 h-4 mr-1" />Organisieren</Button>
                          </Link>
                          {showShareButton && (
                            <Button variant="ghost" size="icon" onClick={() => handleShareInternal(event)} title="Schützen-intern teilen">
                              <Share2 className="w-4 h-4 text-primary" />
                            </Button>
                          )}
                          {showSubmitButton && (
                            <Button variant="ghost" size="icon" onClick={() => handleSubmitForPublication(event)} title="Zur Veröffentlichung einreichen">
                              <Send className="w-4 h-4 text-amber-600" />
                            </Button>
                          )}
                          {canEditEvent(event) && (
                            <>
                              <Button variant="ghost" size="icon" onClick={() => openEditDialog(event)}><Edit className="w-4 h-4" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => setDeletingEvent(event)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                            </>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className={`${audience === "public" && ownerType === "club" ? "sm:max-w-2xl" : "sm:max-w-md"} max-h-[90vh] flex flex-col`}>
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>{editingEvent ? "Termin bearbeiten" : "Neuer Termin"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 overflow-y-auto flex-1 pr-2">
            {(canManageClubEvents || canManageCompanyEvents) && (
              <div>
                <Label>Bereich</Label>
                <Select value={ownerType} onValueChange={(v) => { setOwnerType(v as OwnerType); setAudience(v === "company" ? "company_only" : "club_internal"); }} disabled={editingEvent !== null}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {canManageClubEvents && <SelectItem value="club"><span className="flex items-center gap-2"><Shield className="w-4 h-4" /> Hauptverein</span></SelectItem>}
                    {canManageCompanyEvents && (
                      <SelectItem value="company">
                        <span className="flex items-center gap-2">
                          <Building2 className="w-4 h-4" /> {hasPermission("club.admin.full") ? "Kompanie" : "Meine Kompanie"}
                        </span>
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {ownerType === "company" && canManageClubEvents && (
              <div className="space-y-2">
                <Label>Kompanie auswählen *</Label>
                <Select 
                  value={formOwnerId} 
                  onValueChange={setFormOwnerId}
                >
                  <SelectTrigger><SelectValue placeholder="Kompanie wählen..." /></SelectTrigger>
                  <SelectContent>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {ownerType === "club" && canManageClubEvents && (
              <div>
                <Label>Zielgruppe</Label>
                <Select value={audience} onValueChange={(v) => setAudience(v as EventAudience)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="club_internal"><span className="flex items-center gap-2"><Users className="w-4 h-4" /> Schützen-intern</span></SelectItem>
                    <SelectItem value="public"><span className="flex items-center gap-2"><Globe className="w-4 h-4" /> Öffentlich (Homepage)</span></SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  {audience === "public" ? "Wird automatisch freigegeben und auf der Vereins-Homepage angezeigt" : "Nur sichtbar für angemeldete Vereinsmitglieder"}
                </p>
                {audience === "public" && (
                  <div className="mt-4">
                    <EventPublicPreview title={title} description={description} location={location} startAt={startAt} endAt={endAt} category={category} eventId={editingEvent?.id} clubSlug={clubSlug} />
                  </div>
                )}
              </div>
            )}

            {ownerType === "company" && (
              <div>
                <Label>Zielgruppe</Label>
                <Select value={audience} onValueChange={(v) => setAudience(v as EventAudience)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="company_only"><span className="flex items-center gap-2"><Building2 className="w-4 h-4" /> Kompanie-intern</span></SelectItem>
                    <SelectItem value="club_internal"><span className="flex items-center gap-2"><Users className="w-4 h-4" /> Schützen-intern</span></SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  {audience === "company_only" ? "Nur sichtbar für Mitglieder Ihrer Kompanie" : "Sichtbar für alle Vereinsmitglieder"}
                </p>
              </div>
            )}

            <div>
              <Label>Titel *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z.B. Jahreshauptversammlung" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Start *</Label><Input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} /></div>
              <div><Label>Ende</Label><Input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} /></div>
            </div>
            <div><Label>Ort</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="z.B. Schützenhaus" /></div>
            <div>
              <Label>Kategorie</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as EventCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(categoryLabels).map(([key, { label }]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Beschreibung</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Zusätzliche Informationen..." rows={3} /></div>
          </div>
          <DialogFooter className="flex-shrink-0 pt-4 border-t">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={handleSave} disabled={isSubmitting || !title.trim() || !startAt || (ownerType === "company" && !formOwnerId)}>
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejectingEvent} onOpenChange={() => setRejectingEvent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Termin ablehnen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Bitte geben Sie einen Grund für die Ablehnung von „{rejectingEvent?.title}" an.
            </p>
            <div>
              <Label>Ablehnungsgrund *</Label>
              <Textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="z.B. Bitte genauere Beschreibung hinzufügen..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectingEvent(null)}>Abbrechen</Button>
            <Button variant="destructive" onClick={handleReject} disabled={isSubmitting || !rejectionReason.trim()}>
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Ablehnen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingEvent} onOpenChange={() => setDeletingEvent(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Termin löschen?</AlertDialogTitle>
            <AlertDialogDescription>Sind Sie sicher, dass Sie „{deletingEvent?.title}" löschen möchten?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PortalLayout>
  );
};

export default Events;
