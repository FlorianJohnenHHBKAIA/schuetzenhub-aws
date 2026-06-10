import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, Building2, User, Mail, Lock, Loader2, AlertCircle,
  CheckCircle2, MapPin, Users, Search, Phone, MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import ClubClaimDialog from "@/components/public/ClubClaimDialog";
import { useToast } from "@/hooks/use-toast";
import { apiJson, setToken } from "@/integrations/api/client";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ClubMatch {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  zip: string | null;
  claim_status: string;
  logo_url: string | null;
}

// ── Claim-Status-Badge ────────────────────────────────────────────────────────

const ClaimBadge = ({ status }: { status: string }) => {
  if (status === "unclaimed")
    return <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">Nicht übernommen</span>;
  if (status === "approved" || status === "claimed")
    return <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-medium">Bereits verwaltet</span>;
  return <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">Anfrage ausstehend</span>;
};

// ── MatchCard ─────────────────────────────────────────────────────────────────

interface MatchCardProps {
  match: ClubMatch;
  onAccessRequest: (m: ClubMatch) => void;
  onClaimRequest: (m: ClubMatch) => void;
  compact?: boolean;
}

const MatchCard = ({ match, onAccessRequest, onClaimRequest, compact = false }: MatchCardProps) => {
  const isUnclaimed = match.claim_status === "unclaimed";
  const location = [match.zip, match.city].filter(Boolean).join(" ");

  return (
    <div className={`border border-border rounded-lg p-3 flex items-start gap-3 ${compact ? "bg-muted/20" : "bg-card"}`}>
      {match.logo_url ? (
        <img src={match.logo_url} alt={match.name} className="w-10 h-10 rounded-full object-cover border border-border shrink-0" />
      ) : (
        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
          <Shield className="w-4 h-4 text-muted-foreground" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium text-sm text-foreground truncate">{match.name}</p>
          <ClaimBadge status={match.claim_status} />
        </div>
        {location && <p className="text-xs text-muted-foreground mt-0.5">{location}</p>}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {isUnclaimed ? (
            <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => onClaimRequest(match)}>
              Verein übernehmen
            </Button>
          ) : (
            <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => onAccessRequest(match)}>
              Zugang anfragen
            </Button>
          )}
          <a href={`/verein/${match.slug}`} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors">
            Profil ansehen
          </a>
        </div>
      </div>
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

const Setup = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Step: 1=Suchen, 2=Vereinsdaten, 3=Administrator, 4=Fertig
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    clubName: "", clubSlug: "", city: "",
    firstName: "", lastName: "", email: "", password: "", confirmPassword: "",
  });

  // Step 1: search
  const [searchQuery, setSearchQuery] = useState("");
  const [matches, setMatches] = useState<ClubMatch[] | null>(null);
  const [checkLoading, setCheckLoading] = useState(false);
  const [checkError, setCheckError] = useState("");

  // Claim dialog
  const [claimDialogClub, setClaimDialogClub] = useState<ClubMatch | null>(null);

  // Access request dialog
  const [accessDialogClub, setAccessDialogClub] = useState<ClubMatch | null>(null);
  const [accessForm, setAccessForm] = useState({ firstname: "", lastname: "", email: "", phone: "", message: "" });
  const [accessSubmitting, setAccessSubmitting] = useState(false);
  const [accessSuccess, setAccessSuccess] = useState(false);
  const [accessError, setAccessError] = useState("");

  // Step 3: 409 duplicate conflict
  const [dupConflict, setDupConflict] = useState<ClubMatch[] | null>(null);
  const [forceCreate, setForceCreate] = useState(false);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const generateSlug = (name: string) =>
    name.toLowerCase()
      .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

  const handleClubNameChange = (value: string) =>
    setFormData((f) => ({ ...f, clubName: value, clubSlug: generateSlug(value) }));

  // ── Step 1: search ─────────────────────────────────────────────────────────

  async function handleSearch() {
    if (!searchQuery.trim()) return;
    setCheckLoading(true);
    setCheckError("");
    setMatches(null);
    try {
      const data = await apiJson<{ matches: ClubMatch[] }>(
        `/api/public/clubs/check?q=${encodeURIComponent(searchQuery.trim())}`
      );
      setMatches(data.matches);
    } catch {
      setCheckError("Suche fehlgeschlagen. Bitte erneut versuchen.");
    } finally {
      setCheckLoading(false);
    }
  }

  function proceedToCreate() {
    const zipMatch = searchQuery.trim().match(/\b(\d{4,5})\b/);
    const nameFromQuery = zipMatch
      ? searchQuery.trim().replace(zipMatch[0], "").trim()
      : searchQuery.trim();
    setFormData((f) => ({
      ...f,
      clubName: nameFromQuery || f.clubName,
      clubSlug: generateSlug(nameFromQuery || f.clubName),
    }));
    setStep(2);
  }

  // ── Access request dialog ──────────────────────────────────────────────────

  function openAccessDialog(club: ClubMatch) {
    setAccessDialogClub(club);
    setAccessForm({ firstname: "", lastname: "", email: "", phone: "", message: "" });
    setAccessSuccess(false);
    setAccessError("");
  }

  async function handleAccessSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accessDialogClub) return;
    if (!accessForm.firstname.trim() || !accessForm.lastname.trim() || !accessForm.email.trim()) {
      setAccessError("Vorname, Nachname und E-Mail sind Pflichtfelder.");
      return;
    }
    setAccessSubmitting(true);
    setAccessError("");
    try {
      await apiJson(`/api/public/clubs/${accessDialogClub.slug}/access-request`, {
        method: "POST",
        body: JSON.stringify(accessForm),
      });
      setAccessSuccess(true);
    } catch {
      setAccessError("Ihre Anfrage konnte nicht gesendet werden. Bitte erneut versuchen.");
    } finally {
      setAccessSubmitting(false);
    }
  }

  // ── Step 2 validation ──────────────────────────────────────────────────────

  const validateStep2 = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.clubName.trim()) newErrors.clubName = "Vereinsname ist erforderlich";
    if (!formData.clubSlug.trim()) newErrors.clubSlug = "Slug ist erforderlich";
    if (!/^[a-z0-9-]+$/.test(formData.clubSlug)) newErrors.clubSlug = "Nur Kleinbuchstaben, Zahlen und Bindestriche";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ── Step 3 validation + submit ─────────────────────────────────────────────

  const validateStep3 = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.firstName.trim()) newErrors.firstName = "Vorname ist erforderlich";
    if (!formData.lastName.trim()) newErrors.lastName = "Nachname ist erforderlich";
    if (!formData.email.trim()) newErrors.email = "E-Mail ist erforderlich";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = "Ungültige E-Mail-Adresse";
    if (formData.password.length < 6) newErrors.password = "Mindestens 6 Zeichen";
    if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = "Passwörter stimmen nicht überein";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep3()) return;
    setIsSubmitting(true);
    setErrors({});

    try {
      const data = await apiJson<{ token: string; clubSlug: string }>("/api/auth/setup", {
        method: "POST",
        body: JSON.stringify({
          clubName: formData.clubName, clubSlug: formData.clubSlug, city: formData.city,
          firstName: formData.firstName, lastName: formData.lastName,
          email: formData.email, password: formData.password,
          force: forceCreate,
        }),
      });
      setToken(data.token);
      setStep(4);
      toast({ title: "Setup erfolgreich!", description: "Ihr Verein wurde erstellt." });
    } catch (err: unknown) {
      const e = err as { message?: string; status?: number; matches?: ClubMatch[] };
      if (e.status === 409 && e.matches) {
        setDupConflict(e.matches);
        setForceCreate(false);
      } else {
        setErrors({ general: e.message || "Ein Fehler ist aufgetreten" });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const hasMatches = (matches?.length ?? 0) > 0;
  const hasNoMatch = matches !== null && matches.length === 0;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-forest-dark via-forest to-forest-dark p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card rounded-2xl shadow-lg p-8 max-w-lg w-full border border-border"
      >
        {/* Logo + Title */}
        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 rounded-xl bg-primary flex items-center justify-center">
            <Shield className="w-7 h-7 text-primary-foreground" />
          </div>
        </div>
        <h1 className="font-display text-2xl font-bold text-center text-foreground mb-2">Verein einrichten</h1>
        <p className="text-muted-foreground text-center mb-8 text-sm">
          {step === 4
            ? "Ihr Verein ist einsatzbereit!"
            : "Prüfen Sie zuerst, ob Ihr Verein bereits im SchützenHub-Vereinsregister vorhanden ist."}
        </p>

        {/* Step indicator */}
        {step < 4 && (
          <div className="flex items-center justify-center gap-2 mb-8">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${step >= s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  {s}
                </div>
                {s < 3 && <div className="w-8 h-0.5 bg-border mx-1" />}
              </div>
            ))}
          </div>
        )}

        {/* General error */}
        {errors.general && (
          <div className="mb-6 p-3 rounded-lg bg-destructive/10 border border-destructive/30 flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />{errors.general}
          </div>
        )}

        {/* ── STEP 1: Suchen ────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg mb-6">
                <Search className="w-5 h-5 text-primary" />
                <div>
                  <p className="font-medium">Schritt 1: Verein suchen</p>
                  <p className="text-sm text-muted-foreground">Prüfen Sie ob Ihr Verein bereits existiert</p>
                </div>
              </div>

              <div>
                <Label>Verein suchen</Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Vereinsname, Ort oder PLZ eingeben"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  />
                </div>
              </div>

              <Button
                type="button"
                className="w-full"
                disabled={!searchQuery.trim() || checkLoading}
                onClick={handleSearch}
              >
                {checkLoading
                  ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Suche läuft…</>
                  : <><Search className="w-4 h-4 mr-2" />Suchen</>}
              </Button>

              {checkError && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="w-4 h-4 shrink-0" />{checkError}
                </div>
              )}

              {/* Matches found */}
              {hasMatches && (
                <div className="space-y-3 pt-2">
                  <p className="text-sm font-medium text-foreground">
                    {matches!.length} {matches!.length === 1 ? "Verein" : "Vereine"} gefunden
                  </p>
                  <div className="space-y-2">
                    {matches!.map((m) => (
                      <MatchCard key={m.id} match={m} onAccessRequest={openAccessDialog} onClaimRequest={setClaimDialogClub} />
                    ))}
                  </div>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
                    onClick={proceedToCreate}
                  >
                    Mein Verein ist nicht dabei → Neuen Verein anlegen
                  </button>
                </div>
              )}

              {/* No match */}
              {hasNoMatch && (
                <div className="space-y-3 pt-2">
                  <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-800 dark:bg-green-900/20 dark:border-green-700/40 dark:text-green-200 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    Kein passender Verein gefunden. Sie können einen neuen Verein anlegen.
                  </div>
                  <Button type="button" className="w-full" onClick={proceedToCreate}>
                    Neuen Verein anlegen
                  </Button>
                </div>
              )}
            </motion.div>
          )}

          {/* ── STEP 2: Vereinsdaten ───────────────────────────────────────── */}
          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg mb-6">
                <Building2 className="w-5 h-5 text-primary" />
                <div>
                  <p className="font-medium">Schritt 2: Vereinsdaten</p>
                  <p className="text-sm text-muted-foreground">Grunddaten Ihres Vereins</p>
                </div>
              </div>

              <div>
                <Label>Vereinsname *</Label>
                <Input
                  placeholder="z.B. St. Sebastianus Schützenbruderschaft"
                  value={formData.clubName}
                  onChange={(e) => handleClubNameChange(e.target.value)}
                  className={errors.clubName ? "border-destructive" : ""}
                />
                {errors.clubName && <p className="text-sm text-destructive mt-1">{errors.clubName}</p>}
              </div>
              <div>
                <Label>URL-Kennung *</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground whitespace-nowrap">schuetzenhub.de/</span>
                  <Input
                    placeholder="st-sebastianus"
                    value={formData.clubSlug}
                    onChange={(e) => setFormData((f) => ({ ...f, clubSlug: e.target.value.toLowerCase() }))}
                    className={errors.clubSlug ? "border-destructive" : ""}
                  />
                </div>
                {errors.clubSlug && <p className="text-sm text-destructive mt-1">{errors.clubSlug}</p>}
              </div>
              <div>
                <Label>Ort</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="z.B. Musterstadt"
                    value={formData.city}
                    onChange={(e) => setFormData((f) => ({ ...f, city: e.target.value }))}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <Button type="button" variant="outline" onClick={() => setStep(1)} className="flex-1">Zurück</Button>
                <Button type="button" onClick={() => validateStep2() && setStep(3)} className="flex-1">Weiter</Button>
              </div>
            </motion.div>
          )}

          {/* ── STEP 3: Administrator ──────────────────────────────────────── */}
          {step === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg mb-6">
                  <User className="w-5 h-5 text-primary" />
                  <div>
                    <p className="font-medium">Schritt 3: Administrator</p>
                    <p className="text-sm text-muted-foreground">Erstellen Sie Ihr Admin-Konto</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Vorname *</Label>
                    <Input value={formData.firstName} onChange={(e) => setFormData((f) => ({ ...f, firstName: e.target.value }))} className={errors.firstName ? "border-destructive" : ""} />
                    {errors.firstName && <p className="text-sm text-destructive mt-1">{errors.firstName}</p>}
                  </div>
                  <div>
                    <Label>Nachname *</Label>
                    <Input value={formData.lastName} onChange={(e) => setFormData((f) => ({ ...f, lastName: e.target.value }))} className={errors.lastName ? "border-destructive" : ""} />
                    {errors.lastName && <p className="text-sm text-destructive mt-1">{errors.lastName}</p>}
                  </div>
                </div>
                <div>
                  <Label>E-Mail *</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input type="email" placeholder="admin@ihr-verein.de" value={formData.email} onChange={(e) => setFormData((f) => ({ ...f, email: e.target.value }))} className={`pl-10 ${errors.email ? "border-destructive" : ""}`} />
                  </div>
                  {errors.email && <p className="text-sm text-destructive mt-1">{errors.email}</p>}
                </div>
                <div>
                  <Label>Passwort *</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input type="password" placeholder="Mindestens 6 Zeichen" value={formData.password} onChange={(e) => setFormData((f) => ({ ...f, password: e.target.value }))} className={`pl-10 ${errors.password ? "border-destructive" : ""}`} />
                  </div>
                  {errors.password && <p className="text-sm text-destructive mt-1">{errors.password}</p>}
                </div>
                <div>
                  <Label>Passwort bestätigen *</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input type="password" placeholder="Passwort wiederholen" value={formData.confirmPassword} onChange={(e) => setFormData((f) => ({ ...f, confirmPassword: e.target.value }))} className={`pl-10 ${errors.confirmPassword ? "border-destructive" : ""}`} />
                  </div>
                  {errors.confirmPassword && <p className="text-sm text-destructive mt-1">{errors.confirmPassword}</p>}
                </div>

                {/* 409 duplicate conflict panel */}
                {dupConflict && (
                  <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-700/40 space-y-3">
                    <p className="text-sm font-medium text-amber-900 dark:text-amber-200 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      Wir haben mögliche bestehende Vereinsprofile gefunden.
                    </p>
                    <div className="space-y-2">
                      {dupConflict.map((m) => (
                        <MatchCard key={m.id} match={m} onAccessRequest={openAccessDialog} onClaimRequest={setClaimDialogClub} compact />
                      ))}
                    </div>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={forceCreate}
                        onChange={(e) => setForceCreate(e.target.checked)}
                        className="mt-0.5 accent-primary"
                      />
                      <span className="text-sm text-amber-800 dark:text-amber-200">
                        Ich bestätige, dass keiner der angezeigten Vereine meinem Verein entspricht.
                      </span>
                    </label>
                  </div>
                )}

                <div className="flex gap-3 mt-6">
                  <Button type="button" variant="outline" onClick={() => setStep(2)} className="flex-1">Zurück</Button>
                  <Button type="submit" disabled={isSubmitting || (dupConflict !== null && !forceCreate)} className="flex-1">
                    {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin mr-1" />Setup läuft…</> : "Verein erstellen"}
                  </Button>
                </div>
              </form>
            </motion.div>
          )}

          {/* ── STEP 4: Fertig ────────────────────────────────────────────── */}
          {step === 4 && (
            <motion.div key="step4" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-6">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold mb-2">{formData.clubName} ist bereit!</h2>
                <p className="text-muted-foreground">Ihr Verein wurde erfolgreich eingerichtet.</p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg text-left space-y-3">
                {["Verein erstellt", "Administrator-Konto angelegt", "'1. Kompanie' erstellt", "Öffentliche Homepage aktiv"].map((text) => (
                  <div key={text} className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                    <span className="text-sm">{text}</span>
                  </div>
                ))}
              </div>
              <Button onClick={() => navigate("/portal")} className="w-full" size="lg">
                <Users className="w-5 h-5 mr-2" />Zum Mitgliederportal
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {step < 4 && (
          <div className="mt-6 pt-6 border-t border-border">
            <a href="/" className="block text-center text-sm text-muted-foreground hover:text-foreground transition-colors">
              ← Zurück zur Startseite
            </a>
          </div>
        )}
      </motion.div>

      {/* ── Claim Dialog ──────────────────────────────────────────────────── */}
      <ClubClaimDialog
        clubSlug={claimDialogClub?.slug ?? ""}
        clubName={claimDialogClub?.name ?? ""}
        open={claimDialogClub !== null}
        onOpenChange={(open) => !open && setClaimDialogClub(null)}
      />

      {/* ── Access Request Dialog ──────────────────────────────────────────── */}
      <Dialog open={accessDialogClub !== null} onOpenChange={(open) => !open && setAccessDialogClub(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Zugang anfragen</DialogTitle>
            <DialogDescription>
              {accessDialogClub?.name} – Senden Sie eine Anfrage an den Vereinsadministrator.
            </DialogDescription>
          </DialogHeader>

          {accessSuccess ? (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="font-medium">Anfrage gesendet!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Der Vereinsadministrator wird sich bei Ihnen melden.
                </p>
              </div>
              <Button variant="outline" onClick={() => setAccessDialogClub(null)} className="w-full">
                Schließen
              </Button>
            </div>
          ) : (
            <form onSubmit={handleAccessSubmit} className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Vorname *</Label>
                  <Input
                    value={accessForm.firstname}
                    onChange={(e) => setAccessForm((f) => ({ ...f, firstname: e.target.value }))}
                    placeholder="Max"
                  />
                </div>
                <div>
                  <Label>Nachname *</Label>
                  <Input
                    value={accessForm.lastname}
                    onChange={(e) => setAccessForm((f) => ({ ...f, lastname: e.target.value }))}
                    placeholder="Mustermann"
                  />
                </div>
              </div>
              <div>
                <Label>E-Mail *</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="email"
                    value={accessForm.email}
                    onChange={(e) => setAccessForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="max@beispiel.de"
                    className="pl-10"
                  />
                </div>
              </div>
              <div>
                <Label>Telefon</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={accessForm.phone}
                    onChange={(e) => setAccessForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="+49 123 456789"
                    className="pl-10"
                  />
                </div>
              </div>
              <div>
                <Label>Nachricht</Label>
                <div className="relative">
                  <MessageSquare className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Textarea
                    value={accessForm.message}
                    onChange={(e) => setAccessForm((f) => ({ ...f, message: e.target.value }))}
                    placeholder="Kurze Beschreibung Ihrer Anfrage…"
                    className="pl-10 resize-none"
                    rows={3}
                  />
                </div>
              </div>

              {accessError && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="w-4 h-4 shrink-0" />{accessError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setAccessDialogClub(null)} className="flex-1">
                  Abbrechen
                </Button>
                <Button type="submit" disabled={accessSubmitting} className="flex-1">
                  {accessSubmitting
                    ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Wird gesendet…</>
                    : "Anfrage senden"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Setup;
