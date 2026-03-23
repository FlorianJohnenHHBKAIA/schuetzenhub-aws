import { useState, useRef } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase, apiUpload, getStorageUrl } from "@/integrations/api/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface Company {
  id: string;
  name: string;
  logo_url: string | null;
  cover_url: string | null;
  description: string | null;
}

interface CompanyEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company: Company;
  onSave: () => void;
}

const CompanyEditDialog = ({ open, onOpenChange, company, onSave }: CompanyEditDialogProps) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState(company.name);
  const [description, setDescription] = useState(company.description || "");
  const [logoUrl, setLogoUrl] = useState(company.logo_url || "");
  const [coverUrl, setCoverUrl] = useState(company.cover_url || "");
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  
  const logoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File, type: "logo" | "cover") => {
    const isLogo = type === "logo";
    if (isLogo) {
      setIsUploadingLogo(true);
    } else {
      setIsUploadingCover(true);
    }

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${company.id}/${type}-${Date.now()}.${fileExt}`;
      
      await apiUpload(`/api/upload`, file, { bucket: "company-assets", path: fileName });
      const publicUrl = getStorageUrl("company-assets", fileName) || "";

      if (isLogo) {
        setLogoUrl(publicUrl);
      } else {
        setCoverUrl(publicUrl);
      }

      toast({ title: `${isLogo ? "Logo" : "Titelbild"} hochgeladen` });
    } catch (error: unknown) {
      console.error("Upload error:", error);
      toast({ title: "Upload fehlgeschlagen", variant: "destructive" });
    } finally {
      if (isLogo) {
        setIsUploadingLogo(false);
      } else {
        setIsUploadingCover(false);
      }
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from("companies")
        .update({
          name,
          description: description || null,
          logo_url: logoUrl || null,
          cover_url: coverUrl || null,
        })
        .eq("id", company.id);

      if (error) throw error;
      
      toast({ title: "Kompanie aktualisiert" });
      onSave();
    } catch (error: unknown) {
      console.error("Save error:", error);
      toast({ title: "Speichern fehlgeschlagen", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Kompanie bearbeiten</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Logo Upload */}
          <div>
            <Label>Wappen / Logo</Label>
            <div className="mt-2 flex items-center gap-4">
              <div className="w-20 h-20 rounded-lg border bg-muted flex items-center justify-center overflow-hidden">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs text-muted-foreground">Kein Logo</span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={isUploadingLogo}
                >
                  {isUploadingLogo ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Upload className="w-4 h-4 mr-2" />
                  )}
                  Logo hochladen
                </Button>
                {logoUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setLogoUrl("")}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Entfernen
                  </Button>
                )}
              </div>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], "logo")}
              />
            </div>
          </div>

          {/* Cover Upload */}
          <div>
            <Label>Titelbild</Label>
            <div className="mt-2">
              <div className="w-full h-24 rounded-lg border bg-muted flex items-center justify-center overflow-hidden relative">
                {coverUrl ? (
                  <img src={coverUrl} alt="Cover" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs text-muted-foreground">Kein Titelbild</span>
                )}
              </div>
              <div className="flex gap-2 mt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => coverInputRef.current?.click()}
                  disabled={isUploadingCover}
                >
                  {isUploadingCover ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Upload className="w-4 h-4 mr-2" />
                  )}
                  Titelbild hochladen
                </Button>
                {coverUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setCoverUrl("")}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Entfernen
                  </Button>
                )}
              </div>
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], "cover")}
              />
            </div>
          </div>

          {/* Name */}
          <div>
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Kompaniename"
            />
          </div>

          {/* Description */}
          <div>
            <Label>Beschreibung</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Kurze Beschreibung der Kompanie..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CompanyEditDialog;