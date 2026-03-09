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
import { Switch } from "@/components/ui/switch";
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
import {
  Plus,
  Images,
  Trash2,
  Pencil,
  Eye,
  EyeOff,
  Loader2,
  Upload,
} from "lucide-react";

interface GalleryImage {
  id: string;
  club_id: string;
  title: string | null;
  description: string | null;
  image_path: string;
  sort_order: number;
  is_visible: boolean;
  created_at: string;
}

const Gallery = () => {
  const { member } = useAuth();
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isVisible, setIsVisible] = useState(true);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const fetchImages = useCallback(async () => {
    if (!member?.club_id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("gallery_images")
        .select("*")
        .eq("club_id", member.club_id)
        .order("sort_order", { ascending: true });

      if (error) throw error;
      setImages(data || []);
    } catch (error) {
      console.error("Error fetching gallery images:", error);
      toast.error("Fehler beim Laden der Galerie");
    } finally {
      setLoading(false);
    }
  }, [member?.club_id]);

  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

  const getImageUrl = (path: string) =>
    `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/gallery-images/${path}`;

  const openCreateDialog = () => {
    setSelectedImage(null);
    setTitle("");
    setDescription("");
    setIsVisible(true);
    setImageFile(null);
    setImagePreview(null);
    setDialogOpen(true);
  };

  const openEditDialog = (image: GalleryImage) => {
    setSelectedImage(image);
    setTitle(image.title || "");
    setDescription(image.description || "");
    setIsVisible(image.is_visible);
    setImageFile(null);
    setImagePreview(getImageUrl(image.image_path));
    setDialogOpen(true);
  };

  const openDeleteDialog = (image: GalleryImage) => {
    setSelectedImage(image);
    setDeleteDialogOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!member?.club_id) return;
    
    // Require image for new entries
    if (!selectedImage && !imageFile) {
      toast.error("Bitte wähle ein Bild aus");
      return;
    }

    setSaving(true);
    try {
      let imagePath = selectedImage?.image_path;

      // Upload new image if selected
      if (imageFile) {
        const fileExt = imageFile.name.split(".").pop();
        const fileName = `${member.club_id}/${crypto.randomUUID()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from("gallery-images")
          .upload(fileName, imageFile);

        if (uploadError) throw uploadError;
        imagePath = fileName;

        // Delete old image if replacing
        if (selectedImage?.image_path) {
          await supabase.storage
            .from("gallery-images")
            .remove([selectedImage.image_path]);
        }
      }

      if (selectedImage) {
        // Update existing
        const { error } = await supabase
          .from("gallery_images")
          .update({
            title: title || null,
            description: description || null,
            is_visible: isVisible,
            image_path: imagePath,
          })
          .eq("id", selectedImage.id);

        if (error) throw error;
        toast.success("Bild aktualisiert");
      } else {
        // Create new
        const maxSortOrder = Math.max(...images.map((i) => i.sort_order), -1);
        
        const { error } = await supabase
          .from("gallery_images")
          .insert({
            club_id: member.club_id,
            title: title || null,
            description: description || null,
            is_visible: isVisible,
            image_path: imagePath!,
            sort_order: maxSortOrder + 1,
            uploaded_by_member_id: member.id,
          });

        if (error) throw error;
        toast.success("Bild hinzugefügt");
      }

      setDialogOpen(false);
      fetchImages();
    } catch (error) {
      console.error("Error saving image:", error);
      toast.error("Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedImage) return;

    try {
      // Delete from storage
      await supabase.storage
        .from("gallery-images")
        .remove([selectedImage.image_path]);

      // Delete from database
      const { error } = await supabase
        .from("gallery_images")
        .delete()
        .eq("id", selectedImage.id);

      if (error) throw error;

      toast.success("Bild gelöscht");
      setDeleteDialogOpen(false);
      fetchImages();
    } catch (error) {
      console.error("Error deleting image:", error);
      toast.error("Fehler beim Löschen");
    }
  };

  const toggleVisibility = async (image: GalleryImage) => {
    try {
      const { error } = await supabase
        .from("gallery_images")
        .update({ is_visible: !image.is_visible })
        .eq("id", image.id);

      if (error) throw error;
      
      setImages(images.map((i) =>
        i.id === image.id ? { ...i, is_visible: !i.is_visible } : i
      ));
      
      toast.success(image.is_visible ? "Bild ausgeblendet" : "Bild eingeblendet");
    } catch (error) {
      console.error("Error toggling visibility:", error);
      toast.error("Fehler beim Ändern der Sichtbarkeit");
    }
  };

  return (
    <PortalLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Images className="w-8 h-8" />
              Galerie
            </h1>
            <p className="text-muted-foreground mt-1">
              Verwalte die Bildergalerie für die öffentliche Vereinsseite
            </p>
          </div>
          <Button onClick={openCreateDialog}>
            <Plus className="w-4 h-4 mr-2" />
            Bild hinzufügen
          </Button>
        </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : images.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Images className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="font-semibold text-lg mb-2">Noch keine Bilder</h3>
            <p className="text-muted-foreground mb-4">
              Füge Bilder hinzu, die auf der öffentlichen Vereinsseite angezeigt werden.
            </p>
            <Button onClick={openCreateDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Erstes Bild hinzufügen
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {images.map((image) => (
            <Card
              key={image.id}
              className={`overflow-hidden group relative ${
                !image.is_visible ? "opacity-60" : ""
              }`}
            >
              <div className="aspect-square relative">
                <img
                  src={getImageUrl(image.image_path)}
                  alt={image.title || "Galeriebild"}
                  className="w-full h-full object-cover"
                />
                
                {/* Overlay with actions */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={() => openEditDialog(image)}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={() => toggleVisibility(image)}
                  >
                    {image.is_visible ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => openDeleteDialog(image)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                {/* Visibility indicator */}
                {!image.is_visible && (
                  <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                    <EyeOff className="w-3 h-3 inline mr-1" />
                    Ausgeblendet
                  </div>
                )}
              </div>
              
              {image.title && (
                <CardContent className="p-3">
                  <p className="font-medium text-sm truncate">{image.title}</p>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedImage ? "Bild bearbeiten" : "Neues Bild hinzufügen"}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Image Upload */}
            <div className="space-y-2">
              <Label>Bild</Label>
              {imagePreview ? (
                <div className="relative">
                  <img
                    src={imagePreview}
                    alt="Vorschau"
                    className="w-full h-48 object-cover rounded-lg"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    className="absolute bottom-2 right-2"
                    onClick={() => document.getElementById("image-upload")?.click()}
                  >
                    <Upload className="w-4 h-4 mr-1" />
                    Ändern
                  </Button>
                </div>
              ) : (
                <div
                  className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
                  onClick={() => document.getElementById("image-upload")?.click()}
                >
                  <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Klicke zum Hochladen
                  </p>
                </div>
              )}
              <input
                id="image-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Titel (optional)</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="z.B. Schützenfest 2024"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Beschreibung (optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Kurze Beschreibung des Bildes..."
                rows={2}
              />
            </div>

            {/* Visibility */}
            <div className="flex items-center justify-between">
              <div>
                <Label>Sichtbar auf der Homepage</Label>
                <p className="text-sm text-muted-foreground">
                  Wenn aktiviert, wird das Bild öffentlich angezeigt
                </p>
              </div>
              <Switch
                checked={isVisible}
                onCheckedChange={setIsVisible}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {selectedImage ? "Speichern" : "Hinzufügen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
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
      </div>
    </PortalLayout>
  );
};

export default Gallery;
