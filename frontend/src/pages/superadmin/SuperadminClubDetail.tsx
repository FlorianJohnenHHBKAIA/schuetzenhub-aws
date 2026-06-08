import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { motion } from "framer-motion";
import {
  ArrowLeft, Loader2, AlertCircle, RefreshCw,
  Users, UserCheck, Shield, CalendarDays,
  Building2, MapPin,
  Calendar, FileText, Award, Briefcase,
  Search,
} from "lucide-react";
import { apiJson } from "@/integrations/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ClubDetail {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  city: string | null;
  location_city: string | null;
  location_zip: string | null;
  description: string | null;
  founded_year: number | null;
  website: string | null;
  website_url: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  plan: string;
  plan_started_at: string | null;
  custom_domain: string | null;
  domain_status: string | null;
  logo_path: string | null;
  created_at: string;
  updated_at: string;
  member_stats: { total: number; active: number; passive: number; prospect: number; resigned: number };
  admin_count: number;
  companies: Array<{ id: string; name: string }>;
  events_published: number;
  posts_published: number;
  active_appointments: Array<{ title: string; member_name: string }>;
  recent_events: Array<{ id: string; title: string; start_at: string; publication_status: string }>;
  recent_posts: Array<{ id: string; title: string; created_at: string; publication_status: string }>;
}

interface MemberRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  status: 'active' | 'passive' | 'prospect' | 'resigned';
  member_since: string | null;
  created_at: string;
  system_role: 'admin' | 'member' | null;
  company_name: string | null;
  role_names: string | null;
  appointment_titles: string | null;
}

const MEMBER_STATUS_LABELS: Record<string, string> = {
  all: "Alle",
  active: "Aktiv",
  passive: "Passiv",
  prospect: "Anfragen",
  resigned: "Ausgetreten",
};

const MemberStatusBadge = ({ status }: { status: MemberRow["status"] }) => {
  const styles: Record<MemberRow["status"], string> = {
    active:   "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    passive:  "bg-muted text-muted-foreground",
    prospect: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    resigned: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
      {MEMBER_STATUS_LABELS[status] ?? status}
    </span>
  );
};

const PlanBadge = ({ plan }: { plan: string }) => {
  const isActive = plan !== "free";
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
      isActive
        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
        : "bg-muted text-muted-foreground"
    }`}>
      {isActive ? `Aktiv · ${plan}` : "Kostenlos"}
    </span>
  );
};

const StatusChip = ({ status }: { status: string }) => (
  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
    status === "published"
      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
      : "bg-muted text-muted-foreground"
  }`}>
    {status === "published" ? "Veröffentlicht" : "Entwurf"}
  </span>
);

const DataRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-start gap-2 py-2 border-b border-border last:border-0">
    <span className="text-xs text-muted-foreground w-36 shrink-0 pt-0.5">{label}</span>
    <span className="text-sm text-foreground break-all">{value}</span>
  </div>
);

const KpiCard = ({
  label, value, icon: Icon, color,
}: {
  label: string; value: number; icon: React.ElementType; color: string;
}) => (
  <div className="bg-card border rounded-xl p-4 flex items-start gap-3">
    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
      <Icon className="w-4 h-4" />
    </div>
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-bold text-foreground">{value}</p>
    </div>
  </div>
);

const SuperadminClubDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: club, isLoading, isError, refetch } = useQuery<ClubDetail>({
    queryKey: ["superadmin-club", id],
    queryFn: () => apiJson<ClubDetail>(`/api/superadmin/clubs/${id}`),
    enabled: !!id,
  });

  const { data: members = [], isLoading: membersLoading, isError: membersError } =
    useQuery<MemberRow[]>({
      queryKey: ["superadmin-club-members", id],
      queryFn: () => apiJson<MemberRow[]>(`/api/superadmin/clubs/${id}/members`),
      enabled: !!id,
    });

  const [memberSearch, setMemberSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredMembers = members.filter((m) => {
    const q = memberSearch.toLowerCase();
    const matchesSearch =
      `${m.first_name} ${m.last_name}`.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q);
    const matchesStatus = statusFilter === "all" || m.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const displayCity = club?.location_city || club?.city;
  const displayWebsite = club?.website_url || club?.website;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate("/superadmin/clubs")}>
          <ArrowLeft className="w-4 h-4 mr-2" />Alle Vereine
        </Button>
        <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Vereinsdaten konnten nicht geladen werden.</span>
          <Button variant="ghost" size="sm" onClick={() => refetch()} className="ml-auto text-destructive hover:text-destructive">
            <RefreshCw className="w-3.5 h-3.5 mr-1" />Erneut versuchen
          </Button>
        </div>
      </div>
    );
  }

  if (!club) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate("/superadmin/clubs")}>
          <ArrowLeft className="w-4 h-4 mr-2" />Alle Vereine
        </Button>
        <div className="text-center py-12 text-muted-foreground">
          <Building2 className="w-10 h-10 opacity-30 mx-auto mb-3" />
          <p>Verein nicht gefunden.</p>
          <Button variant="outline" onClick={() => navigate("/superadmin/clubs")} className="mt-4">
            Zurück zur Liste
          </Button>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      {/* Back */}
      <Button variant="ghost" onClick={() => navigate("/superadmin/clubs")} className="-ml-2">
        <ArrowLeft className="w-4 h-4 mr-2" />Alle Vereine
      </Button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground">{club.name}</h1>
            <PlanBadge plan={club.plan} />
          </div>
          {club.tagline && (
            <p className="text-muted-foreground text-sm">{club.tagline}</p>
          )}
          {(displayCity || club.founded_year) && (
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              {displayCity && <><MapPin className="w-3.5 h-3.5" />{displayCity}</>}
              {displayCity && club.founded_year && <span className="mx-1">·</span>}
              {club.founded_year && <>Gegründet {club.founded_year}</>}
            </p>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Mitglieder gesamt"
          value={club.member_stats.total}
          icon={Users}
          color="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
        />
        <KpiCard
          label="Aktive Mitglieder"
          value={club.member_stats.active}
          icon={UserCheck}
          color="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
        />
        <KpiCard
          label="Admins"
          value={club.admin_count}
          icon={Shield}
          color="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
        />
        <KpiCard
          label="Events publiziert"
          value={club.events_published}
          icon={CalendarDays}
          color="bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400"
        />
      </div>

      {/* Mitglieder-Status-Aufschlüsselung */}
      {club.member_stats.total > 0 && (
        <div className="flex flex-wrap gap-2 text-xs">
          {club.member_stats.active > 0 && (
            <span className="px-2 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
              {club.member_stats.active} Aktiv
            </span>
          )}
          {club.member_stats.passive > 0 && (
            <span className="px-2 py-1 rounded-full bg-muted text-muted-foreground">
              {club.member_stats.passive} Passiv
            </span>
          )}
          {club.member_stats.prospect > 0 && (
            <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              {club.member_stats.prospect} Anfragen
            </span>
          )}
          {club.member_stats.resigned > 0 && (
            <span className="px-2 py-1 rounded-full bg-muted text-muted-foreground">
              {club.member_stats.resigned} Ausgetreten
            </span>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Stammdaten */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="w-4 h-4" />Stammdaten
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <DataRow label="Slug / URL-Pfad" value={club.slug} />
            {club.location_zip && displayCity && (
              <DataRow label="Ort" value={`${club.location_zip} ${displayCity}`} />
            )}
            {!club.location_zip && displayCity && (
              <DataRow label="Ort" value={displayCity} />
            )}
            {club.contact_email && (
              <DataRow label="Kontakt-E-Mail" value={club.contact_email} />
            )}
            {club.contact_phone && (
              <DataRow label="Telefon" value={club.contact_phone} />
            )}
            {displayWebsite && (
              <DataRow label="Website" value={displayWebsite} />
            )}
            {club.custom_domain && (
              <DataRow label="Custom Domain" value={club.custom_domain} />
            )}
            {club.domain_status && club.custom_domain && (
              <DataRow label="Domain-Status" value={club.domain_status} />
            )}
            {club.plan_started_at && (
              <DataRow
                label="Plan aktiv seit"
                value={format(new Date(club.plan_started_at), "dd.MM.yyyy", { locale: de })}
              />
            )}
            <DataRow
              label="Angelegt am"
              value={format(new Date(club.created_at), "dd.MM.yyyy HH:mm", { locale: de })}
            />
            <DataRow
              label="Zuletzt geändert"
              value={format(new Date(club.updated_at), "dd.MM.yyyy HH:mm", { locale: de })}
            />
          </CardContent>
        </Card>

        {/* Kompanien + Aktive Ämter */}
        <div className="space-y-4">
          {/* Kompanien */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Award className="w-4 h-4" />
                Kompanien
                <span className="ml-auto text-sm font-normal text-muted-foreground">
                  {club.companies.length}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {club.companies.length === 0 ? (
                <p className="text-sm text-muted-foreground">Keine Kompanien angelegt.</p>
              ) : (
                <ul className="space-y-1">
                  {club.companies.map((c) => (
                    <li key={c.id} className="flex items-center gap-2 text-sm py-1">
                      <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      {c.name}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Aktive Ämter */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Briefcase className="w-4 h-4" />
                Aktive Ämter
                <span className="ml-auto text-sm font-normal text-muted-foreground">
                  {club.active_appointments.length}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {club.active_appointments.length === 0 ? (
                <p className="text-sm text-muted-foreground">Keine aktiven Ämter eingetragen.</p>
              ) : (
                <ul className="space-y-1">
                  {club.active_appointments.map((a, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm py-1 border-b border-border last:border-0">
                      <span className="font-medium text-foreground w-36 shrink-0 truncate">{a.title}</span>
                      <span className="text-muted-foreground truncate">{a.member_name}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Letzte Aktivitäten */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Letzte Veranstaltungen */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4" />Letzte Veranstaltungen
            </CardTitle>
          </CardHeader>
          <CardContent>
            {club.recent_events.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine Veranstaltungen vorhanden.</p>
            ) : (
              <ul className="space-y-2">
                {club.recent_events.map((e) => (
                  <li key={e.id} className="flex items-start justify-between gap-2 py-1.5 border-b border-border last:border-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{e.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(e.start_at), "dd.MM.yyyy", { locale: de })}
                      </p>
                    </div>
                    <StatusChip status={e.publication_status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Letzte Beiträge */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4" />Letzte Beiträge
            </CardTitle>
          </CardHeader>
          <CardContent>
            {club.recent_posts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine Beiträge vorhanden.</p>
            ) : (
              <ul className="space-y-2">
                {club.recent_posts.map((p) => (
                  <li key={p.id} className="flex items-start justify-between gap-2 py-1.5 border-b border-border last:border-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{p.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(p.created_at), "dd.MM.yyyy", { locale: de })}
                      </p>
                    </div>
                    <StatusChip status={p.publication_status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Mitgliederliste */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <span className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Mitglieder
                {!membersLoading && (
                  <span className="text-sm font-normal text-muted-foreground">
                    ({members.length})
                  </span>
                )}
              </span>
              <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Name oder E-Mail …"
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    className="pl-8 h-8 text-sm w-44"
                  />
                </div>
                {(["all", "active", "passive", "prospect", "resigned"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      statusFilter === s
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {MEMBER_STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {membersError && (
            <div className="flex items-center gap-3 mx-4 mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Mitglieder konnten nicht geladen werden.</span>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">Name</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">E-Mail</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">Status</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">Kompanie</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">Rollen & Ämter</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">Beigetreten</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground whitespace-nowrap">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {membersLoading &&
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-border">
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-muted rounded animate-pulse" style={{ width: `${50 + (j % 4) * 15}%` }} />
                        </td>
                      ))}
                    </tr>
                  ))}

                {!membersLoading && !membersError && filteredMembers.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                      <Users className="w-8 h-8 opacity-30 mx-auto mb-2" />
                      {memberSearch || statusFilter !== "all"
                        ? "Keine Mitglieder gefunden."
                        : "Keine Mitglieder vorhanden."}
                    </td>
                  </tr>
                )}

                {!membersLoading &&
                  filteredMembers.map((m) => {
                    const joinedDate = m.member_since ?? m.created_at;
                    const rolesAndAmts = [m.role_names, m.appointment_titles].filter(Boolean).join(" · ");
                    return (
                      <tr
                        key={m.id}
                        className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-foreground whitespace-nowrap">
                              {m.last_name}, {m.first_name}
                            </span>
                            {m.system_role === "admin" && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                Admin
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{m.email}</td>
                        <td className="px-4 py-3">
                          <MemberStatusBadge status={m.status} />
                        </td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                          {m.company_name ?? <span className="opacity-40">–</span>}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground max-w-[200px]">
                          {rolesAndAmts
                            ? <span className="truncate block" title={rolesAndAmts}>{rolesAndAmts}</span>
                            : <span className="opacity-40">–</span>}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                          {format(new Date(joinedDate), "dd.MM.yyyy", { locale: de })}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button variant="outline" size="sm" disabled>
                            Details
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          {!membersLoading && filteredMembers.length < members.length && (
            <p className="px-4 py-2.5 text-xs text-muted-foreground border-t border-border">
              Zeige {filteredMembers.length} von {members.length} Mitgliedern
            </p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default SuperadminClubDetail;
