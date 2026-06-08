import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import {
  Flag, Clock, CheckCircle2, BarChart2, AlertCircle, RefreshCw,
} from "lucide-react";
import { apiJson } from "@/integrations/api/client";
import { Button } from "@/components/ui/button";

interface ReportStats {
  open_count: number;
  in_review_count: number;
  resolved_count: number;
  dismissed_count: number;
  total_count: number;
}

interface ReportRow {
  id: string;
  target_type: "post" | "event" | "comment" | "member" | "club";
  target_id: string | null;
  reason: string;
  description: string | null;
  status: "open" | "in_review" | "resolved" | "dismissed";
  created_at: string;
  resolved_at: string | null;
  club_name: string | null;
  club_slug: string | null;
}

interface ReportsData {
  stats: ReportStats;
  reports: ReportRow[];
}

type FilterKey = "all" | "open" | "in_review" | "resolved";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all",       label: "Alle" },
  { key: "open",      label: "Offen" },
  { key: "in_review", label: "In Prüfung" },
  { key: "resolved",  label: "Erledigt" },
];

const KpiCard = ({
  label, value, icon: Icon, color, loading,
}: {
  label: string;
  value: number | undefined;
  icon: React.ElementType;
  color: string;
  loading: boolean;
}) => (
  <div className="bg-card border rounded-xl p-5 flex items-start gap-4">
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

const TYPE_LABELS: Record<ReportRow["target_type"], string> = {
  post:    "Beitrag",
  event:   "Termin",
  comment: "Kommentar",
  member:  "Mitglied",
  club:    "Verein",
};

const TypeBadge = ({ type }: { type: ReportRow["target_type"] }) => {
  const colorMap: Record<ReportRow["target_type"], string> = {
    post:    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    event:   "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
    comment: "bg-muted text-muted-foreground",
    member:  "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    club:    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colorMap[type]}`}>
      {TYPE_LABELS[type]}
    </span>
  );
};

const StatusBadge = ({ status }: { status: ReportRow["status"] }) => {
  const map: Record<ReportRow["status"], { label: string; cls: string }> = {
    open:      { label: "Offen",       cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
    in_review: { label: "In Prüfung",  cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
    resolved:  { label: "Erledigt",    cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
    dismissed: { label: "Abgewiesen",  cls: "bg-muted text-muted-foreground" },
  };
  const { label, cls } = map[status];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
};

const SkeletonRow = () => (
  <tr className="border-b border-border">
    {Array.from({ length: 6 }).map((_, i) => (
      <td key={i} className="px-4 py-3">
        <div className="h-4 bg-muted rounded animate-pulse" style={{ width: `${50 + (i % 4) * 15}%` }} />
      </td>
    ))}
  </tr>
);

const SuperadminReports = () => {
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");

  const { data, isLoading, isError, refetch } = useQuery<ReportsData>({
    queryKey: ["superadmin-reports"],
    queryFn: () => apiJson<ReportsData>("/api/superadmin/reports"),
  });

  const filtered = (data?.reports ?? []).filter((r) => {
    if (activeFilter === "all")       return true;
    if (activeFilter === "resolved")  return r.status === "resolved" || r.status === "dismissed";
    return r.status === activeFilter;
  });

  const totalReports = data?.stats.total_count ?? 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Meldungen & Compliance</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          {isLoading ? "Lade …" : `${totalReports} Meldung${totalReports !== 1 ? "en" : ""} gesamt`}
        </p>
      </div>

      {/* Filter-Chips */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveFilter(key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              activeFilter === key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* KPI-Karten */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Offene Meldungen"
          value={data?.stats.open_count}
          icon={Flag}
          color="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
          loading={isLoading}
        />
        <KpiCard
          label="In Prüfung"
          value={data?.stats.in_review_count}
          icon={Clock}
          color="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
          loading={isLoading}
        />
        <KpiCard
          label="Erledigt"
          value={data?.stats.resolved_count}
          icon={CheckCircle2}
          color="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
          loading={isLoading}
        />
        <KpiCard
          label="Gesamt"
          value={data?.stats.total_count}
          icon={BarChart2}
          color="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
          loading={isLoading}
        />
      </div>

      {/* Fehlerzustand */}
      {isError && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Meldungen konnten nicht geladen werden.</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            className="ml-auto text-destructive hover:text-destructive"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            Erneut versuchen
          </Button>
        </div>
      )}

      {/* Tabelle */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">Typ</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">Grund</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">Verein</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">Status</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">Gemeldet am</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground whitespace-nowrap">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}

              {!isLoading && !isError && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center text-muted-foreground">
                    <Flag className="w-8 h-8 opacity-30 mx-auto mb-2" />
                    <p className="font-medium">Keine Meldungen vorhanden.</p>
                    <p className="text-xs mt-1 max-w-xs mx-auto">
                      Sobald Benutzer oder Vereine Inhalte melden, erscheinen sie hier.
                    </p>
                  </td>
                </tr>
              )}

              {!isLoading &&
                filtered.map((report) => (
                  <tr
                    key={report.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    {/* Typ */}
                    <td className="px-4 py-3">
                      <TypeBadge type={report.target_type} />
                    </td>

                    {/* Grund */}
                    <td className="px-4 py-3 max-w-[200px]">
                      <p className="truncate text-foreground" title={report.reason}>
                        {report.reason}
                      </p>
                      {report.description && (
                        <p className="text-xs text-muted-foreground truncate" title={report.description}>
                          {report.description}
                        </p>
                      )}
                    </td>

                    {/* Verein */}
                    <td className="px-4 py-3 text-muted-foreground">
                      {report.club_name ?? <span className="opacity-40">–</span>}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <StatusBadge status={report.status} />
                    </td>

                    {/* Gemeldet am */}
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {format(new Date(report.created_at), "dd.MM.yyyy", { locale: de })}
                    </td>

                    {/* Aktionen */}
                    <td className="px-4 py-3 text-right">
                      <Button variant="outline" size="sm" disabled>
                        Details
                      </Button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {!isLoading && !isError && activeFilter !== "all" && filtered.length < totalReports && (
          <div className="px-4 py-2.5 text-xs text-muted-foreground border-t border-border">
            Zeige {filtered.length} von {totalReports} Meldungen
          </div>
        )}
      </div>
    </div>
  );
};

export default SuperadminReports;
