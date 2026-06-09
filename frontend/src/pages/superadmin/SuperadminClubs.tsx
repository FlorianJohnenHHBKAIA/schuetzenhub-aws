import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import {
  Building2, Search, AlertCircle, RefreshCw, Plus, Loader2, X, ImageIcon,
} from "lucide-react";
import { apiJson, apiUpload } from "@/integrations/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

// ── Interfaces ───────────────────────────────────────────────────────────────

interface ClubRow {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  location_zip: string | null;
  plan: string;
  plan_started_at: string | null;
  sales_status: string;
  created_at: string;
  active_members: number;
  total_members: number;
  admin_count: number;
}

interface CreateClubForm {
  name: string;
  club_number: string;
  street: string;
  house_number: string;
  location_zip: string;
  location_city: string;
  state: string;
  country: string;
  contact_email: string;
  contact_phone: string;
  website_url: string;
  founded_year: string;
  description: string;
  sales_status: string;
}

// ── Sales-Status-Konfiguration ───────────────────────────────────────────────

const SALES_STATUS_OPTIONS = [
  { value: "recherchiert",     label: "Recherchiert",     color: "bg-muted text-muted-foreground" },
  { value: "kontaktiert",      label: "Kontaktiert",      color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  { value: "interessiert",     label: "Interessiert",     color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400" },
  { value: "demo_vereinbart",  label: "Demo vereinbart",  color: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400" },
  { value: "registriert",      label: "Registriert",      color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  { value: "aktiv",            label: "Aktiv",            color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  { value: "abgelehnt",        label: "Abgelehnt",        color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  { value: "nicht_erreichbar", label: "Nicht erreichbar", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
];

function getSalesStatusOption(value: string) {
  return SALES_STATUS_OPTIONS.find((o) => o.value === value) ?? SALES_STATUS_OPTIONS[0];
}

const EMPTY_FORM: CreateClubForm = {
  name: "",
  club_number: "",
  street: "",
  house_number: "",
  location_zip: "",
  location_city: "",
  state: "",
  country: "Deutschland",
  contact_email: "",
  contact_phone: "",
  website_url: "",
  founded_year: "",
  description: "",
  sales_status: "recherchiert",
};

// ── Hilfskomponenten ──────────────────────────────────────────────────────────

const SalesBadge = ({ status }: { status: string }) => {
  const opt = getSalesStatusOption(status);
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${opt.color}`}>
      {opt.label}
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

const FormSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="space-y-3">
    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border pb-1.5">
      {title}
    </p>
    {children}
  </div>
);

const FormRow = ({ children }: { children: React.ReactNode }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
);

const FormField = ({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) => (
  <div className="space-y-1">
    <label className="text-sm text-muted-foreground">
      {label}
      {required && <span className="text-destructive ml-0.5">*</span>}
    </label>
    {children}
  </div>
);

// ── Hauptkomponente ───────────────────────────────────────────────────────────

const SuperadminClubs = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("alle");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateClubForm>(EMPTY_FORM);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    data: clubs = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<ClubRow[]>({
    queryKey: ["superadmin-clubs"],
    queryFn: () => apiJson<ClubRow[]>("/api/superadmin/clubs"),
  });

  const createMutation = useMutation({
    mutationFn: async ({ formData, logo }: { formData: CreateClubForm; logo: File | null }) => {
      const club = await apiJson<{ id: string; slug: string }>("/api/superadmin/clubs", {
        method: "POST",
        body: JSON.stringify(formData),
      });
      if (logo) {
        await apiUpload(`/api/superadmin/clubs/${club.id}/logo`, logo, {}, "PATCH");
      }
      return club;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["superadmin-clubs"] });
      queryClient.invalidateQueries({ queryKey: ["superadmin-stats"] });
      handleCloseDialog();
    },
    onError: () => setCreateError("Verein konnte nicht angelegt werden."),
  });

  function handleCloseDialog() {
    setShowCreate(false);
    setForm(EMPTY_FORM);
    setLogoFile(null);
    setLogoPreview(null);
    setCreateError(null);
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setLogoFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setLogoPreview(null);
    }
  }

  function setField<K extends keyof CreateClubForm>(key: K, value: CreateClubForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setCreateError(null);
  }

  const filtered = clubs.filter((c) => {
    const q = search.toLowerCase();
    const matchesSearch =
      c.name.toLowerCase().includes(q) ||
      (c.city ?? "").toLowerCase().includes(q) ||
      (c.location_zip ?? "").toLowerCase().includes(q) ||
      c.slug.toLowerCase().includes(q);
    const matchesStatus =
      statusFilter === "alle" || c.sales_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const canSubmit = form.name.trim().length > 0 && !createMutation.isPending;

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
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative w-full sm:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Name, Ort oder PLZ …"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button onClick={() => setShowCreate(true)} className="whitespace-nowrap">
            <Plus className="w-4 h-4 mr-1.5" />
            Neuen Verein anlegen
          </Button>
        </div>
      </div>

      {/* Status-Filter-Chips */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setStatusFilter("alle")}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            statusFilter === "alle"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          Alle
        </button>
        {SALES_STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setStatusFilter(opt.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              statusFilter === opt.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Error state */}
      {isError && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Vereine konnten nicht geladen werden.</span>
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

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">Verein</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">PLZ / Ort</th>
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
                    {search || statusFilter !== "alle"
                      ? "Keine Vereine für diese Filterauswahl gefunden."
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

                    {/* PLZ / Ort */}
                    <td className="px-4 py-3 text-muted-foreground">
                      {club.location_zip || club.city ? (
                        <span>
                          {club.location_zip && <span>{club.location_zip} </span>}
                          {club.city}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/50">–</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <SalesBadge status={club.sales_status} />
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

        {!isLoading && !isError && (statusFilter !== "alle" || search) && filtered.length < clubs.length && (
          <div className="px-4 py-2.5 text-xs text-muted-foreground border-t border-border">
            Zeige {filtered.length} von {clubs.length} Vereinen
          </div>
        )}
      </div>

      {/* Create-Dialog */}
      <Dialog open={showCreate} onOpenChange={(open) => { if (!open) handleCloseDialog(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Neuen Verein anlegen</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">

            {/* Basisdaten */}
            <FormSection title="Basisdaten">
              <FormRow>
                <FormField label="Vereinsname" required>
                  <Input
                    value={form.name}
                    onChange={(e) => setField("name", e.target.value)}
                    placeholder="z.B. Schützenverein Musterstadt"
                  />
                </FormField>
                <FormField label="Vereinsnummer">
                  <Input
                    value={form.club_number}
                    onChange={(e) => setField("club_number", e.target.value)}
                    placeholder="z.B. 12345"
                  />
                </FormField>
              </FormRow>
              <FormRow>
                <FormField label="Straße">
                  <Input
                    value={form.street}
                    onChange={(e) => setField("street", e.target.value)}
                    placeholder="Musterstraße"
                  />
                </FormField>
                <FormField label="Hausnummer">
                  <Input
                    value={form.house_number}
                    onChange={(e) => setField("house_number", e.target.value)}
                    placeholder="1a"
                  />
                </FormField>
              </FormRow>
              <FormRow>
                <FormField label="PLZ">
                  <Input
                    value={form.location_zip}
                    onChange={(e) => setField("location_zip", e.target.value)}
                    placeholder="12345"
                  />
                </FormField>
                <FormField label="Ort">
                  <Input
                    value={form.location_city}
                    onChange={(e) => setField("location_city", e.target.value)}
                    placeholder="Musterstadt"
                  />
                </FormField>
              </FormRow>
              <FormRow>
                <FormField label="Bundesland">
                  <Input
                    value={form.state}
                    onChange={(e) => setField("state", e.target.value)}
                    placeholder="Bayern"
                  />
                </FormField>
                <FormField label="Land">
                  <Input
                    value={form.country}
                    onChange={(e) => setField("country", e.target.value)}
                    placeholder="Deutschland"
                  />
                </FormField>
              </FormRow>
              <FormField label="Sales-Status">
                <select
                  value={form.sales_status}
                  onChange={(e) => setField("sales_status", e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {SALES_STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </FormField>
            </FormSection>

            {/* Kontaktdaten */}
            <FormSection title="Kontaktdaten">
              <FormRow>
                <FormField label="E-Mail">
                  <Input
                    type="email"
                    value={form.contact_email}
                    onChange={(e) => setField("contact_email", e.target.value)}
                    placeholder="kontakt@verein.de"
                  />
                </FormField>
                <FormField label="Telefon">
                  <Input
                    value={form.contact_phone}
                    onChange={(e) => setField("contact_phone", e.target.value)}
                    placeholder="+49 123 456789"
                  />
                </FormField>
              </FormRow>
              <FormField label="Website">
                <Input
                  value={form.website_url}
                  onChange={(e) => setField("website_url", e.target.value)}
                  placeholder="https://www.verein.de"
                />
              </FormField>
            </FormSection>

            {/* Vereinsinformationen */}
            <FormSection title="Vereinsinformationen">
              <FormField label="Gründungsjahr">
                <Input
                  type="number"
                  value={form.founded_year}
                  onChange={(e) => setField("founded_year", e.target.value)}
                  placeholder="z.B. 1872"
                  min={1800}
                  max={new Date().getFullYear()}
                />
              </FormField>
              <FormField label="Kurzbeschreibung">
                <textarea
                  value={form.description}
                  onChange={(e) => setField("description", e.target.value)}
                  placeholder="Kurze Beschreibung des Vereins …"
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </FormField>
            </FormSection>

            {/* Logo */}
            <FormSection title="Logo / Wappen">
              <div className="flex items-start gap-4">
                <div
                  className="w-16 h-16 rounded-lg border border-border bg-muted flex items-center justify-center shrink-0 overflow-hidden"
                >
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo-Vorschau" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-6 h-6 text-muted-foreground/40" />
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Bild auswählen
                  </Button>
                  {logoFile && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="truncate max-w-[180px]">{logoFile.name}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setLogoFile(null);
                          setLogoPreview(null);
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Optional – kann später jederzeit geändert werden.
                  </p>
                </div>
              </div>
            </FormSection>

            {/* Fehlermeldung */}
            {createError && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {createError}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog} disabled={createMutation.isPending}>
              Abbrechen
            </Button>
            <Button
              onClick={() => createMutation.mutate({ formData: form, logo: logoFile })}
              disabled={!canSubmit}
            >
              {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Verein anlegen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SuperadminClubs;
