import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import {
  Package, Building2, CheckCircle2, AlertCircle, Search, RefreshCw,
} from "lucide-react";
import { apiJson } from "@/integrations/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface PackageStats {
  total_clubs: number;
  free_clubs: number;
  paid_clubs: number;
  no_start_date: number;
}

interface ClubPlanRow {
  id: string;
  name: string;
  slug: string;
  plan: string;
  plan_started_at: string | null;
  created_at: string;
  total_members: number;
}

interface PackagesData {
  stats: PackageStats;
  clubs: ClubPlanRow[];
}

type FilterKey = "all" | "free" | "paid";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all",  label: "Alle" },
  { key: "free", label: "Kostenlos" },
  { key: "paid", label: "Aktive Pakete" },
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

const PlanBadge = ({ plan }: { plan: string }) => {
  const isPaid = plan !== "free";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
      isPaid
        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
        : "bg-muted text-muted-foreground"
    }`}>
      {isPaid ? plan : "Kostenlos"}
    </span>
  );
};

const SkeletonRow = () => (
  <tr className="border-b border-border">
    {Array.from({ length: 6 }).map((_, i) => (
      <td key={i} className="px-4 py-3">
        <div className="h-4 bg-muted rounded animate-pulse" style={{ width: `${55 + (i % 4) * 15}%` }} />
      </td>
    ))}
  </tr>
);

const SuperadminPackages = () => {
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState<FilterKey>("all");

  const { data, isLoading, isError, refetch } = useQuery<PackagesData>({
    queryKey: ["superadmin-packages"],
    queryFn: () => apiJson<PackagesData>("/api/superadmin/packages"),
  });

  const filtered = (data?.clubs ?? []).filter((c) => {
    const q = search.toLowerCase();
    const matchesSearch =
      c.name.toLowerCase().includes(q) ||
      c.slug.toLowerCase().includes(q) ||
      c.plan.toLowerCase().includes(q);
    const matchesPlan =
      planFilter === "all" ||
      (planFilter === "free" && c.plan === "free") ||
      (planFilter === "paid" && c.plan !== "free");
    return matchesSearch && matchesPlan;
  });

  const totalClubs = data?.clubs.length ?? 0;

  return (
    <div className="space-y-5">
      {/* Header + Suche */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pakete & Abrechnung</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {isLoading ? "Lade …" : `${totalClubs} Vereine`}
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Nach Verein oder Plan suchen …"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Filter-Chips */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setPlanFilter(key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              planFilter === key
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
          label="Vereine gesamt"
          value={data?.stats.total_clubs}
          icon={Building2}
          color="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
          loading={isLoading}
        />
        <KpiCard
          label="Kostenlos"
          value={data?.stats.free_clubs}
          icon={Package}
          color="bg-muted text-muted-foreground"
          loading={isLoading}
        />
        <KpiCard
          label="Aktive Pakete"
          value={data?.stats.paid_clubs}
          icon={CheckCircle2}
          color="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
          loading={isLoading}
        />
        <KpiCard
          label="Kein Startdatum"
          value={data?.stats.no_start_date}
          icon={AlertCircle}
          color="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
          loading={isLoading}
        />
      </div>

      {/* Fehlerzustand */}
      {isError && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Paketdaten konnten nicht geladen werden.</span>
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
                <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">Verein</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">Plan</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground whitespace-nowrap">Mitglieder</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">Plan seit</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">Angelegt am</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground whitespace-nowrap">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}

              {!isLoading && !isError && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    <Package className="w-8 h-8 opacity-30 mx-auto mb-2" />
                    {search || planFilter !== "all"
                      ? `Kein Verein gefunden${search ? ` für „${search}"` : ""}`
                      : "Noch keine Vereine registriert."}
                  </td>
                </tr>
              )}

              {!isLoading &&
                filtered.map((club) => (
                  <tr
                    key={club.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    {/* Verein */}
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{club.name}</p>
                      <p className="text-xs text-muted-foreground">{club.slug}</p>
                    </td>

                    {/* Plan */}
                    <td className="px-4 py-3">
                      <PlanBadge plan={club.plan} />
                    </td>

                    {/* Mitglieder */}
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {club.total_members}
                    </td>

                    {/* Plan seit */}
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {club.plan_started_at
                        ? format(new Date(club.plan_started_at), "dd.MM.yyyy", { locale: de })
                        : <span className="opacity-40">–</span>}
                    </td>

                    {/* Angelegt am */}
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {format(new Date(club.created_at), "dd.MM.yyyy", { locale: de })}
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

        {!isLoading && !isError && filtered.length < (data?.clubs.length ?? 0) && (
          <div className="px-4 py-2.5 text-xs text-muted-foreground border-t border-border">
            Zeige {filtered.length} von {data?.clubs.length} Vereinen
          </div>
        )}
      </div>
    </div>
  );
};

export default SuperadminPackages;
