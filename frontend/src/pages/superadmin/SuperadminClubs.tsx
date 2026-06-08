import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Building2, Search, AlertCircle, RefreshCw } from "lucide-react";
import { apiJson } from "@/integrations/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ClubRow {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  plan: string;
  plan_started_at: string | null;
  created_at: string;
  active_members: number;
  total_members: number;
  admin_count: number;
}

const PlanBadge = ({ plan }: { plan: string }) => {
  const isActive = plan !== "free";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
        isActive
          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
          : "bg-muted text-muted-foreground"
      }`}
    >
      {isActive ? "Aktiv" : "Kostenlos"}
    </span>
  );
};

const SkeletonRow = () => (
  <tr className="border-b border-border">
    {Array.from({ length: 7 }).map((_, i) => (
      <td key={i} className="px-4 py-3">
        <div className="h-4 bg-muted rounded animate-pulse" style={{ width: `${60 + (i % 3) * 20}%` }} />
      </td>
    ))}
  </tr>
);

const SuperadminClubs = () => {
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const {
    data: clubs = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<ClubRow[]>({
    queryKey: ["superadmin-clubs"],
    queryFn: () => apiJson<ClubRow[]>("/api/superadmin/clubs"),
  });

  const filtered = clubs.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.city ?? "").toLowerCase().includes(q) ||
      c.slug.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Vereine</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {isLoading ? "Lade …" : `${clubs.length} Verein${clubs.length !== 1 ? "e" : ""} registriert`}
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Nach Name oder Ort suchen …"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Error state */}
      {isError && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Vereine konnten nicht geladen werden.</span>
          <Button variant="ghost" size="sm" onClick={() => refetch()} className="ml-auto text-destructive hover:text-destructive">
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            Erneut versuchen
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">Verein</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">Ort</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">Status</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground whitespace-nowrap">Mitglieder</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground whitespace-nowrap">Admins</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">Angelegt am</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground whitespace-nowrap">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}

              {!isLoading && filtered.length === 0 && !isError && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    <Building2 className="w-8 h-8 opacity-30 mx-auto mb-2" />
                    {search
                      ? `Kein Verein gefunden für „${search}"`
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

                    {/* Ort */}
                    <td className="px-4 py-3 text-muted-foreground">
                      {club.city ?? <span className="text-muted-foreground/50">–</span>}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <PlanBadge plan={club.plan} />
                    </td>

                    {/* Mitglieder */}
                    <td className="px-4 py-3 text-right tabular-nums">
                      <span className="font-medium">{club.active_members}</span>
                      <span className="text-muted-foreground"> / {club.total_members}</span>
                    </td>

                    {/* Admins */}
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {club.admin_count}
                    </td>

                    {/* Angelegt am */}
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {format(new Date(club.created_at), "dd.MM.yyyy", { locale: de })}
                    </td>

                    {/* Aktionen */}
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/superadmin/clubs/${club.id}`)}
                      >
                        Details
                      </Button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SuperadminClubs;
