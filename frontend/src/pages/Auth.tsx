import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Shield, Mail, Lock, Loader2, AlertCircle, User, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { apiJson, setToken } from "@/integrations/api/client";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

const emailSchema = z.string().email("Bitte geben Sie eine gültige E-Mail-Adresse ein");
const passwordSchema = z.string().min(6, "Das Passwort muss mindestens 6 Zeichen haben");
const nameSchema = z.string().min(2, "Mindestens 2 Zeichen erforderlich");

interface Club { id: string; name: string; slug: string; }

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [selectedClubId, setSelectedClubId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; firstName?: string; lastName?: string; club?: string; general?: string }>({});
  
  const { signIn, user, isLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: clubs = [], isLoading: isLoadingClubs } = useQuery({
    queryKey: ["clubs-for-registration"],
    queryFn: async () => apiJson<Club[]>("/api/clubs/registration"),
    enabled: !isLogin,
  });

  useEffect(() => {
    if (user && !isLoading) navigate("/portal");
  }, [user, isLoading, navigate]);

  const validateForm = () => {
    const newErrors: typeof errors = {};
    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) newErrors.email = emailResult.error.errors[0].message;
    const passwordResult = passwordSchema.safeParse(password);
    if (!passwordResult.success) newErrors.password = passwordResult.error.errors[0].message;
    if (!isLogin) {
      const firstNameResult = nameSchema.safeParse(firstName);
      if (!firstNameResult.success) newErrors.firstName = firstNameResult.error.errors[0].message;
      const lastNameResult = nameSchema.safeParse(lastName);
      if (!lastNameResult.success) newErrors.lastName = lastNameResult.error.errors[0].message;
      if (!selectedClubId) newErrors.club = "Bitte wählen Sie einen Verein aus";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    if (!validateForm()) return;
    setIsSubmitting(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          setErrors({ general: error.message.includes("Ungültige") ? "E-Mail oder Passwort ist falsch" : error.message });
        } else {
          toast({ title: "Willkommen zurück!", description: "Sie wurden erfolgreich angemeldet." });
        }
      } else {
        const data = await apiJson<{ token: string }>("/api/auth/register", {
          method: "POST",
          body: JSON.stringify({ email, password, firstName, lastName, clubId: selectedClubId }),
        });
        setToken(data.token);
        toast({ title: "Registrierung erfolgreich!", description: "Ihr Konto wurde erstellt." });
        navigate("/portal");
      }
    } catch (err: unknown) {
      setErrors({ general: (err as Error).message || "Ein unerwarteter Fehler ist aufgetreten" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-forest-dark via-forest to-forest-dark p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="w-full max-w-md">
        <div className="bg-card rounded-2xl shadow-lg p-8 border border-border">
          <div className="flex justify-center mb-6">
            <div className="w-14 h-14 rounded-xl bg-primary flex items-center justify-center">
              <Shield className="w-7 h-7 text-primary-foreground" />
            </div>
          </div>
          <h1 className="font-display text-2xl font-bold text-center text-foreground mb-2">
            {isLogin ? "Anmelden" : "Registrieren"}
          </h1>
          <p className="text-muted-foreground text-center mb-6">
            {isLogin ? "Melden Sie sich in Ihrem Vereinsportal an" : "Erstellen Sie Ihr Konto"}
          </p>

          {errors.general && (
            <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/30 flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {errors.general}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">E-Mail</Label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="email" type="email" placeholder="ihre@email.de" value={email} onChange={(e) => setEmail(e.target.value)} className={`pl-10 ${errors.email ? "border-destructive" : ""}`} disabled={isSubmitting} />
              </div>
              {errors.email && <p className="text-sm text-destructive mt-1">{errors.email}</p>}
            </div>

            {!isLogin && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="firstName">Vorname</Label>
                    <div className="relative mt-1">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input id="firstName" placeholder="Max" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={`pl-10 ${errors.firstName ? "border-destructive" : ""}`} disabled={isSubmitting} />
                    </div>
                    {errors.firstName && <p className="text-sm text-destructive mt-1">{errors.firstName}</p>}
                  </div>
                  <div>
                    <Label htmlFor="lastName">Nachname</Label>
                    <Input id="lastName" placeholder="Mustermann" value={lastName} onChange={(e) => setLastName(e.target.value)} className={`${errors.lastName ? "border-destructive" : ""}`} disabled={isSubmitting} />
                    {errors.lastName && <p className="text-sm text-destructive mt-1">{errors.lastName}</p>}
                  </div>
                </div>
                <div>
                  <Label>Verein</Label>
                  <div className="relative mt-1">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
                    <Select value={selectedClubId} onValueChange={setSelectedClubId} disabled={isSubmitting || isLoadingClubs}>
                      <SelectTrigger className={`pl-10 ${errors.club ? "border-destructive" : ""}`}>
                        <SelectValue placeholder={isLoadingClubs ? "Lade Vereine..." : "Verein auswählen"} />
                      </SelectTrigger>
                      <SelectContent>
                        {clubs.map((club) => (
                          <SelectItem key={club.id} value={club.id}>{club.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {errors.club && <p className="text-sm text-destructive mt-1">{errors.club}</p>}
                </div>
              </>
            )}

            <div>
              <Label htmlFor="password">Passwort</Label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className={`pl-10 ${errors.password ? "border-destructive" : ""}`} disabled={isSubmitting} />
              </div>
              {errors.password && <p className="text-sm text-destructive mt-1">{errors.password}</p>}
            </div>

            <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Bitte warten...</> : isLogin ? "Anmelden" : "Registrieren"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button onClick={() => { setIsLogin(!isLogin); setErrors({}); }} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {isLogin ? "Noch kein Konto? Jetzt registrieren" : "Bereits ein Konto? Jetzt anmelden"}
            </button>
          </div>
          <div className="mt-6 pt-6 border-t border-border">
            <a href="/" className="block text-center text-sm text-muted-foreground hover:text-foreground transition-colors">← Zurück zur Startseite</a>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Auth;
