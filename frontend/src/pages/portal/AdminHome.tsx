import { useState, useEffect, useMemo } from "react";
import { Link, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Calendar,
  ClipboardList,
  Megaphone,
  Users,
  Building2,
  Award,
  ChevronRight,
  Wrench,
  Image,
  FileText,
  Book,
  Handshake,
  LayoutGrid,
  BadgeCheck,
  Shield,
  BarChart3,
  Settings,
  UserCog,
  UserPlus,
  Check,
  X,
  Loader2,
  Eye,
  Cake,
  CheckCircle2,
  XCircle,
  HelpCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import PortalLayout from "@/components/portal/PortalLayout";
import { useAuth } from "@/lib/auth";
import { useUIMode } from "@/hooks/useUIMode";
import { supabase, apiJson } from "@/integrations/api/client";
import AdminBirthdaysSection from "@/components/portal/AdminBirthdaysSection";
import { useToast } from "@/hooks/use-toast";
import { differenceInDays, format } from "date-fns";
import { de } from "date-fns/locale";

interface CriticalShift {
  eventId: string;
  eventTitle: string;
  openSlots: number;
  daysUntil: number;
}

interface AttentionItem {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  variant: "warning" | "critical";
}

interface SectionTile {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
}

// API response types
interface UpcomingEvent {
  id: string;
  title: string;
  start_at: string;
}

interface ShiftData {
  id: string;
  event_id: string;
  required_slots: number | null;
}

interface AssignmentData {
  work_shift_id: string;
}

interface AdData {
  status: string;
}

interface MagazineData {
  id: string;
  year: number;
  status: string;
}

interface PendingMember {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  created_at: string;
  status: string;
  company_name?: string | null;
  company_id?: string | null;
}

interface ParticipantCount {
  event_id: string;
  attending_count: number;
  declined_count: number;
  member_count: number;
}

interface EventRsvpStat {
  eventId: string;
  title: string;
  startAt: string;
  ownerType: string;
  attending: number;
  declined: number;
  pending: number;
  memberCount: number;
  responseRate: number;
}

const AdminHome = () => {
  const { member, hasPermission, isLoading: authLoading } = useAuth();
  const { isAdminMode, toggleMode, isLoaded: uiModeLoaded } = useUIMode();
  const { toast } = useToast();

  const [pendingEventApprovals, setPendingEventApprovals] = useState(0);
  const [pendingPostApprovals, setPendingPostApprovals] = useState(0);
  const [pendingAwardRequests, setPendingAwardRequests] = useState(0);
  const [criticalShifts, setCriticalShifts] = useState<CriticalShift[]>([]);
  const [magazineStats, setMagazineStats] = useState<{ year: number; progress: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingMembers, setPendingMembers] = useState<PendingMember[]>([]);
  const [eventRsvpStats, setEventRsvpStats] = useState<EventRsvpStat[]>([]);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  useEffect(() => {
    if (member?.club_id && isAdminMode) {
      fetchData();
    }
  }, [member?.club_id, isAdminMode]);

  const fetchData = async () => {
    if (!member?.club_id) return;
    setIsLoading(true);

    try {
      const now = new Date();
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const [
        pendingEventsRes,
        pendingPostsRes,
        pendingAwardsRes,
        upcomingEventsWithShiftsRes,
        upcomingEventsForRsvpRes,
        currentMagazineRes,
        pendingMembersRes,
      ] = await Promise.all([
        supabase
          .from("events")
          .select("id", { count: "exact" })
          .eq("club_id", member.club_id)
          .eq("publication_status", "submitted"),
        supabase
          .from("posts")
          .select("id", { count: "exact" })
          .eq("club_id", member.club_id)
          .eq("publication_status", "submitted"),
        supabase
          .from("member_awards")
          .select("id", { count: "exact" })
          .eq("club_id", member.club_id)
          .eq("status", "pending"),
        supabase
          .from("events")
          .select("id, title, start_at")
          .eq("club_id", member.club_id)
          .gte("start_at", now.toISOString())
          .lte("start_at", sevenDaysFromNow.toISOString())
          .order("start_at"),
        supabase
          .from("events")
          .select("id, title, start_at, owner_type")
          .eq("club_id", member.club_id)
          .in("publication_status", ["approved", "submitted"])
          .gte("start_at", now.toISOString())
          .lte("start_at", thirtyDaysFromNow.toISOString())
          .order("start_at"),
        supabase
          .from("magazines")
          .select("id, year, status")
          .eq("club_id", member.club_id)
          .eq("year", now.getFullYear())
          .eq("status", "draft")
          .maybeSingle(),
        apiJson<PendingMember[]>("/api/members/pending").catch(() => []),
      ]);

      setPendingEventApprovals(pendingEventsRes.count || 0);
      setPendingPostApprovals(pendingPostsRes.count || 0);
      setPendingAwardRequests(pendingAwardsRes.count || 0);
      setPendingMembers(Array.isArray(pendingMembersRes) ? pendingMembersRes : []);

      const upcomingEvents = (upcomingEventsWithShiftsRes.data as UpcomingEvent[]) || [];

      if (upcomingEvents.length > 0) {
        const eventIds = upcomingEvents.map((e) => e.id);

        const { data: shiftsRaw } = await supabase
          .from("work_shifts")
          .select("id, event_id, required_slots")
          .in("event_id", eventIds);

        const shiftsData = (shiftsRaw as ShiftData[]) || [];

        if (shiftsData.length > 0) {
          const shiftIds = shiftsData.map((s) => s.id);

          const { data: assignmentsRaw } = await supabase
            .from("work_shift_assignments")
            .select("work_shift_id")
            .in("work_shift_id", shiftIds)
            .in("status", ["signed_up", "completed"]);

          const assignmentsData = (assignmentsRaw as AssignmentData[]) || [];

          const assignmentCounts = assignmentsData.reduce(
            (acc, a) => {
              acc[a.work_shift_id] = (acc[a.work_shift_id] || 0) + 1;
              return acc;
            },
            {} as Record<string, number>
          );

          const eventShiftStats = upcomingEvents.map((event) => {
            const eventShifts = shiftsData.filter((s) => s.event_id === event.id);
            const totalRequired = eventShifts.reduce((sum, s) => sum + (s.required_slots || 0), 0);
            const totalFilled = eventShifts.reduce(
              (sum, s) => sum + (assignmentCounts[s.id] || 0),
              0
            );
            return {
              eventId: event.id,
              eventTitle: event.title,
              openSlots: Math.max(0, totalRequired - totalFilled),
              daysUntil: differenceInDays(new Date(event.start_at), now),
            };
          });

          setCriticalShifts(eventShiftStats.filter((e) => e.openSlots > 0).slice(0, 2));
        }
      }

      const rsvpEvents = (upcomingEventsForRsvpRes.data as {
        id: string; title: string; start_at: string; owner_type: string;
      }[]) || [];
      if (rsvpEvents.length > 0) {
        try {
          const counts = await apiJson<ParticipantCount[]>(
            `/api/events/participant-counts?ids=${rsvpEvents.map(e => e.id).join(",")}`
          );
          const countMap: Record<string, ParticipantCount> = Object.fromEntries(
            counts.map(c => [c.event_id, c])
          );
          const stats: EventRsvpStat[] = rsvpEvents.map(event => {
            const c = countMap[event.id] ?? { attending_count: 0, declined_count: 0, member_count: 0 };
            const pending = Math.max(0, c.member_count - c.attending_count - c.declined_count);
            const responseRate = c.member_count > 0
              ? Math.round(((c.attending_count + c.declined_count) / c.member_count) * 100)
              : 0;
            return {
              eventId: event.id,
              title: event.title,
              startAt: event.start_at,
              ownerType: event.owner_type,
              attending: c.attending_count,
              declined: c.declined_count,
              pending,
              memberCount: c.member_count,
              responseRate,
            };
          });
          setEventRsvpStats(
            stats.sort((a, b) => a.responseRate - b.responseRate).slice(0, 5)
          );
        } catch {
          // Fehler: Section zeigt leer, kein Absturz
        }
      }

      const magazineData = currentMagazineRes.data as MagazineData | null;
      if (magazineData) {
        const { data: adsRaw } = await supabase
          .from("magazine_ads")
          .select("status")
          .eq("magazine_id", magazineData.id);

        const adsData = (adsRaw as AdData[]) || [];

        if (adsData.length > 0) {
          const placedCount = adsData.filter((ad) => ad.status === "placed").length;
          const progress = Math.round((placedCount / adsData.length) * 100);
          setMagazineStats({ year: magazineData.year, progress });
        }
      }
    } catch (error: unknown) {
      console.error("Error fetching admin home data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    setApprovingId(id);
    try {
      await apiJson(`/api/members/${id}/approve`, { method: "POST" });
      setPendingMembers((prev) => prev.filter((m) => m.id !== id));
      toast({ title: "Mitglied angenommen", description: "Der Status wurde auf 'Aktiv' gesetzt." });
    } catch {
      toast({ title: "Fehler beim Annehmen", variant: "destructive" });
    } finally {
      setApprovingId(null);
    }
  };

  const handleReject = async (id: string) => {
    setRejectingId(id);
    try {
      await apiJson(`/api/members/${id}/reject`, { method: "POST" });
      setPendingMembers((prev) => prev.filter((m) => m.id !== id));
      toast({ title: "Anfrage abgelehnt" });
    } catch {
      toast({ title: "Fehler beim Ablehnen", variant: "destructive" });
    } finally {
      setRejectingId(null);
    }
  };

  const attentionItems = useMemo((): AttentionItem[] => {
    const items: AttentionItem[] = [];

    if (pendingMembers.length > 0 && hasPermission("club.members.manage")) {
      items.push({
        id: "pending-members",
        label: "Neue Mitgliedsanfragen",
        description: `${pendingMembers.length} ${pendingMembers.length === 1 ? "Anfrage wartet" : "Anfragen warten"} auf Prüfung`,
        href: "/portal/admin",
        icon: UserPlus,
        variant: "warning",
      });
    }

    if (pendingEventApprovals > 0 && hasPermission("club.events.approve_publication")) {
      items.push({
        id: "event-approvals",
        label: "Termin-Freigaben",
        description: `${pendingEventApprovals} ${pendingEventApprovals === 1 ? "Termin wartet" : "Termine warten"} auf Freigabe`,
        href: "/portal/event-approvals",
        icon: Calendar,
        variant: "warning",
      });
    }

    if (pendingPostApprovals > 0 && hasPermission("club.posts.approve_publication")) {
      items.push({
        id: "post-approvals",
        label: "Beitrags-Freigaben",
        description: `${pendingPostApprovals} ${pendingPostApprovals === 1 ? "Beitrag wartet" : "Beiträge warten"} auf Freigabe`,
        href: "/portal/post-approvals",
        icon: Megaphone,
        variant: "warning",
      });
    }

    if (pendingAwardRequests > 0 && hasPermission("club.admin.full")) {
      items.push({
        id: "award-requests",
        label: "Auszeichnungs-Anträge",
        description: `${pendingAwardRequests} ${pendingAwardRequests === 1 ? "Antrag wartet" : "Anträge warten"} auf Entscheidung`,
        href: "/portal/awards/requests",
        icon: Award,
        variant: "warning",
      });
    }

    criticalShifts.forEach((shift) => {
      items.push({
        id: `shift-${shift.eventId}`,
        label: shift.eventTitle,
        description: `${shift.openSlots} ${shift.openSlots === 1 ? "Platz" : "Plätze"} offen – in ${shift.daysUntil} ${shift.daysUntil === 1 ? "Tag" : "Tagen"}`,
        href: `/portal/events/${shift.eventId}/organize`,
        icon: ClipboardList,
        variant: "critical",
      });
    });

    if (magazineStats && magazineStats.progress < 50 && hasPermission("club.magazine.ads.manage")) {
      items.push({
        id: "magazine-ads",
        label: `Schützenheft ${magazineStats.year}`,
        description: `Nur ${magazineStats.progress}% der Anzeigen vollständig`,
        href: "/portal/magazine-ads",
        icon: Book,
        variant: "warning",
      });
    }

    return items.slice(0, 6);
  }, [pendingMembers, pendingEventApprovals, pendingPostApprovals, pendingAwardRequests, criticalShifts, magazineStats, hasPermission]);

  const membersOrgTiles: SectionTile[] = useMemo(
    () =>
      [
        { label: "Mitglieder", href: "/portal/members", icon: Users, permission: "club.members.manage" },
        { label: "Kompanien", href: "/portal/companies", icon: Building2, permission: "club.companies.manage" },
        { label: "Kompanie-Zugehörigkeit", href: "/portal/assignments", icon: UserCog, permission: "club.members.manage" },
        { label: "Ämter & Funktionen", href: "/portal/appointments", icon: BadgeCheck, permission: "club.appointments.manage" },
      ].filter((tile) => !tile.permission || hasPermission(tile.permission)),
    [hasPermission]
  );

  const eventsShiftsTiles: SectionTile[] = useMemo(
    () => [
      { label: "Termine", href: "/portal/events", icon: Calendar },
      // AUSKOMMENTIERT: Arbeitsdienste (Kann später wieder aktiviert werden)
      // { label: "Arbeitsdienste", href: "/portal/workshifts", icon: ClipboardList },
    ],
    []
  );

  const contentTiles: SectionTile[] = useMemo(
    () => [
      { label: "Aushang / Beiträge", href: "/portal/posts", icon: Megaphone },
      { label: "Galerie", href: "/portal/gallery", icon: Image },
      { label: "Vereinsprofil", href: "/portal/club-profile", icon: Shield },
      { label: "Dokumente", href: "/portal/documents", icon: FileText },
    ],
    []
  );

  const magazineTiles: SectionTile[] = useMemo(
    () =>
      [
        { label: "Schützenhefte", href: "/portal/magazines", icon: Book, permission: "club.magazine.manage" },
        { label: "Anzeigen", href: "/portal/magazine-ads", icon: LayoutGrid, permission: "club.magazine.ads.manage" },
        { label: "Sponsoren", href: "/portal/magazine-sponsors", icon: Handshake, permission: "club.magazine.ads.manage" },
      ].filter((tile) => !tile.permission || hasPermission(tile.permission)),
    [hasPermission]
  );

  if (!authLoading && uiModeLoaded && !isAdminMode) {
    return <Navigate to="/portal" replace />;
  }

  if (authLoading || !uiModeLoaded) {
    return (
      <PortalLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Wrench className="w-4 h-4" />
            <span>Admin-Modus aktiv</span>
            <button
              onClick={toggleMode}
              className="text-primary hover:underline ml-2"
            >
              Zum Mitglieder-Modus wechseln
            </button>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-3xl font-bold">Verwaltung</h1>
          <p className="text-muted-foreground mt-1">
            Übersicht für Vorstand und Vereinsführung
          </p>
        </motion.div>

        {attentionItems.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-4"
          >
            <h2 className="text-lg font-semibold flex items-center gap-2 text-amber-600 dark:text-amber-500">
              <AlertTriangle className="w-5 h-5" />
              Aktuell wichtig
            </h2>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {attentionItems.map((item) => (
                <Link key={item.id} to={item.href}>
                  <Card
                    className={`hover:shadow-md transition-shadow cursor-pointer h-full ${
                      item.variant === "critical"
                        ? "border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20"
                        : "border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20"
                    }`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div
                            className={`p-2 rounded-lg ${
                              item.variant === "critical"
                                ? "bg-red-100 dark:bg-red-900/50"
                                : "bg-amber-100 dark:bg-amber-900/50"
                            }`}
                          >
                            <item.icon
                              className={`w-5 h-5 ${
                                item.variant === "critical"
                                  ? "text-red-600 dark:text-red-400"
                                  : "text-amber-600 dark:text-amber-400"
                              }`}
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{item.label}</p>
                            <p className="text-sm text-muted-foreground">{item.description}</p>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </motion.section>
        )}

        {pendingMembers.length > 0 && hasPermission("club.members.manage") && (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="space-y-4"
          >
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-amber-500" />
              Ausstehende Mitgliedsanfragen
              <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400">
                {pendingMembers.length}
              </Badge>
            </h2>
            <div className="space-y-2">
              {pendingMembers.map((m) => (
                <Card key={m.id} className="border-amber-200 bg-amber-50/30 dark:border-amber-900 dark:bg-amber-950/10">
                  <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <p className="font-medium">{m.first_name} {m.last_name}</p>
                      <p className="text-sm text-muted-foreground">{m.email}</p>
                      {m.company_name && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Building2 className="w-3 h-3" />{m.company_name}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Registriert am {format(new Date(m.created_at), "dd.MM.yyyy", { locale: de })}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                      <Button size="sm" variant="secondary" asChild>
                        <Link to={`/portal/member/${m.id}`}>
                          <Eye className="w-3 h-3 mr-1" />
                          Profil ansehen
                        </Link>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-green-500 text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30"
                        disabled={approvingId === m.id || rejectingId === m.id}
                        onClick={() => handleApprove(m.id)}
                      >
                        {approvingId === m.id
                          ? <Loader2 className="w-3 h-3 animate-spin mr-1" />
                          : <Check className="w-3 h-3 mr-1" />}
                        Annehmen
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-400 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                        disabled={approvingId === m.id || rejectingId === m.id}
                        onClick={() => handleReject(m.id)}
                      >
                        {rejectingId === m.id
                          ? <Loader2 className="w-3 h-3 animate-spin mr-1" />
                          : <X className="w-3 h-3 mr-1" />}
                        Ablehnen
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </motion.section>
        )}

        {membersOrgTiles.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Mitglieder & Organisation
              </h2>
              <Button variant="outline" size="sm" asChild>
                <Link to="/portal/members">Mitglieder verwalten</Link>
              </Button>
            </div>

            <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
              {membersOrgTiles.map((tile) => (
                <Link key={tile.href} to={tile.href}>
                  <Card className="hover:shadow-md hover:border-primary/50 transition-all cursor-pointer h-full">
                    <CardContent className="p-4 flex flex-col items-center justify-center text-center gap-2 min-h-[90px]">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <tile.icon className="w-5 h-5 text-primary" />
                      </div>
                      <span className="text-sm font-medium">{tile.label}</span>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </motion.section>
        )}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-4"
        >
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Termine & Einsätze
          </h2>

          <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
            {eventsShiftsTiles.map((tile) => (
              <Link key={tile.href} to={tile.href}>
                <Card className="hover:shadow-md hover:border-primary/50 transition-all cursor-pointer h-full">
                  <CardContent className="p-4 flex flex-col items-center justify-center text-center gap-2 min-h-[90px]">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <tile.icon className="w-5 h-5 text-primary" />
                    </div>
                    <span className="text-sm font-medium">{tile.label}</span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {criticalShifts.length > 0 && (
            <p className="text-sm text-muted-foreground">
              <span className="text-red-600 dark:text-red-400 font-medium">
                {criticalShifts.length} {criticalShifts.length === 1 ? "Arbeitsdienst" : "Arbeitsdienste"} unterbesetzt
              </span>{" "}
              – siehe "Aktuell wichtig"
            </p>
          )}
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="space-y-4"
        >
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-primary" />
            Inhalte & Öffentlichkeit
          </h2>

          <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
            {contentTiles.map((tile) => (
              <Link key={tile.href} to={tile.href}>
                <Card className="hover:shadow-md hover:border-primary/50 transition-all cursor-pointer h-full">
                  <CardContent className="p-4 flex flex-col items-center justify-center text-center gap-2 min-h-[90px]">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <tile.icon className="w-5 h-5 text-primary" />
                    </div>
                    <span className="text-sm font-medium">{tile.label}</span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {pendingPostApprovals > 0 && hasPermission("club.posts.approve_publication") && (
            <p className="text-sm text-muted-foreground">
              <span className="text-amber-600 dark:text-amber-400 font-medium">
                {pendingPostApprovals} {pendingPostApprovals === 1 ? "Beitrag wartet" : "Beiträge warten"} auf Freigabe
              </span>
            </p>
          )}
        </motion.section>

        {/* AUSKOMMENTIERT: Sektion "Schuetzenheft & Sponsoren" ist aktuell deaktiviert.
        {magazineTiles.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-4"
          >
            <Card className="border-2 border-dashed border-primary/30 bg-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Book className="w-5 h-5 text-primary" />
                  Schützenheft & Sponsoren
                </CardTitle>
                {magazineStats && (
                  <CardDescription>
                    Schützenheft {magazineStats.year}: {magazineStats.progress}% der Anzeigen vollständig
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 grid-cols-3">
                  {magazineTiles.map((tile) => (
                    <Link key={tile.href} to={tile.href}>
                      <Card className="hover:shadow-md hover:border-primary/50 transition-all cursor-pointer h-full bg-background">
                        <CardContent className="p-4 flex flex-col items-center justify-center text-center gap-2 min-h-[80px]">
                          <tile.icon className="w-5 h-5 text-primary" />
                          <span className="text-sm font-medium">{tile.label}</span>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.section>
        )}

        */}

        {eventRsvpStats.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.27 }}
            className="space-y-4"
          >
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Termine mit niedrigster Rückmeldequote
            </h2>
            <div className="space-y-2">
              {eventRsvpStats.map(stat => (
                <Link
                  key={stat.eventId}
                  to={`/portal/events/${stat.eventId}/organize`}
                  className="block p-4 rounded-xl bg-card border border-border hover:shadow-md hover:border-primary/20 transition-all"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium truncate flex-1">{stat.title}</p>
                    <Badge variant="outline" className="shrink-0 text-xs">
                      {stat.ownerType === "club"
                        ? <><Users className="w-3 h-3 mr-1 inline" />Verein</>
                        : <><Building2 className="w-3 h-3 mr-1 inline" />Kompanie</>
                      }
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    {format(new Date(stat.startAt), "EEEE, dd. MMMM yyyy", { locale: de })}
                  </p>
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                      <CheckCircle2 className="w-3 h-3" /> {stat.attending} Zusagen
                    </span>
                    <span className="flex items-center gap-1 text-destructive">
                      <XCircle className="w-3 h-3" /> {stat.declined} Absagen
                    </span>
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <HelpCircle className="w-3 h-3" /> {stat.pending} Offen
                    </span>
                    <span className="ml-auto text-muted-foreground text-xs font-medium">
                      {stat.responseRate}% Rückmeldequote
                    </span>
                  </div>
                  {stat.memberCount > 0 && (
                    <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${stat.responseRate}%` }}
                      />
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </motion.section>
        )}

        {member?.club_id && (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-4"
          >
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Cake className="w-5 h-5 text-primary" />
              Geburtstage im Verein
            </h2>
            <AdminBirthdaysSection clubId={member.club_id} />
          </motion.section>
        )}

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="pt-4 border-t"
        >
          <div className="flex flex-wrap gap-3">
            {hasPermission("club.roles.manage") && (
              <Button variant="ghost" size="sm" asChild>
                <Link to="/portal/roles" className="gap-2">
                  <Shield className="w-4 h-4" />
                  Rollen & Rechte
                </Link>
              </Button>
            )}
            {hasPermission("club.admin.full") && (
              <Button variant="ghost" size="sm" asChild>
                <Link to="/portal/yearly-reports" className="gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Jahresübersicht
                </Link>
              </Button>
            )}
            {hasPermission("club.settings.manage") && (
              <Button variant="ghost" size="sm" asChild>
                <Link to="/portal/settings" className="gap-2">
                  <Settings className="w-4 h-4" />
                  Einstellungen
                </Link>
              </Button>
            )}
          </div>
        </motion.section>
      </div>
    </PortalLayout>
  );
};

export default AdminHome;
