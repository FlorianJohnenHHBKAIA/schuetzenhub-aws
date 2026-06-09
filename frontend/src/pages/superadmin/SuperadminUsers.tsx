import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Users, Search, AlertCircle, RefreshCw, ShieldAlert } from "lucide-react";
import { apiJson } from "@/integrations/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface UserRow {
  id: string;
  email: string;
  is_superadmin: boolean;
  created_at: string;
  club_count: number;
  display_name: string | null;
  club_names: string | null;
  admin_role_count: number;
}

type FilterKey = "all" | "superadmin" | "club" | "no-club";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all",        label: "Alle" },
  { key: "superadmin", label: "Superadmins" },
  { key: "club",       label: "Vereinsnutzer" },
  { key: "no-club",    label: "Ohne Verein" },
];

const UserTypeBadge = ({ user }: { user: UserRow }) => {
  if (user.is_superadmin) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-destructive/10 text-destructive">
        <ShieldAlert className="w-3 h-3" />
        Superadmin
      </span>
    );
  }
  if (user.admin_role_count > 0) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
        Admin ({user.admin_role_count})
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
      Mitglied
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

const SuperadminUsers = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");

  const { data: users = [], isLoading, isError, refetch } = useQuery<UserRow[]>({
    queryKey: ["superadmin-users"],
    queryFn: () => apiJson<UserRow[]>("/api/superadmin/users"),
  });

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    const matchesSearch =
      u.email.toLowerCase().includes(q) ||
      (u.display_name ?? "").toLowerCase().includes(q) ||
      (u.club_names ?? "").toLowerCase().includes(q);

    let matchesFilter = true;
    if (activeFilter === "superadmin") matchesFilter = u.is_superadmin;
    else if (activeFilter === "club")    matchesFilter = u.club_count > 0;
    else if (activeFilter === "no-club") matchesFilter = u.club_count === 0 && !u.is_superadmin;

    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Benutzer</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {isLoading ? "Lade …" : `${users.length} Benutzer registriert`}
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="E-Mail, Name oder Verein …"
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

      {/* Fehlerzustand */}
      {isError && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Benutzer konnten nicht geladen werden.</span>
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
                <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">Benutzer</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">E-Mail</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">Typ</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">Vereine</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">Angelegt am</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground whitespace-nowrap">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}

              {!isLoading && !isError && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    <Users className="w-8 h-8 opacity-30 mx-auto mb-2" />
                    {search || activeFilter !== "all"
                      ? `Kein Benutzer gefunden${search ? ` für „${search}"` : ""}`
                      : "Noch keine Benutzer registriert."}
                  </td>
                </tr>
              )}

              {!isLoading &&
                filtered.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    {/* Benutzer */}
                    <td className="px-4 py-3">
                      {user.display_name ? (
                        <>
                          <p className="font-medium text-foreground">{user.display_name}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </>
                      ) : (
                        <p className="font-medium text-foreground">{user.email}</p>
                      )}
                    </td>

                    {/* E-Mail */}
                    <td className="px-4 py-3 text-muted-foreground">{user.email}</td>

                    {/* Typ */}
                    <td className="px-4 py-3">
                      <UserTypeBadge user={user} />
                    </td>

                    {/* Vereine */}
                    <td className="px-4 py-3 text-muted-foreground max-w-[220px]">
                      {user.club_names ? (
                        <span className="truncate block" title={user.club_names}>
                          {user.club_names}
                        </span>
                      ) : (
                        <span className="opacity-40">–</span>
                      )}
                    </td>

                    {/* Angelegt am */}
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {format(new Date(user.created_at), "dd.MM.yyyy", { locale: de })}
                    </td>

                    {/* Aktionen */}
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/superadmin/users/${user.id}`)}
                      >
                        Details
                      </Button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {!isLoading && !isError && filtered.length < users.length && (
          <div className="px-4 py-2.5 text-xs text-muted-foreground border-t border-border">
            Zeige {filtered.length} von {users.length} Benutzern
          </div>
        )}
      </div>
    </div>
  );
};

export default SuperadminUsers;
