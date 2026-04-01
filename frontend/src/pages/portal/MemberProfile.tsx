import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Edit, Award, Shield, Building2, Calendar, Loader2, User, Plus, MoreVertical, Trash2, Pencil, Clock, CheckCircle, Mail, Phone, MapPin } from "lucide-react";
import PortalLayout from "@/components/portal/PortalLayout";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/api/client";
import { useToast } from "@/hooks/use-toast";
import { useWorkShiftStats } from "@/hooks/useWorkShiftStats";
import MemberProfileEditDialog from "@/components/portal/MemberProfileEditDialog";
import AwardDialog, { getAwardTypeConfig } from "@/components/portal/AwardDialog";
import AwardRequestDialog from "@/components/portal/AwardRequestDialog";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface MemberData {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  street: string | null;
  zip: string | null;
  city: string | null;
  status: string;
  avatar_url: string | null;
  cover_url: string | null;
  title: string | null;
  bio: string | null;
  created_at: string;
}

interface MemberAward {
  id: string;
  title: string;
  description: string | null;
  awarded_at: string;
  award_type: string;
}

interface CompanyMembership {
  company_id: string;
  company_name: string;
  company_logo_url: string | null;
  valid_from: string;
  valid_to: string | null;
}

interface Appointment {
  role_name: string;
  scope_type: string;
  scope_name: string;
  valid_from: string;
  valid_to: string | null;
}

interface RawMembership {
  company_id: string;
  valid_from: string;
  valid_to: string | null;
}

interface RawCompany {
  id: string;
  name: string;
  logo_url: string | null;
}

interface RawAppointment {
  role_id: string;
  scope_type: string;
  scope_id: string;
  valid_from: string;
  valid_to: string | null;
  roles: { name: string };
}

interface RawCompanyName {
  name: string;
}

const statusLabels: Record<string, { label: string; className: string }> = {
  prospect: { label: "Anwärter", className: "bg-blue-500/10 text-blue-500" },
  active: { label: "Aktiv", className: "bg-green-500/10 text-green-500" },
  passive: { label: "Passiv", className: "bg-yellow-500/10 text-yellow-500" },
  resigned: { label: "Ausgetreten", className: "bg-red-500/10 text-red-500" },
};

const MemberProfile = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { member: currentMember, hasPermission } = useAuth();
  const { toast } = useToast();
  
  const [memberData, setMemberData] = useState<MemberData | null>(null);
  const [awards, setAwards] = useState<MemberAward[]>([]);
  const [companies, setCompanies] = useState<CompanyMembership[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAwardDialogOpen, setIsAwardDialogOpen] = useState(false);
  const [isAwardRequestDialogOpen, setIsAwardRequestDialogOpen] = useState(false);
  const [selectedAward, setSelectedAward] = useState<MemberAward | null>(null);
  const [awardToDelete, setAwardToDelete] = useState<MemberAward | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  const { stats: workStats, loading: workStatsLoading } = useWorkShiftStats(id || null, selectedYear);

  useEffect(() => {
    if (id) fetchMemberData();
  }, [id]);

  const fetchMemberData = async () => {
    setIsLoading(true);
    try {
      const { data: memberRaw, error: memberError } = await supabase
        .from("members")
        .select("*")
        .eq("id", id)
        .single();

      if (memberError) throw memberError;
      setMemberData(memberRaw as MemberData);

      const { data: awardsData } = await supabase
        .from("member_awards")
        .select("*")
        .eq("member_id", id)
        .order("awarded_at", { ascending: false });
      setAwards((awardsData as MemberAward[]) || []);

      const { data: membershipsData } = await supabase
        .from("member_company_memberships")
        .select("company_id, valid_from, valid_to")
        .eq("member_id", id)
        .order("valid_from", { ascending: false });

      const memberships = (membershipsData as RawMembership[]) || [];

      if (memberships.length > 0) {
        const companyIds = [...new Set(memberships.map(m => m.company_id))];
        const { data: companiesData } = await supabase
          .from("companies")
          .select("id, name, logo_url")
          .in("id", companyIds);

        const companyMap = new Map<string, { name: string; logo_url: string | null }>(
          ((companiesData as RawCompany[]) || []).map(c => [c.id, { name: c.name, logo_url: c.logo_url }])
        );

        const enrichedMemberships: CompanyMembership[] = memberships.map(m => ({
          company_id: m.company_id,
          company_name: companyMap.get(m.company_id)?.name || "Unbekannt",
          company_logo_url: companyMap.get(m.company_id)?.logo_url || null,
          valid_from: m.valid_from,
          valid_to: m.valid_to,
        }));
        setCompanies(enrichedMemberships);
      }

      const { data: appointmentsData } = await supabase
        .from("appointments")
        .select(`role_id, scope_type, scope_id, valid_from, valid_to, roles!inner(name)`)
        .eq("member_id", id)
        .order("valid_from", { ascending: false });

      if (appointmentsData) {
        const rawAppointments = appointmentsData as RawAppointment[];
        const enrichedAppointments: Appointment[] = [];
        for (const apt of rawAppointments) {
          let scopeName = "";
          if (apt.scope_type === "company") {
            const { data: company } = await supabase
              .from("companies")
              .select("name")
              .eq("id", apt.scope_id)
              .single();
            scopeName = (company as RawCompanyName | null)?.name || "";
          } else if (apt.scope_type === "club") {
            scopeName = "Verein";
          }
          enrichedAppointments.push({
            role_name: apt.roles.name,
            scope_type: apt.scope_type,
            scope_name: scopeName,
            valid_from: apt.valid_from,
            valid_to: apt.valid_to,
          });
        }
        setAppointments(enrichedAppointments);
      }
    } catch (error: unknown) {
      console.error("Error fetching member:", error);
      toast({ title: "Fehler beim Laden", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateStr: string) => format(new Date(dateStr), "dd.MM.yyyy", { locale: de });

  const isOwnProfile = currentMember?.id === id;
  const canEdit = isOwnProfile || hasPermission("club.members.manage");
  const canManageAwards = hasPermission("club.members.manage");

  const handleDeleteAward = async () => {
    if (!awardToDelete) return;
    try {
      const { error } = await supabase.from("member_awards").delete().eq("id", awardToDelete.id);
      if (error) throw error;
      toast({ title: "Auszeichnung gelöscht" });
      fetchMemberData();
    } catch (error: unknown) {
      console.error("Error deleting award:", error);
      toast({ title: "Fehler beim Löschen", variant: "destructive" });
    } finally {
      setAwardToDelete(null);
    }
  };

  const openEditAward = (award: MemberAward) => { setSelectedAward(award); setIsAwardDialogOpen(true); };
  const openNewAward = () => { setSelectedAward(null); setIsAwardDialogOpen(true); };

  if (isLoading) {
    return <PortalLayout><div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></PortalLayout>;
  }

  if (!memberData) {
    return (
      <PortalLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Mitglied nicht gefunden</p>
          <Button variant="outline" onClick={() => navigate("/portal/members")} className="mt-4">Zurück</Button>
        </div>
      </PortalLayout>
    );
  }

  const status = statusLabels[memberData.status] || statusLabels.prospect;
  const activeCompany = companies.find(c => !c.valid_to);
  const activeAppointments = appointments.filter(a => !a.valid_to);
  const primaryAppointment = activeAppointments.find(a => a.scope_type === "club") || activeAppointments[0];

  return (
    <PortalLayout>
      <div className="max-w-5xl mx-auto">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />Zurück
        </Button>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative">
          <div className="flex items-start gap-6 md:gap-8">
            <Avatar className="w-28 h-28 md:w-40 md:h-40 border-4 border-primary/20 shadow-xl shrink-0">
              <AvatarImage src={memberData.avatar_url || undefined} alt={memberData.first_name} className="object-contain" />
              <AvatarFallback className="text-3xl md:text-5xl bg-primary text-primary-foreground">
                {memberData.first_name[0]}{memberData.last_name[0]}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0 pt-2">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="font-display text-2xl md:text-4xl font-bold">{memberData.first_name} {memberData.last_name}</h1>
                <Badge variant="secondary" className={status.className}>{status.label}</Badge>
              </div>
              {activeAppointments.length > 0 ? (
                <div className="flex flex-wrap gap-2 mt-2">
                  {activeAppointments.map((apt, idx) => (
                    <Badge key={idx} variant="secondary" className="bg-primary/10 text-primary text-sm font-medium">
                      <Shield className="w-3.5 h-3.5 mr-1.5" />{apt.role_name}
                      {apt.scope_type === "company" && apt.scope_name && <span className="ml-1 text-primary/70">({apt.scope_name})</span>}
                    </Badge>
                  ))}
                </div>
              ) : memberData.title ? (
                <p className="text-lg text-primary font-medium mt-2 flex items-center gap-2"><Shield className="w-4 h-4" />{memberData.title}</p>
              ) : null}
              {memberData.bio && <p className="text-muted-foreground mt-3 max-w-2xl line-clamp-3">{memberData.bio}</p>}
              {activeCompany && (
                <div className="mt-4 inline-flex items-center gap-2 px-3 py-2 bg-card rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate(`/portal/company/${activeCompany.company_id}`)}>
                  {activeCompany.company_logo_url ? (
                    <img src={activeCompany.company_logo_url} alt={activeCompany.company_name} className="w-5 h-5 rounded object-cover" />
                  ) : <Building2 className="w-4 h-4 text-primary" />}
                  <span className="text-sm font-medium">{activeCompany.company_name}</span>
                </div>
              )}
            </div>

            {canEdit && (
              <Button size="sm" variant="secondary" className="shrink-0" onClick={() => setIsEditOpen(true)}>
                <Edit className="w-4 h-4 mr-2" />Bearbeiten
              </Button>
            )}
          </div>
        </motion.div>

        {(isOwnProfile || canManageAwards || awards.length > 0) && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-semibold flex items-center gap-2">
                <Award className="w-5 h-5 text-primary" />Auszeichnungen
                {awards.length > 0 && <Badge variant="secondary" className="ml-2">{awards.length}</Badge>}
              </h2>
              <div className="flex gap-2">
                {isOwnProfile && <Button size="sm" variant="outline" onClick={() => setIsAwardRequestDialogOpen(true)}><Plus className="w-4 h-4 mr-2" />Beantragen</Button>}
                {canManageAwards && <Button size="sm" variant="outline" onClick={openNewAward}><Plus className="w-4 h-4 mr-2" />Hinzufügen</Button>}
              </div>
            </div>
            {awards.length > 0 ? (
              <div className="flex flex-wrap gap-3">
                {awards.slice(0, 8).map((award) => {
                  const typeConfig = getAwardTypeConfig(award.award_type);
                  const AwardIcon = typeConfig.icon;
                  return (
                    <div key={award.id} className="group relative flex items-center gap-2 px-4 py-2 bg-card rounded-full border hover:bg-muted/50 transition-colors cursor-default" title={`${award.title}${award.description ? ` - ${award.description}` : ''} (${formatDate(award.awarded_at)})`}>
                      <div className={`w-6 h-6 rounded-full ${typeConfig.bgColor} flex items-center justify-center`}>
                        <AwardIcon className={`w-3.5 h-3.5 ${typeConfig.color}`} />
                      </div>
                      <span className="text-sm font-medium">{award.title}</span>
                      <span className="text-xs text-muted-foreground">{format(new Date(award.awarded_at), "yyyy", { locale: de })}</span>
                    </div>
                  );
                })}
                {awards.length > 8 && <div className="flex items-center px-4 py-2 text-sm text-muted-foreground">+{awards.length - 8} weitere</div>}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground bg-muted/30 rounded-lg border border-dashed">
                <Award className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Noch keine Auszeichnungen erhalten.</p>
                {isOwnProfile && <p className="text-xs mt-1">Klicken Sie auf "Beantragen", um eine Auszeichnung anzufordern.</p>}
              </div>
            )}
          </motion.div>
        )}

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-lg font-semibold flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />{isOwnProfile ? "Dein Engagement für den Verein" : "Engagement"}
              </h2>
              {isOwnProfile && <p className="text-sm text-muted-foreground mt-1">Jede Stunde zählt – danke für deinen Einsatz!</p>}
            </div>
            <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
              <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[...Array(5)].map((_, i) => {
                  const year = new Date().getFullYear() - i;
                  return <SelectItem key={year} value={year.toString()}>{year}</SelectItem>;
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center"><Clock className="w-6 h-6 text-primary" /></div>
                  <div><p className="text-2xl font-bold">{workStatsLoading ? '...' : workStats.totalHours}</p><p className="text-sm text-muted-foreground">Stunden {selectedYear}</p></div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center"><CheckCircle className="w-6 h-6 text-green-500" /></div>
                  <div><p className="text-2xl font-bold">{workStatsLoading ? '...' : workStats.completedShifts}</p><p className="text-sm text-muted-foreground">Einsätze</p></div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center"><Calendar className="w-6 h-6 text-blue-500" /></div>
                  <div><p className="text-2xl font-bold">{workStatsLoading ? '...' : workStats.upcomingShifts}</p><p className="text-sm text-muted-foreground">Kommende</p></div>
                </div>
              </CardContent>
            </Card>
            {workStats.totalHours >= 10 && (
              <Card className="border-green-500/50 bg-gradient-to-br from-green-500/10 to-emerald-500/5">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center"><Award className="w-6 h-6 text-green-600" /></div>
                    <div><p className="font-semibold text-green-600">Soll erfüllt!</p><p className="text-sm text-muted-foreground">≥ 10 Stunden</p></div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </motion.div>

        {(isOwnProfile || canEdit) ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mt-8">
            <h2 className="font-display text-xl font-semibold mb-4 flex items-center gap-2"><User className="w-5 h-5 text-primary" />Kontaktdaten</h2>
            <Card>
              <CardContent className="pt-6">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="flex items-center gap-3"><Mail className="w-5 h-5 text-muted-foreground" /><div><p className="text-sm text-muted-foreground">E-Mail</p><p className="font-medium">{memberData.email}</p></div></div>
                  {memberData.phone && <div className="flex items-center gap-3"><Phone className="w-5 h-5 text-muted-foreground" /><div><p className="text-sm text-muted-foreground">Telefon</p><p className="font-medium">{memberData.phone}</p></div></div>}
                  {(memberData.street || memberData.city) && (
                    <div className="flex items-center gap-3"><MapPin className="w-5 h-5 text-muted-foreground" /><div><p className="text-sm text-muted-foreground">Adresse</p><p className="font-medium">{memberData.street && <span>{memberData.street}<br /></span>}{memberData.zip} {memberData.city}</p></div></div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ) : null}

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mt-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-xl font-semibold flex items-center gap-2"><Building2 className="w-5 h-5 text-primary" />Schützen Chronik</h2>
          </div>
          <div className="flex flex-wrap gap-4 mb-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-muted-foreground/50" /><span>Zeiträume (links)</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-accent" /><span>Auszeichnungen (rechts)</span></div>
          </div>

          {(() => {
            type ChronicleEvent = {
              type: 'company' | 'appointment' | 'award';
              title: string;
              subtitle?: string;
              date: string;
              endDate?: string | null;
              isActive: boolean;
              icon: typeof Building2;
              iconBgColor: string;
              iconColor: string;
              logo_url?: string | null;
              company_id?: string;
              award?: MemberAward;
            };

            const chronicleEvents: ChronicleEvent[] = [];

            companies.forEach(c => {
              chronicleEvents.push({ type: 'company', title: c.company_name, subtitle: 'Kompanie', date: c.valid_from, endDate: c.valid_to, isActive: !c.valid_to, icon: Building2, iconBgColor: 'bg-primary/10', iconColor: 'text-primary', logo_url: c.company_logo_url, company_id: c.company_id });
            });

            appointments.forEach(apt => {
              chronicleEvents.push({ type: 'appointment', title: apt.role_name, subtitle: apt.scope_name, date: apt.valid_from, endDate: apt.valid_to, isActive: !apt.valid_to, icon: Shield, iconBgColor: 'bg-blue-500/10', iconColor: 'text-blue-500' });
            });

            awards.forEach(award => {
              const typeConfig = getAwardTypeConfig(award.award_type);
              chronicleEvents.push({ type: 'award', title: award.title, subtitle: award.description || undefined, date: award.awarded_at, endDate: null, isActive: false, icon: typeConfig.icon, iconBgColor: typeConfig.bgColor, iconColor: typeConfig.color, award: award });
            });

            chronicleEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            if (chronicleEvents.length === 0) {
              return <p className="text-muted-foreground text-sm text-center py-8">Noch keine Einträge in der Chronik vorhanden.</p>;
            }

            return (
              <div className="relative">
                <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-border -translate-x-1/2 hidden md:block" />
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border md:hidden" />
                <div className="space-y-6">
                  {chronicleEvents.map((event, idx) => {
                    const EventIcon = event.icon;
                    const isLeftSide = event.type === 'company' || event.type === 'appointment';
                    return (
                      <div key={`${event.type}-${idx}`} className="relative flex items-start gap-4 md:gap-0">
                        <div className="flex-1 hidden md:flex md:justify-end md:pr-8">
                          {isLeftSide && (
                            <div className={`inline-block p-4 bg-card rounded-xl border text-right ${event.company_id ? 'cursor-pointer hover:bg-muted/50 transition-colors' : ''}`} onClick={() => event.company_id && navigate(`/portal/company/${event.company_id}`)}>
                              <div className="flex items-center gap-3 flex-row-reverse">
                                {event.logo_url ? <img src={event.logo_url} alt={event.title} className="w-8 h-8 rounded object-contain" /> : <div className={`w-8 h-8 rounded ${event.iconBgColor} flex items-center justify-center`}><EventIcon className={`w-4 h-4 ${event.iconColor}`} /></div>}
                                <div><p className="font-medium">{event.title}</p>{event.subtitle && <p className="text-sm text-muted-foreground">{event.subtitle}</p>}</div>
                              </div>
                              <div className="text-sm text-muted-foreground flex items-center gap-2 mt-2 justify-end">
                                <Calendar className="w-4 h-4" />{formatDate(event.date)} – {event.endDate ? formatDate(event.endDate) : "heute"}
                              </div>
                              {event.isActive && <Badge variant="secondary" className="text-xs bg-primary/10 text-primary mt-2">Aktuell</Badge>}
                            </div>
                          )}
                        </div>
                        <div className="hidden md:flex items-center justify-center w-10 shrink-0">
                          <div className={`w-4 h-4 rounded-full border-2 border-background shadow-sm ${event.isActive ? 'bg-primary' : isLeftSide ? 'bg-muted-foreground/50' : 'bg-accent'}`} />
                        </div>
                        <div className="md:hidden absolute left-2 top-4 w-4 h-4 rounded-full border-2 border-background shadow-sm bg-primary" style={{ transform: 'translateX(-50%)' }} />
                        <div className="flex-1 hidden md:flex md:justify-start md:pl-8">
                          {!isLeftSide && (
                            <div className="inline-block p-4 bg-card rounded-xl border group relative">
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full ${event.iconBgColor} flex items-center justify-center`}><EventIcon className={`w-4 h-4 ${event.iconColor}`} /></div>
                                <div><p className="font-medium">{event.title}</p>{event.subtitle && <p className="text-sm text-muted-foreground truncate max-w-[200px]">{event.subtitle}</p>}</div>
                                {canManageAwards && event.award && (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem onClick={() => openEditAward(event.award!)}><Pencil className="w-4 h-4 mr-2" />Bearbeiten</DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => setAwardToDelete(event.award!)} className="text-destructive focus:text-destructive"><Trash2 className="w-4 h-4 mr-2" />Löschen</DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground flex items-center gap-2 mt-2"><Calendar className="w-4 h-4" />{formatDate(event.date)}</div>
                            </div>
                          )}
                        </div>
                        <div className="md:hidden ml-6 flex-1">
                          <div className={`p-4 bg-card rounded-xl border ${event.company_id ? 'cursor-pointer hover:bg-muted/50 transition-colors' : ''} group relative`} onClick={() => event.company_id && navigate(`/portal/company/${event.company_id}`)}>
                            <div className="flex items-center gap-3">
                              {event.logo_url ? <img src={event.logo_url} alt={event.title} className="w-8 h-8 rounded object-contain" /> : <div className={`w-8 h-8 rounded ${event.type === 'award' ? 'rounded-full' : ''} ${event.iconBgColor} flex items-center justify-center`}><EventIcon className={`w-4 h-4 ${event.iconColor}`} /></div>}
                              <div className="flex-1 min-w-0"><p className="font-medium">{event.title}</p>{event.subtitle && <p className="text-sm text-muted-foreground truncate">{event.subtitle}</p>}</div>
                              {canManageAwards && event.award && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => openEditAward(event.award!)}><Pencil className="w-4 h-4 mr-2" />Bearbeiten</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setAwardToDelete(event.award!)} className="text-destructive focus:text-destructive"><Trash2 className="w-4 h-4 mr-2" />Löschen</DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground flex items-center gap-2 mt-2">
                              <Calendar className="w-4 h-4" />
                              {event.endDate !== undefined ? `${formatDate(event.date)} – ${event.endDate ? formatDate(event.endDate) : "heute"}` : formatDate(event.date)}
                            </div>
                            {event.isActive && <Badge variant="secondary" className="text-xs bg-primary/10 text-primary mt-2">Aktuell</Badge>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </motion.div>
      </div>

      {memberData && <MemberProfileEditDialog open={isEditOpen} onOpenChange={setIsEditOpen} member={memberData} onSave={() => { fetchMemberData(); setIsEditOpen(false); }} />}

      {memberData && currentMember && (
        <AwardDialog open={isAwardDialogOpen} onOpenChange={setIsAwardDialogOpen} memberId={memberData.id} clubId={currentMember.club_id} award={selectedAward} onSave={() => { fetchMemberData(); setIsAwardDialogOpen(false); }} />
      )}

      <AlertDialog open={!!awardToDelete} onOpenChange={() => setAwardToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Auszeichnung löschen?</AlertDialogTitle>
            <AlertDialogDescription>Möchten Sie die Auszeichnung "{awardToDelete?.title}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAward} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isOwnProfile && memberData && currentMember && (
        <AwardRequestDialog open={isAwardRequestDialogOpen} onOpenChange={setIsAwardRequestDialogOpen} memberId={memberData.id} clubId={currentMember.club_id} onSuccess={fetchMemberData} />
      )}
    </PortalLayout>
  );
};

export default MemberProfile;