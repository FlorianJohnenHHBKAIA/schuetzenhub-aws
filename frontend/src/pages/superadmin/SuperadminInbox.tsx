import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import {
  Building2, Copy, CheckCircle2, Loader2, Inbox,
  UserPlus, MessageCircle, ClipboardList, ChevronDown, KeyRound,
} from "lucide-react";
import { apiJson } from "@/integrations/api/client";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

// ── Types ────────────────────────────────────────────────────────────────────

type InboxItemStatus = "new" | "in_progress" | "done" | "archived" | "open" | "approved" | "rejected";
type InboxItemType = "membership_interest" | "club_contact" | "claim" | "access_request";
type InboxItemSource = "interest" | "claim" | "access";

interface InboxItem {
  id: string;
  source: InboxItemSource;
  type: InboxItemType;
  clubId: string;
  clubName: string;
  clubSlug: string;
  name: string;
  email: string;
  phone: string | null;
  message: string | null;
  status: InboxItemStatus;
  createdAt: string;
  internalNote: string | null;
}

// ── Badge helpers ─────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<InboxItemType, string> = {
  membership_interest: "Mitgliedschaft",
  club_contact: "Kontakt",
  claim: "Übernahme",
  access_request: "Zugang",
};

const TYPE_COLORS: Record<InboxItemType, string> = {
  membership_interest: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  club_contact: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  claim: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  access_request: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
};

const STATUS_LABELS: Record<string, string> = {
  new: "Neu", in_progress: "In Bearbeitung", done: "Erledigt", archived: "Archiviert",
  open: "Offen", approved: "Genehmigt", rejected: "Abgelehnt",
};

const STATUS_COLORS: Record<string, string> = {
  new: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  done: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  archived: "bg-muted text-muted-foreground",
  open: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  approved: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  rejected: "bg-destructive/10 text-destructive",
};

const TypeBadge = ({ type }: { type: InboxItemType }) => (
  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium shrink-0 ${TYPE_COLORS[type]}`}>
    {TYPE_LABELS[type]}
  </span>
);

const StatusBadge = ({ status }: { status: string }) => (
  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium shrink-0 ${STATUS_COLORS[status] ?? "bg-muted text-muted-foreground"}`}>
    {STATUS_LABELS[status] ?? status}
  </span>
);

// ── Filter tabs ───────────────────────────────────────────────────────────────

const STATUS_FILTERS = [
  { value: "all", label: "Alle" },
  { value: "new", label: "Neu" },
  { value: "in_progress", label: "In Bearbeitung" },
  { value: "done", label: "Erledigt" },
  { value: "archived", label: "Archiviert" },
];

const TYPE_FILTERS = [
  { value: "all", label: "Alle Typen" },
  { value: "membership_interest", label: "Mitgliedschaft" },
  { value: "club_contact", label: "Kontakt" },
  { value: "claim", label: "Übernahme" },
  { value: "access_request", label: "Zugangsanfragen" },
];

// ── Row component ─────────────────────────────────────────────────────────────

const InboxRow = ({
  item,
  onStatusChange,
  onNoteChange,
  isPending,
}: {
  item: InboxItem;
  onStatusChange: (id: string, source: InboxItemSource, status: string) => void;
  onNoteChange: (id: string, source: InboxItemSource, note: string) => void;
  isPending: boolean;
}) => {
  const navigate = useNavigate();
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteValue, setNoteValue] = useState(item.internalNote ?? "");
  const [copied, setCopied] = useState(false);

  function copyEmail() {
    navigator.clipboard.writeText(item.email);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function saveNote() {
    onNoteChange(item.id, item.source, noteValue);
    setNoteOpen(false);
  }

  const isClaimItem = item.source === "claim" && item.type !== "access_request";

  return (
    <div className="border-b border-border last:border-0">
      <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-start gap-3">
        {/* Type + Club */}
        <div className="flex items-start gap-2 sm:w-52 shrink-0">
          <TypeBadge type={item.type} />
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0 space-y-0.5">
          <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
          <p className="text-xs text-muted-foreground truncate">{item.clubName}</p>
          {item.message && (
            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{item.message}</p>
          )}
        </div>

        {/* Meta */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <StatusBadge status={item.status} />
          <p className="text-xs text-muted-foreground">
            {format(new Date(item.createdAt), "dd.MM.yyyy", { locale: de })}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {!isClaimItem && (
            <Select
              value={item.status}
              onValueChange={(v) => onStatusChange(item.id, item.source, v)}
              disabled={isPending}
            >
              <SelectTrigger className="h-7 w-36 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">Neu</SelectItem>
                <SelectItem value="in_progress">In Bearbeitung</SelectItem>
                <SelectItem value="done">Erledigt</SelectItem>
                <SelectItem value="archived">Archiviert</SelectItem>
              </SelectContent>
            </Select>
          )}

          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            title="E-Mail kopieren"
            onClick={copyEmail}
          >
            {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
          </Button>

          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            title="Zum Verein"
            onClick={() => navigate(`/superadmin/clubs/${item.clubId}`)}
          >
            <Building2 className="w-3.5 h-3.5" />
          </Button>

          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            title="Interne Notiz"
            onClick={() => setNoteOpen((o) => !o)}
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${noteOpen ? "rotate-180" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Phone */}
      {item.phone && (
        <p className="px-4 pb-1 text-xs text-muted-foreground">Tel: {item.phone}</p>
      )}

      {/* Note panel */}
      {noteOpen && (
        <div className="px-4 pb-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Interne Notiz</p>
          <Textarea
            value={noteValue}
            onChange={(e) => setNoteValue(e.target.value)}
            placeholder="Notiz für das Team…"
            rows={2}
            className="text-sm resize-none"
          />
          <div className="flex gap-2">
            <Button size="sm" className="h-7 text-xs" onClick={saveNote} disabled={isPending}>
              {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Speichern"}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setNoteOpen(false)}>
              Abbrechen
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

const SuperadminInbox = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeStatus = searchParams.get("status") ?? "all";
  const activeType = searchParams.get("type") ?? "all";
  const clubIdFilter = searchParams.get("club_id") ?? undefined;

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value === "all") next.delete(key);
    else next.set(key, value);
    setSearchParams(next);
  }

  // ── Query ─────────────────────────────────────────────────────────────────

  const params = new URLSearchParams();
  if (activeStatus !== "all") params.set("status", activeStatus);
  if (activeType !== "all") params.set("type", activeType);
  if (clubIdFilter) params.set("club_id", clubIdFilter);

  const { data: items = [], isLoading, isError } = useQuery<InboxItem[]>({
    queryKey: ["superadmin-inbox", activeStatus, activeType, clubIdFilter],
    queryFn: () => apiJson<InboxItem[]>(`/api/superadmin/inbox?${params.toString()}`),
    select: (rows) => rows.map((r) => ({
      ...r,
      clubId: (r as unknown as Record<string, string>)["club_id"] ?? r.clubId,
      clubName: (r as unknown as Record<string, string>)["club_name"] ?? r.clubName,
      clubSlug: (r as unknown as Record<string, string>)["club_slug"] ?? r.clubSlug,
      internalNote: (r as unknown as Record<string, string | null>)["internal_note"] ?? r.internalNote,
      createdAt: (r as unknown as Record<string, string>)["created_at"] ?? r.createdAt,
    })),
  });

  // ── Mutations ─────────────────────────────────────────────────────────────

  const { mutate: patchItem, isPending } = useMutation({
    mutationFn: ({ id, source, body }: { id: string; source: InboxItemSource; body: Record<string, unknown> }) => {
      const segment = source === "claim" ? "claim" : source === "access" ? "access" : "interest";
      return apiJson(`/api/superadmin/inbox/${segment}/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["superadmin-inbox"] }),
  });

  function handleStatusChange(id: string, source: InboxItemSource, status: string) {
    patchItem({ id, source, body: { status } });
  }

  function handleNoteChange(id: string, source: InboxItemSource, note: string) {
    patchItem({ id, source, body: { internal_note: note } });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Inbox className="w-6 h-6" /> Inbox
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Öffentliche Anfragen – Mitgliedschaft, Kontakt, Übernahme, Zugang
            {clubIdFilter && (
              <span className="ml-2 text-xs bg-muted px-1.5 py-0.5 rounded">
                Gefiltert nach Verein
                <button className="ml-1 hover:text-foreground" onClick={() => { const n = new URLSearchParams(searchParams); n.delete("club_id"); setSearchParams(n); }}>×</button>
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => navigate("/superadmin/claim-requests")}>
            <ClipboardList className="w-4 h-4 mr-1.5" /> Übernahmeanfragen
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Status filter */}
        <div className="flex rounded-lg border border-border overflow-hidden text-sm">
          {STATUS_FILTERS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setFilter("status", value)}
              className={`px-3 py-1.5 transition-colors ${
                activeStatus === value
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:bg-muted/50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Type filter */}
        <div className="flex rounded-lg border border-border overflow-hidden text-sm">
          {TYPE_FILTERS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setFilter("type", value)}
              className={`px-3 py-1.5 transition-colors ${
                activeType === value
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:bg-muted/50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats chips */}
      <div className="flex gap-3 flex-wrap text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><UserPlus className="w-3.5 h-3.5" />{items.filter(i => i.type === "membership_interest").length} Mitgliedschaft</span>
        <span className="flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5" />{items.filter(i => i.type === "club_contact").length} Kontakt</span>
        <span className="flex items-center gap-1"><ClipboardList className="w-3.5 h-3.5" />{items.filter(i => i.type === "claim").length} Übernahme</span>
        <span className="flex items-center gap-1"><KeyRound className="w-3.5 h-3.5" />{items.filter(i => i.type === "access_request").length} Zugang</span>
      </div>

      {/* Table */}
      <div className="bg-card border rounded-xl overflow-hidden">
        {/* Desktop header */}
        <div className="hidden sm:grid px-4 py-2 bg-muted/30 border-b border-border text-xs font-medium text-muted-foreground"
          style={{ gridTemplateColumns: "120px 1fr 160px 200px" }}>
          <span>Typ</span>
          <span>Anfrage</span>
          <span className="text-right">Datum / Status</span>
          <span className="text-right">Aktionen</span>
        </div>

        {/* Loading */}
        {isLoading && Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0">
            <div className="h-5 w-24 bg-muted rounded animate-pulse shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 bg-muted rounded animate-pulse w-2/3" />
              <div className="h-3 bg-muted rounded animate-pulse w-1/3" />
            </div>
            <div className="h-5 w-16 bg-muted rounded animate-pulse shrink-0" />
          </div>
        ))}

        {/* Error */}
        {isError && (
          <div className="px-4 py-10 text-center text-destructive text-sm">
            Fehler beim Laden der Anfragen.
          </div>
        )}

        {/* Empty */}
        {!isLoading && !isError && items.length === 0 && (
          <div className="px-4 py-12 text-center text-muted-foreground text-sm">
            <Inbox className="w-8 h-8 mx-auto mb-2 opacity-30" />
            Keine Anfragen gefunden.
          </div>
        )}

        {/* Items */}
        {!isLoading && items.map((item) => (
          <InboxRow
            key={`${item.source}-${item.id}`}
            item={item}
            onStatusChange={handleStatusChange}
            onNoteChange={handleNoteChange}
            isPending={isPending}
          />
        ))}
      </div>
    </div>
  );
};

export default SuperadminInbox;
