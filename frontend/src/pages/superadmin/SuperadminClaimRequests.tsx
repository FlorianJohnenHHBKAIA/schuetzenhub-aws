import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { ChevronRight } from "lucide-react";
import { apiJson } from "@/integrations/api/client";

interface ClaimRequest {
  id: string;
  club_id: string;
  club_name: string;
  club_slug: string;
  firstname: string;
  lastname: string;
  position: string | null;
  email: string;
  phone: string | null;
  status: "open" | "approved" | "rejected";
  created_at: string;
}

type FilterStatus = "all" | "open" | "approved" | "rejected";

const STATUS_LABEL: Record<string, string> = {
  open: "Offen",
  approved: "Genehmigt",
  rejected: "Abgelehnt",
};

const STATUS_COLOR: Record<string, string> = {
  open: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  approved: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  rejected: "bg-muted text-muted-foreground",
};

const StatusBadge = ({ status }: { status: string }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[status] ?? "bg-muted text-muted-foreground"}`}>
    {STATUS_LABEL[status] ?? status}
  </span>
);

const FILTER_OPTIONS: { value: FilterStatus; label: string }[] = [
  { value: "all", label: "Alle" },
  { value: "open", label: "Offen" },
  { value: "approved", label: "Genehmigt" },
  { value: "rejected", label: "Abgelehnt" },
];

const SuperadminClaimRequests = () => {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState<FilterStatus>("all");

  const { data: requests = [], isLoading } = useQuery<ClaimRequest[]>({
    queryKey: ["superadmin-claim-requests"],
    queryFn: () => apiJson<ClaimRequest[]>("/api/superadmin/claim-requests"),
  });

  const filtered = activeFilter === "all" ? requests : requests.filter((r) => r.status === activeFilter);
  const openCount = requests.filter((r) => r.status === "open").length;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Übernahmeanfragen</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Vereinsübernahmen prüfen und bearbeiten
          </p>
        </div>
        {openCount > 0 && (
          <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            {openCount} offen
          </span>
        )}
      </div>

      {/* Filter Chips */}
      <div className="flex flex-wrap gap-2">
        {FILTER_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setActiveFilter(value)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeFilter === value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {label}
            {value === "open" && openCount > 0 && (
              <span className="ml-1.5 text-xs opacity-75">({openCount})</span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Verein</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Antragsteller</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Funktion</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">E-Mail</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Eingereicht</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 7 }).map((__, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-muted rounded animate-pulse" style={{ width: `${60 + (j * 10) % 30}%` }} />
                    </td>
                  ))}
                </tr>
              ))}

              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    {activeFilter === "all"
                      ? "Noch keine Übernahmeanfragen vorhanden."
                      : `Keine ${STATUS_LABEL[activeFilter]?.toLowerCase()} Anfragen.`}
                  </td>
                </tr>
              )}

              {!isLoading && filtered.map((req) => (
                <tr
                  key={req.id}
                  onClick={() => navigate(`/superadmin/claim-requests/${req.id}`)}
                  className="hover:bg-muted/30 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-foreground">{req.club_name}</td>
                  <td className="px-4 py-3 text-foreground">{req.firstname} {req.lastname}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{req.position || "–"}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{req.email}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell whitespace-nowrap">
                    {format(new Date(req.created_at), "dd.MM.yyyy", { locale: de })}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={req.status} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <ChevronRight className="w-4 h-4" />
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

export default SuperadminClaimRequests;
