import { useState, useRef } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase, apiUpload, getStorageUrl } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface MemberData {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  street: string | null;
  zip: string | null;
  city: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  title: string | null;
  bio: string | null;
}

interface MemberProfileEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: MemberData;
  onSave: () => void;
}

const MemberProfileEditDialog = ({ open, onOpenChange, member, onSave }: MemberProfileEditDialogProps) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [title, setTitle] = useState(member.title || "");
  const [bio, setBio] = useState(member.bio || "");
  const [phone, setPhone] = useState(member.phone || "");
  const [street, setStreet] = useState(member.street || "");
  const [zip, setZip] = useState(member.zip || "");
  const [city, setCity] = useState(member.city || "");
  const [avatarUrl, setAvatarUrl] = useState(member.avatar_url || "");
  const [coverUrl, setCoverUrl] = useState(member.cover_url || "");
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File, type: "avatar" | "cover") => {
    const isAvatar = type === "avatar";
    isAvatar ? setIsUploadingAvatar(true) : setIsUploadingCover(true);

    try {
      const fileExt = file.name.split(".").pop();
      const bucket = isAvatar ? "avatars" : "covers";
      const fileName = `${member.id}/${type}-${Date.now()}.${fileExt}`;
      
      const uploadResult = await apiUpload(`/api/upload`, file, { bucket, path: fileName });
      const publicUrl = getStorageUrl(bucket, fileName) || "";

      if (isAvatar) {
        setAvatarUrl(publicUrl);
      } else {
        setCoverUrl(publicUrl);
      }

      toast({ title: `${isAvatar ? "Profilbild" : "Titelbild"} hochgeladen` });
    } catch (error) {
      console.error("Upload error:", error);
      toast({ title: "Upload fehlgeschlagen", variant: "destructive" });
    } finally {
      isAvatar ? setIsUploadingAvatar(false) : setIsUploadingCover(false);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from("members")
        .update({
          title: title || null,
          bio: bio || null,
          phone: phone || null,
          street: street || null,
          zip: zip || null,
          city: city || null,
          avatar_url: avatarUrl || null,
          cover_url: coverUrl || null,
        })
        .eq("id", member.id);

      if (error) throw error;
      
      toast({ title: "Profil aktualisiert" });
      onSave();
    } catch (error) {
      console.error("Save error:", error);
      toast({ title: "Speichern fehlgeschlagen", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Profil bearbeiten</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Avatar Upload */}
          <div>
            <Label>Profilbild</Label>
            <div className="mt-2 flex items-center gap-4">
              <Avatar className="w-20 h-20">
                <AvatarImage src={avatarUrl || undefined} alt={member.first_name} />
                <AvatarFallback className="text-lg bg-primary text-primary-foreground">
                  {member.first_name[0]}{member.last_name[0]}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={isUploadingAvatar}
                >
                  {isUploadingAvatar ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Upload className="w-4 h-4 mr-2" />
                  )}
                  Profilbild hochladen
                </Button>
                {avatarUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setAvatarUrl("")}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Entfernen
                  </Button>
                )}
              </div>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], "avatar")}
              />
            </div>
          </div>

          {/* Cover Upload */}
          <div>
            <Label>Titelbild</Label>
            <div className="mt-2">
              <div className="w-full h-24 rounded-lg border bg-muted flex items-center justify-center overflow-hidden">
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

          {/* Title */}
          <div>
            <Label>Titel / Position</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="z.B. Hauptmann, Schriftführer..."
            />
          </div>

          {/* Bio */}
          <div>
            <Label>Über mich</Label>
            <Textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Kurze Beschreibung..."
              rows={3}
            />
          </div>

          {/* Contact Info Section */}
          <div className="border-t pt-4 mt-4">
            <Label className="text-base font-semibold mb-4 block">Kontaktdaten</Label>
            
            <div className="space-y-4">
              {/* Phone */}
              <div>
                <Label>Telefon</Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Telefonnummer"
                  type="tel"
                />
              </div>

              {/* Street */}
              <div>
                <Label>Straße & Hausnummer</Label>
                <Input
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  placeholder="Musterstraße 123"
                />
              </div>

              {/* ZIP & City */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>PLZ</Label>
                  <Input
                    value={zip}
                    onChange={(e) => setZip(e.target.value)}
                    placeholder="12345"
                  />
                </div>
                <div className="col-span-2">
                  <Label>Ort</Label>
                  <Input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Musterstadt"
                  />
                </div>
              </div>
            </div>
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

export default MemberProfileEditDialog;
