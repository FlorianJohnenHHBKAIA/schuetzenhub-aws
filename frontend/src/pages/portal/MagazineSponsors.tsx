import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, Plus, Building2, Globe, Mail, User, MoreHorizontal,
  Loader2, Trash2, Edit, Check, X, ImageIcon
} from "lucide-react";
import PortalLayout from "@/components/portal/PortalLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AdHistory {
  magazine_id: string;
  magazine_title: string;
  magazine_year: number;
  ad_type: string;
  status: string;
}

interface Sponsor {
  id: string;
  club_id: string;
  name: string;
  logo_path: string | null;
  website_url: string | null;
  contact_name: string | null;
  contact_email: string | null;
  active: boolean;
  created_at: string;
  ad_count?: number;
  last_ad_year?: number;
  ad_years?: number[];
  ad_history?: AdHistory[];
}

const MagazineSponsors = () => {
  const navigate = useNavigate();
  const { member, hasPermission } = useAuth();
  const { toast } = useToast();

  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingSponsor, setEditingSponsor] = useState<Sponsor | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formWebsite, setFormWebsite] = useState("");
  const [formContactName, setFormContactName] = useState("");
  const [formContactEmail, setFormContactEmail] = useState("");
  const [formActive, setFormActive] = useState(true);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const canManageAds = hasPermission("club.magazine.ads.manage");
  const canManageMagazine = hasPermission("club.magazine.manage");
  const canAccess = canManageAds || canManageMagazine;

  useEffect(() => {
    if (member?.club_id) fetchSponsors();
  }, [member?.club_id]);

  const fetchSponsors = async () => {
    setIsLoading(true);

    // Fetch sponsors with ad count and history
    const { data: sponsorsData, error } = await supabase
      .from("sponsors")
      .select(`
        *,
        magazine_ads(id, magazine_id, ad_type, status, magazines(id, title, year))
      `)
      .eq("club_id", member!.club_id)
      .order("name");

    if (!error && sponsorsData) {
      const enrichedSponsors = sponsorsData.map((s: any) => {
        const ads = s.magazine_ads || [];
        const years = ads
          .map((a: any) => a.magazines?.year)
          .filter((y: number | null) => y !== null);
        const uniqueYears = [...new Set(years)].sort((a: number, b: number) => b - a);
        
        // Build ad history
        const adHistory: AdHistory[] = ads
          .filter((a: any) => a.magazines)
          .map((a: any) => ({
            magazine_id: a.magazine_id,
            magazine_title: a.magazines.title,
            magazine_year: a.magazines.year,
            ad_type: a.ad_type,
            status: a.status,
          }));

        return {
          ...s,
          ad_count: ads.length,
          last_ad_year: uniqueYears.length > 0 ? uniqueYears[0] : undefined,
          ad_years: uniqueYears,
          ad_history: adHistory,
          magazine_ads: undefined,
        };
      });
      setSponsors(enrichedSponsors);
    }

    setIsLoading(false);
  };

  const openCreateDialog = () => {
    setEditingSponsor(null);
    setFormName("");
    setFormWebsite("");
    setFormContactName("");
    setFormContactEmail("");
    setFormActive(true);
    setLogoFile(null);
    setLogoPreview(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (sponsor: Sponsor) => {
    setEditingSponsor(sponsor);
    setFormName(sponsor.name);
    setFormWebsite(sponsor.website_url || "");
    setFormContactName(sponsor.contact_name || "");
    setFormContactEmail(sponsor.contact_email || "");
    setFormActive(sponsor.active);
    setLogoFile(null);
    setLogoPreview(sponsor.logo_path ? getLogoUrl(sponsor.logo_path) : null);
    setIsDialogOpen(true);
  };

  const getLogoUrl = (path: string) => {
    const { data } = supabase.storage.from("club-assets").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    setIsSaving(true);

    try {
      let logoPath = editingSponsor?.logo_path || null;

      // Upload logo if new file selected
      if (logoFile) {
        const fileExt = logoFile.name.split(".").pop();
        const fileName = `sponsors/${member!.club_id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("club-assets")
          .upload(fileName, logoFile);

        if (uploadError) throw uploadError;
        logoPath = fileName;
      }

      const sponsorData = {
        name: formName.trim(),
        website_url: formWebsite.trim() || null,
        contact_name: formContactName.trim() || null,
        contact_email: formContactEmail.trim() || null,
        active: formActive,
        logo_path: logoPath,
      };

      if (editingSponsor) {
        // Update existing
        const { error } = await supabase
          .from("sponsors")
          .update(sponsorData)
          .eq("id", editingSponsor.id);

        if (error) throw error;
        toast({ title: "Sponsor aktualisiert" });
      } else {
        // Create new
        const { error } = await supabase
          .from("sponsors")
          .insert({
            ...sponsorData,
            club_id: member!.club_id,
          });

        if (error) throw error;
        toast({ title: "Sponsor erstellt" });
      }

      setIsDialogOpen(false);
      fetchSponsors();
    } catch (error: any) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    }

    setIsSaving(false);
  };

  const handleDelete = async () => {
    if (!editingSponsor) return;

    const { error } = await supabase
      .from("sponsors")
      .delete()
      .eq("id", editingSponsor.id);

    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Sponsor gelöscht" });
      fetchSponsors();
    }

    setIsDeleteOpen(false);
    setEditingSponsor(null);
  };

  if (!canAccess) {
    return (
      <PortalLayout>
        <p className="text-center py-12 text-muted-foreground">
          Keine Berechtigung für Sponsorenverwaltung
        </p>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8"
        >
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/portal/magazine")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-display text-3xl font-bold">Sponsoren</h1>
              <p className="text-muted-foreground">Anzeigenkunden und Sponsoren verwalten</p>
            </div>
          </div>
          {canManageAds && (
            <Button onClick={openCreateDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Neuer Sponsor
            </Button>
          )}
        </motion.div>

        {/* Sponsors List */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : sponsors.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16 bg-card rounded-xl border"
          >
            <Building2 className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">Noch keine Sponsoren</h3>
            <p className="text-muted-foreground mb-6">
              Legen Sie Ihren ersten Sponsor an
            </p>
            {canManageAds && (
              <Button onClick={openCreateDialog}>
                <Plus className="w-4 h-4 mr-2" />
                Ersten Sponsor anlegen
              </Button>
            )}
          </motion.div>
        ) : (
          <div className="grid gap-4">
            {sponsors.map((sponsor, index) => (
              <motion.div
                key={sponsor.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-card rounded-xl border p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {/* Logo */}
                    <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                      {sponsor.logo_path ? (
                        <img
                          src={getLogoUrl(sponsor.logo_path)}
                          alt={sponsor.name}
                          className="w-full h-full object-contain p-1"
                        />
                      ) : (
                        <Building2 className="w-6 h-6 text-muted-foreground" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-lg">{sponsor.name}</h3>
                        <Badge variant={sponsor.active ? "default" : "secondary"}>
                          {sponsor.active ? "Aktiv" : "Inaktiv"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1 flex-wrap">
                        {sponsor.contact_name && (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {sponsor.contact_name}
                          </span>
                        )}
                        {sponsor.website_url && (
                          <a
                            href={sponsor.website_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 hover:text-primary"
                          >
                            <Globe className="w-3 h-3" />
                            Website
                          </a>
                        )}
                        <span>{sponsor.ad_count || 0} Anzeigen</span>
                        {sponsor.last_ad_year && (
                          <span>Zuletzt: {sponsor.last_ad_year}</span>
                        )}
                      </div>
                      {/* History - years with ads */}
                      {sponsor.ad_years && sponsor.ad_years.length > 0 && (
                        <div className="mt-2 flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-muted-foreground">Jahre:</span>
                          {sponsor.ad_years.map((year) => (
                            <Badge key={year} variant="outline" className="text-xs">
                              {year}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  {canManageAds && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(sponsor)}>
                          <Edit className="w-4 h-4 mr-2" />
                          Bearbeiten
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => {
                            setEditingSponsor(sponsor);
                            setIsDeleteOpen(true);
                          }}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Löschen
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingSponsor ? "Sponsor bearbeiten" : "Neuer Sponsor"}
              </DialogTitle>
              <DialogDescription>
                {editingSponsor
                  ? "Aktualisieren Sie die Sponsorendaten"
                  : "Legen Sie einen neuen Sponsor an"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Logo Upload */}
              <div className="space-y-2">
                <Label>Logo</Label>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center overflow-hidden border-2 border-dashed">
                    {logoPreview ? (
                      <img
                        src={logoPreview}
                        alt="Logo preview"
                        className="w-full h-full object-contain p-1"
                      />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoChange}
                      className="max-w-[200px]"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      PNG, JPG bis 2MB
                    </p>
                  </div>
                </div>
              </div>

              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  placeholder="Firmenname"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>

              {/* Website */}
              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  type="url"
                  placeholder="https://example.com"
                  value={formWebsite}
                  onChange={(e) => setFormWebsite(e.target.value)}
                />
              </div>

              {/* Contact Name */}
              <div className="space-y-2">
                <Label htmlFor="contactName">Ansprechpartner</Label>
                <Input
                  id="contactName"
                  placeholder="Max Mustermann"
                  value={formContactName}
                  onChange={(e) => setFormContactName(e.target.value)}
                />
              </div>

              {/* Contact Email */}
              <div className="space-y-2">
                <Label htmlFor="contactEmail">E-Mail</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  placeholder="kontakt@example.com"
                  value={formContactEmail}
                  onChange={(e) => setFormContactEmail(e.target.value)}
                />
              </div>

              {/* Active Status */}
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <Label>Aktiv</Label>
                  <p className="text-sm text-muted-foreground">
                    Inaktive Sponsoren werden nicht bei neuen Anzeigen vorgeschlagen
                  </p>
                </div>
                <Switch
                  checked={formActive}
                  onCheckedChange={setFormActive}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Abbrechen
              </Button>
              <Button onClick={handleSave} disabled={!formName.trim() || isSaving}>
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : editingSponsor ? (
                  "Speichern"
                ) : (
                  "Erstellen"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Sponsor löschen?</AlertDialogTitle>
              <AlertDialogDescription>
                Der Sponsor „{editingSponsor?.name}" wird gelöscht.
                {editingSponsor?.ad_count && editingSponsor.ad_count > 0 && (
                  <span className="block mt-2 text-destructive">
                    Achtung: Dieser Sponsor hat {editingSponsor.ad_count} zugeordnete Anzeige(n).
                  </span>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground"
              >
                Löschen
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PortalLayout>
  );
};

export default MagazineSponsors;
