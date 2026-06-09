import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { ArrowLeft, MapPin, Mail, Phone, Globe, Shield, BadgeCheck, ExternalLink, BookmarkPlus, Loader2, CheckCircle } from "lucide-react";
import { apiJson, getStorageUrl } from "@/integrations/api/client";
import { useAuth } from "@/lib/auth";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FestivalProject {
  id: string;
  title: string;
  start_date: string | null;
  end_date: string | null;
  status: string;
}

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
  is_verified: boolean;
}

const TYPE_COLORS: Record<string, string> = {
  "Schausteller":          "bg-amber-500/20 text-amber-300 border-amber-500/30",
  "Festzelt":              "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  "Getränkelieferant":     "bg-blue-500/20 text-blue-300 border-blue-500/30",
  "Catering":              "bg-green-500/20 text-green-300 border-green-500/30",
  "Band":                  "bg-purple-500/20 text-purple-300 border-purple-500/30",
  "DJ":                    "bg-pink-500/20 text-pink-300 border-pink-500/30",
  "Musikverein":           "bg-violet-500/20 text-violet-300 border-violet-500/30",
  "Sicherheitsdienst":     "bg-red-500/20 text-red-300 border-red-500/30",
  "Toilettenservice":      "bg-gray-500/20 text-gray-300 border-gray-500/30",
  "Veranstaltungstechnik": "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  "Dekoration":            "bg-rose-500/20 text-rose-300 border-rose-500/30",
  "Sonstiges":             "bg-white/10 text-cream/60 border-white/10",
};

// ─── Component ────────────────────────────────────────────────────────────────

const PublicProviderDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();

  const [showContact, setShowContact] = useState(false);
  const [showSaveFest, setShowSaveFest] = useState(false);
  const [saveFestId, setSaveFestId] = useState<string>("");
  const [saveFestSuccess, setSaveFestSuccess] = useState(false);
  const [saveFestError, setSaveFestError] = useState("");
  const [contactForm, setContactForm] = useState({
    firstname: "", lastname: "", email: "", phone: "", message: "",
  });
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [contactSuccess, setContactSuccess] = useState(false);
  const [contactError, setContactError] = useState("");

  const { data: provider, isLoading, isError } = useQuery<ProviderDetail>({
    queryKey: ["public-provider-detail", slug],
    queryFn: () => apiJson<ProviderDetail>(`/api/public/providers/${slug}`),
    enabled: !!slug,
  });

  const { data: festivals = [] } = useQuery<FestivalProject[]>({
    queryKey: ["festival-projects"],
    queryFn: () => apiJson<FestivalProject[]>("/api/festplaner"),
    enabled: isAdmin && showSaveFest,
  });

  const saveMutation = useMutation({
    mutationFn: ({ festId, providerId }: { festId: string; providerId: string }) =>
      apiJson(`/api/festplaner/${festId}/providers`, {
        method: "POST",
        body: JSON.stringify({ provider_id: providerId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["festival-providers", saveFestId] });
      setSaveFestSuccess(true);
      setSaveFestError("");
    },
    onError: (err: Error) => setSaveFestError(err.message || "Fehler beim Speichern"),
  });

  const handleContactSubmit = async () => {
    const { firstname, lastname, email, message } = contactForm;
    if (!firstname.trim() || !lastname.trim() || !email.trim() || !message.trim()) {
      setContactError("Bitte füllen Sie alle Pflichtfelder aus.");
      return;
    }
    setContactSubmitting(true);
    setContactError("");
    try {
      const res = await fetch(`/api/public/providers/${slug}/inquire`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contactForm),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Fehler beim Senden");
      }
      setContactSuccess(true);
    } catch (err) {
      setContactError(err instanceof Error ? err.message : "Fehler beim Senden");
    } finally {
      setContactSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-forest-dark flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
      </div>
    );
  }

  if (isError || !provider) {
    return (
      <div className="min-h-screen bg-forest-dark flex flex-col items-center justify-center gap-4 text-cream">
        <Shield className="w-12 h-12 text-cream/20" />
        <p className="text-cream/50">Anbieter nicht gefunden.</p>
        <Link to="/anbieter" className="text-gold text-sm hover:underline">← Zurück zum Verzeichnis</Link>
      </div>
    );
  }

  const logoUrl = provider.logo_url || (provider.logo_path ? getStorageUrl("provider-assets", provider.logo_path) : null);
  const heroUrl = provider.hero_image_url || (provider.hero_image_path ? getStorageUrl("provider-assets", provider.hero_image_path) : null);
  const typeCls = TYPE_COLORS[provider.provider_type] ?? TYPE_COLORS["Sonstiges"];

  const addressLines = [
    provider.street,
    [provider.zip, provider.city].filter(Boolean).join(" "),
    provider.state,
  ].filter(Boolean);

  const schemaLocalBusiness = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: provider.company_name,
    description: provider.description ?? undefined,
    email: provider.email ?? undefined,
    telephone: provider.phone ?? undefined,
    url: provider.website ?? undefined,
    address: {
      "@type": "PostalAddress",
      streetAddress: provider.street ?? undefined,
      postalCode: provider.zip ?? undefined,
      addressLocality: provider.city ?? undefined,
      addressRegion: provider.state ?? undefined,
      addressCountry: "DE",
    },
  };

  return (
    <div className="min-h-screen bg-forest-dark text-cream">
      <Helmet>
        <title>{provider.company_name} – Dienstleister | SchützenHub</title>
        <meta name="description" content={provider.description ?? `${provider.company_name} – ${provider.provider_type} für Schützenfeste`} />
        <script type="application/ld+json">{JSON.stringify(schemaLocalBusiness)}</script>
      </Helmet>

      {/* ── Fixed Nav ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-forest-dark/95 backdrop-blur border-b border-gold/10 h-16 flex items-center px-6 gap-4">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <Shield className="w-6 h-6 text-gold" />
          <span className="font-bold text-cream hidden sm:block">SchützenHub</span>
        </Link>
        <div className="flex-1" />
        <Link to="/anbieter" className="flex items-center gap-1 text-sm text-cream/70 hover:text-gold transition-colors">
          <ArrowLeft className="w-4 h-4" /> Alle Anbieter
        </Link>
      </nav>

      {/* ── Hero ── */}
      <section className="pt-16 border-b border-gold/10">
        {heroUrl && (
          <div className="w-full h-48 overflow-hidden">
            <img src={heroUrl} alt="" className="w-full h-full object-cover opacity-40" />
          </div>
        )}
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="flex items-start gap-5">
            {logoUrl ? (
              <img src={logoUrl} alt={provider.company_name} className="w-16 h-16 rounded-xl object-cover border border-gold/20 shrink-0" />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">
                <Shield className="w-8 h-8 text-gold/40" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${typeCls}`}>
                  {provider.provider_type}
                </span>
                {provider.is_verified && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gold/15 text-gold border border-gold/25">
                    <BadgeCheck className="w-3.5 h-3.5" /> Verifiziert
                  </span>
                )}
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-cream leading-tight mb-2">
                {provider.company_name}
              </h1>
              {(provider.city || provider.state) && (
                <p className="text-cream/60 flex items-center gap-1.5 text-sm">
                  <MapPin className="w-4 h-4" />
                  {[provider.city, provider.state].filter(Boolean).join(", ")}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-3 mt-6">
            <Button
              onClick={() => { setShowContact(true); setContactSuccess(false); setContactError(""); }}
              className="bg-gold hover:bg-gold/90 text-forest-dark font-medium"
            >
              <Mail className="w-4 h-4 mr-2" /> Anbieter kontaktieren
            </Button>
            {provider.website && (
              <a href={provider.website} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="border-gold/30 text-cream hover:bg-white/5">
                  <ExternalLink className="w-4 h-4 mr-2" /> Website besuchen
                </Button>
              </a>
            )}
            {isAdmin && (
              <Button
                variant="outline"
                className="border-gold/30 text-cream hover:bg-white/5"
                onClick={() => { setShowSaveFest(true); setSaveFestSuccess(false); setSaveFestError(""); setSaveFestId(""); }}
              >
                <BookmarkPlus className="w-4 h-4 mr-2" /> Für Fest speichern
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* ── Body ── */}
      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Left col */}
          <div className="lg:col-span-2 space-y-6">
            {provider.description && (
              <div className="bg-white/5 border border-gold/10 rounded-xl p-6">
                <h2 className="font-semibold text-cream mb-3">Über uns</h2>
                <p className="text-cream/70 whitespace-pre-line leading-relaxed">{provider.description}</p>
              </div>
            )}
          </div>

          {/* Right col */}
          <div className="space-y-5">

            {/* Kontakt */}
            {(provider.contact_name || provider.email || provider.phone || provider.website) && (
              <div className="bg-white/5 border border-gold/10 rounded-xl p-6">
                <h2 className="font-semibold text-cream text-sm mb-4">Kontakt</h2>
                <div className="space-y-3 text-sm">
                  {provider.contact_name && (
                    <p className="text-cream/80 font-medium">{provider.contact_name}</p>
                  )}
                  {provider.email && (
                    <a href={`mailto:${provider.email}`} className="flex items-center gap-2 text-cream/60 hover:text-gold transition-colors">
                      <Mail className="w-4 h-4 shrink-0" /> {provider.email}
                    </a>
                  )}
                  {provider.phone && (
                    <a href={`tel:${provider.phone}`} className="flex items-center gap-2 text-cream/60 hover:text-gold transition-colors">
                      <Phone className="w-4 h-4 shrink-0" /> {provider.phone}
                    </a>
                  )}
                  {provider.website && (
                    <a href={provider.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-cream/60 hover:text-gold transition-colors truncate">
                      <Globe className="w-4 h-4 shrink-0" />
                      <span className="truncate">{provider.website.replace(/^https?:\/\//, "")}</span>
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Adresse */}
            {addressLines.length > 0 && (
              <div className="bg-white/5 border border-gold/10 rounded-xl p-6">
                <h2 className="font-semibold text-cream text-sm mb-3 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-gold" /> Adresse
                </h2>
                <address className="not-italic text-sm text-cream/70 space-y-0.5">
                  {addressLines.map((line, i) => <p key={i}>{line}</p>)}
                </address>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ── Contact Dialog ── */}
      <Dialog open={showContact} onOpenChange={(o) => { setShowContact(o); if (!o) { setContactSuccess(false); setContactError(""); setContactForm({ firstname: "", lastname: "", email: "", phone: "", message: "" }); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Anbieter kontaktieren</DialogTitle>
          </DialogHeader>
          {contactSuccess ? (
            <div className="py-6 text-center">
              <BadgeCheck className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <p className="font-medium text-foreground">Anfrage gesendet!</p>
              <p className="text-sm text-muted-foreground mt-1">Der Anbieter wird sich bei Ihnen melden.</p>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Vorname *</Label>
                    <Input value={contactForm.firstname} onChange={(e) => setContactForm((f) => ({ ...f, firstname: e.target.value }))} placeholder="Max" />
                  </div>
                  <div>
                    <Label>Nachname *</Label>
                    <Input value={contactForm.lastname} onChange={(e) => setContactForm((f) => ({ ...f, lastname: e.target.value }))} placeholder="Mustermann" />
                  </div>
                </div>
                <div>
                  <Label>E-Mail *</Label>
                  <Input type="email" value={contactForm.email} onChange={(e) => setContactForm((f) => ({ ...f, email: e.target.value }))} placeholder="max@beispiel.de" />
                </div>
                <div>
                  <Label>Telefon</Label>
                  <Input value={contactForm.phone} onChange={(e) => setContactForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+49 …" />
                </div>
                <div>
                  <Label>Nachricht *</Label>
                  <Textarea value={contactForm.message} onChange={(e) => setContactForm((f) => ({ ...f, message: e.target.value }))} placeholder="Ihre Nachricht…" rows={4} />
                </div>
                {contactError && <p className="text-sm text-destructive">{contactError}</p>}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowContact(false)}>Abbrechen</Button>
                <Button onClick={handleContactSubmit} disabled={contactSubmitting}>
                  {contactSubmitting ? "Senden…" : "Anfrage senden"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Für Fest speichern Dialog ── */}
      {isAdmin && (
        <Dialog open={showSaveFest} onOpenChange={(o) => { setShowSaveFest(o); if (!o) { setSaveFestSuccess(false); setSaveFestError(""); } }}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Für Fest speichern</DialogTitle>
            </DialogHeader>
            {saveFestSuccess ? (
              <div className="py-6 text-center">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <p className="font-medium text-foreground">Gespeichert!</p>
                <p className="text-sm text-muted-foreground mt-1">{provider.company_name} wurde zur Shortlist hinzugefügt.</p>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  <div>
                    <Label>Fest auswählen</Label>
                    {festivals.length === 0 ? (
                      <p className="text-sm text-muted-foreground mt-1">Noch keine Feste angelegt. Legen Sie im Portal unter <strong>Festplaner</strong> ein Fest an.</p>
                    ) : (
                      <select
                        value={saveFestId}
                        onChange={(e) => setSaveFestId(e.target.value)}
                        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="">Fest wählen…</option>
                        {festivals.map((f) => (
                          <option key={f.id} value={f.id}>{f.title}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  {saveFestError && <p className="text-sm text-destructive">{saveFestError}</p>}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowSaveFest(false)}>Abbrechen</Button>
                  <Button
                    disabled={!saveFestId || saveMutation.isPending}
                    onClick={() => saveMutation.mutate({ festId: saveFestId, providerId: provider.id })}
                  >
                    {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Speichern"}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      )}

      {/* ── Footer ── */}
      <footer className="border-t border-gold/10 mt-10 py-8 px-6 text-center text-sm text-cream/40">
        <div className="flex items-center justify-center gap-6 mb-3">
          <Link to="/anbieter" className="hover:text-cream transition-colors">Anbieterverzeichnis</Link>
          <Link to="/vereine" className="hover:text-cream transition-colors">Vereine</Link>
          <Link to="/auth" className="hover:text-cream transition-colors">Anmelden</Link>
        </div>
        © {new Date().getFullYear()} SchützenHub
      </footer>
    </div>
  );
};

export default PublicProviderDetail;
