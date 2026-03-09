import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, X, Image as ImageIcon, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "@/hooks/use-toast";

interface PhotoUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  defaultScope?: "company" | "club";
}

type UsagePermission = "internal" | "homepage" | "magazine" | "all";

export function PhotoUploadDialog({ 
  open, 
  onOpenChange, 
  onSuccess,
  defaultScope = "company" 
}: PhotoUploadDialogProps) {
  const { member } = useAuth();
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [scope, setScope] = useState<"company" | "club">(defaultScope);
  const [usagePermissions, setUsagePermissions] = useState<Set<string>>(new Set(["internal"]));
  const [description, setDescription] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);

  // Fetch member's company on mount
  useState(() => {
    if (member?.id) {
      supabase
        .from("member_company_memberships")
        .select("company_id")
        .eq("member_id", member.id)
        .is("valid_to", null)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.company_id) {
            setCompanyId(data.company_id);
          }
        });
    }
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const imageFiles = acceptedFiles.filter(file => file.type.startsWith("image/"));
    setFiles(prev => [...prev, ...imageFiles]);
    
    // Generate previews
    imageFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviews(prev => [...prev, e.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".jpeg", ".jpg", ".png", ".webp"] },
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const togglePermission = (permission: string) => {
    setUsagePermissions(prev => {
      const next = new Set(prev);
      if (next.has(permission)) {
        // Always keep at least "internal"
        if (permission !== "internal" || next.size > 1) {
          next.delete(permission);
        }
      } else {
        next.add(permission);
      }
      return next;
    });
  };

  const getUsagePermissionValue = (): UsagePermission => {
    if (usagePermissions.has("internal") && usagePermissions.has("homepage") && usagePermissions.has("magazine")) {
      return "all";
    }
    if (usagePermissions.has("magazine")) return "magazine";
    if (usagePermissions.has("homepage")) return "homepage";
    return "internal";
  };

  const handleUpload = async () => {
    if (!member?.id || !member?.club_id || files.length === 0) return;

    setIsUploading(true);
    const uploadedCount = { success: 0, failed: 0 };

    try {
      for (const file of files) {
        const fileExt = file.name.split(".").pop();
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const filePath = `members/${member.id}/${fileName}`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from("gallery-images")
          .upload(filePath, file);

        if (uploadError) {
          console.error("Upload error:", uploadError);
          uploadedCount.failed++;
          continue;
        }

        // Create database record
        const visibility = scope === "company" ? "company" : "club";
        const { error: dbError } = await supabase
          .from("member_gallery_images")
          .insert({
            member_id: member.id,
            club_id: member.club_id,
            company_id: scope === "company" ? companyId : null,
            image_path: filePath,
            visibility,
            usage_permission: getUsagePermissionValue(),
            description: description || null,
            status: "pending",
          });

        if (dbError) {
          console.error("DB error:", dbError);
          uploadedCount.failed++;
        } else {
          uploadedCount.success++;
        }
      }

      if (uploadedCount.success > 0) {
        toast({
          title: "Fotos hochgeladen",
          description: `${uploadedCount.success} Foto(s) erfolgreich hochgeladen.`,
        });
        onSuccess?.();
        handleClose();
      }

      if (uploadedCount.failed > 0) {
        toast({
          title: "Einige Uploads fehlgeschlagen",
          description: `${uploadedCount.failed} Foto(s) konnten nicht hochgeladen werden.`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Fehler",
        description: "Die Fotos konnten nicht hochgeladen werden.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setFiles([]);
    setPreviews([]);
    setScope(defaultScope);
    setUsagePermissions(new Set(["internal"]));
    setDescription("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Fotos hochladen
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 py-4">
          {/* Dropzone */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
              isDragActive 
                ? "border-primary bg-primary/5" 
                : "border-muted-foreground/25 hover:border-primary/50"
            }`}
          >
            <input {...getInputProps()} />
            <ImageIcon className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
            {isDragActive ? (
              <p className="text-sm text-primary">Fotos hier ablegen...</p>
            ) : (
              <div className="space-y-1">
                <p className="text-sm font-medium">Fotos hierher ziehen</p>
                <p className="text-xs text-muted-foreground">oder klicken zum Auswählen</p>
              </div>
            )}
          </div>

          {/* Previews */}
          {previews.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {previews.map((preview, index) => (
                <div key={index} className="relative aspect-square">
                  <img
                    src={preview}
                    alt={`Preview ${index + 1}`}
                    className="w-full h-full object-cover rounded-lg"
                  />
                  <button
                    onClick={() => removeFile(index)}
                    className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Scope Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Für wen sind die Fotos?</Label>
            <RadioGroup
              value={scope}
              onValueChange={(v) => setScope(v as "company" | "club")}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="company" id="scope-company" />
                <Label htmlFor="scope-company" className="font-normal cursor-pointer">
                  Meine Kompanie
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="club" id="scope-club" />
                <Label htmlFor="scope-club" className="font-normal cursor-pointer">
                  Gesamter Verein
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Usage Permissions */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Nutzungserlaubnis</Label>
            <p className="text-xs text-muted-foreground">
              Wo dürfen deine Fotos verwendet werden?
            </p>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="perm-internal"
                  checked={usagePermissions.has("internal")}
                  onCheckedChange={() => togglePermission("internal")}
                  disabled
                />
                <Label htmlFor="perm-internal" className="font-normal cursor-pointer">
                  Im Portal (intern)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="perm-homepage"
                  checked={usagePermissions.has("homepage")}
                  onCheckedChange={() => togglePermission("homepage")}
                />
                <Label htmlFor="perm-homepage" className="font-normal cursor-pointer">
                  Auf der Vereins-Homepage
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="perm-magazine"
                  checked={usagePermissions.has("magazine")}
                  onCheckedChange={() => togglePermission("magazine")}
                />
                <Label htmlFor="perm-magazine" className="font-normal cursor-pointer">
                  Im Schützenheft / Jahresrückblick
                </Label>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-medium">
              Beschreibung (optional)
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="z.B. Schützenfest 2024, Kompanieschießen..."
              rows={2}
              maxLength={500}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={handleClose} disabled={isUploading}>
            Abbrechen
          </Button>
          <Button onClick={handleUpload} disabled={files.length === 0 || isUploading}>
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Wird hochgeladen...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                {files.length} Foto{files.length !== 1 ? "s" : ""} hochladen
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
