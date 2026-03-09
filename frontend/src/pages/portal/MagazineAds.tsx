import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, Plus, ImageIcon, MoreHorizontal, Loader2, Trash2, Edit,
  Upload, Building2, FileDown, GripVertical, Lock, AlertCircle, Euro, Clock, TrendingUp
} from "lucide-react";
import { differenceInDays } from "date-fns";
import { Reorder } from "framer-motion";
import PortalLayout from "@/components/portal/PortalLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

interface Magazine {
  id: string;
  title: string;
  year: number;
  status: "draft" | "finalized";
  club_id: string;
}

interface Sponsor {
  id: string;
  name: string;
  logo_path: string | null;
  active: boolean;
}

interface MagazineAd {
  id: string;
  magazine_id: string;
  sponsor_id: string;
  ad_type: "full_page" | "half_page" | "quarter_page";
  ad_image_path: string | null;
  notes: string | null;
  status: "requested" | "received" | "placed";
  order_index: number;
  locked_position: string | null;
  price: number | null;
  created_at: string;
  sponsor?: Sponsor;
}

const AD_TYPES = [
  { value: "full_page", label: "Ganze Seite (1/1)", short: "1/1" },
  { value: "half_page", label: "Halbe Seite (1/2)", short: "1/2" },
  { value: "quarter_page", label: "Viertel Seite (1/4)", short: "1/4" },
];

const AD_STATUSES = [
  { value: "requested", label: "Angefragt", color: "bg-yellow-500" },
  { value: "received", label: "Eingegangen", color: "bg-blue-500" },
  { value: "placed", label: "Platziert", color: "bg-green-500" },
];

const MagazineAds = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { member, hasPermission } = useAuth();
  const { toast } = useToast();

  const [magazine, setMagazine] = useState<Magazine | null>(null);
  const [ads, setAds] = useState<MagazineAd[]>([]);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [editingAd, setEditingAd] = useState<MagazineAd | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formSponsorId, setFormSponsorId] = useState("");
  const [formAdType, setFormAdType] = useState<"full_page" | "half_page" | "quarter_page">("full_page");
  const [formStatus, setFormStatus] = useState<"requested" | "received" | "placed">("requested");
  const [formNotes, setFormNotes] = useState("");
  const [formLockedPosition, setFormLockedPosition] = useState<string | null>(null);
  const [formPrice, setFormPrice] = useState<string>("");
  const [adImageFile, setAdImageFile] = useState<File | null>(null);
  const [adImagePreview, setAdImagePreview] = useState<string | null>(null);

  const canManageAds = hasPermission("club.magazine.ads.manage");
  const canManageMagazine = hasPermission("club.magazine.manage");
  const canEdit = (canManageAds || canManageMagazine) && magazine?.status === "draft";

  useEffect(() => {
    if (id) fetchData();
  }, [id]);

  const fetchData = async () => {
    setIsLoading(true);

    // Fetch magazine
    const { data: magData, error: magError } = await supabase
      .from("magazines")
      .select("*")
      .eq("id", id)
      .single();

    if (magError || !magData) {
      toast({ title: "Fehler", description: "Schützenheft nicht gefunden", variant: "destructive" });
      navigate("/portal/magazine");
      return;
    }

    setMagazine(magData);

    // Fetch ads with sponsor info
    const { data: adsData } = await supabase
      .from("magazine_ads")
      .select(`
        *,
        sponsor:sponsors(id, name, logo_path, active)
      `)
      .eq("magazine_id", id)
      .order("order_index");

    setAds(adsData || []);

    // Fetch active sponsors
    const { data: sponsorsData } = await supabase
      .from("sponsors")
      .select("id, name, logo_path, active")
      .eq("club_id", magData.club_id)
      .eq("active", true)
      .order("name");

    setSponsors(sponsorsData || []);

    setIsLoading(false);
  };

  const getImageUrl = (path: string) => {
    const { data } = supabase.storage.from("club-assets").getPublicUrl(path);
    return data.publicUrl;
  };

  const openCreateDialog = () => {
    setEditingAd(null);
    setFormSponsorId("");
    setFormAdType("full_page");
    setFormStatus("requested");
    setFormNotes("");
    setFormLockedPosition(null);
    setFormPrice("");
    setAdImageFile(null);
    setAdImagePreview(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (ad: MagazineAd) => {
    setEditingAd(ad);
    setFormSponsorId(ad.sponsor_id);
    setFormAdType(ad.ad_type);
    setFormStatus(ad.status);
    setFormNotes(ad.notes || "");
    setFormLockedPosition(ad.locked_position);
    setFormPrice(ad.price?.toString() || "");
    setAdImageFile(null);
    setAdImagePreview(ad.ad_image_path ? getImageUrl(ad.ad_image_path) : null);
    setIsDialogOpen(true);
  };

  const openUploadDialog = (ad: MagazineAd) => {
    setEditingAd(ad);
    setAdImageFile(null);
    setAdImagePreview(ad.ad_image_path ? getImageUrl(ad.ad_image_path) : null);
    setIsUploadOpen(true);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAdImageFile(file);
      setAdImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSave = async () => {
    if (!formSponsorId) return;
    setIsSaving(true);

    try {
      let imagePath = editingAd?.ad_image_path || null;

      // Upload image if new file selected
      if (adImageFile) {
        const fileExt = adImageFile.name.split(".").pop();
        const fileName = `magazine-ads/${magazine!.club_id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("club-assets")
          .upload(fileName, adImageFile);

        if (uploadError) throw uploadError;
        imagePath = fileName;
      }

      const adData = {
        sponsor_id: formSponsorId,
        ad_type: formAdType,
        status: formStatus,
        notes: formNotes.trim() || null,
        locked_position: formLockedPosition,
        ad_image_path: imagePath,
        price: formPrice ? parseFloat(formPrice) : null,
      };

      if (editingAd) {
        const { error } = await supabase
          .from("magazine_ads")
          .update(adData)
          .eq("id", editingAd.id);

        if (error) throw error;
        toast({ title: "Anzeige aktualisiert" });
      } else {
        const maxOrder = Math.max(...ads.map((a) => a.order_index), -1);
        const { error } = await supabase
          .from("magazine_ads")
          .insert({
            ...adData,
            magazine_id: id,
            order_index: maxOrder + 1,
          });

        if (error) throw error;
        toast({ title: "Anzeige hinzugefügt" });
      }

      setIsDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    }

    setIsSaving(false);
  };

  const handleUploadImage = async () => {
    if (!editingAd || !adImageFile) return;
    setIsSaving(true);

    try {
      const fileExt = adImageFile.name.split(".").pop();
      const fileName = `magazine-ads/${magazine!.club_id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("club-assets")
        .upload(fileName, adImageFile);

      if (uploadError) throw uploadError;

      const { error } = await supabase
        .from("magazine_ads")
        .update({ ad_image_path: fileName, status: "received" })
        .eq("id", editingAd.id);

      if (error) throw error;

      toast({ title: "Anzeigenbild hochgeladen" });
      setIsUploadOpen(false);
      fetchData();
    } catch (error: any) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    }

    setIsSaving(false);
  };

  const handleDelete = async () => {
    if (!editingAd) return;

    const { error } = await supabase
      .from("magazine_ads")
      .delete()
      .eq("id", editingAd.id);

    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Anzeige entfernt" });
      fetchData();
    }

    setIsDeleteOpen(false);
    setEditingAd(null);
  };

  const handleReorder = async (newOrder: MagazineAd[]) => {
    setAds(newOrder);

    for (let i = 0; i < newOrder.length; i++) {
      await supabase
        .from("magazine_ads")
        .update({ order_index: i })
        .eq("id", newOrder[i].id);
    }
  };

  const handleStatusChange = async (adId: string, newStatus: "requested" | "received" | "placed") => {
    const { error } = await supabase
      .from("magazine_ads")
      .update({ status: newStatus })
      .eq("id", adId);

    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    } else {
      fetchData();
    }
  };

  const exportCSV = () => {
    const header = "Sponsor,Format,Status,Preis,Notizen\n";
    const rows = ads.map((ad) => {
      const sponsor = ad.sponsor?.name || "Unbekannt";
      const format = AD_TYPES.find((t) => t.value === ad.ad_type)?.short || ad.ad_type;
      const status = AD_STATUSES.find((s) => s.value === ad.status)?.label || ad.status;
      const price = ad.price?.toFixed(2) || "";
      const notes = (ad.notes || "").replace(/"/g, '""');
      return `"${sponsor}","${format}","${status}","${price}","${notes}"`;
    });

    const csv = header + rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `anzeigen-${magazine?.title || "export"}.csv`;
    link.click();
  };

  // Statistics
  const missingCount = ads.filter((a) => a.status === "requested" && !a.ad_image_path).length;
  const receivedCount = ads.filter((a) => a.status === "received").length;
  const placedCount = ads.filter((a) => a.status === "placed").length;

  // Revenue calculations
  const totalRevenue = ads.reduce((sum, ad) => sum + (ad.price || 0), 0);
  const placedRevenue = ads.filter((a) => a.status === "placed").reduce((sum, ad) => sum + (ad.price || 0), 0);
  const missingRevenue = ads.filter((a) => a.status === "requested").reduce((sum, ad) => sum + (ad.price || 0), 0);

  // Helper to calculate days since ad was requested
  const getDaysSinceCreated = (createdAt: string) => {
    return differenceInDays(new Date(), new Date(createdAt));
  };

  if (isLoading) {
    return (
      <PortalLayout>
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </PortalLayout>
    );
  }

  if (!magazine) {
    return (
      <PortalLayout>
        <p className="text-center py-12 text-muted-foreground">Schützenheft nicht gefunden</p>
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
          className="flex items-center justify-between mb-6"
        >
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(`/portal/magazine/${id}`)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-display text-2xl font-bold">Anzeigen: {magazine.title}</h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>{magazine.year}</span>
                <Badge variant={magazine.status === "finalized" ? "default" : "secondary"}>
                  {magazine.status === "finalized" ? (
                    <>
                      <Lock className="w-3 h-3 mr-1" />
                      Finalisiert
                    </>
                  ) : (
                    "Entwurf"
                  )}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportCSV}>
              <FileDown className="w-4 h-4 mr-2" />
              CSV Export
            </Button>
            {canEdit && (
              <Button onClick={openCreateDialog}>
                <Plus className="w-4 h-4 mr-2" />
                Anzeige hinzufügen
              </Button>
            )}
          </div>
        </motion.div>

        {/* Status Overview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6"
        >
          <div className="bg-card rounded-xl border p-4">
            <div className="flex items-center gap-2 text-yellow-600 mb-1">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm font-medium">Fehlt</span>
            </div>
            <p className="text-2xl font-bold">{missingCount}</p>
          </div>
          <div className="bg-card rounded-xl border p-4">
            <div className="flex items-center gap-2 text-blue-600 mb-1">
              <ImageIcon className="w-4 h-4" />
              <span className="text-sm font-medium">Eingegangen</span>
            </div>
            <p className="text-2xl font-bold">{receivedCount}</p>
          </div>
          <div className="bg-card rounded-xl border p-4">
            <div className="flex items-center gap-2 text-green-600 mb-1">
              <Building2 className="w-4 h-4" />
              <span className="text-sm font-medium">Platziert</span>
            </div>
            <p className="text-2xl font-bold">{placedCount}</p>
          </div>
          <div className="bg-card rounded-xl border p-4">
            <div className="flex items-center gap-2 text-primary mb-1">
              <Euro className="w-4 h-4" />
              <span className="text-sm font-medium">Einnahmen</span>
            </div>
            <p className="text-2xl font-bold">{totalRevenue.toFixed(0)} €</p>
            <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
              <div className="flex justify-between">
                <span>Platziert:</span>
                <span className="text-green-600">{placedRevenue.toFixed(0)} €</span>
              </div>
              {missingRevenue > 0 && (
                <div className="flex justify-between">
                  <span>Ausstehend:</span>
                  <span className="text-yellow-600">{missingRevenue.toFixed(0)} €</span>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Ads List */}
        {ads.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16 bg-card rounded-xl border"
          >
            <ImageIcon className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">Noch keine Anzeigen</h3>
            <p className="text-muted-foreground mb-6">
              Fügen Sie die erste Anzeige zu diesem Schützenheft hinzu
            </p>
            {canEdit && (
              <Button onClick={openCreateDialog}>
                <Plus className="w-4 h-4 mr-2" />
                Erste Anzeige hinzufügen
              </Button>
            )}
          </motion.div>
        ) : (
          <Reorder.Group
            axis="y"
            values={ads}
            onReorder={canEdit ? handleReorder : () => {}}
            className="space-y-3"
          >
            {ads.map((ad) => {
              const statusInfo = AD_STATUSES.find((s) => s.value === ad.status);
              const typeInfo = AD_TYPES.find((t) => t.value === ad.ad_type);

              return (
                <Reorder.Item
                  key={ad.id}
                  value={ad}
                  className="bg-card rounded-xl border p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-4">
                    {/* Drag Handle */}
                    {canEdit && (
                      <GripVertical className="w-5 h-5 text-muted-foreground cursor-grab" />
                    )}

                    {/* Ad Preview */}
                    <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                      {ad.ad_image_path ? (
                        <img
                          src={getImageUrl(ad.ad_image_path)}
                          alt="Anzeige"
                          className="w-full h-full object-cover"
                        />
                      ) : ad.sponsor?.logo_path ? (
                        <img
                          src={getImageUrl(ad.sponsor.logo_path)}
                          alt={ad.sponsor.name}
                          className="w-full h-full object-contain p-2 opacity-50"
                        />
                      ) : (
                        <ImageIcon className="w-6 h-6 text-muted-foreground" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-medium truncate">{ad.sponsor?.name || "Unbekannter Sponsor"}</h3>
                        <Badge variant="outline">{typeInfo?.short}</Badge>
                        <Badge
                          className={`${statusInfo?.color} text-white border-0`}
                        >
                          {statusInfo?.label}
                        </Badge>
                        {ad.locked_position && (
                          <Badge variant="secondary">
                            <Lock className="w-3 h-3 mr-1" />
                            {ad.locked_position === "back" ? "Hinten" : ad.locked_position}
                          </Badge>
                        )}
                        {ad.price && (
                          <Badge variant="outline" className="text-primary">
                            <Euro className="w-3 h-3 mr-1" />
                            {ad.price.toFixed(0)} €
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        {ad.notes && (
                          <p className="text-muted-foreground truncate">{ad.notes}</p>
                        )}
                        {/* Reminder for missing ads */}
                        {ad.status === "requested" && !ad.ad_image_path && getDaysSinceCreated(ad.created_at) >= 7 && (
                          <span className="flex items-center gap-1 text-orange-600 font-medium whitespace-nowrap">
                            <Clock className="w-3 h-3" />
                            Fehlt seit {getDaysSinceCreated(ad.created_at)} Tagen
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    {canEdit && (
                      <div className="flex items-center gap-2">
                        {!ad.ad_image_path && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openUploadDialog(ad)}
                          >
                            <Upload className="w-4 h-4 mr-1" />
                            Bild
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(ad)}>
                              <Edit className="w-4 h-4 mr-2" />
                              Bearbeiten
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openUploadDialog(ad)}>
                              <Upload className="w-4 h-4 mr-2" />
                              Bild hochladen
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleStatusChange(ad.id, "requested")}>
                              Angefragt
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleStatusChange(ad.id, "received")}>
                              Eingegangen
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleStatusChange(ad.id, "placed")}>
                              Platziert
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => {
                                setEditingAd(ad);
                                setIsDeleteOpen(true);
                              }}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Entfernen
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
                  </div>
                </Reorder.Item>
              );
            })}
          </Reorder.Group>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingAd ? "Anzeige bearbeiten" : "Neue Anzeige"}
              </DialogTitle>
              <DialogDescription>
                {editingAd ? "Aktualisieren Sie die Anzeigendaten" : "Fügen Sie eine neue Anzeige hinzu"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Sponsor */}
              <div className="space-y-2">
                <Label>Sponsor *</Label>
                <Select value={formSponsorId} onValueChange={setFormSponsorId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sponsor auswählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {sponsors.map((sponsor) => (
                      <SelectItem key={sponsor.id} value={sponsor.id}>
                        {sponsor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs"
                  onClick={() => navigate("/portal/magazine/sponsors")}
                >
                  Neuen Sponsor anlegen →
                </Button>
              </div>

              {/* Ad Type */}
              <div className="space-y-2">
                <Label>Format</Label>
                <Select value={formAdType} onValueChange={(v) => setFormAdType(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AD_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status */}
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formStatus} onValueChange={(v) => setFormStatus(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AD_STATUSES.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Locked Position */}
              <div className="space-y-2">
                <Label>Feste Position</Label>
                <Select
                  value={formLockedPosition || "auto"}
                  onValueChange={(v) => setFormLockedPosition(v === "auto" ? null : v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Automatisch</SelectItem>
                    <SelectItem value="front">Vorne (nach Inhaltsverzeichnis)</SelectItem>
                    <SelectItem value="back">Hinten (vor Sponsorentafel)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Price */}
              <div className="space-y-2">
                <Label>Preis (€)</Label>
                <div className="relative">
                  <Euro className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Intern für Einnahmenübersicht (nicht öffentlich)
                </p>
              </div>

              {/* Image Upload */}
              <div className="space-y-2">
                <Label>Anzeigenbild</Label>
                <div className="flex items-center gap-4">
                  <div className="w-24 h-24 rounded-lg bg-muted flex items-center justify-center overflow-hidden border-2 border-dashed">
                    {adImagePreview ? (
                      <img
                        src={adImagePreview}
                        alt="Vorschau"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="max-w-[200px]"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      JPG, PNG. Optimal: 300 DPI
                    </p>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label>Notizen</Label>
                <Textarea
                  placeholder="z.B. Rechnung gestellt am..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Abbrechen
              </Button>
              <Button onClick={handleSave} disabled={!formSponsorId || isSaving}>
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : editingAd ? (
                  "Speichern"
                ) : (
                  "Hinzufügen"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Upload Image Dialog */}
        <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Anzeigenbild hochladen</DialogTitle>
              <DialogDescription>
                Laden Sie das Anzeigenbild für {editingAd?.sponsor?.name} hoch
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="flex items-center gap-4">
                <div className="w-32 h-32 rounded-lg bg-muted flex items-center justify-center overflow-hidden border-2 border-dashed">
                  {adImagePreview ? (
                    <img
                      src={adImagePreview}
                      alt="Vorschau"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="w-12 h-12 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Empfohlen: 300 DPI für Druckqualität
                  </p>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsUploadOpen(false)}>
                Abbrechen
              </Button>
              <Button onClick={handleUploadImage} disabled={!adImageFile || isSaving}>
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Hochladen"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Anzeige entfernen?</AlertDialogTitle>
              <AlertDialogDescription>
                Die Anzeige von „{editingAd?.sponsor?.name}" wird aus diesem Schützenheft entfernt.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground"
              >
                Entfernen
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PortalLayout>
  );
};

export default MagazineAds;
