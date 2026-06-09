import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, ChevronRight, BadgeCheck, Store, Loader2 } from "lucide-react";
import { apiJson } from "@/integrations/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProviderRow {
  id: string;
  company_name: string;
  slug: string;
  provider_type: string;
  city: string | null;
  state: string | null;
  is_public: boolean;
  is_verified: boolean;
  inquiry_count: number;
  created_at: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PROVIDER_TYPES = [
  "Schausteller", "Festzelt", "Getränkelieferant", "Catering", "Band", "DJ",
  "Musikverein", "Sicherheitsdienst", "Toilettenservice", "Veranstaltungstechnik",
  "Dekoration", "Sonstiges",
];

const BUNDESLAENDER = [
  "Baden-Württemberg","Bayern","Berlin","Brandenburg","Bremen",
  "Hamburg","Hessen","Mecklenburg-Vorpommern","Niedersachsen",
  "Nordrhein-Westfalen","Rheinland-Pfalz","Saarland","Sachsen",
  "Sachsen-Anhalt","Schleswig-Holstein","Thüringen",
];

// ─── Component ────────────────────────────────────────────────────────────────

const SuperadminProviders = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ company_name: "", provider_type: "", city: "", state: "" });
  const [createError, setCreateError] = useState("");

  const { data: providers = [], isLoading, isError } = useQuery<ProviderRow[]>({
    queryKey: ["superadmin-providers"],
    queryFn: () => apiJson<ProviderRow[]>("/api/superadmin/providers"),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof createForm) => apiJson("/api/superadmin/providers", {
      method: "POST",
      body: JSON.stringify(data),
    }),
    onSuccess: (created: ProviderRow) => {
      queryClient.invalidateQueries({ queryKey: ["superadmin-providers"] });
      queryClient.invalidateQueries({ queryKey: ["superadmin-stats"] });
      setShowCreate(false);
      setCreateForm({ company_name: "", provider_type: "", city: "", state: "" });
      navigate(`/superadmin/providers/${created.id}`);
    },
    onError: (err: Error) => setCreateError(err.message || "Fehler beim Anlegen"),
  });

  const filtered = providers.filter((p) => {
    const q = search.toLowerCase();
    const matchesSearch = !q || p.company_name.toLowerCase().includes(q) || (p.city ?? "").toLowerCase().includes(q);
    const matchesType = typeFilter === "all" || p.provider_type === typeFilter;
    const matchesStatus = statusFilter === "all"
      || (statusFilter === "public" && p.is_public)
      || (statusFilter === "verified" && p.is_verified)
      || (statusFilter === "private" && !p.is_public);
    return matchesSearch && matchesType && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Anbieter</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Schausteller und Dienstleister verwalten</p>
        </div>
        <Button onClick={() => { setShowCreate(true); setCreateError(""); }} className="gap-2">
          <Plus className="w-4 h-4" /> Neuer Anbieter
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Suche nach Name, Ort…"
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Alle Kategorien" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Kategorien</SelectItem>
            {PROVIDER_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Alle Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            <SelectItem value="public">Öffentlich</SelectItem>
            <SelectItem value="verified">Verifiziert</SelectItem>
            <SelectItem value="private">Nicht öffentlich</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b bg-muted/30 flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">{filtered.length} Anbieter</span>
        </div>

        {isLoading && (
          <div className="divide-y divide-border">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="px-5 py-4 flex items-center gap-4">
                <div className="h-4 bg-muted rounded animate-pulse w-40" />
                <div className="h-4 bg-muted rounded animate-pulse w-24 ml-auto" />
              </div>
            ))}
          </div>
        )}

        {isError && (
          <div className="px-5 py-10 text-center text-muted-foreground text-sm">Fehler beim Laden.</div>
        )}

        {!isLoading && !isError && filtered.length === 0 && (
          <div className="px-5 py-12 text-center">
            <Store className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">Keine Anbieter gefunden.</p>
          </div>
        )}

        {!isLoading && !isError && filtered.length > 0 && (
          <div className="divide-y divide-border">
            {filtered.map((p) => (
              <div
                key={p.id}
                className="px-5 py-4 flex items-center gap-4 hover:bg-muted/20 cursor-pointer transition-colors"
                onClick={() => navigate(`/superadmin/providers/${p.id}`)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground truncate">{p.company_name}</p>
                    {p.is_verified && (
                      <BadgeCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground">{p.provider_type}</span>
                    {(p.city || p.state) && (
                      <span className="text-xs text-muted-foreground">· {[p.city, p.state].filter(Boolean).join(", ")}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0 text-sm">
                  {p.inquiry_count > 0 && (
                    <span className="bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 px-2 py-0.5 rounded-full text-xs font-medium">
                      {p.inquiry_count} Anfrage{p.inquiry_count !== 1 ? "n" : ""}
                    </span>
                  )}
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.is_public ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-muted-foreground"}`}>
                    {p.is_public ? "Öffentlich" : "Privat"}
                  </span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Neuer Anbieter</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Firmenname *</Label>
              <Input
                value={createForm.company_name}
                onChange={(e) => setCreateForm((f) => ({ ...f, company_name: e.target.value }))}
                placeholder="z.B. Müller Festzelte GmbH"
              />
            </div>
            <div>
              <Label>Kategorie *</Label>
              <Select value={createForm.provider_type} onValueChange={(v) => setCreateForm((f) => ({ ...f, provider_type: v }))}>
                <SelectTrigger><SelectValue placeholder="Kategorie wählen…" /></SelectTrigger>
                <SelectContent>
                  {PROVIDER_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Stadt</Label>
                <Input value={createForm.city} onChange={(e) => setCreateForm((f) => ({ ...f, city: e.target.value }))} placeholder="München" />
              </div>
              <div>
                <Label>Bundesland</Label>
                <Select value={createForm.state} onValueChange={(v) => setCreateForm((f) => ({ ...f, state: v }))}>
                  <SelectTrigger><SelectValue placeholder="Bundesland" /></SelectTrigger>
                  <SelectContent>
                    {BUNDESLAENDER.map((bl) => <SelectItem key={bl} value={bl}>{bl}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {createError && <p className="text-sm text-destructive">{createError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Abbrechen</Button>
            <Button
              onClick={() => createMutation.mutate(createForm)}
              disabled={createMutation.isPending || !createForm.company_name.trim() || !createForm.provider_type}
            >
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Anlegen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SuperadminProviders;
