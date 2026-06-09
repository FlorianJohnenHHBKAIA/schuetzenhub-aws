import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import {
  ScrollText, AlertCircle, RefreshCw, ChevronDown, ChevronUp, Search,
} from "lucide-react";
import { apiJson } from "@/integrations/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AuditLogEntry {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  actor_email: string;
  performed_by: string | null;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
  club_name: string | null;
  club_slug: string | null;
  provider_name: string | null;
  provider_slug: string | null;
}

// ─── Action-Badge ─────────────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  "club.created":             "Verein erstellt",
  "club.updated":             "Verein aktualisiert",
  "club.plan_changed":        "Plan geändert",
  "club.archived":            "Archiviert",
  "club.unarchived":          "Archivierung aufgehoben",
  "club.logo_uploaded":       "Logo hochgeladen",
  "club.hero_uploaded":       "Titelbild hochgeladen",
  "club.note_created":        "Notiz angelegt",
  "club.note_deleted":        "Notiz gelöscht",
  "claim_request.approved":   "Anfrage genehmigt",
  "claim_request.rejected":   "Anfrage abgelehnt",
  "provider.created":         "Anbieter erstellt",
  "provider.updated":         "Anbieter aktualisiert",
  "provider.logo_uploaded":   "Logo hochgeladen",
  "provider.hero_uploaded":   "Titelbild hochgeladen",
};

function actionBadgeClass(action: string): string {
  if (action === "club.plan_changed")       return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
  if (action === "club.archived")           return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
  if (action === "club.unarchived")         return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
  if (action === "claim_request.approved")  return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
  if (action === "claim_request.rejected")  return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
  if (action.endsWith(".created"))          return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
  if (action.endsWith(".updated"))          return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
  return "bg-muted text-muted-foreground";
}

const ActionBadge = ({ action }: { action: string }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${actionBadgeClass(action)}`}>
    {ACTION_LABELS[action] ?? action}
  </span>
);

// ─── Entity-Typ-Badge ─────────────────────────────────────────────────────────

const ENTITY_LABELS: Record<string, string> = {
  club:          "Verein",
  provider:      "Anbieter",
  claim_request: "Claim-Anfrage",
};

const ENTITY_COLORS: Record<string, string> = {
  club:          "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  provider:      "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  claim_request: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
};

const EntityTypeBadge = ({ type }: { type: string }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ENTITY_COLORS[type] ?? "bg-muted text-muted-foreground"}`}>
    {ENTITY_LABELS[type] ?? type}
  </span>
);

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const SkeletonRow = () => (
  <tr className="border-b border-border">
    {Array.from({ length: 7 }).map((_, i) => (
      <td key={i} className="px-4 py-3">
        <div className="h-4 bg-muted rounded animate-pulse" style={{ width: `${40 + (i % 5) * 12}%` }} />
      </td>
    ))}
  </tr>
);

// ─── Filter-Definitionen ──────────────────────────────────────────────────────

const ENTITY_FILTERS = [
  { key: "",              label: "Alle Typen" },
  { key: "club",          label: "Vereine" },
  { key: "provider",      label: "Anbieter" },
  { key: "claim_request", label: "Claim-Anfragen" },
];

const ACTION_FILTERS = [
  { key: "",                      label: "Alle Aktionen" },
  { key: "club.plan_changed",     label: "Plan geändert" },
  { key: "club.archived",         label: "Archiviert" },
  { key: "club.unarchived",       label: "Aufgehoben" },
  { key: "claim_request.approved", label: "Genehmigt" },
  { key: "claim_request.rejected", label: "Abgelehnt" },
  { key: "club.created",          label: "Verein erstellt" },
  { key: "provider.created",      label: "Anbieter erstellt" },
  { key: "club.updated",          label: "Verein aktualisiert" },
  { key: "provider.updated",      label: "Anbieter aktualisiert" },
];

// ─── Detail-Vorschau ──────────────────────────────────────────────────────────

const DetailPanel = ({ entry }: { entry: AuditLogEntry }) => {
  const hasContent = entry.before_state || entry.after_state || entry.metadata;
  if (!hasContent) {
    return (
      <tr>
        <td colSpan={7} className="px-4 pb-3 pt-0 bg-muted/20 text-xs text-muted-foreground">
          Keine weiteren Details vorhanden.
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td colSpan={7} className="px-4 pb-4 pt-1 bg-muted/20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          {entry.before_state && (
            <div>
              <p className="font-medium text-muted-foreground mb-1">Vorher</p>
              <pre className="bg-muted rounded p-2 overflow-x-auto text-foreground leading-relaxed">
                {JSON.stringify(entry.before_state, null, 2)}
              </pre>
            </div>
          )}
          {entry.after_state && (
            <div>
              <p className="font-medium text-muted-foreground mb-1">Nachher</p>
              <pre className="bg-muted rounded p-2 overflow-x-auto text-foreground leading-relaxed">
                {JSON.stringify(entry.after_state, null, 2)}
              </pre>
            </div>
          )}
          {entry.metadata && (
            <div className={!entry.before_state && !entry.after_state ? "" : "md:col-span-2"}>
              <p className="font-medium text-muted-foreground mb-1">Metadaten</p>
              <pre className="bg-muted rounded p-2 overflow-x-auto text-foreground leading-relaxed">
                {JSON.stringify(entry.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
};

// ─── Hauptkomponente ──────────────────────────────────────────────────────────

const SuperadminAuditLogs = () => {
  const [entityTypeFilter, setEntityTypeFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [search, setSearch] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const { data = [], isLoading, isError, refetch } = useQuery<AuditLogEntry[]>({
    queryKey: ["superadmin-audit-logs", entityTypeFilter, actionFilter],
    queryFn: () => {
      const params = new URLSearchParams({ limit: "200" });
      if (entityTypeFilter) params.set("entity_type", entityTypeFilter);
      if (actionFilter)     params.set("action", actionFilter);
      return apiJson<AuditLogEntry[]>(`/api/superadmin/audit-logs?${params}`);
    },
  });

  const filtered = data.filter((entry) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      entry.actor_email.toLowerCase().includes(q) ||
      (entry.entity_id ?? "").toLowerCase().includes(q) ||
      (entry.club_name ?? "").toLowerCase().includes(q) ||
      (entry.provider_name ?? "").toLowerCase().includes(q)
    );
  });

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const entityLabel = (entry: AuditLogEntry) => {
    if (entry.club_name)     return entry.club_name;
    if (entry.provider_name) return entry.provider_name;
    if (entry.entity_id)     return entry.entity_id.slice(0, 8) + "…";
    return <span className="opacity-40">–</span>;
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Audit-Log</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          {isLoading
            ? "Lade …"
            : `${filtered.length} Eintr${filtered.length !== 1 ? "äge" : "ag"}${data.length !== filtered.length ? ` von ${data.length}` : ""}`}
        </p>
      </div>

      {/* Freitext-Suche */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Suche nach Admin, Verein, Entity-ID …"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Filter-Chips: Entity-Typ */}
      <div className="flex flex-wrap gap-2">
        {ENTITY_FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setEntityTypeFilter(key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              entityTypeFilter === key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Filter-Chips: Aktion */}
      <div className="flex flex-wrap gap-2">
        {ACTION_FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActionFilter(key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              actionFilter === key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Fehler-State */}
      {isError && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Audit-Log konnte nicht geladen werden.</span>
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
                <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">Zeitpunkt</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">Admin</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">Aktion</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">Typ</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">Entity</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">IP</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground whitespace-nowrap">Details</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}

              {!isLoading && !isError && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center text-muted-foreground">
                    <ScrollText className="w-8 h-8 opacity-30 mx-auto mb-2" />
                    <p className="font-medium">Noch keine Audit-Einträge vorhanden.</p>
                    <p className="text-xs mt-1 max-w-xs mx-auto">
                      Sobald Superadmin-Aktionen durchgeführt werden, erscheinen sie hier.
                    </p>
                  </td>
                </tr>
              )}

              {!isLoading && filtered.map((entry) => {
                const isExpanded = expandedIds.has(entry.id);
                return [
                  <tr
                    key={entry.id}
                    className={`border-b border-border last:border-0 transition-colors ${isExpanded ? "bg-muted/10" : "hover:bg-muted/30"}`}
                  >
                    {/* Zeitpunkt */}
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {format(new Date(entry.created_at), "dd.MM.yyyy HH:mm", { locale: de })}
                    </td>

                    {/* Admin */}
                    <td className="px-4 py-3 max-w-[180px]">
                      <p className="truncate text-foreground" title={entry.actor_email}>
                        {entry.actor_email}
                      </p>
                    </td>

                    {/* Aktion */}
                    <td className="px-4 py-3">
                      <ActionBadge action={entry.action} />
                    </td>

                    {/* Typ */}
                    <td className="px-4 py-3">
                      <EntityTypeBadge type={entry.entity_type} />
                    </td>

                    {/* Entity */}
                    <td className="px-4 py-3 max-w-[160px]">
                      <p className="truncate text-foreground text-sm" title={entry.club_name ?? entry.provider_name ?? entry.entity_id ?? ""}>
                        {entityLabel(entry)}
                      </p>
                    </td>

                    {/* IP */}
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs whitespace-nowrap">
                      {entry.ip_address ?? <span className="opacity-40">–</span>}
                    </td>

                    {/* Details-Toggle */}
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => toggleExpanded(entry.id)}
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        aria-label={isExpanded ? "Details ausblenden" : "Details anzeigen"}
                      >
                        {isExpanded ? (
                          <><ChevronUp className="w-3.5 h-3.5" /> Schließen</>
                        ) : (
                          <><ChevronDown className="w-3.5 h-3.5" /> Details</>
                        )}
                      </button>
                    </td>
                  </tr>,
                  isExpanded && <DetailPanel key={`${entry.id}-detail`} entry={entry} />,
                ];
              })}
            </tbody>
          </table>
        </div>

        {!isLoading && !isError && data.length === 200 && (
          <div className="px-4 py-2.5 text-xs text-muted-foreground border-t border-border">
            Es werden maximal 200 Einträge angezeigt. Nutze die Filter, um gezielt zu suchen.
          </div>
        )}
      </div>
    </div>
  );
};

export default SuperadminAuditLogs;
