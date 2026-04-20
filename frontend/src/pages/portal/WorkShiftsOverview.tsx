import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format, differenceInDays, startOfMonth, endOfMonth, subMonths, addMonths } from "date-fns";
import { de } from "date-fns/locale";
import { motion } from "framer-motion";
import { ArrowLeft, Calendar, Users, Clock, AlertTriangle, CheckCircle2, Building2, ChevronLeft, ChevronRight, Filter, BarChart3, TrendingUp } from "lucide-react";
import PortalLayout from "@/components/portal/PortalLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/api/client";

interface EventWithStats {
  id: string;
  title: string;
  start_at: string;
  end_at: string | null;
  owner_type: "club" | "company";
  owner_id: string;
  category: string;
  totalSlots: number;
  filledSlots: number;
  openSlots: number;
  isCritical: boolean;
  daysUntil: number;
  helpersByCompany?: Record<string, number>;
}

interface Company {
  id: string;
  name: string;
}

interface RawShift {
  id: string;
  event_id: string;
  required_slots: number;
  owner_id: string;
  owner_type: string;
}

interface RawAssignment {
  id: string;
  work_shift_id: string;
  member_id: string;
  status: string;
}

interface RawMembership {
  member_id: string;
  company_id: string;
}

const CRITICAL_DAYS_THRESHOLD = 7;

const categoryLabels: Record<string, string> = {
  training: "Training", meeting: "Versammlung", fest: "Fest", work: "Arbeit", other: "Sonstiges",
};

const WorkShiftsOverview = () => {
  const navigate = useNavigate();
  const { member, hasPermission, permissions } = useAuth();

  const [events, setEvents] = useState<EventWithStats[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [dateRange, setDateRange] = useState<Date>(new Date());
  const [filterOwner, setFilterOwner] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const canManageClubEvents = hasPermission("club.events.manage") || hasPermission("club.admin.full");
  const companyPermissions = useMemo(() => {
    return permissions.filter(p => p.permission_key === "company.workshifts.manage" && p.scope_type === "company").map(p => p.scope_id).filter((id): id is string => id !== undefined);
  }, [permissions]);

  const canViewFullOverview = canManageClubEvents;

  useEffect(() => {
    if (member?.club_id) fetchData();
  }, [member?.club_id, dateRange]);

  const fetchData = async () => {
    if (!member) return;
    setIsLoading(true);

    try {
      const { data: companiesData } = await supabase.from("companies").select("id, name").eq("club_id", member.club_id);
      setCompanies((companiesData as Company[]) || []);

      const start = startOfMonth(dateRange);
      const end = endOfMonth(addMonths(dateRange, 2));

      const { data: eventsData } = await supabase.from("events").select("id, title, start_at, end_at, owner_type, owner_id, category, club_id").eq("club_id", member.club_id).gte("start_at", start.toISOString()).lte("start_at", end.toISOString()).order("start_at");

      if (!eventsData || (eventsData as unknown[]).length === 0) { setEvents([]); setIsLoading(false); return; }

      const typedEventsData = eventsData as Array<{ id: string; title: string; start_at: string; end_at: string | null; owner_type: string; owner_id: string; category: string }>;
      const eventIds = typedEventsData.map(e => e.id);
      const { data: shiftsData } = await supabase.from("work_shifts").select("id, event_id, required_slots, owner_id, owner_type").in("event_id", eventIds);

      const shiftIds = ((shiftsData as RawShift[]) || []).map(s => s.id);
      let assignmentsData: RawAssignment[] = [];
      if (shiftIds.length > 0) {
        const { data } = await supabase.from("work_shift_assignments").select("id, work_shift_id, member_id, status").in("work_shift_id", shiftIds).in("status", ["signed_up", "completed"]);
        assignmentsData = (data as RawAssignment[]) || [];
      }

      const memberIds = [...new Set(assignmentsData.map(a => a.member_id))];
      const memberCompanyMap: Record<string, string[]> = {};
      if (memberIds.length > 0) {
        const { data: membershipsData } = await supabase.from("member_company_memberships").select("member_id, company_id").in("member_id", memberIds).is("valid_to", null);
        ((membershipsData as RawMembership[]) || []).forEach(m => {
          if (!memberCompanyMap[m.member_id]) memberCompanyMap[m.member_id] = [];
          memberCompanyMap[m.member_id].push(m.company_id);
        });
      }

      const eventsWithStats: EventWithStats[] = typedEventsData.map(event => {
        const eventShifts = ((shiftsData as RawShift[]) || []).filter(s => s.event_id === event.id);
        const totalSlots = eventShifts.reduce((sum, s) => sum + s.required_slots, 0);
        const eventAssignments = eventShifts.flatMap(s => assignmentsData.filter(a => a.work_shift_id === s.id));
        const filledSlots = eventAssignments.length;
        const openSlots = Math.max(0, totalSlots - filledSlots);
        const daysUntil = differenceInDays(new Date(event.start_at), new Date());
        const isCritical = openSlots > 0 && daysUntil >= 0 && daysUntil <= CRITICAL_DAYS_THRESHOLD;

        const helpersByCompany: Record<string, number> = {};
        eventAssignments.forEach(a => {
          (memberCompanyMap[a.member_id] || []).forEach(companyId => {
            helpersByCompany[companyId] = (helpersByCompany[companyId] || 0) + 1;
          });
        });

        return { id: event.id, title: event.title, start_at: event.start_at, end_at: event.end_at, owner_type: event.owner_type as "club" | "company", owner_id: event.owner_id, category: event.category, totalSlots, filledSlots, openSlots, isCritical, daysUntil, helpersByCompany };
      });

      setEvents(eventsWithStats);
    } catch (error: unknown) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      if (filterOwner !== "all") {
        if (filterOwner === "club" && event.owner_type !== "club") return false;
        if (filterOwner !== "club" && filterOwner !== "all") { if (event.owner_type !== "company" || event.owner_id !== filterOwner) return false; }
      }
      if (!canViewFullOverview) { if (event.owner_type === "company" && !companyPermissions.includes(event.owner_id)) return false; }
      if (filterCategory !== "all" && event.category !== filterCategory) return false;
      if (event.totalSlots === 0) return false;
      return true;
    });
  }, [events, filterOwner, filterCategory, canViewFullOverview, companyPermissions]);

  const stats = useMemo(() => {
    const relevantEvents = filteredEvents.filter(e => e.daysUntil >= 0);
    return { totalEvents: relevantEvents.length, totalSlots: relevantEvents.reduce((sum, e) => sum + e.totalSlots, 0), filledSlots: relevantEvents.reduce((sum, e) => sum + e.filledSlots, 0), openSlots: relevantEvents.reduce((sum, e) => sum + e.openSlots, 0), criticalEvents: relevantEvents.filter(e => e.isCritical).length };
  }, [filteredEvents]);

  const getStatusColor = (event: EventWithStats): string => {
    if (event.openSlots === 0) return "bg-green-500/10 text-green-600 border-green-500/30";
    if (event.isCritical) return "bg-destructive/10 text-destructive border-destructive/30";
    return "bg-amber-500/10 text-amber-600 border-amber-500/30";
  };

  const getCompanyName = (companyId: string) => companies.find(c => c.id === companyId)?.name || "Kompanie";

  if (isLoading) {
    return <PortalLayout><div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div></PortalLayout>;
  }

  return (
    <PortalLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-4 mb-4"><Button variant="ghost" size="sm" onClick={() => navigate("/portal/workshifts")}><ArrowLeft className="h-4 w-4 mr-2" />Zurück</Button></div>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="font-display text-3xl font-bold flex items-center gap-3"><TrendingUp className="w-8 h-8" />Bedarfsübersicht</h1><p className="text-muted-foreground mt-1">Planungshilfe: Wo fehlen Helfer?</p></div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setDateRange(subMonths(dateRange, 1))}><ChevronLeft className="h-4 w-4" /></Button>
              <span className="text-sm font-medium min-w-[120px] text-center">{format(dateRange, "MMMM yyyy", { locale: de })}</span>
              <Button variant="outline" size="icon" onClick={() => setDateRange(addMonths(dateRange, 1))}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-primary/10"><Calendar className="w-5 h-5 text-primary" /></div><div><p className="text-2xl font-bold">{stats.totalEvents}</p><p className="text-xs text-muted-foreground">Termine</p></div></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-blue-500/10"><Users className="w-5 h-5 text-blue-600" /></div><div><p className="text-2xl font-bold">{stats.totalSlots}</p><p className="text-xs text-muted-foreground">Gesamtbedarf</p></div></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-green-500/10"><CheckCircle2 className="w-5 h-5 text-green-600" /></div><div><p className="text-2xl font-bold">{stats.filledSlots}</p><p className="text-xs text-muted-foreground">Belegt</p></div></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-amber-500/10"><Clock className="w-5 h-5 text-amber-600" /></div><div><p className="text-2xl font-bold">{stats.openSlots}</p><p className="text-xs text-muted-foreground">Offen</p></div></div></CardContent></Card>
          <Card className={stats.criticalEvents > 0 ? "border-destructive/50" : ""}><CardContent className="p-4"><div className="flex items-center gap-3"><div className={`p-2 rounded-lg ${stats.criticalEvents > 0 ? "bg-destructive/10" : "bg-muted"}`}><AlertTriangle className={`w-5 h-5 ${stats.criticalEvents > 0 ? "text-destructive" : "text-muted-foreground"}`} /></div><div><p className="text-2xl font-bold">{stats.criticalEvents}</p><p className="text-xs text-muted-foreground">Kritisch</p></div></div></CardContent></Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2"><Filter className="w-4 h-4 text-muted-foreground" /><span className="text-sm font-medium">Filter:</span></div>
                <Select value={filterOwner} onValueChange={setFilterOwner}>
                  <SelectTrigger className="w-[180px]"><SelectValue placeholder="Alle Zuständigkeiten" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Zuständigkeiten</SelectItem>
                    <SelectItem value="club">Hauptverein</SelectItem>
                    {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="w-[150px]"><SelectValue placeholder="Alle Kategorien" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Kategorien</SelectItem>
                    {Object.entries(categoryLabels).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="w-5 h-5" />Termine mit Arbeitsdiensten ({filteredEvents.length})</CardTitle></CardHeader>
            <CardContent>
              {filteredEvents.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground"><Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" /><p>Keine Termine mit Arbeitsdiensten im gewählten Zeitraum</p></div>
              ) : (
                <div className="space-y-3">
                  {filteredEvents.map((event, index) => {
                    const percentage = event.totalSlots > 0 ? Math.round((event.filledSlots / event.totalSlots) * 100) : 0;
                    return (
                      <motion.div key={event.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.05 }} className={`border rounded-lg p-4 hover:bg-muted/30 transition-colors cursor-pointer ${event.isCritical ? "border-destructive/50 bg-destructive/5" : ""}`} onClick={() => navigate(`/portal/events/${event.id}/organize`)}>
                        <div className="flex flex-col md:flex-row md:items-center gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <h4 className="font-medium truncate">{event.title}</h4>
                              {event.isCritical && <Badge variant="destructive" className="flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Kritisch</Badge>}
                              <Badge variant="outline" className="text-xs">{event.owner_type === "club" ? "Hauptverein" : getCompanyName(event.owner_id)}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground flex items-center gap-2">
                              <Calendar className="w-3 h-3" />{format(new Date(event.start_at), "EEEE, d. MMMM yyyy", { locale: de })}
                              {event.daysUntil >= 0 && <span className="text-xs">(in {event.daysUntil} {event.daysUntil === 1 ? "Tag" : "Tagen"})</span>}
                            </p>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="w-32 space-y-1">
                              <div className="flex justify-between text-xs"><span>{event.filledSlots}/{event.totalSlots}</span><span>{percentage}%</span></div>
                              <Progress value={percentage} className="h-2" />
                            </div>
                            <Badge className={getStatusColor(event)}>
                              {event.openSlots === 0 ? <><CheckCircle2 className="w-3 h-3 mr-1" />Voll</> : <>{event.openSlots} offen</>}
                            </Badge>
                          </div>
                        </div>
                        {canViewFullOverview && event.owner_type === "club" && Object.keys(event.helpersByCompany || {}).length > 0 && (
                          <div className="mt-3 pt-3 border-t flex flex-wrap gap-2">
                            <span className="text-xs text-muted-foreground mr-2 flex items-center gap-1"><Building2 className="w-3 h-3" />Helfer nach Kompanie:</span>
                            {Object.entries(event.helpersByCompany || {}).map(([companyId, count]) => <Badge key={companyId} variant="secondary" className="text-xs">{getCompanyName(companyId)}: {count}</Badge>)}
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </PortalLayout>
  );
};

export default WorkShiftsOverview;