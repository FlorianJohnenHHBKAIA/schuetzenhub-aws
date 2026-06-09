import { useState, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  useDroppable,
  useDraggable,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowLeft, Euro, Users, Star, Heart, Trash2, Plus, Loader2,
  Pencil, GripVertical, Search, CheckCircle, X, Send, Mail,
  Eye, Archive, Info, Circle, CircleCheck, AlertTriangle,
  ClipboardList, User,
} from "lucide-react";
import { apiJson, getStorageUrl } from "@/integrations/api/client";
import { useAuth } from "@/lib/auth";
import PortalLayout from "@/components/portal/PortalLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FestivalDetail {
  id: string;
  title: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  planned_total: number;
  actual_total: number;
  provider_counts: Record<string, number>;
  created_at: string;
}

interface ShortlistEntry {
  id: string;
  festival_id: string;
  provider_id: string;
  status: string;
  notes: string | null;
  rating: number | null;
  is_favorite: boolean;
  company_name: string;
  provider_type: string;
  city: string | null;
  state: string | null;
  logo_path: string | null;
  logo_url: string | null;
  slug: string;
}

interface BudgetItem {
  id: string;
  festival_id: string;
  category: string;
  description: string | null;
  planned_amount: number | null;
  actual_amount: number | null;
}

interface InquiryRow {
  id: string;
  festival_id: string;
  provider_id: string;
  subject: string | null;
  message: string | null;
  status: string;
  sent_at: string | null;
  company_name: string;
  email: string | null;
  created_at: string;
  info?: string;
}

interface TaskRow {
  id: string;
  festival_id: string;
  title: string;
  description: string | null;
  category: string | null;
  status: string;
  priority: string;
  assigned_to: string | null;
  assigned_name: string | null;
  due_date: string | null;
  created_at: string;
}

interface MemberOption {
  id: string;
  first_name: string;
  last_name: string;
  status?: string;
}

interface PublicProvider {
  id: string;
  company_name: string;
  provider_type: string;
  city: string | null;
  slug: string;
  logo_url: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const KANBAN_COLUMNS = [
  { id: "angefragt",        label: "Angefragt" },
  { id: "in_verhandlung",   label: "In Verhandlung" },
  { id: "angebot_erhalten", label: "Angebot erhalten" },
  { id: "beauftragt",       label: "Beauftragt" },
  { id: "abgelehnt",        label: "Abgelehnt" },
];

const COLUMN_COLORS: Record<string, string> = {
  angefragt:        "bg-blue-500/10 border-blue-500/20",
  in_verhandlung:   "bg-amber-500/10 border-amber-500/20",
  angebot_erhalten: "bg-violet-500/10 border-violet-500/20",
  beauftragt:       "bg-green-500/10 border-green-500/20",
  abgelehnt:        "bg-red-500/10 border-red-500/20",
};

const HEADER_COLORS: Record<string, string> = {
  angefragt:        "text-blue-500",
  in_verhandlung:   "text-amber-500",
  angebot_erhalten: "text-violet-500",
  beauftragt:       "text-green-500",
  abgelehnt:        "text-red-500",
};

const STATUS_LABELS: Record<string, string> = {
  planning: "Planung", preparation: "Vorbereitung", confirmed: "Bestätigt", completed: "Abgeschlossen",
};
const STATUS_COLORS: Record<string, string> = {
  planning:    "bg-blue-500/15 text-blue-400 border-blue-500/30",
  preparation: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  confirmed:   "bg-green-500/15 text-green-400 border-green-500/30",
  completed:   "bg-muted/50 text-muted-foreground border-border",
};

const BUDGET_CATEGORIES = [
  "Schausteller", "Getränke", "Catering", "Musik", "Sicherheit",
  "Technik", "Dekoration", "Sonstiges",
];

const INQUIRY_STATUS_META: Record<string, { label: string; color: string }> = {
  draft:    { label: "Entwurf",          color: "bg-muted/50 text-muted-foreground border-border" },
  sent:     { label: "Gesendet",         color: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  replied:  { label: "Antwort erhalten", color: "bg-violet-500/15 text-violet-400 border-violet-500/30" },
  accepted: { label: "Angenommen",       color: "bg-green-500/15 text-green-400 border-green-500/30" },
  declined: { label: "Abgelehnt",        color: "bg-red-500/15 text-red-400 border-red-500/30" },
  archived: { label: "Archiviert",       color: "bg-muted/30 text-muted-foreground/50 border-border" },
};

const TASK_CATEGORIES = [
  "Allgemein", "Genehmigungen", "Schausteller", "Getränke", "Catering",
  "Musik", "Sicherheit", "Technik", "Dekoration", "Helfer", "Kommunikation", "Sonstiges",
];

const TASK_STATUS_META: Record<string, { label: string; color: string }> = {
  open:        { label: "Offen",      color: "bg-muted/30 text-muted-foreground border-border" },
  in_progress: { label: "In Arbeit",  color: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  done:        { label: "Erledigt",   color: "bg-green-500/15 text-green-400 border-green-500/30" },
  archived:    { label: "Archiviert", color: "bg-muted/20 text-muted-foreground/50 border-border" },
};

const PRIORITY_META: Record<string, { label: string; color: string }> = {
  low:    { label: "Niedrig",  color: "text-muted-foreground/60" },
  normal: { label: "Normal",   color: "text-blue-400" },
  high:   { label: "Hoch",     color: "text-amber-400" },
  urgent: { label: "Dringend", color: "text-red-400" },
};

function formatEuro(v: number | null | undefined) {
  if (v == null) return "–";
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
}
function formatDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StarRating({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className="focus:outline-none"
        >
          <Star
            className={`w-3.5 h-3.5 ${(value ?? 0) >= n ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`}
          />
        </button>
      ))}
    </div>
  );
}

function ProviderCard({
  item,
  onPatch,
  onRemove,
  onInquire,
  latestInquiry,
}: {
  item: ShortlistEntry;
  onPatch: (id: string, data: Partial<ShortlistEntry>) => void;
  onRemove: (id: string) => void;
  onInquire: (item: ShortlistEntry) => void;
  latestInquiry?: InquiryRow | null;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: item.id });
  const [editNotes, setEditNotes] = useState(false);
  const [notes, setNotes] = useState(item.notes ?? "");
  const logoUrl = item.logo_url || (item.logo_path ? getStorageUrl("provider-assets", item.logo_path) : null);

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-card border border-border rounded-lg p-3 shadow-sm select-none"
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          {...listeners}
          {...attributes}
          className="mt-0.5 cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground shrink-0"
        >
          <GripVertical className="w-4 h-4" />
        </button>

        {logoUrl ? (
          <img src={logoUrl} alt={item.company_name} className="w-8 h-8 rounded-md object-cover border border-border shrink-0" />
        ) : (
          <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center shrink-0">
            <Users className="w-4 h-4 text-muted-foreground/40" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 justify-between">
            <p className="text-sm font-medium text-foreground truncate leading-tight">{item.company_name}</p>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => onPatch(item.id, { is_favorite: !item.is_favorite })}
                className={`${item.is_favorite ? "text-rose-500" : "text-muted-foreground/30 hover:text-rose-400"} transition-colors`}
              >
                <Heart className={`w-3.5 h-3.5 ${item.is_favorite ? "fill-rose-500" : ""}`} />
              </button>
              <button
                type="button"
                onClick={() => onRemove(item.id)}
                className="text-muted-foreground/30 hover:text-destructive transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{item.provider_type}{item.city ? ` · ${item.city}` : ""}</p>
          <div className="mt-1.5">
            <StarRating value={item.rating} onChange={(v) => onPatch(item.id, { rating: v })} />
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="mt-2 pl-6">
        {editNotes ? (
          <div className="space-y-1">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="text-xs"
              placeholder="Notizen…"
              autoFocus
            />
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-xs px-2"
                onClick={() => { onPatch(item.id, { notes }); setEditNotes(false); }}
              >
                <CheckCircle className="w-3 h-3 mr-1" /> Speichern
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-xs px-2"
                onClick={() => { setNotes(item.notes ?? ""); setEditNotes(false); }}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditNotes(true)}
            className="flex items-center gap-1 text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          >
            <Pencil className="w-3 h-3" />
            {item.notes ? <span className="truncate max-w-36">{item.notes}</span> : "Notiz hinzufügen"}
          </button>
        )}
      </div>

      {/* Inquiry badge + action */}
      <div className="mt-2 pl-6 flex items-center justify-between gap-2">
        {latestInquiry ? (
          <span className={`inline-flex items-center text-xs px-1.5 py-0.5 rounded border ${INQUIRY_STATUS_META[latestInquiry.status]?.color ?? ""}`}>
            {INQUIRY_STATUS_META[latestInquiry.status]?.label ?? latestInquiry.status}
            {latestInquiry.sent_at && (
              <span className="ml-1 opacity-70">· {formatDate(latestInquiry.sent_at)}</span>
            )}
          </span>
        ) : (
          <span />
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-6 text-xs px-2 shrink-0"
          onClick={() => onInquire(item)}
        >
          <Send className="w-3 h-3 mr-1" /> Anfrage
        </Button>
      </div>
    </div>
  );
}

function KanbanColumn({
  columnId,
  label,
  items,
  onPatch,
  onRemove,
  onInquire,
  latestInquiryByProvider,
}: {
  columnId: string;
  label: string;
  items: ShortlistEntry[];
  onPatch: (id: string, data: Partial<ShortlistEntry>) => void;
  onRemove: (id: string) => void;
  onInquire: (item: ShortlistEntry) => void;
  latestInquiryByProvider: Map<string, InquiryRow>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: columnId });
  const colCls = COLUMN_COLORS[columnId] ?? "bg-muted/10 border-border";
  const headerCls = HEADER_COLORS[columnId] ?? "text-foreground";

  return (
    <div className={`flex flex-col rounded-xl border ${colCls} ${isOver ? "ring-2 ring-primary/40" : ""} min-w-[220px] flex-1 transition-all`}>
      <div className="px-3 py-2.5 border-b border-inherit flex items-center justify-between gap-2">
        <span className={`text-xs font-semibold uppercase tracking-wide ${headerCls}`}>{label}</span>
        <span className="bg-white/10 text-foreground/60 text-xs px-1.5 py-0.5 rounded-full">{items.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className="flex-1 p-2 space-y-2 overflow-y-auto min-h-[120px]"
      >
        {items.map((item) => (
          <ProviderCard
            key={item.id}
            item={item}
            onPatch={onPatch}
            onRemove={onRemove}
            onInquire={onInquire}
            latestInquiry={latestInquiryByProvider.get(item.provider_id) ?? null}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const FestplanerDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<"anbieter" | "budget" | "anfragen" | "aufgaben">("anbieter");

  // Festival edit dialog
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({ title: "", description: "", start_date: "", end_date: "", status: "" });

  // Add provider dialog
  const [showAddProvider, setShowAddProvider] = useState(false);
  const [providerSearch, setProviderSearch] = useState("");
  const [addError, setAddError] = useState("");

  // Budget dialog
  const [showAddBudget, setShowAddBudget] = useState(false);
  const [editBudgetItem, setEditBudgetItem] = useState<BudgetItem | null>(null);
  const [budgetForm, setBudgetForm] = useState({ category: "", description: "", planned_amount: "", actual_amount: "" });
  const [budgetError, setBudgetError] = useState("");

  // Inquiry dialog
  const [showInquiry, setShowInquiry] = useState(false);
  const [inquiryTarget, setInquiryTarget] = useState<ShortlistEntry | null>(null);
  const [inquiryForm, setInquiryForm] = useState({ subject: "", message: "" });
  const [inquiryInfo, setInquiryInfo] = useState<string | null>(null);
  const [inquiryError, setInquiryError] = useState("");
  // Inquiry detail dialog (Anfragen tab)
  const [viewInquiry, setViewInquiry] = useState<InquiryRow | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  // Task state
  const [taskStatusFilter, setTaskStatusFilter] = useState<string>("active");
  const [taskCategoryFilter, setTaskCategoryFilter] = useState<string>("all");
  const [taskPriorityFilter, setTaskPriorityFilter] = useState<string>("all");
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editTask, setEditTask] = useState<TaskRow | null>(null);
  const [taskForm, setTaskForm] = useState({
    title: "", description: "", category: "", status: "open",
    priority: "normal", assigned_to: "", due_date: "",
  });
  const [taskError, setTaskError] = useState("");

  // DnD
  const [dragActiveId, setDragActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: festival, isLoading: festLoading } = useQuery<FestivalDetail>({
    queryKey: ["festival", id],
    queryFn: () => apiJson<FestivalDetail>(`/api/festplaner/${id}`),
    enabled: !!id && isAdmin,
  });

  const { data: providers = [], isLoading: providersLoading } = useQuery<ShortlistEntry[]>({
    queryKey: ["festival-providers", id],
    queryFn: () => apiJson<ShortlistEntry[]>(`/api/festplaner/${id}/providers`),
    enabled: !!id && isAdmin,
  });

  const { data: budgetItems = [], isLoading: budgetLoading } = useQuery<BudgetItem[]>({
    queryKey: ["festival-budget", id],
    queryFn: () => apiJson<BudgetItem[]>(`/api/festplaner/${id}/budget`),
    enabled: !!id && isAdmin,
  });

  const { data: inquiries = [] } = useQuery<InquiryRow[]>({
    queryKey: ["festival-inquiries", id],
    queryFn: () => apiJson<InquiryRow[]>(`/api/festplaner/${id}/inquiries`),
    enabled: !!id && isAdmin,
  });

  const { data: tasks = [] } = useQuery<TaskRow[]>({
    queryKey: ["festival-tasks", id],
    queryFn: () => apiJson<TaskRow[]>(`/api/festplaner/${id}/tasks`),
    enabled: !!id && isAdmin,
  });

  const { data: members = [] } = useQuery<MemberOption[]>({
    queryKey: ["club-members-light"],
    queryFn: () => apiJson<MemberOption[]>("/api/members"),
    enabled: showTaskForm || !!editTask,
    select: (data: MemberOption[]) => data.filter((m) => m.status !== "resigned"),
  });

  const latestInquiryByProvider = useMemo(() => {
    const map = new Map<string, InquiryRow>();
    for (const inq of inquiries) {
      const existing = map.get(inq.provider_id);
      if (!existing || inq.created_at > existing.created_at) map.set(inq.provider_id, inq);
    }
    return map;
  }, [inquiries]);

  const { data: publicProviders = [], isLoading: searchLoading } = useQuery<PublicProvider[]>({
    queryKey: ["public-providers-search", providerSearch],
    queryFn: () => apiJson<{ providers: PublicProvider[] }>(`/api/public/providers?search=${encodeURIComponent(providerSearch)}&limit=20`)
      .then((r) => {
        if (Array.isArray(r)) return r as unknown as PublicProvider[];
        return (r as { providers: PublicProvider[] }).providers ?? [];
      }),
    enabled: showAddProvider,
  });

  // ── Mutations ──────────────────────────────────────────────────────────────

  const patchFestival = useMutation({
    mutationFn: (data: Partial<FestivalDetail>) =>
      apiJson(`/api/festplaner/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["festival", id] });
      queryClient.invalidateQueries({ queryKey: ["festival-projects"] });
      setShowEdit(false);
    },
  });

  const addProvider = useMutation({
    mutationFn: (provider_id: string) =>
      apiJson(`/api/festplaner/${id}/providers`, { method: "POST", body: JSON.stringify({ provider_id }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["festival-providers", id] });
      queryClient.invalidateQueries({ queryKey: ["festival", id] });
      setShowAddProvider(false);
      setProviderSearch("");
      setAddError("");
    },
    onError: (err: Error) => setAddError(err.message),
  });

  const patchProvider = useMutation({
    mutationFn: ({ shortlistId, data }: { shortlistId: string; data: Partial<ShortlistEntry> }) =>
      apiJson(`/api/festplaner/${id}/providers/${shortlistId}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["festival-providers", id] }),
  });

  const removeProvider = useMutation({
    mutationFn: (shortlistId: string) =>
      apiJson(`/api/festplaner/${id}/providers/${shortlistId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["festival-providers", id] });
      queryClient.invalidateQueries({ queryKey: ["festival", id] });
    },
  });

  const addBudget = useMutation({
    mutationFn: (data: typeof budgetForm) =>
      apiJson(`/api/festplaner/${id}/budget`, { method: "POST", body: JSON.stringify({
        category: data.category,
        description: data.description || null,
        planned_amount: data.planned_amount ? parseFloat(data.planned_amount) : null,
        actual_amount: data.actual_amount ? parseFloat(data.actual_amount) : null,
      })}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["festival-budget", id] });
      queryClient.invalidateQueries({ queryKey: ["festival", id] });
      setShowAddBudget(false);
      setBudgetForm({ category: "", description: "", planned_amount: "", actual_amount: "" });
    },
    onError: (err: Error) => setBudgetError(err.message),
  });

  const patchBudget = useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: typeof budgetForm }) =>
      apiJson(`/api/festplaner/${id}/budget/${itemId}`, { method: "PATCH", body: JSON.stringify({
        category: data.category,
        description: data.description || null,
        planned_amount: data.planned_amount ? parseFloat(data.planned_amount) : null,
        actual_amount: data.actual_amount ? parseFloat(data.actual_amount) : null,
      })}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["festival-budget", id] });
      queryClient.invalidateQueries({ queryKey: ["festival", id] });
      setEditBudgetItem(null);
    },
    onError: (err: Error) => setBudgetError(err.message),
  });

  const deleteBudget = useMutation({
    mutationFn: (itemId: string) =>
      apiJson(`/api/festplaner/${id}/budget/${itemId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["festival-budget", id] });
      queryClient.invalidateQueries({ queryKey: ["festival", id] });
    },
  });

  const createInquiry = useMutation({
    mutationFn: ({ status }: { status: "draft" | "sent" }) =>
      apiJson<InquiryRow>(`/api/festplaner/${id}/inquiries`, {
        method: "POST",
        body: JSON.stringify({ provider_id: inquiryTarget!.provider_id, ...inquiryForm, status }),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["festival-inquiries", id] });
      if (data.info) {
        setInquiryInfo(data.info);
      } else {
        setShowInquiry(false);
        setInquiryTarget(null);
      }
    },
    onError: (err: Error) => setInquiryError(err.message || "Fehler"),
  });

  const patchInquiry = useMutation({
    mutationFn: ({ inquiryId, data }: { inquiryId: string; data: { status?: string; subject?: string; message?: string } }) =>
      apiJson<InquiryRow>(`/api/festplaner/${id}/inquiries/${inquiryId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["festival-inquiries", id] });
      if (viewInquiry?.id === updated.id) setViewInquiry(updated);
    },
  });

  const createTask = useMutation({
    mutationFn: (data: typeof taskForm) =>
      apiJson(`/api/festplaner/${id}/tasks`, { method: "POST", body: JSON.stringify({
        ...data,
        assigned_to: data.assigned_to || null,
        due_date: data.due_date || null,
        category: data.category || null,
        description: data.description || null,
      }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["festival-tasks", id] });
      setShowTaskForm(false);
      setTaskForm({ title: "", description: "", category: "", status: "open", priority: "normal", assigned_to: "", due_date: "" });
      setTaskError("");
    },
    onError: (err: Error) => setTaskError(err.message),
  });

  const patchTask = useMutation({
    mutationFn: ({ taskId, data }: { taskId: string; data: Partial<typeof taskForm> }) =>
      apiJson(`/api/festplaner/${id}/tasks/${taskId}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["festival-tasks", id] });
      setEditTask(null);
      setTaskForm({ title: "", description: "", category: "", status: "open", priority: "normal", assigned_to: "", due_date: "" });
      setTaskError("");
    },
    onError: (err: Error) => setTaskError(err.message),
  });

  const deleteTask = useMutation({
    mutationFn: (taskId: string) =>
      apiJson(`/api/festplaner/${id}/tasks/${taskId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["festival-tasks", id] }),
  });

  // ── DnD handlers ──────────────────────────────────────────────────────────

  function handleDragStart(event: DragStartEvent) {
    setDragActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    setDragActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const draggedItem = providers.find((p) => p.id === active.id);
    const newStatus = over.id as string;
    if (!draggedItem || draggedItem.status === newStatus) return;
    if (!KANBAN_COLUMNS.find((c) => c.id === newStatus)) return;
    patchProvider.mutate({ shortlistId: draggedItem.id, data: { status: newStatus } });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  const openEdit = () => {
    if (!festival) return;
    setEditForm({
      title: festival.title,
      description: festival.description ?? "",
      start_date: festival.start_date?.slice(0, 10) ?? "",
      end_date: festival.end_date?.slice(0, 10) ?? "",
      status: festival.status,
    });
    setShowEdit(true);
  };

  const openEditBudget = (item: BudgetItem) => {
    setEditBudgetItem(item);
    setBudgetError("");
    setBudgetForm({
      category: item.category,
      description: item.description ?? "",
      planned_amount: item.planned_amount != null ? String(item.planned_amount) : "",
      actual_amount: item.actual_amount != null ? String(item.actual_amount) : "",
    });
  };

  const openInquiryDialog = (item: ShortlistEntry) => {
    const dateRange = [formatDate(festival?.start_date ?? null), formatDate(festival?.end_date ?? null)]
      .filter(Boolean).join(" bis ");
    const title = festival?.title ?? "";
    setInquiryTarget(item);
    setInquiryForm({
      subject: `Anfrage für ${title}${dateRange ? " vom " + dateRange : ""}`,
      message: `Guten Tag,\n\nwir planen derzeit unser Fest ${title}${dateRange ? " im Zeitraum " + dateRange : ""} und möchten gerne anfragen, ob Sie für diesen Zeitraum verfügbar sind.\n\nBitte senden Sie uns bei Interesse ein unverbindliches Angebot zu.\n\nMit freundlichen Grüßen`,
    });
    setInquiryInfo(null);
    setInquiryError("");
    setShowInquiry(true);
  };

  // ── Budget sums ────────────────────────────────────────────────────────────

  const plannedTotal = festival?.planned_total ?? 0;
  const actualTotal = festival?.actual_total ?? 0;
  const diff = plannedTotal - actualTotal;

  // ── Task KPIs ──────────────────────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  const tasksOpen    = tasks.filter((t) => t.status === "open").length;
  const tasksOverdue = tasks.filter((t) =>
    t.status !== "done" && t.status !== "archived" && t.due_date && t.due_date < today
  ).length;
  const tasksDone    = tasks.filter((t) => t.status === "done").length;
  const tasksTotal   = tasks.filter((t) => t.status !== "archived").length;
  const tasksActiveBadge = tasks.filter((t) => t.status === "open" || t.status === "in_progress").length;

  // ── Provider already on shortlist ids ─────────────────────────────────────
  const shortlistedIds = new Set(providers.map((p) => p.provider_id));

  // ── Drag overlay item ─────────────────────────────────────────────────────
  const dragItem = dragActiveId ? providers.find((p) => p.id === dragActiveId) : null;

  if (!isAdmin) {
    return (
      <PortalLayout>
        <div className="py-16 text-center text-muted-foreground">
          Nur fuer Vereinsadmins zugaenglich.
        </div>
      </PortalLayout>
    );
  }

  if (festLoading) {
    return (
      <PortalLayout>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </PortalLayout>
    );
  }

  if (!festival) {
    return (
      <PortalLayout>
        <div className="py-16 text-center text-muted-foreground">
          <p>Fest nicht gefunden.</p>
          <Button variant="link" onClick={() => navigate("/portal/festplaner")}>Zurück zum Festplaner</Button>
        </div>
      </PortalLayout>
    );
  }

  const statusCls = STATUS_COLORS[festival.status] ?? STATUS_COLORS.planning;
  const statusLabel = STATUS_LABELS[festival.status] ?? festival.status;
  const beauftragtCount = festival.provider_counts?.beauftragt ?? 0;
  const offenCount = (festival.provider_counts?.angefragt ?? 0) + (festival.provider_counts?.in_verhandlung ?? 0) + (festival.provider_counts?.angebot_erhalten ?? 0);

  return (
    <PortalLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <button
            type="button"
            onClick={() => navigate("/portal/festplaner")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" /> Alle Feste
          </button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-foreground">{festival.title}</h1>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusCls}`}>
              {statusLabel}
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={openEdit} className="gap-1.5">
            <Pencil className="w-3.5 h-3.5" /> Bearbeiten
          </Button>
        </div>
        {(festival.start_date || festival.end_date) && (
          <p className="text-sm text-muted-foreground mt-1">
            {[formatDate(festival.start_date), formatDate(festival.end_date)].filter(Boolean).join(" – ")}
          </p>
        )}
        {festival.description && (
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{festival.description}</p>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-card border rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Geplantes Budget</p>
          <p className="text-lg font-bold text-foreground">{formatEuro(plannedTotal)}</p>
        </div>
        <div className="bg-card border rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Tats. Kosten</p>
          <p className={`text-lg font-bold ${actualTotal > plannedTotal && plannedTotal > 0 ? "text-destructive" : "text-foreground"}`}>
            {formatEuro(actualTotal)}
          </p>
        </div>
        <div className="bg-card border rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Offene Anfragen</p>
          <p className="text-lg font-bold text-foreground">{offenCount}</p>
        </div>
        <div className="bg-card border rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Beauftragt</p>
          <p className="text-lg font-bold text-green-500">{beauftragtCount}</p>
        </div>
      </div>

      {/* Task KPI Row */}
      {tasksTotal > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-card border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <ClipboardList className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Offene Aufgaben</p>
            </div>
            <p className="text-lg font-bold text-foreground">{tasksOpen}</p>
          </div>
          <div className="bg-card border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Überfällig</p>
            </div>
            <p className={`text-lg font-bold ${tasksOverdue > 0 ? "text-destructive" : "text-foreground"}`}>{tasksOverdue}</p>
          </div>
          <div className="bg-card border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <CircleCheck className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Erledigt</p>
            </div>
            <p className="text-lg font-bold text-green-500">{tasksDone}</p>
          </div>
          <div className="bg-card border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Circle className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Gesamt</p>
            </div>
            <p className="text-lg font-bold text-foreground">{tasksTotal}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      {(() => {
        const activeInquiryCount = inquiries.filter((q) => q.status !== "archived" && q.status !== "draft").length;
        return (
          <div className="flex gap-1 border-b border-border">
            {(["anbieter", "budget", "anfragen", "aufgaben"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === tab
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab === "anbieter" ? "Anbieter" : tab === "budget" ? "Budget" : tab === "anfragen" ? "Anfragen" : "Aufgaben"}
                {tab === "anfragen" && activeInquiryCount > 0 && (
                  <span className="bg-blue-500/20 text-blue-400 text-xs px-1.5 py-0.5 rounded-full font-normal">
                    {activeInquiryCount}
                  </span>
                )}
                {tab === "aufgaben" && tasksActiveBadge > 0 && (
                  <span className="bg-amber-500/20 text-amber-400 text-xs px-1.5 py-0.5 rounded-full font-normal">
                    {tasksActiveBadge}
                  </span>
                )}
              </button>
            ))}
          </div>
        );
      })()}

      {/* ── TAB: ANBIETER ─────────────────────────────────────────────────── */}
      {activeTab === "anbieter" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { setShowAddProvider(true); setAddError(""); setProviderSearch(""); }} className="gap-2">
              <Plus className="w-4 h-4" /> Anbieter hinzufügen
            </Button>
          </div>

          {providersLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div className="flex gap-3 overflow-x-auto pb-4">
                {KANBAN_COLUMNS.map((col) => (
                  <KanbanColumn
                    key={col.id}
                    columnId={col.id}
                    label={col.label}
                    items={providers.filter((p) => p.status === col.id)}
                    onPatch={(sid, data) => patchProvider.mutate({ shortlistId: sid, data })}
                    onRemove={(sid) => removeProvider.mutate(sid)}
                    onInquire={openInquiryDialog}
                    latestInquiryByProvider={latestInquiryByProvider}
                  />
                ))}
              </div>
              <DragOverlay>
                {dragItem ? (
                  <div className="bg-card border border-primary/50 rounded-lg p-3 shadow-xl opacity-90 w-52">
                    <p className="text-sm font-medium text-foreground truncate">{dragItem.company_name}</p>
                    <p className="text-xs text-muted-foreground">{dragItem.provider_type}</p>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          )}
        </div>
      )}

      {/* ── TAB: BUDGET ───────────────────────────────────────────────────── */}
      {activeTab === "budget" && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground bg-muted/30 border rounded-xl px-4 py-3">
            <span>Geplant: <strong className="text-foreground">{formatEuro(plannedTotal)}</strong></span>
            <span>Tatsächlich: <strong className="text-foreground">{formatEuro(actualTotal)}</strong></span>
            <span>
              Differenz:{" "}
              <strong className={diff < 0 ? "text-destructive" : "text-green-500"}>
                {diff >= 0 ? "+" : ""}{formatEuro(diff)}
              </strong>
            </span>
            <div className="ml-auto">
              <Button
                onClick={() => { setShowAddBudget(true); setBudgetError(""); setBudgetForm({ category: "", description: "", planned_amount: "", actual_amount: "" }); }}
                className="gap-2"
                size="sm"
              >
                <Plus className="w-3.5 h-3.5" /> Position hinzufügen
              </Button>
            </div>
          </div>

          {budgetLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : budgetItems.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <Euro className="w-10 h-10 mx-auto opacity-20 mb-3" />
              <p className="text-sm">Noch keine Budgetpositionen angelegt.</p>
            </div>
          ) : (
            <div className="bg-card border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/30 border-b border-border text-xs text-muted-foreground uppercase tracking-wide">
                    <th className="text-left px-4 py-3 font-medium">Kategorie</th>
                    <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Beschreibung</th>
                    <th className="text-right px-4 py-3 font-medium">Geplant</th>
                    <th className="text-right px-4 py-3 font-medium">Tatsächlich</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {budgetItems.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/10 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">{item.category}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{item.description ?? "–"}</td>
                      <td className="px-4 py-3 text-right text-foreground">{formatEuro(item.planned_amount)}</td>
                      <td className="px-4 py-3 text-right text-foreground">{formatEuro(item.actual_amount)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEditBudget(item)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive/70 hover:text-destructive" onClick={() => deleteBudget.mutate(item.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: ANFRAGEN ─────────────────────────────────────────────────── */}
      {activeTab === "anfragen" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {inquiries.filter((q) => q.status !== "archived").length} Anfrage(n)
            </p>
            <button
              type="button"
              onClick={() => setShowArchived((v) => !v)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {showArchived ? "Archivierte ausblenden" : "Archivierte anzeigen"}
            </button>
          </div>

          {inquiries.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <Mail className="w-10 h-10 mx-auto opacity-20 mb-3" />
              <p className="text-sm">Noch keine Anfragen erstellt.</p>
              <p className="text-xs mt-1 opacity-70">Öffnen Sie eine Anbieterkarte im Kanban und klicken Sie auf "Anfrage".</p>
            </div>
          ) : (
            <div className="bg-card border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/30 border-b border-border text-xs text-muted-foreground uppercase tracking-wide">
                    <th className="text-left px-4 py-3 font-medium">Anbieter</th>
                    <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Betreff</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Gesendet am</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {inquiries
                    .filter((q) => showArchived || q.status !== "archived")
                    .map((inq) => {
                      const meta = INQUIRY_STATUS_META[inq.status] ?? INQUIRY_STATUS_META.draft;
                      return (
                        <tr key={inq.id} className="hover:bg-muted/10 transition-colors">
                          <td className="px-4 py-3 font-medium text-foreground">{inq.company_name}</td>
                          <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell max-w-xs truncate">
                            {inq.subject ?? "–"}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full border ${meta.color}`}>
                              {meta.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                            {inq.sent_at ? formatDate(inq.sent_at) : "–"}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm" variant="ghost" className="h-7 px-2 gap-1 text-xs"
                                onClick={() => setViewInquiry(inq)}
                              >
                                <Eye className="w-3.5 h-3.5" /> Ansehen
                              </Button>
                              {inq.status !== "archived" && (
                                <Button
                                  size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground/60 hover:text-foreground"
                                  onClick={() => patchInquiry.mutate({ inquiryId: inq.id, data: { status: "archived" } })}
                                >
                                  <Archive className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: AUFGABEN ─────────────────────────────────────────────────── */}
      {activeTab === "aufgaben" && (
        <div className="space-y-4">
          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-2">
            <Select value={taskStatusFilter} onValueChange={setTaskStatusFilter}>
              <SelectTrigger className="h-8 text-xs w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Aktiv</SelectItem>
                <SelectItem value="open">Offen</SelectItem>
                <SelectItem value="in_progress">In Arbeit</SelectItem>
                <SelectItem value="done">Erledigt</SelectItem>
                <SelectItem value="archived">Archiviert</SelectItem>
                <SelectItem value="all">Alle</SelectItem>
              </SelectContent>
            </Select>
            <Select value={taskCategoryFilter} onValueChange={setTaskCategoryFilter}>
              <SelectTrigger className="h-8 text-xs w-40">
                <SelectValue placeholder="Kategorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Kategorien</SelectItem>
                {TASK_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={taskPriorityFilter} onValueChange={setTaskPriorityFilter}>
              <SelectTrigger className="h-8 text-xs w-36">
                <SelectValue placeholder="Priorität" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Prioritäten</SelectItem>
                {Object.entries(PRIORITY_META).map(([v, m]) => (
                  <SelectItem key={v} value={v}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="ml-auto">
              <Button
                size="sm"
                className="gap-1.5 h-8"
                onClick={() => {
                  setEditTask(null);
                  setTaskForm({ title: "", description: "", category: "", status: "open", priority: "normal", assigned_to: "", due_date: "" });
                  setTaskError("");
                  setShowTaskForm(true);
                }}
              >
                <Plus className="w-3.5 h-3.5" /> Aufgabe anlegen
              </Button>
            </div>
          </div>

          {/* Task list */}
          {(() => {
            const filtered = tasks.filter((t) => {
              if (taskStatusFilter === "active") return t.status === "open" || t.status === "in_progress";
              if (taskStatusFilter !== "all") return t.status === taskStatusFilter;
              return true;
            }).filter((t) => {
              if (taskCategoryFilter !== "all") return t.category === taskCategoryFilter;
              return true;
            }).filter((t) => {
              if (taskPriorityFilter !== "all") return t.priority === taskPriorityFilter;
              return true;
            });

            if (tasks.length === 0) {
              return (
                <div className="py-16 text-center text-muted-foreground">
                  <ClipboardList className="w-10 h-10 mx-auto opacity-20 mb-3" />
                  <p className="text-sm">Noch keine Aufgaben angelegt.</p>
                  <p className="text-xs mt-1 opacity-70">Legen Sie Aufgaben an oder nutzen Sie die Standard-Checkliste.</p>
                </div>
              );
            }

            if (filtered.length === 0) {
              return (
                <div className="py-12 text-center text-muted-foreground">
                  <p className="text-sm">Keine Aufgaben gefunden.</p>
                </div>
              );
            }

            return (
              <div className="space-y-2">
                {filtered.map((task) => {
                  const isOverdue = task.status !== "done" && task.status !== "archived" && task.due_date && task.due_date < today;
                  const statusMeta = TASK_STATUS_META[task.status] ?? TASK_STATUS_META.open;
                  const priorityMeta = PRIORITY_META[task.priority] ?? PRIORITY_META.normal;
                  const isDone = task.status === "done";

                  return (
                    <div
                      key={task.id}
                      className={`bg-card border rounded-xl px-4 py-3 flex items-start gap-3 transition-colors ${
                        task.status === "archived" ? "opacity-50" : ""
                      }`}
                    >
                      {/* Quick-complete toggle */}
                      <button
                        type="button"
                        className={`mt-0.5 shrink-0 transition-colors ${isDone ? "text-green-500" : "text-muted-foreground/40 hover:text-green-500"}`}
                        onClick={() => patchTask.mutate({ taskId: task.id, data: { status: isDone ? "open" : "done" } })}
                      >
                        {isDone ? <CircleCheck className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm font-medium leading-snug ${isDone ? "line-through text-muted-foreground" : "text-foreground"}`}>
                            {task.title}
                          </p>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className={`text-xs font-medium ${priorityMeta.color}`}>{priorityMeta.label}</span>
                            <Button
                              size="sm" variant="ghost" className="h-7 w-7 p-0"
                              onClick={() => {
                                setEditTask(task);
                                setTaskForm({
                                  title: task.title,
                                  description: task.description ?? "",
                                  category: task.category ?? "",
                                  status: task.status,
                                  priority: task.priority,
                                  assigned_to: task.assigned_to ?? "",
                                  due_date: task.due_date ?? "",
                                });
                                setTaskError("");
                                setShowTaskForm(true);
                              }}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive/50 hover:text-destructive"
                              onClick={() => deleteTask.mutate(task.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                          <span className={`inline-flex items-center text-xs px-1.5 py-0.5 rounded border ${statusMeta.color}`}>
                            {statusMeta.label}
                          </span>
                          {task.category && (
                            <span className="text-xs text-muted-foreground">{task.category}</span>
                          )}
                          {task.due_date && (
                            <span className={`text-xs ${isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                              {isOverdue && <AlertTriangle className="w-3 h-3 inline mr-0.5" />}
                              Fällig: {formatDate(task.due_date)}
                            </span>
                          )}
                          {task.assigned_name && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <User className="w-3 h-3" /> {task.assigned_name}
                            </span>
                          )}
                        </div>
                        {task.description && (
                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{task.description}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* ── Edit Festival Dialog ───────────────────────────────────────────── */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Fest bearbeiten</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Titel *</Label>
              <Input value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={editForm.status} onValueChange={(v) => setEditForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Beschreibung</Label>
              <Textarea value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Startdatum</Label>
                <Input type="date" value={editForm.start_date} onChange={(e) => setEditForm((f) => ({ ...f, start_date: e.target.value }))} />
              </div>
              <div>
                <Label>Enddatum</Label>
                <Input type="date" value={editForm.end_date} onChange={(e) => setEditForm((f) => ({ ...f, end_date: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEdit(false)}>Abbrechen</Button>
            <Button
              onClick={() => patchFestival.mutate(editForm)}
              disabled={patchFestival.isPending || !editForm.title.trim()}
            >
              {patchFestival.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Provider Dialog ────────────────────────────────────────────── */}
      <Dialog open={showAddProvider} onOpenChange={setShowAddProvider}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Anbieter hinzufügen</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={providerSearch}
                onChange={(e) => setProviderSearch(e.target.value)}
                placeholder="Anbieter suchen…"
                className="pl-9"
                autoFocus
              />
            </div>
            {addError && <p className="text-sm text-destructive">{addError}</p>}
            <div className="max-h-80 overflow-y-auto space-y-1">
              {searchLoading ? (
                <div className="py-6 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : publicProviders.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Keine Anbieter gefunden.</p>
              ) : (
                publicProviders.map((p) => {
                  const already = shortlistedIds.has(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={already || addProvider.isPending}
                      onClick={() => addProvider.mutate(p.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                        already
                          ? "opacity-40 cursor-not-allowed"
                          : "hover:bg-muted/50 cursor-pointer"
                      }`}
                    >
                      {p.logo_url ? (
                        <img src={p.logo_url} alt="" className="w-8 h-8 rounded-md object-cover border border-border shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-md bg-muted shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{p.company_name}</p>
                        <p className="text-xs text-muted-foreground">{p.provider_type}{p.city ? ` · ${p.city}` : ""}</p>
                      </div>
                      {already && <span className="text-xs text-muted-foreground shrink-0">Bereits hinzugefügt</span>}
                    </button>
                  );
                })
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddProvider(false)}>Schließen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add/Edit Budget Dialog ─────────────────────────────────────────── */}
      <Dialog open={showAddBudget || !!editBudgetItem} onOpenChange={(o) => { if (!o) { setShowAddBudget(false); setEditBudgetItem(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editBudgetItem ? "Position bearbeiten" : "Budgetposition hinzufügen"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Kategorie *</Label>
              <Select value={budgetForm.category} onValueChange={(v) => setBudgetForm((f) => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue placeholder="Kategorie wählen…" /></SelectTrigger>
                <SelectContent>
                  {BUDGET_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Beschreibung</Label>
              <Input value={budgetForm.description} onChange={(e) => setBudgetForm((f) => ({ ...f, description: e.target.value }))} placeholder="z.B. Festzelt 20×40m" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Geplant (€)</Label>
                <Input type="number" min="0" step="0.01" value={budgetForm.planned_amount} onChange={(e) => setBudgetForm((f) => ({ ...f, planned_amount: e.target.value }))} placeholder="0,00" />
              </div>
              <div>
                <Label>Tatsächlich (€)</Label>
                <Input type="number" min="0" step="0.01" value={budgetForm.actual_amount} onChange={(e) => setBudgetForm((f) => ({ ...f, actual_amount: e.target.value }))} placeholder="0,00" />
              </div>
            </div>
            {budgetError && <p className="text-sm text-destructive">{budgetError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddBudget(false); setEditBudgetItem(null); }}>Abbrechen</Button>
            <Button
              onClick={() => {
                if (editBudgetItem) {
                  patchBudget.mutate({ itemId: editBudgetItem.id, data: budgetForm });
                } else {
                  addBudget.mutate(budgetForm);
                }
              }}
              disabled={!budgetForm.category || addBudget.isPending || patchBudget.isPending}
            >
              {(addBudget.isPending || patchBudget.isPending) ? <Loader2 className="w-4 h-4 animate-spin" /> : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* ── Anfrage senden Dialog ─────────────────────────────────────────── */}
      <Dialog open={showInquiry} onOpenChange={(o) => { if (!o) { setShowInquiry(false); setInquiryTarget(null); setInquiryInfo(null); setInquiryError(""); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Anfrage an {inquiryTarget?.company_name}</DialogTitle>
          </DialogHeader>
          {inquiryInfo ? (
            <div className="py-4 space-y-4">
              <div className="flex items-start gap-3 bg-blue-500/10 border border-blue-500/20 rounded-lg px-4 py-3">
                <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <p className="text-sm text-blue-300">{inquiryInfo}</p>
              </div>
              <DialogFooter>
                <Button onClick={() => { setShowInquiry(false); setInquiryTarget(null); setInquiryInfo(null); }}>
                  Schließen
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <div>
                  <Label>Betreff</Label>
                  <Input
                    value={inquiryForm.subject}
                    onChange={(e) => setInquiryForm((f) => ({ ...f, subject: e.target.value }))}
                    placeholder="Betreff…"
                  />
                </div>
                <div>
                  <Label>Nachricht</Label>
                  <Textarea
                    value={inquiryForm.message}
                    onChange={(e) => setInquiryForm((f) => ({ ...f, message: e.target.value }))}
                    rows={8}
                    placeholder="Ihre Nachricht…"
                  />
                </div>
                {inquiryError && <p className="text-sm text-destructive">{inquiryError}</p>}
              </div>
              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button variant="outline" onClick={() => { setShowInquiry(false); setInquiryTarget(null); }}>
                  Abbrechen
                </Button>
                <Button
                  variant="outline"
                  disabled={createInquiry.isPending}
                  onClick={() => createInquiry.mutate({ status: "draft" })}
                >
                  {createInquiry.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Als Entwurf speichern"}
                </Button>
                <Button
                  disabled={createInquiry.isPending}
                  onClick={() => createInquiry.mutate({ status: "sent" })}
                >
                  {createInquiry.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                    <><Send className="w-4 h-4 mr-1.5" /> Senden</>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Anfrage ansehen Dialog ────────────────────────────────────────── */}
      <Dialog open={!!viewInquiry} onOpenChange={(o) => { if (!o) setViewInquiry(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Anfrage an {viewInquiry?.company_name}</DialogTitle>
          </DialogHeader>
          {viewInquiry && (
            <>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Status:</span>
                  <Select
                    value={viewInquiry.status}
                    onValueChange={(v) => patchInquiry.mutate({ inquiryId: viewInquiry.id, data: { status: v } })}
                  >
                    <SelectTrigger className="h-7 text-xs w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(INQUIRY_STATUS_META).map(([v, m]) => (
                        <SelectItem key={v} value={v}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {viewInquiry.sent_at && (
                    <span className="text-xs text-muted-foreground ml-auto">
                      Gesendet: {formatDate(viewInquiry.sent_at)}
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Betreff</p>
                  <p className="text-sm text-foreground">{viewInquiry.subject ?? "–"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Nachricht</p>
                  <p className="text-sm text-foreground whitespace-pre-line bg-muted/30 rounded-lg p-3">
                    {viewInquiry.message ?? "–"}
                  </p>
                </div>
                {viewInquiry.email && (
                  <p className="text-xs text-muted-foreground">
                    An: <a href={`mailto:${viewInquiry.email}`} className="text-primary hover:underline">{viewInquiry.email}</a>
                  </p>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setViewInquiry(null)}>Schließen</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
      {/* ── Task Form Dialog ──────────────────────────────────────────────── */}
      <Dialog open={showTaskForm} onOpenChange={(o) => { if (!o) { setShowTaskForm(false); setEditTask(null); setTaskError(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editTask ? "Aufgabe bearbeiten" : "Aufgabe anlegen"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Titel *</Label>
              <Input
                value={taskForm.title}
                onChange={(e) => setTaskForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Titel der Aufgabe"
                autoFocus
              />
            </div>
            <div>
              <Label>Beschreibung</Label>
              <Textarea
                value={taskForm.description}
                onChange={(e) => setTaskForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
                placeholder="Optionale Beschreibung…"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Kategorie</Label>
                <Select value={taskForm.category || "__none__"} onValueChange={(v) => setTaskForm((f) => ({ ...f, category: v === "__none__" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Kategorie…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Keine</SelectItem>
                    {TASK_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Priorität</Label>
                <Select value={taskForm.priority} onValueChange={(v) => setTaskForm((f) => ({ ...f, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORITY_META).map(([v, m]) => (
                      <SelectItem key={v} value={v}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Status</Label>
                <Select value={taskForm.status} onValueChange={(v) => setTaskForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TASK_STATUS_META).map(([v, m]) => (
                      <SelectItem key={v} value={v}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Fälligkeitsdatum</Label>
                <Input
                  type="date"
                  value={taskForm.due_date}
                  onChange={(e) => setTaskForm((f) => ({ ...f, due_date: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>Zuständig</Label>
              <Select value={taskForm.assigned_to || "__none__"} onValueChange={(v) => setTaskForm((f) => ({ ...f, assigned_to: v === "__none__" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Zuständige Person…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nicht zugewiesen</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.first_name} {m.last_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {taskError && <p className="text-sm text-destructive">{taskError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowTaskForm(false); setEditTask(null); setTaskError(""); }}>
              Abbrechen
            </Button>
            <Button
              disabled={!taskForm.title.trim() || createTask.isPending || patchTask.isPending}
              onClick={() => {
                if (editTask) {
                  patchTask.mutate({ taskId: editTask.id, data: {
                    ...taskForm,
                    assigned_to: taskForm.assigned_to || null,
                    due_date: taskForm.due_date || null,
                    category: taskForm.category || null,
                    description: taskForm.description || null,
                  } as Partial<typeof taskForm> });
                } else {
                  createTask.mutate(taskForm);
                }
              }}
            >
              {(createTask.isPending || patchTask.isPending) ? <Loader2 className="w-4 h-4 animate-spin" /> : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </PortalLayout>
  );
};

export default FestplanerDetail;
