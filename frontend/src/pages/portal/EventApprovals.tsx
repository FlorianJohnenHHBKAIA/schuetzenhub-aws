import { useEffect, useState } from "react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { motion } from "framer-motion";
import {
  Loader2,
  Calendar,
  MapPin,
  Building2,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import PortalLayout from "@/components/portal/PortalLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

type EventCategory = "training" | "meeting" | "fest" | "work" | "other";

interface Event {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_at: string;
  end_at: string | null;
  category: EventCategory;
  owner_id: string;
  owner_name?: string;
  submitted_at: string | null;
  club_id: string;
}

interface Company {
  id: string;
  name: string;
}

const categoryLabels: Record<EventCategory, { label: string; color: string }> = {
  training: { label: "Training", color: "bg-blue-500/10 text-blue-500" },
  meeting: { label: "Versammlung", color: "bg-purple-500/10 text-purple-500" },
  fest: { label: "Fest/Feier", color: "bg-amber-500/10 text-amber-500" },
  work: { label: "Arbeitsdienst", color: "bg-green-500/10 text-green-500" },
  other: { label: "Sonstiges", color: "bg-muted text-muted-foreground" },
};

const EventApprovals = () => {
  const { member, hasPermission, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState<Event[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [rejectingEvent, setRejectingEvent] = useState<Event | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canApprove = hasPermission("club.events.approve_publication") || hasPermission("club.admin.full");

  useEffect(() => {
    if (!authLoading && !canApprove) {
      navigate("/portal");
    }
  }, [authLoading, canApprove, navigate]);

  useEffect(() => {
    if (member?.club_id && canApprove) {
      fetchData();
    }
  }, [member?.club_id, canApprove]);

  const fetchData = async () => {
    if (!member) return;
    setIsLoading(true);

    try {
      const { data: companiesData } = await supabase
        .from("companies")
        .select("id, name")
        .eq("club_id", member.club_id);
      setCompanies(companiesData || []);

      const { data: eventsData, error } = await supabase
        .from("events")
        .select("*")
        .eq("club_id", member.club_id)
        .eq("publication_status", "submitted")
        .order("submitted_at", { ascending: true });

      if (error) throw error;

      const companyMap = new Map((companiesData || []).map((c) => [c.id, c.name]));
      const enrichedEvents = (eventsData || []).map((e) => ({
        ...e,
        owner_name: companyMap.get(e.owner_id) || "Kompanie",
      }));

      setEvents(enrichedEvents);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Fehler beim Laden der Termine");
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (event: Event) => {
    if (!member) return;
    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from("events")
        .update({
          audience: "public",
          publication_status: "approved",
          approved_at: new Date().toISOString(),
          approved_by_member_id: member.id,
        })
        .eq("id", event.id);

      if (error) throw error;

      toast.success("Termin freigegeben und öffentlich geschaltet");
      fetchData();
    } catch (error: any) {
      console.error("Error approving event:", error);
      toast.error(error.message || "Fehler beim Freigeben");
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
      const { error } = await supabase
        .from("events")
        .update({
          publication_status: "rejected",
          rejection_reason: rejectionReason.trim(),
        })
        .eq("id", rejectingEvent.id);

      if (error) throw error;

      toast.success("Termin abgelehnt");
      setRejectingEvent(null);
      setRejectionReason("");
      fetchData();
    } catch (error: any) {
      console.error("Error rejecting event:", error);
      toast.error(error.message || "Fehler beim Ablehnen");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <PortalLayout>
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="font-display text-3xl font-bold">Termin-Freigaben</h1>
          <p className="text-muted-foreground">
            Eingereichte Termine zur Veröffentlichung prüfen und freigeben
          </p>
        </motion.div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : events.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Clock className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                Keine Termine zur Freigabe vorhanden
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {events.map((event) => {
              const cat = categoryLabels[event.category];
              const startDate = new Date(event.start_at);
              const endDate = event.end_at ? new Date(event.end_at) : null;
              const submittedDate = event.submitted_at
                ? new Date(event.submitted_at)
                : null;

              return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex gap-4">
                          <div className="flex-shrink-0 w-14 h-14 bg-amber-500/10 rounded-lg flex flex-col items-center justify-center">
                            <span className="text-xs text-amber-600 font-medium">
                              {format(startDate, "MMM", { locale: de })}
                            </span>
                            <span className="text-xl font-bold text-amber-600">
                              {format(startDate, "d")}
                            </span>
                          </div>

                          <div className="min-w-0">
                            <h3 className="font-medium text-foreground">
                              {event.title}
                            </h3>
                            <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-muted-foreground">
                              <span>
                                {format(startDate, "HH:mm", { locale: de })}
                                {endDate && ` – ${format(endDate, "HH:mm", { locale: de })}`}
                              </span>
                              {event.location && (
                                <>
                                  <span>•</span>
                                  <span className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3" />
                                    {event.location}
                                  </span>
                                </>
                              )}
                            </div>
                            {event.description && (
                              <p className="text-sm text-muted-foreground mt-2">
                                {event.description}
                              </p>
                            )}
                            <div className="flex flex-wrap gap-2 mt-3">
                              <Badge variant="secondary" className={cat.color}>
                                {cat.label}
                              </Badge>
                              <Badge variant="outline" className="flex items-center gap-1">
                                <Building2 className="w-3 h-3" />
                                {event.owner_name}
                              </Badge>
                              {submittedDate && (
                                <Badge variant="secondary" className="bg-amber-500/10 text-amber-600">
                                  Eingereicht: {format(submittedDate, "dd.MM.yyyy HH:mm", { locale: de })}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
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
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Freigeben
                          </Button>
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

      {/* Rejection Dialog */}
      <Dialog open={!!rejectingEvent} onOpenChange={() => setRejectingEvent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Termin ablehnen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-muted-foreground">
              Sie sind dabei, den Termin „{rejectingEvent?.title}" abzulehnen.
              Bitte geben Sie einen Grund an.
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
            <Button variant="outline" onClick={() => setRejectingEvent(null)}>
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={isSubmitting || !rejectionReason.trim()}
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Ablehnen"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
};

export default EventApprovals;
