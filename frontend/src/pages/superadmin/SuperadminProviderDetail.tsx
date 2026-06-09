import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import {
  ArrowLeft, Loader2, Save, Upload, BadgeCheck, Store, MessageSquare, Calendar,
} from "lucide-react";
import { apiJson, apiUpload } from "@/integrations/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProviderDetail {
  id: string;
  company_name: string;
  slug: string;
  provider_type: string;
  description: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  logo_path: string | null;
  hero_image_path: string | null;
  logo_url: string | null;
  hero_image_url: string | null;
  street: string | null;
  zip: string | null;
  city: string | null;
  state: string | null;
  is_public: boolean;
  is_verified: boolean;
  inquiry_count: number;
  created_at: string;
  updated_at: string;
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SectionCard({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="bg-card border rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b bg-muted/30 flex items-center justify-between">
        <h3 className="font-semibold text-sm text-foreground">{title}</h3>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

const SuperadminProviderDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const heroInputRef = useRef<HTMLInputElement>(null);

  // ── Form state ──
  const [stammdaten, setStammdaten] = useState({ company_name: "", slug: "", provider_type: "", description: "" });
  const [kontakt, setKontakt] = useState({ contact_name: "", email: "", phone: "", website: "" });
  const [adresse, setAdresse] = useState({ street: "", zip: "", city: "", state: "" });
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [heroPreview, setHeroPreview] = useState<string | null>(null);

  const { data: provider, isLoading, isError } = useQuery<ProviderDetail>({
    queryKey: ["superadmin-provider", id],
    queryFn: () => apiJson<ProviderDetail>(`/api/superadmin/providers/${id}`),
    enabled: !!id,
  });

  useEffect(() => {
    if (!provider) return;
    setStammdaten({
      company_name: provider.company_name ?? "",
      slug: provider.slug ?? "",
      provider_type: provider.provider_type ?? "",
      description: provider.description ?? "",
    });
    setKontakt({
      contact_name: provider.contact_name ?? "",
      email: provider.email ?? "",
      phone: provider.phone ?? "",
      website: provider.website ?? "",
    });
    setAdresse({
      street: provider.street ?? "",
      zip: provider.zip ?? "",
      city: provider.city ?? "",
      state: provider.state ?? "",
    });
  }, [provider?.id]);

  const patchMutation = useMutation({
    mutationFn: (fields: Record<string, unknown>) =>
      apiJson(`/api/superadmin/providers/${id}`, { method: "PATCH", body: JSON.stringify(fields) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["superadmin-provider", id] });
      queryClient.invalidateQueries({ queryKey: ["superadmin-providers"] });
      toast.success("Gespeichert");
    },
    onError: (err: Error) => toast.error(err.message || "Fehler beim Speichern"),
  });

  const logoMutation = useMutation({
    mutationFn: (file: File) => apiUpload(`/api/superadmin/providers/${id}/logo`, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["superadmin-provider", id] });
      toast.success("Logo hochgeladen");
      setLogoPreview(null);
    },
    onError: () => toast.error("Fehler beim Hochladen"),
  });

  const heroMutation = useMutation({
    mutationFn: (file: File) => apiUpload(`/api/superadmin/providers/${id}/hero`, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["superadmin-provider", id] });
      toast.success("Titelbild hochgeladen");
      setHeroPreview(null);
    },
    onError: () => toast.error("Fehler beim Hochladen"),
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: "logo" | "hero") => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (type === "logo") setLogoPreview(ev.target?.result as string);
      else setHeroPreview(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
    if (type === "logo") logoMutation.mutate(file);
    else heroMutation.mutate(file);
  };

  const isDirtyStammdaten = provider != null && (
    stammdaten.company_name !== (provider.company_name ?? "") ||
    stammdaten.slug !== (provider.slug ?? "") ||
    stammdaten.provider_type !== (provider.provider_type ?? "") ||
    stammdaten.description !== (provider.description ?? "")
  );

  const isDirtyKontakt = provider != null && (
    kontakt.contact_name !== (provider.contact_name ?? "") ||
    kontakt.email !== (provider.email ?? "") ||
    kontakt.phone !== (provider.phone ?? "") ||
    kontakt.website !== (provider.website ?? "")
  );

  const isDirtyAdresse = provider != null && (
    adresse.street !== (provider.street ?? "") ||
    adresse.zip !== (provider.zip ?? "") ||
    adresse.city !== (provider.city ?? "") ||
    adresse.state !== (provider.state ?? "")
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !provider) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Store className="w-10 h-10 text-muted-foreground/40" />
        <p className="text-muted-foreground text-sm">Anbieter nicht gefunden.</p>
        <Button variant="outline" size="sm" onClick={() => navigate("/superadmin/providers")}>
          Zurück zur Liste
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/superadmin/providers")} className="gap-1.5">
          <ArrowLeft className="w-4 h-4" /> Anbieter
        </Button>
      </div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            {provider.company_name}
            {provider.is_verified && <BadgeCheck className="w-5 h-5 text-emerald-500" />}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">{provider.provider_type}</p>
        </div>
        <a href={`/anbieter/${provider.slug}`} target="_blank" rel="noopener noreferrer" className="shrink-0">
          <Button variant="outline" size="sm">Öffentlich ansehen</Button>
        </a>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Main col ── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Stammdaten */}
          <SectionCard
            title="Stammdaten"
            action={
              <Button size="sm" onClick={() => patchMutation.mutate(stammdaten)} disabled={patchMutation.isPending || !isDirtyStammdaten} className="gap-1.5">
                {patchMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Speichern
              </Button>
            }
          >
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Firmenname *</Label>
                  <Input value={stammdaten.company_name} onChange={(e) => setStammdaten((s) => ({ ...s, company_name: e.target.value }))} />
                </div>
                <div>
                  <Label>URL-Slug</Label>
                  <Input value={stammdaten.slug} onChange={(e) => setStammdaten((s) => ({ ...s, slug: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label>Kategorie</Label>
                <Select value={stammdaten.provider_type} onValueChange={(v) => setStammdaten((s) => ({ ...s, provider_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROVIDER_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Beschreibung</Label>
                <Textarea value={stammdaten.description} onChange={(e) => setStammdaten((s) => ({ ...s, description: e.target.value }))} rows={4} />
              </div>
            </div>
          </SectionCard>

          {/* Kontakt */}
          <SectionCard
            title="Kontaktdaten"
            action={
              <Button size="sm" onClick={() => patchMutation.mutate(kontakt)} disabled={patchMutation.isPending || !isDirtyKontakt} className="gap-1.5">
                {patchMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Speichern
              </Button>
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Ansprechpartner</Label>
                <Input value={kontakt.contact_name} onChange={(e) => setKontakt((k) => ({ ...k, contact_name: e.target.value }))} placeholder="Max Mustermann" />
              </div>
              <div>
                <Label>E-Mail</Label>
                <Input type="email" value={kontakt.email} onChange={(e) => setKontakt((k) => ({ ...k, email: e.target.value }))} />
              </div>
              <div>
                <Label>Telefon</Label>
                <Input value={kontakt.phone} onChange={(e) => setKontakt((k) => ({ ...k, phone: e.target.value }))} />
              </div>
              <div>
                <Label>Website</Label>
                <Input value={kontakt.website} onChange={(e) => setKontakt((k) => ({ ...k, website: e.target.value }))} placeholder="https://…" />
              </div>
            </div>
          </SectionCard>

          {/* Adresse */}
          <SectionCard
            title="Adresse"
            action={
              <Button size="sm" onClick={() => patchMutation.mutate(adresse)} disabled={patchMutation.isPending || !isDirtyAdresse} className="gap-1.5">
                {patchMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Speichern
              </Button>
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Label>Straße</Label>
                <Input value={adresse.street} onChange={(e) => setAdresse((a) => ({ ...a, street: e.target.value }))} />
              </div>
              <div>
                <Label>PLZ</Label>
                <Input value={adresse.zip} onChange={(e) => setAdresse((a) => ({ ...a, zip: e.target.value }))} />
              </div>
              <div>
                <Label>Stadt</Label>
                <Input value={adresse.city} onChange={(e) => setAdresse((a) => ({ ...a, city: e.target.value }))} />
              </div>
              <div className="sm:col-span-2">
                <Label>Bundesland</Label>
                <Select value={adresse.state} onValueChange={(v) => setAdresse((a) => ({ ...a, state: v }))}>
                  <SelectTrigger><SelectValue placeholder="Bundesland wählen…" /></SelectTrigger>
                  <SelectContent>
                    {BUNDESLAENDER.map((bl) => <SelectItem key={bl} value={bl}>{bl}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </SectionCard>

          {/* Bilder */}
          <SectionCard title="Bilder">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Logo */}
              <div>
                <p className="text-sm font-medium text-foreground mb-2">Logo</p>
                <div className="border border-dashed border-border rounded-xl p-4 text-center">
                  {(logoPreview || provider.logo_url) ? (
                    <img src={logoPreview || provider.logo_url!} alt="Logo" className="w-20 h-20 object-cover rounded-lg mx-auto mb-3" />
                  ) : (
                    <div className="w-20 h-20 bg-muted rounded-lg mx-auto mb-3 flex items-center justify-center">
                      <Store className="w-8 h-8 text-muted-foreground/40" />
                    </div>
                  )}
                  <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFileSelect(e, "logo")} />
                  <Button size="sm" variant="outline" onClick={() => logoInputRef.current?.click()} disabled={logoMutation.isPending} className="gap-1.5">
                    {logoMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    {provider.logo_path ? "Ändern" : "Hochladen"}
                  </Button>
                </div>
              </div>

              {/* Hero */}
              <div>
                <p className="text-sm font-medium text-foreground mb-2">Titelbild</p>
                <div className="border border-dashed border-border rounded-xl p-4 text-center">
                  {(heroPreview || provider.hero_image_url) ? (
                    <img src={heroPreview || provider.hero_image_url!} alt="Titelbild" className="w-full h-20 object-cover rounded-lg mx-auto mb-3" />
                  ) : (
                    <div className="w-full h-20 bg-muted rounded-lg mx-auto mb-3 flex items-center justify-center">
                      <Upload className="w-6 h-6 text-muted-foreground/40" />
                    </div>
                  )}
                  <input ref={heroInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFileSelect(e, "hero")} />
                  <Button size="sm" variant="outline" onClick={() => heroInputRef.current?.click()} disabled={heroMutation.isPending} className="gap-1.5">
                    {heroMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    {provider.hero_image_path ? "Ändern" : "Hochladen"}
                  </Button>
                </div>
              </div>
            </div>
          </SectionCard>
        </div>

        {/* ── Sidebar ── */}
        <div className="space-y-5">

          {/* Status */}
          <div className="bg-card border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b bg-muted/30">
              <h3 className="font-semibold text-sm text-foreground">Status</h3>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Öffentlich sichtbar</p>
                  <p className="text-xs text-muted-foreground">Im Verzeichnis anzeigen</p>
                </div>
                <Switch
                  checked={provider.is_public}
                  onCheckedChange={(v) => patchMutation.mutate({ is_public: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Verifiziert</p>
                  <p className="text-xs text-muted-foreground">Verifiziert-Badge anzeigen</p>
                </div>
                <Switch
                  checked={provider.is_verified}
                  onCheckedChange={(v) => patchMutation.mutate({ is_verified: v })}
                />
              </div>
            </div>
          </div>

          {/* KPIs */}
          <div className="bg-card border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b bg-muted/30">
              <h3 className="font-semibold text-sm text-foreground">Statistiken</h3>
            </div>
            <div className="p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400 flex items-center justify-center">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Anfragen</p>
                  <p className="text-xl font-bold text-foreground">{provider.inquiry_count}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Meta */}
          <div className="bg-card border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b bg-muted/30">
              <h3 className="font-semibold text-sm text-foreground">Metadaten</h3>
            </div>
            <div className="p-5 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Erstellt</span>
                <span className="text-foreground text-xs">{format(new Date(provider.created_at), "dd.MM.yyyy", { locale: de })}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Geändert</span>
                <span className="text-foreground text-xs">{format(new Date(provider.updated_at), "dd.MM.yyyy HH:mm", { locale: de })}</span>
              </div>
              <div className="flex items-start justify-between gap-2">
                <span className="text-muted-foreground">Slug</span>
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded break-all">{provider.slug}</code>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuperadminProviderDetail;
