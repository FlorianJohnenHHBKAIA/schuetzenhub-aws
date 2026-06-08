import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ShieldCheck, Search, AlertCircle, RefreshCw,
  UserCheck, Building2, ShieldAlert,
} from "lucide-react";
import { apiJson } from "@/integrations/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface RoleStats {
  total_roles: number;
  total_assignments: number;
  clubs_with_roles: number;
  superadmin_count: number;
}

interface RoleRow {
  name: string;
  level: 'club' | 'company';
  club_count: number;
  assignment_count: number;
  permission_count: number;
}

interface RolesData {
  stats: RoleStats;
  roles: RoleRow[];
}

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

const ScopeBadge = ({ level }: { level: RoleRow['level'] }) => {
  if (level === 'company') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
        Kompanie
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
      Verein
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

const SuperadminRoles = () => {
  const [search, setSearch] = useState("");

  const { data, isLoading, isError, refetch } = useQuery<RolesData>({
    queryKey: ["superadmin-roles"],
    queryFn: () => apiJson<RolesData>("/api/superadmin/roles"),
  });

  const filtered = (data?.roles ?? []).filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase())
  );

  const totalRoles = data?.roles.length ?? 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Rollen & Rechte</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {isLoading
              ? "Lade …"
              : `${totalRoles} Rollen${totalRoles !== 1 ? "" : ""} plattformweit definiert`}
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Nach Rollenname suchen …"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* KPI-Karten */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Rollen gesamt"
          value={data?.stats.total_roles}
          icon={ShieldCheck}
          color="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
          loading={isLoading}
        />
        <KpiCard
          label="Vergebene Rollen"
          value={data?.stats.total_assignments}
          icon={UserCheck}
          color="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
          loading={isLoading}
        />
        <KpiCard
          label="Vereine mit Rollen"
          value={data?.stats.clubs_with_roles}
          icon={Building2}
          color="bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400"
          loading={isLoading}
        />
        <KpiCard
          label="Superadmins"
          value={data?.stats.superadmin_count}
          icon={ShieldAlert}
          color="bg-destructive/10 text-destructive"
          loading={isLoading}
        />
      </div>

      {/* Fehlerzustand */}
      {isError && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Rollen konnten nicht geladen werden.</span>
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
                <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">Rolle</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">Scope</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground whitespace-nowrap">Zuweisungen</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground whitespace-nowrap">Vereine</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground whitespace-nowrap">Berechtigungen</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground whitespace-nowrap">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}

              {!isLoading && !isError && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    <ShieldCheck className="w-8 h-8 opacity-30 mx-auto mb-2" />
                    {search
                      ? `Keine Rolle gefunden für „${search}"`
                      : "Noch keine Rollen definiert."}
                  </td>
                </tr>
              )}

              {!isLoading &&
                filtered.map((role) => (
                  <tr
                    key={`${role.name}-${role.level}`}
                    className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    {/* Rolle */}
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{role.name}</p>
                    </td>

                    {/* Scope */}
                    <td className="px-4 py-3">
                      <ScopeBadge level={role.level} />
                    </td>

                    {/* Zuweisungen */}
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {role.assignment_count}
                    </td>

                    {/* Vereine */}
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {role.club_count}
                    </td>

                    {/* Berechtigungen */}
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {role.permission_count > 0
                        ? role.permission_count
                        : <span className="opacity-40">–</span>}
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

        {!isLoading && !isError && filtered.length < (data?.roles.length ?? 0) && (
          <div className="px-4 py-2.5 text-xs text-muted-foreground border-t border-border">
            Zeige {filtered.length} von {data?.roles.length} Rollen
          </div>
        )}
      </div>
    </div>
  );
};

export default SuperadminRoles;
