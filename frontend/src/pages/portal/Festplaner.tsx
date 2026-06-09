import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, CalendarDays, Euro, Users, Loader2, PartyPopper, ChevronRight, Lock } from "lucide-react";
import { apiJson } from "@/integrations/api/client";
import { useAuth } from "@/lib/auth";
import PortalLayout from "@/components/portal/PortalLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FestivalProject {
  id: string;
  title: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  provider_count: number;
  planned_total: number;
  actual_total: number;
  created_at: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  planning:     "Planung",
  preparation:  "Vorbereitung",
  confirmed:    "Bestätigt",
  completed:    "Abgeschlossen",
};

const STATUS_COLORS: Record<string, string> = {
  planning:    "bg-blue-500/15 text-blue-400 border-blue-500/30",
  preparation: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  confirmed:   "bg-green-500/15 text-green-400 border-green-500/30",
  completed:   "bg-muted/50 text-muted-foreground border-border",
};

function formatDate(date: string | null) {
  if (!date) return null;
  return new Date(date).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatEuro(amount: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(amount);
}

// ─── Component ────────────────────────────────────────────────────────────────

const Festplaner = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: "", description: "", start_date: "", end_date: "", addTemplate: false,
  });
  const [createError, setCreateError] = useState("");

  const { data: festivals = [], isLoading } = useQuery<FestivalProject[]>({
    queryKey: ["festival-projects"],
    queryFn: () => apiJson<FestivalProject[]>("/api/festplaner"),
    enabled: isAdmin,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof createForm) =>
      apiJson<FestivalProject>("/api/festplaner", { method: "POST", body: JSON.stringify({
        title: data.title,
        description: data.description || null,
        start_date: data.start_date || null,
        end_date: data.end_date || null,
      }) }),
    onSuccess: async (created, variables) => {
      if (variables.addTemplate) {
        await apiJson(`/api/festplaner/${created.id}/tasks/template`, { method: "POST" }).catch(() => {});
      }
      queryClient.invalidateQueries({ queryKey: ["festival-projects"] });
      setShowCreate(false);
      setCreateForm({ title: "", description: "", start_date: "", end_date: "", addTemplate: false });
      navigate(`/portal/festplaner/${created.id}`);
    },
    onError: (err: Error) => setCreateError(err.message || "Fehler beim Anlegen"),
  });

  if (!isAdmin) {
    return (
      <PortalLayout>
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-muted-foreground">
          <Lock className="w-10 h-10 opacity-30" />
          <p className="text-sm">Nur für Vereinsadmins zugänglich.</p>
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Festplaner</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Schützenfeste zentral planen und koordinieren</p>
          </div>
          <Button onClick={() => { setShowCreate(true); setCreateError(""); }} className="gap-2">
            <Plus className="w-4 h-4" /> Neues Fest anlegen
          </Button>
        </div>

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-card border rounded-xl p-5 space-y-3">
              <div className="h-5 bg-muted rounded animate-pulse w-2/3" />
              <div className="h-4 bg-muted rounded animate-pulse w-1/3" />
              <div className="h-4 bg-muted rounded animate-pulse w-1/2" />
            </div>
          ))}
        </div>
      )}

      {/* Empty */}
      {!isLoading && festivals.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-muted-foreground">
          <PartyPopper className="w-12 h-12 opacity-20" />
          <div className="text-center">
            <p className="font-medium text-foreground">Noch keine Feste angelegt</p>
            <p className="text-sm mt-1">Erstellen Sie Ihr erstes Schützenfest-Projekt.</p>
          </div>
          <Button onClick={() => { setShowCreate(true); setCreateError(""); }} variant="outline" className="gap-2">
            <Plus className="w-4 h-4" /> Neues Fest anlegen
          </Button>
        </div>
      )}

      {/* Festival grid */}
      {!isLoading && festivals.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {festivals.map((fest) => {
            const statusCls = STATUS_COLORS[fest.status] ?? STATUS_COLORS.planning;
            const statusLabel = STATUS_LABELS[fest.status] ?? fest.status;
            const startFmt = formatDate(fest.start_date);
            const endFmt = formatDate(fest.end_date);
            const dateRange = startFmt && endFmt
              ? `${startFmt} – ${endFmt}`
              : startFmt ?? endFmt ?? null;

            return (
              <button
                key={fest.id}
                onClick={() => navigate(`/portal/festplaner/${fest.id}`)}
                className="bg-card border border-border rounded-xl p-5 text-left hover:border-primary/40 hover:bg-muted/20 transition-all group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusCls}`}>
                    {statusLabel}
                  </span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0 mt-0.5" />
                </div>

                <h2 className="font-semibold text-foreground leading-snug mb-1 line-clamp-2">
                  {fest.title}
                </h2>

                {dateRange && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 mb-3">
                    <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                    {dateRange}
                  </p>
                )}

                <div className="flex items-center gap-4 text-xs text-muted-foreground mt-auto pt-2 border-t border-border">
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    {fest.provider_count} Anbieter
                  </span>
                  {fest.planned_total > 0 && (
                    <span className="flex items-center gap-1">
                      <Euro className="w-3.5 h-3.5" />
                      {formatEuro(fest.planned_total)}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Neues Fest anlegen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Titel *</Label>
              <Input
                value={createForm.title}
                onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="z.B. Schützenfest 2025"
                autoFocus
              />
            </div>
            <div>
              <Label>Beschreibung</Label>
              <Textarea
                value={createForm.description}
                onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Kurze Beschreibung…"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Startdatum</Label>
                <Input
                  type="date"
                  value={createForm.start_date}
                  onChange={(e) => setCreateForm((f) => ({ ...f, start_date: e.target.value }))}
                />
              </div>
              <div>
                <Label>Enddatum</Label>
                <Input
                  type="date"
                  value={createForm.end_date}
                  onChange={(e) => setCreateForm((f) => ({ ...f, end_date: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="addTemplate"
                checked={createForm.addTemplate}
                onChange={(e) => setCreateForm((f) => ({ ...f, addTemplate: e.target.checked }))}
                className="h-4 w-4 rounded border-border"
              />
              <Label htmlFor="addTemplate" className="cursor-pointer font-normal">
                Standard-Checkliste automatisch anlegen
              </Label>
            </div>
            {createError && <p className="text-sm text-destructive">{createError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Abbrechen</Button>
            <Button
              onClick={() => createMutation.mutate(createForm)}
              disabled={createMutation.isPending || !createForm.title.trim()}
            >
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Anlegen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </PortalLayout>
  );
};

export default Festplaner;
