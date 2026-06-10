import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import {
  Building2, CheckCircle2, Users, Flag,
  Package, ShieldAlert, FileText, CalendarDays,
  ArrowRight, ShieldCheck, LayoutGrid, Settings2, Mail, HardDrive, ClipboardList, Globe,
  Store, BadgeCheck, MessageSquare, Inbox, MessageCircle, UserPlus, KeyRound,
} from "lucide-react";
import { apiJson } from "@/integrations/api/client";

interface ActivityItem {
  id: string;
  title: string;
  type: "post" | "event";
  clubName: string;
  createdAt: string;
}

interface SystemInfo {
  env: string;
  storageProvider: "local" | "s3";
  emailConfigured: boolean;
}

interface SuperadminStats {
  totalClubs: number;
  activeClubs: number;
  freeClubs: number;
  totalUsers: number;
  superadmins: number;
  openReports: number;
  publishedPosts: number;
  publishedEvents: number;
  openClaimRequests: number;
  publicClubs: number;
  publicEvents: number;
  totalProviders: number;
  verifiedProviders: number;
  totalProviderInquiries: number;
  newInterestRequests: number;
  openContactRequests: number;
  openMembershipRequests: number;
  openAccessRequests: number;
  system: SystemInfo;
  recentActivity: ActivityItem[];
}

// ── Hilfs-Komponenten ────────────────────────────────────────────────────────

const KpiCard = ({
  label, value, icon: Icon, color, loading, onClick,
}: {
  label: string;
  value: number | undefined;
  icon: React.ElementType;
  color: string;
  loading: boolean;
  onClick?: () => void;
}) => (
  <div
    className={`bg-card border rounded-xl p-5 flex items-start gap-4 ${onClick ? "cursor-pointer hover:bg-muted/30 transition-colors" : ""}`}
    onClick={onClick}
  >
    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
      <Icon className="w-5 h-5" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm text-muted-foreground truncate">{label}</p>
      {loading ? (
        <div className="h-7 w-16 bg-muted rounded animate-pulse mt-1" />
      ) : (
        <p className="text-2xl font-bold text-foreground">{value ?? "–"}</p>
      )}
    </div>
  </div>
);

const QuickLink = ({
  icon: Icon, title, desc, color, onClick,
}: {
  icon: React.ElementType;
  title: string;
  desc: string;
  color: string;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className="group bg-card border rounded-xl p-4 flex items-center gap-4 text-left hover:bg-muted/40 hover:border-primary/30 transition-colors w-full"
  >
    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
      <Icon className="w-4 h-4" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="font-medium text-foreground text-sm">{title}</p>
      <p className="text-xs text-muted-foreground truncate">{desc}</p>
    </div>
    <ArrowRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0" />
  </button>
);

const ActivityTypeBadge = ({ type }: { type: ActivityItem["type"] }) => {
  if (type === "event") {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 shrink-0">
        Termin
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 shrink-0">
      Beitrag
    </span>
  );
};

const SystemStatusDot = ({ active }: { active: boolean }) => (
  <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${active ? "bg-green-500" : "bg-muted-foreground/40"}`} />
);

// ── Hauptkomponente ──────────────────────────────────────────────────────────

const SuperadminDashboard = () => {
  const navigate = useNavigate();

  const { data: stats, isLoading } = useQuery<SuperadminStats>({
    queryKey: ["superadmin-stats"],
    queryFn: () => apiJson<SuperadminStats>("/api/superadmin/stats"),
  });

  const openReportsColor = (stats?.openReports ?? 0) > 0
    ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
    : "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400";

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Plattformübersicht SchützenHub</p>
      </div>

      {/* KPI-Reihe 1 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <KpiCard
          label="Vereine gesamt"
          value={stats?.totalClubs}
          icon={Building2}
          color="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
          loading={isLoading}
        />
        <KpiCard
          label="Öffentliche Vereine"
          value={stats?.publicClubs ?? 0}
          icon={Globe}
          color="bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400"
          loading={isLoading}
          onClick={() => window.open("/vereine", "_blank")}
        />
        <KpiCard
          label="Aktive Pakete"
          value={stats?.activeClubs}
          icon={CheckCircle2}
          color="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
          loading={isLoading}
        />
        <KpiCard
          label="Benutzer gesamt"
          value={stats?.totalUsers}
          icon={Users}
          color="bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400"
          loading={isLoading}
        />
        <KpiCard
          label="Offene Meldungen"
          value={stats?.openReports}
          icon={Flag}
          color={openReportsColor}
          loading={isLoading}
        />
      </div>

      {/* KPI-Reihe 2 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4">
        <KpiCard
          label="Kostenlose Vereine"
          value={stats?.freeClubs}
          icon={Package}
          color="bg-muted text-muted-foreground"
          loading={isLoading}
        />
        <KpiCard
          label="Superadmins"
          value={stats?.superadmins}
          icon={ShieldAlert}
          color="bg-destructive/10 text-destructive"
          loading={isLoading}
        />
        <KpiCard
          label="Veröff. Beiträge"
          value={stats?.publishedPosts}
          icon={FileText}
          color="bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400"
          loading={isLoading}
        />
        <KpiCard
          label="Veröff. Termine"
          value={stats?.publishedEvents}
          icon={CalendarDays}
          color="bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400"
          loading={isLoading}
        />
        <KpiCard
          label="Öffentl. Veranstaltungen"
          value={stats?.publicEvents ?? 0}
          icon={CalendarDays}
          color="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
          loading={isLoading}
          onClick={() => window.open("/veranstaltungen", "_blank")}
        />
        <KpiCard
          label="Übernahmeanfragen"
          value={stats?.openClaimRequests ?? 0}
          icon={ClipboardList}
          color="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
          loading={isLoading}
          onClick={() => navigate("/superadmin/claim-requests")}
        />
      </div>

      {/* KPI-Reihe 3 – Anbieter */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <KpiCard
          label="Anbieter"
          value={stats?.totalProviders ?? 0}
          icon={Store}
          color="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
          loading={isLoading}
          onClick={() => navigate("/superadmin/providers")}
        />
        <KpiCard
          label="Verifizierte Anbieter"
          value={stats?.verifiedProviders ?? 0}
          icon={BadgeCheck}
          color="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
          loading={isLoading}
        />
        <KpiCard
          label="Anbieter-Anfragen"
          value={stats?.totalProviderInquiries ?? 0}
          icon={MessageSquare}
          color="bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400"
          loading={isLoading}
        />
      </div>

      {/* KPI-Reihe 4 – Vereinsanfragen */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <KpiCard
          label="Neue Vereinsanfragen"
          value={stats?.newInterestRequests ?? 0}
          icon={Inbox}
          color="bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400"
          loading={isLoading}
          onClick={() => navigate("/superadmin/inbox")}
        />
        <KpiCard
          label="Offene Kontaktanfragen"
          value={stats?.openContactRequests ?? 0}
          icon={MessageCircle}
          color="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
          loading={isLoading}
          onClick={() => navigate("/superadmin/inbox?type=club_contact")}
        />
        <KpiCard
          label="Offene Mitgliedschaftsanfragen"
          value={stats?.openMembershipRequests ?? 0}
          icon={UserPlus}
          color="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
          loading={isLoading}
          onClick={() => navigate("/superadmin/inbox?type=membership_interest")}
        />
        <KpiCard
          label="Übernahmeanfragen"
          value={stats?.openClaimRequests ?? 0}
          icon={ClipboardList}
          color="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
          loading={isLoading}
          onClick={() => navigate("/superadmin/claim-requests")}
        />
        <KpiCard
          label="Zugangsanfragen"
          value={stats?.openAccessRequests ?? 0}
          icon={KeyRound}
          color="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
          loading={isLoading}
          onClick={() => navigate("/superadmin/inbox?type=access_request")}
        />
      </div>

      {/* Aktivität + Systemstatus */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Letzte Aktivität */}
        <div className="lg:col-span-2 bg-card border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border bg-muted/30">
            <h2 className="font-semibold text-foreground text-sm">Letzte Aktivität</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Neueste veröffentlichte Beiträge und Termine</p>
          </div>
          <div className="divide-y divide-border">
            {isLoading && Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3">
                <div className="h-5 w-12 bg-muted rounded animate-pulse shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
                  <div className="h-3 bg-muted rounded animate-pulse w-1/3" />
                </div>
                <div className="h-3 bg-muted rounded animate-pulse w-16 shrink-0" />
              </div>
            ))}

            {!isLoading && (stats?.recentActivity ?? []).length === 0 && (
              <div className="px-5 py-10 text-center text-muted-foreground text-sm">
                Noch keine Aktivität vorhanden.
              </div>
            )}

            {!isLoading && (stats?.recentActivity ?? []).map((item) => (
              <div key={`${item.type}-${item.id}`} className="flex items-center gap-3 px-5 py-3">
                <ActivityTypeBadge type={item.type} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{item.clubName}</p>
                </div>
                <p className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                  {format(new Date(item.createdAt), "dd.MM.yyyy", { locale: de })}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Systemstatus */}
        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border bg-muted/30">
            <h2 className="font-semibold text-foreground text-sm">Systemstatus</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Laufende Konfiguration</p>
          </div>
          <div className="px-5 divide-y divide-border">

            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex justify-between items-center py-3">
                  <div className="h-4 bg-muted rounded animate-pulse w-24" />
                  <div className="h-5 bg-muted rounded animate-pulse w-20" />
                </div>
              ))
            ) : (
              <>
                <div className="flex items-center justify-between py-3 gap-3">
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <Settings2 className="w-3.5 h-3.5" /> Umgebung
                  </span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    stats?.system.env === "production"
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                  }`}>
                    {stats?.system.env ?? "–"}
                  </span>
                </div>

                <div className="flex items-center justify-between py-3 gap-3">
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <HardDrive className="w-3.5 h-3.5" /> Speicher
                  </span>
                  <span className="flex items-center gap-1.5 text-sm text-foreground">
                    <SystemStatusDot active />
                    {stats?.system.storageProvider === "s3" ? "AWS S3" : "Lokal"}
                  </span>
                </div>

                <div className="flex items-center justify-between py-3 gap-3">
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5" /> E-Mail
                  </span>
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <SystemStatusDot active={false} />
                    Nicht konfiguriert
                  </span>
                </div>

                <div className="flex items-center justify-between py-3 gap-3">
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <Flag className="w-3.5 h-3.5" /> Offene Meldungen
                  </span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    (stats?.openReports ?? 0) > 0
                      ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                      : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  }`}>
                    {stats?.openReports ?? 0}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Schnellzugriffe */}
      <div>
        <h2 className="font-semibold text-foreground text-sm mb-3">Schnellzugriffe</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <QuickLink
            icon={Building2}
            title="Vereine"
            desc="Alle Vereine verwalten und einsehen"
            color="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
            onClick={() => navigate("/superadmin/clubs")}
          />
          <QuickLink
            icon={Users}
            title="Benutzer"
            desc="Plattformweite Benutzerliste"
            color="bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400"
            onClick={() => navigate("/superadmin/users")}
          />
          <QuickLink
            icon={Flag}
            title="Meldungen & Compliance"
            desc="Gemeldete Inhalte prüfen"
            color="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
            onClick={() => navigate("/superadmin/reports")}
          />
          <QuickLink
            icon={Package}
            title="Pakete & Abrechnung"
            desc="Aktive Pläne und Vereine"
            color="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
            onClick={() => navigate("/superadmin/packages")}
          />
          <QuickLink
            icon={ShieldCheck}
            title="Rollen & Rechte"
            desc="Plattformweite Rollenübersicht"
            color="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
            onClick={() => navigate("/superadmin/roles")}
          />
          <QuickLink
            icon={LayoutGrid}
            title="Systemeinstellungen"
            desc="Konfiguration und Systemstatus"
            color="bg-muted text-muted-foreground"
            onClick={() => navigate("/superadmin/settings")}
          />
        </div>
      </div>

    </div>
  );
};

export default SuperadminDashboard;
