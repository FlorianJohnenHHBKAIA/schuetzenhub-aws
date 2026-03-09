import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Building2,
  Globe,
  Crown,
  Save,
  Loader2,
  ExternalLink,
  Lock,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import PortalLayout from "@/components/portal/PortalLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Club = Database["public"]["Tables"]["clubs"]["Row"];

const planLabels: Record<string, { label: string; color: string }> = {
  free: { label: "Kostenlos", color: "secondary" },
  basic: { label: "Basic", color: "default" },
  pro: { label: "Pro", color: "default" },
};

const planFeatures = {
  free: [
    "1 Kompanie",
    "Bis zu 50 Mitglieder",
    "Grundfunktionen",
  ],
  basic: [
    "Bis zu 5 Kompanien",
    "Unbegrenzte Mitglieder",
    "Erweiterte Funktionen",
    "E-Mail-Support",
  ],
  pro: [
    "Unbegrenzte Kompanien",
    "Unbegrenzte Mitglieder",
    "Alle Funktionen",
    "Eigene Domain",
    "Prioritäts-Support",
    "Branding entfernbar",
  ],
};

const Settings = () => {
  const { member, isAdmin } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [club, setClub] = useState<Club | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    city: "",
  });

  useEffect(() => {
    if (member?.club_id) {
      fetchClub();
    }
  }, [member?.club_id]);

  const fetchClub = async () => {
    try {
      const { data, error } = await supabase
        .from("clubs")
        .select("*")
        .eq("id", member!.club_id)
        .single();

      if (error) throw error;
      setClub(data);
      setFormData({
        name: data.name || "",
        city: data.city || "",
      });
    } catch (error) {
      console.error("Error fetching club:", error);
      toast({
        title: "Fehler",
        description: "Vereinsdaten konnten nicht geladen werden.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!club || !isAdmin) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("clubs")
        .update({
          name: formData.name,
          city: formData.city,
        })
        .eq("id", club.id);

      if (error) throw error;

      setClub({ ...club, name: formData.name, city: formData.city });
      toast({
        title: "Gespeichert",
        description: "Vereinsdaten wurden aktualisiert.",
      });
    } catch (error) {
      console.error("Error saving club:", error);
      toast({
        title: "Fehler",
        description: "Änderungen konnten nicht gespeichert werden.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <PortalLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </PortalLayout>
    );
  }

  if (!isAdmin) {
    return (
      <PortalLayout>
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <Lock className="w-12 h-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">Kein Zugriff</h2>
          <p className="text-muted-foreground">
            Sie benötigen Administrator-Rechte, um die Einstellungen zu verwalten.
          </p>
        </div>
      </PortalLayout>
    );
  }

  const currentPlan = club?.plan || "free";
  const planInfo = planLabels[currentPlan];

  return (
    <PortalLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto space-y-6"
      >
        {/* Header */}
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Einstellungen</h1>
          <p className="text-muted-foreground mt-1">Verwalten Sie die Einstellungen Ihres Vereins</p>
        </div>

        {/* Club Data */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Vereinsdaten
            </CardTitle>
            <CardDescription>
              Grundlegende Informationen über Ihren Verein
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Vereinsname</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="z.B. St. Sebastianus Schützenbruderschaft"
                />
              </div>
              <div>
                <Label htmlFor="city">Ort</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="z.B. Musterstadt"
                />
              </div>
            </div>
            <div>
              <Label>URL-Slug</Label>
              <div className="flex items-center gap-2 mt-1">
                <code className="px-3 py-2 bg-muted rounded-lg text-sm">
                  {club?.slug}
                </code>
                <span className="text-sm text-muted-foreground">
                  (nicht änderbar)
                </span>
              </div>
            </div>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Speichern...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Speichern
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Domain Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              Domain & URLs
            </CardTitle>
            <CardDescription>
              Ihre öffentliche Homepage und Portal-Adressen
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium">Öffentliche Homepage</span>
                  <Badge variant="outline">Standard</Badge>
                </div>
                <code className="text-sm text-primary">
                  schuetzenhub.de/{club?.slug}
                </code>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium">Mitgliederportal</span>
                  <Badge variant="outline">Standard</Badge>
                </div>
                <code className="text-sm text-primary">
                  schuetzenhub.de/{club?.slug}/portal
                </code>
              </div>
            </div>

            {/* Custom Domain */}
            <div className="border-t border-border pt-4 mt-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="font-medium">Eigene Domain</h4>
                  <p className="text-sm text-muted-foreground">
                    Nutzen Sie Ihre eigene Domain für die Homepage
                  </p>
                </div>
                {currentPlan !== "pro" && (
                  <Badge variant="secondary">
                    <Crown className="w-3 h-3 mr-1" />
                    Pro
                  </Badge>
                )}
              </div>
              {club?.custom_domain ? (
                <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                  <code className="text-sm">{club.custom_domain}</code>
                  <Badge 
                    variant={club.domain_status === "active" ? "default" : "secondary"}
                    className="ml-auto"
                  >
                    {club.domain_status === "active" ? "Aktiv" : 
                     club.domain_status === "pending" ? "Ausstehend" : "Inaktiv"}
                  </Badge>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {currentPlan === "pro" 
                      ? "Keine eigene Domain konfiguriert. Kontaktieren Sie den Support zur Einrichtung."
                      : "Eigene Domains sind im Pro-Tarif verfügbar."}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Plan & Subscription */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="w-5 h-5" />
              Tarif & Abonnement
            </CardTitle>
            <CardDescription>
              Ihr aktueller Plan und verfügbare Upgrades
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(["free", "basic", "pro"] as const).map((planKey) => {
                const isCurrentPlan = currentPlan === planKey;
                const info = planLabels[planKey];
                const features = planFeatures[planKey];

                return (
                  <div
                    key={planKey}
                    className={`p-4 rounded-lg border-2 transition-colors ${
                      isCurrentPlan
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold">{info.label}</h4>
                      {isCurrentPlan && (
                        <Badge>Aktuell</Badge>
                      )}
                    </div>
                    <ul className="space-y-2 mb-4">
                      {features.map((feature, idx) => (
                        <li key={idx} className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    {!isCurrentPlan && planKey !== "free" && (
                      <Button variant="outline" size="sm" className="w-full" disabled>
                        <ExternalLink className="w-4 h-4" />
                        Bald verfügbar
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>

            {club?.plan_started_at && (
              <p className="text-sm text-muted-foreground mt-4">
                Aktueller Tarif aktiv seit: {new Date(club.plan_started_at).toLocaleDateString("de-DE")}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Powered By Notice */}
        <Card className="bg-muted/30">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Ihre öffentliche Seite zeigt „Powered by SchützenHub"</span>
              </div>
              {currentPlan !== "pro" && (
                <Badge variant="secondary" className="text-xs">
                  <Crown className="w-3 h-3 mr-1" />
                  Im Pro-Tarif entfernbar
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </PortalLayout>
  );
};

export default Settings;