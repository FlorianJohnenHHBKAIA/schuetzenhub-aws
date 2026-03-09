import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Shield, Building2, User, Mail, Lock, Loader2, AlertCircle, CheckCircle2, MapPin, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiJson, setToken } from "@/integrations/api/client";

const Setup = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    clubName: "", clubSlug: "", city: "",
    firstName: "", lastName: "", email: "", password: "", confirmPassword: "",
  });

  const generateSlug = (name: string) =>
    name.toLowerCase().replace(/ä/g,"ae").replace(/ö/g,"oe").replace(/ü/g,"ue").replace(/ß/g,"ss").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");

  const handleClubNameChange = (value: string) =>
    setFormData({ ...formData, clubName: value, clubSlug: generateSlug(value) });

  const validateStep1 = () => {
    const newErrors: Record<string,string> = {};
    if (!formData.clubName.trim()) newErrors.clubName = "Vereinsname ist erforderlich";
    if (!formData.clubSlug.trim()) newErrors.clubSlug = "Slug ist erforderlich";
    if (!/^[a-z0-9-]+$/.test(formData.clubSlug)) newErrors.clubSlug = "Nur Kleinbuchstaben, Zahlen und Bindestriche";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    const newErrors: Record<string,string> = {};
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
    if (!validateStep2()) return;
    setIsSubmitting(true);
    setErrors({});

    try {
      const data = await apiJson<{ token: string; clubSlug: string }>("/api/auth/setup", {
        method: "POST",
        body: JSON.stringify({
          clubName: formData.clubName, clubSlug: formData.clubSlug, city: formData.city,
          firstName: formData.firstName, lastName: formData.lastName,
          email: formData.email, password: formData.password,
        }),
      });
      setToken(data.token);
      setStep(3);
      toast({ title: "Setup erfolgreich!", description: "Ihr Verein wurde erstellt." });
    } catch (err: unknown) {
      setErrors({ general: (err as Error).message || "Ein Fehler ist aufgetreten" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-forest-dark via-forest to-forest-dark p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-2xl shadow-lg p-8 max-w-lg w-full border border-border">
        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 rounded-xl bg-primary flex items-center justify-center">
            <Shield className="w-7 h-7 text-primary-foreground" />
          </div>
        </div>
        <h1 className="font-display text-2xl font-bold text-center text-foreground mb-2">Willkommen bei SchützenHub</h1>
        <p className="text-muted-foreground text-center mb-8">{step === 3 ? "Ihr Verein ist einsatzbereit!" : "Richten Sie Ihren Verein ein"}</p>

        {step < 3 && (
          <div className="flex items-center justify-center gap-2 mb-8">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${step >= s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{s}</div>
                {s < 3 && <div className="w-8 h-0.5 bg-border mx-1" />}
              </div>
            ))}
          </div>
        )}

        {errors.general && (
          <div className="mb-6 p-3 rounded-lg bg-destructive/10 border border-destructive/30 flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />{errors.general}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {step === 1 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg mb-6">
                <Building2 className="w-5 h-5 text-primary" />
                <div><p className="font-medium">Schritt 1: Vereinsdaten</p><p className="text-sm text-muted-foreground">Grunddaten Ihres Vereins</p></div>
              </div>
              <div>
                <Label>Vereinsname *</Label>
                <Input placeholder="z.B. St. Sebastianus Schützenbruderschaft" value={formData.clubName} onChange={(e) => handleClubNameChange(e.target.value)} className={errors.clubName ? "border-destructive" : ""} />
                {errors.clubName && <p className="text-sm text-destructive mt-1">{errors.clubName}</p>}
              </div>
              <div>
                <Label>URL-Kennung *</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground whitespace-nowrap">schuetzenhub.de/</span>
                  <Input placeholder="st-sebastianus" value={formData.clubSlug} onChange={(e) => setFormData({...formData, clubSlug: e.target.value.toLowerCase()})} className={errors.clubSlug ? "border-destructive" : ""} />
                </div>
                {errors.clubSlug && <p className="text-sm text-destructive mt-1">{errors.clubSlug}</p>}
              </div>
              <div>
                <Label>Ort</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="z.B. Musterstadt" value={formData.city} onChange={(e) => setFormData({...formData, city: e.target.value})} className="pl-10" />
                </div>
              </div>
              <Button type="button" onClick={() => validateStep1() && setStep(2)} className="w-full mt-6">Weiter</Button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg mb-6">
                <User className="w-5 h-5 text-primary" />
                <div><p className="font-medium">Schritt 2: Administrator</p><p className="text-sm text-muted-foreground">Erstellen Sie Ihr Admin-Konto</p></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Vorname *</Label>
                  <Input value={formData.firstName} onChange={(e) => setFormData({...formData, firstName: e.target.value})} className={errors.firstName ? "border-destructive" : ""} />
                  {errors.firstName && <p className="text-sm text-destructive mt-1">{errors.firstName}</p>}
                </div>
                <div>
                  <Label>Nachname *</Label>
                  <Input value={formData.lastName} onChange={(e) => setFormData({...formData, lastName: e.target.value})} className={errors.lastName ? "border-destructive" : ""} />
                  {errors.lastName && <p className="text-sm text-destructive mt-1">{errors.lastName}</p>}
                </div>
              </div>
              <div>
                <Label>E-Mail *</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input type="email" placeholder="admin@ihr-verein.de" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className={`pl-10 ${errors.email ? "border-destructive" : ""}`} />
                </div>
                {errors.email && <p className="text-sm text-destructive mt-1">{errors.email}</p>}
              </div>
              <div>
                <Label>Passwort *</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input type="password" placeholder="Mindestens 6 Zeichen" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} className={`pl-10 ${errors.password ? "border-destructive" : ""}`} />
                </div>
                {errors.password && <p className="text-sm text-destructive mt-1">{errors.password}</p>}
              </div>
              <div>
                <Label>Passwort bestätigen *</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input type="password" placeholder="Passwort wiederholen" value={formData.confirmPassword} onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})} className={`pl-10 ${errors.confirmPassword ? "border-destructive" : ""}`} />
                </div>
                {errors.confirmPassword && <p className="text-sm text-destructive mt-1">{errors.confirmPassword}</p>}
              </div>
              <div className="flex gap-3 mt-6">
                <Button type="button" variant="outline" onClick={() => setStep(1)} className="flex-1">Zurück</Button>
                <Button type="submit" disabled={isSubmitting} className="flex-1">
                  {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" />Setup läuft...</> : "Verein erstellen"}
                </Button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-6">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold mb-2">{formData.clubName} ist bereit!</h2>
                <p className="text-muted-foreground">Ihr Verein wurde erfolgreich eingerichtet.</p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg text-left space-y-3">
                {["Verein erstellt", "Administrator-Konto angelegt", "'1. Kompanie' erstellt", "Öffentliche Homepage aktiv"].map(text => (
                  <div key={text} className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-primary" /><span className="text-sm">{text}</span></div>
                ))}
              </div>
              <Button onClick={() => navigate("/portal")} className="w-full" size="lg">
                <Users className="w-5 h-5" />Zum Mitgliederportal
              </Button>
            </motion.div>
          )}
        </form>

        {step < 3 && (
          <div className="mt-6 pt-6 border-t border-border">
            <a href="/" className="block text-center text-sm text-muted-foreground hover:text-foreground transition-colors">← Zurück zur Startseite</a>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default Setup;
