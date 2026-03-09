import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Save, Upload, ExternalLink, Image, FileText, Phone, Mail, Globe, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import PortalLayout from "@/components/portal/PortalLayout";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

interface ClubProfile {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  location_city: string | null;
  location_zip: string | null;
  tagline: string | null;
  description: string | null;
  logo_path: string | null;
  hero_image_path: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website_url: string | null;
  join_cta_text: string | null;
  join_cta_url: string | null;
  imprint_text: string | null;
  privacy_text: string | null;
}

const ClubProfilePage = () => {
  const { member, hasPermission } = useAuth();
  const [profile, setProfile] = useState<ClubProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [heroFile, setHeroFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [heroPreview, setHeroPreview] = useState<string | null>(null);

  const canEdit = hasPermission("club.settings.manage") || hasPermission("club.admin.full");

  useEffect(() => {
    if (member?.club_id) {
      fetchProfile();
    }
  }, [member?.club_id]);

  const fetchProfile = async () => {
    if (!member?.club_id) return;
    
    try {
      const { data, error } = await supabase
        .from("clubs")
        .select("id, name, slug, city, location_city, location_zip, tagline, description, logo_path, hero_image_path, contact_email, contact_phone, website_url, join_cta_text, join_cta_url, imprint_text, privacy_text")
        .eq("id", member.club_id)
        .single();

      if (error) throw error;
      setProfile(data);
      
      // Set image previews
      if (data.logo_path) {
        const { data: urlData } = supabase.storage.from("club-assets").getPublicUrl(data.logo_path);
        setLogoPreview(urlData.publicUrl);
      }
      if (data.hero_image_path) {
        const { data: urlData } = supabase.storage.from("club-assets").getPublicUrl(data.hero_image_path);
        setHeroPreview(urlData.publicUrl);
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
      toast.error("Fehler beim Laden des Profils");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (type: "logo" | "hero", file: File | null) => {
    if (!file) return;
    
    if (type === "logo") {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    } else {
      setHeroFile(file);
      setHeroPreview(URL.createObjectURL(file));
    }
  };

  const uploadFile = async (file: File, type: "logo" | "hero"): Promise<string | null> => {
    if (!profile?.id) return null;
    
    const ext = file.name.split(".").pop();
    const fileName = `${profile.id}/${type}-${Date.now()}.${ext}`;
    
    const { error } = await supabase.storage
      .from("club-assets")
      .upload(fileName, file, { upsert: true });

    if (error) {
      console.error("Upload error:", error);
      throw error;
    }
    
    return fileName;
  };

  const handleSave = async () => {
    if (!profile || !canEdit) return;
    
    setIsSaving(true);
    try {
      let logoPath = profile.logo_path;
      let heroPath = profile.hero_image_path;

      // Upload new files if selected
      if (logoFile) {
        logoPath = await uploadFile(logoFile, "logo");
      }
      if (heroFile) {
        heroPath = await uploadFile(heroFile, "hero");
      }

      const { error } = await supabase
        .from("clubs")
        .update({
          location_city: profile.location_city,
          location_zip: profile.location_zip,
          tagline: profile.tagline,
          description: profile.description,
          logo_path: logoPath,
          hero_image_path: heroPath,
          contact_email: profile.contact_email,
          contact_phone: profile.contact_phone,
          website_url: profile.website_url,
          join_cta_text: profile.join_cta_text,
          join_cta_url: profile.join_cta_url,
          imprint_text: profile.imprint_text,
          privacy_text: profile.privacy_text,
        })
        .eq("id", profile.id);

      if (error) throw error;

      setProfile({ ...profile, logo_path: logoPath, hero_image_path: heroPath });
      setLogoFile(null);
      setHeroFile(null);
      toast.success("Profil erfolgreich gespeichert");
    } catch (error) {
      console.error("Error saving profile:", error);
      toast.error("Fehler beim Speichern");
    } finally {
      setIsSaving(false);
    }
  };

  const updateField = (field: keyof ClubProfile, value: string | null) => {
    if (!profile) return;
    setProfile({ ...profile, [field]: value || null });
  };

  if (isLoading) {
    return (
      <PortalLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </PortalLayout>
    );
  }

  if (!canEdit) {
    return (
      <PortalLayout>
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold text-foreground mb-2">Keine Berechtigung</h1>
            <p className="text-muted-foreground">
              Sie haben keine Berechtigung, das Vereinsprofil zu bearbeiten.
            </p>
          </div>
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-3xl font-bold text-foreground mb-2">
                Öffentliches Vereinsprofil
              </h1>
              <p className="text-muted-foreground">
                Verwalten Sie die öffentlich sichtbaren Informationen Ihres Vereins.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" asChild>
                <a href={`/verein/${profile?.slug}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Vorschau
                </a>
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                <Save className="w-4 h-4 mr-2" />
                {isSaving ? "Speichert..." : "Speichern"}
              </Button>
            </div>
          </div>
        </motion.div>

        <div className="space-y-6">
          {/* Branding */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Image className="w-5 h-5" />
                Branding
              </CardTitle>
              <CardDescription>Logo und Hero-Bild für die öffentliche Seite</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Logo Upload */}
                <div>
                  <Label>Vereinslogo</Label>
                  <div className="mt-2 space-y-3">
                    {logoPreview && (
                      <div className="w-32 h-32 rounded-lg border border-border overflow-hidden bg-muted">
                        <img src={logoPreview} alt="Logo" className="w-full h-full object-contain" />
                      </div>
                    )}
                    <div>
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileChange("logo", e.target.files?.[0] || null)}
                        className="cursor-pointer"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Empfohlen: Quadratisch, min. 200x200px
                      </p>
                    </div>
                  </div>
                </div>

                {/* Hero Upload */}
                <div>
                  <Label>Hero-Bild</Label>
                  <div className="mt-2 space-y-3">
                    {heroPreview && (
                      <div className="w-full h-32 rounded-lg border border-border overflow-hidden bg-muted">
                        <img src={heroPreview} alt="Hero" className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div>
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileChange("hero", e.target.files?.[0] || null)}
                        className="cursor-pointer"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Empfohlen: 1920x600px, Querformat
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div>
                  <Label htmlFor="tagline">Tagline / Slogan</Label>
                  <Input
                    id="tagline"
                    value={profile?.tagline || ""}
                    onChange={(e) => updateField("tagline", e.target.value)}
                    placeholder="z.B. Tradition, Gemeinschaft, Schützenwesen"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="description">Beschreibung</Label>
                  <Textarea
                    id="description"
                    value={profile?.description || ""}
                    onChange={(e) => updateField("description", e.target.value)}
                    placeholder="Stellen Sie Ihren Verein vor..."
                    className="mt-1 min-h-[150px]"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Location */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5" />
                Standort
              </CardTitle>
              <CardDescription>Adressinformationen für die öffentliche Darstellung</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="location_zip">PLZ</Label>
                  <Input
                    id="location_zip"
                    value={profile?.location_zip || ""}
                    onChange={(e) => updateField("location_zip", e.target.value)}
                    placeholder="12345"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="location_city">Ort</Label>
                  <Input
                    id="location_city"
                    value={profile?.location_city || ""}
                    onChange={(e) => updateField("location_city", e.target.value)}
                    placeholder="Musterstadt"
                    className="mt-1"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contact */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Kontakt
              </CardTitle>
              <CardDescription>Öffentliche Kontaktdaten des Vereins</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="contact_email">E-Mail</Label>
                  <Input
                    id="contact_email"
                    type="email"
                    value={profile?.contact_email || ""}
                    onChange={(e) => updateField("contact_email", e.target.value)}
                    placeholder="info@schuetzenverein.de"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="contact_phone">Telefon</Label>
                  <Input
                    id="contact_phone"
                    value={profile?.contact_phone || ""}
                    onChange={(e) => updateField("contact_phone", e.target.value)}
                    placeholder="+49 123 456789"
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="website_url">Website</Label>
                <Input
                  id="website_url"
                  type="url"
                  value={profile?.website_url || ""}
                  onChange={(e) => updateField("website_url", e.target.value)}
                  placeholder="https://www.schuetzenverein.de"
                  className="mt-1"
                />
              </div>
            </CardContent>
          </Card>

          {/* CTA */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Mitglied werden
              </CardTitle>
              <CardDescription>Call-to-Action für potenzielle Neumitglieder</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="join_cta_text">Button-Text</Label>
                <Input
                  id="join_cta_text"
                  value={profile?.join_cta_text || ""}
                  onChange={(e) => updateField("join_cta_text", e.target.value)}
                  placeholder="Jetzt Mitglied werden"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="join_cta_url">Button-Link</Label>
                <Input
                  id="join_cta_url"
                  type="url"
                  value={profile?.join_cta_url || ""}
                  onChange={(e) => updateField("join_cta_url", e.target.value)}
                  placeholder="mailto:info@verein.de oder https://..."
                  className="mt-1"
                />
              </div>
            </CardContent>
          </Card>

          {/* Legal */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Rechtliches
              </CardTitle>
              <CardDescription>Impressum und Datenschutzhinweise</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="imprint_text">Impressum</Label>
                <Textarea
                  id="imprint_text"
                  value={profile?.imprint_text || ""}
                  onChange={(e) => updateField("imprint_text", e.target.value)}
                  placeholder="Vereinsangaben, Vertretungsberechtigte, Registergericht..."
                  className="mt-1 min-h-[120px]"
                />
              </div>
              <div>
                <Label htmlFor="privacy_text">Datenschutzhinweis</Label>
                <Textarea
                  id="privacy_text"
                  value={profile?.privacy_text || ""}
                  onChange={(e) => updateField("privacy_text", e.target.value)}
                  placeholder="Informationen zum Datenschutz..."
                  className="mt-1 min-h-[120px]"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PortalLayout>
  );
};

export default ClubProfilePage;
