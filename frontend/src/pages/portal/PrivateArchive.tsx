import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import PortalLayout from "@/components/portal/PortalLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  Images,
  Trash2,
  Pencil,
  Lock,
  Users,
  Building2,
  Loader2,
  X,
  Check,
  FolderHeart,
  CheckSquare,
  Square,
} from "lucide-react";

type GalleryVisibility = "private" | "company" | "club";

interface MemberGalleryImage {
  id: string;
  member_id: string;
  club_id: string;
  company_id: string | null;
  title: string | null;
  description: string | null;
  image_path: string;
  visibility: GalleryVisibility;
  created_at: string;
}

interface Company {
  id: string;
  name: string;
}

const PrivateArchive = () => {
  const { member, user } = useAuth();
  const [images, setImages] = useState<MemberGalleryImage[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<MemberGalleryImage | null>(null);
  const [activeTab, setActiveTab] = useState<string>("all");
  
  // Edit form state
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editVisibility, setEditVisibility] = useState<GalleryVisibility>("private");
  const [editCompanyId, setEditCompanyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);

  // Bulk selection state
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [bulkVisibilityDialogOpen, setBulkVisibilityDialogOpen] = useState(false);
  const [bulkVisibility, setBulkVisibility] = useState<GalleryVisibility>("private");
  const [bulkCompanyId, setBulkCompanyId] = useState<string | null>(null);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  const fetchImages = useCallback(async () => {
    if (!member?.id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("member_gallery_images")
        .select("*")
        .eq("member_id", member.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setImages((data || []) as MemberGalleryImage[]);
    } catch (error) {
      console.error("Error fetching images:", error);
      toast.error("Fehler beim Laden der Bilder");
    } finally {
      setLoading(false);
    }
  }, [member?.id]);

  const fetchCompanies = useCallback(async () => {
    if (!member?.id) return;
    
    try {
      const { data, error } = await supabase
        .from("member_company_memberships")
        .select("company_id, companies(id, name)")
        .eq("member_id", member.id)
        .is("valid_to", null);

      if (error) throw error;
      
      const companyList = (data || [])
        .map((m: any) => m.companies)
        .filter(Boolean) as Company[];
      setCompanies(companyList);
    } catch (error) {
      console.error("Error fetching companies:", error);
    }
  }, [member?.id]);

  useEffect(() => {
    fetchImages();
    fetchCompanies();
  }, [fetchImages, fetchCompanies]);

  const getImageUrl = (path: string) =>
    `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/gallery-images/${path}`;

  const handleFileUpload = async (files: FileList | File[]) => {
    if (!member?.id || !member?.club_id || !user?.id) return;
    
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      let uploaded = 0;
      
      for (const file of fileArray) {
        if (!file.type.startsWith("image/")) {
          toast.error(`${file.name} ist kein Bild`);
          continue;
        }

        const fileExt = file.name.split(".").pop();
        const fileName = `members/${user.id}/${crypto.randomUUID()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from("gallery-images")
          .upload(fileName, file);

        if (uploadError) {
          console.error("Upload error:", uploadError);
          toast.error(`Fehler beim Hochladen von ${file.name}`);
          continue;
        }

        const { error: insertError } = await supabase
          .from("member_gallery_images")
          .insert({
            member_id: member.id,
            club_id: member.club_id,
            image_path: fileName,
            visibility: "private",
          });

        if (insertError) {
          console.error("Insert error:", insertError);
          toast.error(`Fehler beim Speichern von ${file.name}`);
          continue;
        }

        uploaded++;
        setUploadProgress(Math.round((uploaded / fileArray.length) * 100));
      }

      toast.success(`${uploaded} Bild${uploaded !== 1 ? "er" : ""} hochgeladen`);
      fetchImages();
    } catch (error) {
      console.error("Error uploading:", error);
      toast.error("Fehler beim Hochladen");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    handleFileUpload(files);
  };

  const openEditDialog = (image: MemberGalleryImage) => {
    setSelectedImage(image);
    setEditTitle(image.title || "");
    setEditDescription(image.description || "");
    setEditVisibility(image.visibility);
    setEditCompanyId(image.company_id);
    setEditDialogOpen(true);
  };

  const openDeleteDialog = (image: MemberGalleryImage) => {
    setSelectedImage(image);
    setDeleteDialogOpen(true);
  };

  const handleSave = async () => {
    if (!selectedImage) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("member_gallery_images")
        .update({
          title: editTitle || null,
          description: editDescription || null,
          visibility: editVisibility,
          company_id: editVisibility === "company" ? editCompanyId : null,
        })
        .eq("id", selectedImage.id);

      if (error) throw error;

      toast.success("Bild aktualisiert");
      setEditDialogOpen(false);
      fetchImages();
    } catch (error) {
      console.error("Error saving:", error);
      toast.error("Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedImage) return;

    try {
      await supabase.storage
        .from("gallery-images")
        .remove([selectedImage.image_path]);

      const { error } = await supabase
        .from("member_gallery_images")
        .delete()
        .eq("id", selectedImage.id);

      if (error) throw error;

      toast.success("Bild gelöscht");
      setDeleteDialogOpen(false);
      fetchImages();
    } catch (error) {
      console.error("Error deleting:", error);
      toast.error("Fehler beim Löschen");
    }
  };

  // Bulk selection handlers
  const toggleBulkMode = () => {
    setBulkMode(!bulkMode);
    setSelectedIds(new Set());
  };

  const toggleImageSelection = (imageId: string) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(imageId)) {
      newSelection.delete(imageId);
    } else {
      newSelection.add(imageId);
    }
    setSelectedIds(newSelection);
  };

  const selectAllFiltered = () => {
    const allFilteredIds = new Set(filteredImages.map((img) => img.id));
    setSelectedIds(allFilteredIds);
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    setBulkProcessing(true);
    try {
      const imagesToDelete = images.filter((img) => selectedIds.has(img.id));
      const paths = imagesToDelete.map((img) => img.image_path);

      // Delete from storage
      await supabase.storage.from("gallery-images").remove(paths);

      // Delete from database
      const { error } = await supabase
        .from("member_gallery_images")
        .delete()
        .in("id", Array.from(selectedIds));

      if (error) throw error;

      toast.success(`${selectedIds.size} Bild${selectedIds.size !== 1 ? "er" : ""} gelöscht`);
      setBulkDeleteDialogOpen(false);
      setSelectedIds(new Set());
      setBulkMode(false);
      fetchImages();
    } catch (error) {
      console.error("Error bulk deleting:", error);
      toast.error("Fehler beim Löschen");
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleBulkVisibilityChange = async () => {
    if (selectedIds.size === 0) return;

    setBulkProcessing(true);
    try {
      const { error } = await supabase
        .from("member_gallery_images")
        .update({
          visibility: bulkVisibility,
          company_id: bulkVisibility === "company" ? bulkCompanyId : null,
        })
        .in("id", Array.from(selectedIds));

      if (error) throw error;

      toast.success(`Freigabe für ${selectedIds.size} Bild${selectedIds.size !== 1 ? "er" : ""} geändert`);
      setBulkVisibilityDialogOpen(false);
      setSelectedIds(new Set());
      setBulkMode(false);
      fetchImages();
    } catch (error) {
      console.error("Error changing visibility:", error);
      toast.error("Fehler beim Ändern der Freigabe");
    } finally {
      setBulkProcessing(false);
    }
  };

  const getVisibilityIcon = (visibility: GalleryVisibility) => {
    switch (visibility) {
      case "private":
        return <Lock className="w-3 h-3" />;
      case "company":
        return <Building2 className="w-3 h-3" />;
      case "club":
        return <Users className="w-3 h-3" />;
    }
  };

  const getVisibilityLabel = (visibility: GalleryVisibility) => {
    switch (visibility) {
      case "private":
        return "Privat";
      case "company":
        return "Kompanie";
      case "club":
        return "Regiment";
    }
  };

  const getVisibilityColor = (visibility: GalleryVisibility) => {
    switch (visibility) {
      case "private":
        return "bg-muted text-muted-foreground";
      case "company":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "club":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    }
  };

  const filteredImages = images.filter((image) => {
    if (activeTab === "all") return true;
    return image.visibility === activeTab;
  });

  const counts = {
    all: images.length,
    private: images.filter((i) => i.visibility === "private").length,
    company: images.filter((i) => i.visibility === "company").length,
    club: images.filter((i) => i.visibility === "club").length,
  };

  return (
    <PortalLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <FolderHeart className="w-8 h-8" />
              Mein Fotoarchiv
            </h1>
            <p className="text-muted-foreground mt-1">
              Lade Fotos hoch und teile sie mit deiner Kompanie oder dem Regiment
            </p>
          </div>
          
          {images.length > 0 && (
            <Button
              variant={bulkMode ? "default" : "outline"}
              onClick={toggleBulkMode}
              className="shrink-0"
            >
              {bulkMode ? (
                <>
                  <X className="w-4 h-4 mr-2" />
                  Auswahl beenden
                </>
              ) : (
                <>
                  <CheckSquare className="w-4 h-4 mr-2" />
                  Mehrere auswählen
                </>
              )}
            </Button>
          )}
        </div>

        {/* Bulk Actions Bar */}
        {bulkMode && (
          <Card className="bg-muted/50">
            <CardContent className="py-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium">
                  {selectedIds.size} von {filteredImages.length} ausgewählt
                </span>
                
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={selectAllFiltered}
                  >
                    Alle auswählen
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={deselectAll}
                    disabled={selectedIds.size === 0}
                  >
                    Keine auswählen
                  </Button>
                </div>

                <div className="flex-1" />

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setBulkVisibility("private");
                      setBulkCompanyId(null);
                      setBulkVisibilityDialogOpen(true);
                    }}
                    disabled={selectedIds.size === 0}
                  >
                    <Pencil className="w-4 h-4 mr-2" />
                    Freigabe ändern
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setBulkDeleteDialogOpen(true)}
                    disabled={selectedIds.size === 0}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Löschen
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Upload Area */}
        <Card
          className={`border-2 border-dashed transition-colors ${
            isDragging
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-primary/50"
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <CardContent className="py-8">
            <div className="flex flex-col items-center gap-4">
              {uploading ? (
                <>
                  <Loader2 className="w-12 h-12 animate-spin text-primary" />
                  <p className="text-lg font-medium">
                    Hochladen... {uploadProgress}%
                  </p>
                </>
              ) : (
                <>
                  <Upload className="w-12 h-12 text-muted-foreground" />
                  <div className="text-center">
                    <p className="text-lg font-medium">
                      Fotos hier ablegen oder klicken zum Auswählen
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Du kannst mehrere Bilder gleichzeitig hochladen
                    </p>
                  </div>
                  <Button
                    onClick={() => document.getElementById("file-upload")?.click()}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Fotos auswählen
                  </Button>
                  <input
                    id="file-upload"
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                  />
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Filter Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all" className="gap-2">
              Alle
              <Badge variant="secondary" className="ml-1">
                {counts.all}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="private" className="gap-2">
              <Lock className="w-3 h-3" />
              Privat
              <Badge variant="secondary" className="ml-1">
                {counts.private}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="company" className="gap-2">
              <Building2 className="w-3 h-3" />
              Kompanie
              <Badge variant="secondary" className="ml-1">
                {counts.company}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="club" className="gap-2">
              <Users className="w-3 h-3" />
              Regiment
              <Badge variant="secondary" className="ml-1">
                {counts.club}
              </Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Image Grid */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredImages.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Images className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="font-semibold text-lg mb-2">
                {activeTab === "all"
                  ? "Noch keine Bilder"
                  : `Keine ${getVisibilityLabel(activeTab as GalleryVisibility).toLowerCase()}en Bilder`}
              </h3>
              <p className="text-muted-foreground">
                {activeTab === "all"
                  ? "Lade dein erstes Foto hoch!"
                  : "Ändere die Freigabe eines Bildes, um es hier zu sehen."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filteredImages.map((image) => {
              const isSelected = selectedIds.has(image.id);
              
              return (
                <Card
                  key={image.id}
                  className={`overflow-hidden group relative cursor-pointer transition-all ${
                    bulkMode && isSelected ? "ring-2 ring-primary ring-offset-2" : ""
                  }`}
                  onClick={() => {
                    if (bulkMode) {
                      toggleImageSelection(image.id);
                    } else {
                      openEditDialog(image);
                    }
                  }}
                >
                  <div className="aspect-square relative">
                    <img
                      src={getImageUrl(image.image_path)}
                      alt={image.title || "Foto"}
                      className="w-full h-full object-cover"
                    />
                    
                    {/* Bulk Selection Checkbox */}
                    {bulkMode && (
                      <div
                        className={`absolute top-2 right-2 w-6 h-6 rounded flex items-center justify-center transition-all ${
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : "bg-background/80 border border-input"
                        }`}
                      >
                        {isSelected && <Check className="w-4 h-4" />}
                      </div>
                    )}

                    {/* Visibility Badge */}
                    <div
                      className={`absolute top-2 left-2 px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getVisibilityColor(
                        image.visibility
                      )}`}
                    >
                      {getVisibilityIcon(image.visibility)}
                      {getVisibilityLabel(image.visibility)}
                    </div>

                    {/* Hover Overlay (only in non-bulk mode) */}
                    {!bulkMode && (
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <Button
                          variant="secondary"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditDialog(image);
                          }}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDeleteDialog(image);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                  
                  {image.title && (
                    <CardContent className="p-2">
                      <p className="font-medium text-sm truncate">{image.title}</p>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Bild bearbeiten</DialogTitle>
            </DialogHeader>
            
            {selectedImage && (
              <div className="space-y-4">
                <img
                  src={getImageUrl(selectedImage.image_path)}
                  alt="Vorschau"
                  className="w-full h-48 object-cover rounded-lg"
                />

                <div className="space-y-2">
                  <Label htmlFor="title">Titel (optional)</Label>
                  <Input
                    id="title"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="z.B. Schützenfest 2024"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Beschreibung (optional)</Label>
                  <Textarea
                    id="description"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Kurze Beschreibung..."
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Freigabe</Label>
                  <Select
                    value={editVisibility}
                    onValueChange={(v) => setEditVisibility(v as GalleryVisibility)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="private">
                        <span className="flex items-center gap-2">
                          <Lock className="w-4 h-4" />
                          Privat - Nur ich
                        </span>
                      </SelectItem>
                      <SelectItem value="company" disabled={companies.length === 0}>
                        <span className="flex items-center gap-2">
                          <Building2 className="w-4 h-4" />
                          Kompanie - Meine Kompanie
                        </span>
                      </SelectItem>
                      <SelectItem value="club">
                        <span className="flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          Regiment - Alle Mitglieder
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {editVisibility === "company" && companies.length > 0 && (
                  <div className="space-y-2">
                    <Label>Für welche Kompanie?</Label>
                    <Select
                      value={editCompanyId || ""}
                      onValueChange={setEditCompanyId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Kompanie auswählen" />
                      </SelectTrigger>
                      <SelectContent>
                        {companies.map((company) => (
                          <SelectItem key={company.id} value={company.id}>
                            {company.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Abbrechen
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Speichern
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Bild löschen?</AlertDialogTitle>
              <AlertDialogDescription>
                Möchtest du dieses Bild wirklich löschen? Diese Aktion kann nicht
                rückgängig gemacht werden.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Löschen
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Bulk Delete Confirmation */}
        <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{selectedIds.size} Bilder löschen?</AlertDialogTitle>
              <AlertDialogDescription>
                Möchtest du diese {selectedIds.size} Bilder wirklich löschen? Diese Aktion kann nicht
                rückgängig gemacht werden.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={bulkProcessing}>Abbrechen</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleBulkDelete}
                disabled={bulkProcessing}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {bulkProcessing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {selectedIds.size} Bilder löschen
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Bulk Visibility Dialog */}
        <Dialog open={bulkVisibilityDialogOpen} onOpenChange={setBulkVisibilityDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Freigabe für {selectedIds.size} Bilder ändern</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Neue Freigabe</Label>
                <Select
                  value={bulkVisibility}
                  onValueChange={(v) => setBulkVisibility(v as GalleryVisibility)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private">
                      <span className="flex items-center gap-2">
                        <Lock className="w-4 h-4" />
                        Privat - Nur ich
                      </span>
                    </SelectItem>
                    <SelectItem value="company" disabled={companies.length === 0}>
                      <span className="flex items-center gap-2">
                        <Building2 className="w-4 h-4" />
                        Kompanie - Meine Kompanie
                      </span>
                    </SelectItem>
                    <SelectItem value="club">
                      <span className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        Regiment - Alle Mitglieder
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {bulkVisibility === "company" && companies.length > 0 && (
                <div className="space-y-2">
                  <Label>Für welche Kompanie?</Label>
                  <Select
                    value={bulkCompanyId || ""}
                    onValueChange={setBulkCompanyId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Kompanie auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setBulkVisibilityDialogOpen(false)} disabled={bulkProcessing}>
                Abbrechen
              </Button>
              <Button onClick={handleBulkVisibilityChange} disabled={bulkProcessing || (bulkVisibility === "company" && !bulkCompanyId)}>
                {bulkProcessing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Freigabe ändern
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PortalLayout>
  );
};

export default PrivateArchive;
