import { useState } from "react";
import { Loader2, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { apiJson } from "@/integrations/api/client";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

interface EventInfo {
  id: string;
  title: string;
  owner_type: "club" | "company";
  owner_id: string;
  audience: "company_only" | "club_internal" | "public";
  club_id: string;
}

interface CreateEventPostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: EventInfo;
  canDirectPublish: boolean;
  onSuccess: () => void;
}

const CATEGORIES = [
  { value: "info", label: "Vereinsinformation" },
  { value: "event", label: "Termine & Veranstaltungen" },
  { value: "warning", label: "Wichtige Mitteilung" },
  { value: "other", label: "Sonstiges" },
];

const CreateEventPostDialog = ({
  open,
  onOpenChange,
  event,
  canDirectPublish,
  onSuccess,
}: CreateEventPostDialogProps) => {
  const { member } = useAuth();

  const defaultAudience =
    event.audience === "public" ? "club_internal" : event.audience;

  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formCategory, setFormCategory] = useState("info");
  const [saving, setSaving] = useState(false);

  const handleClose = () => {
    setFormTitle("");
    setFormContent("");
    setFormCategory("info");
    onOpenChange(false);
  };

  const handleSave = async (asDraft: boolean) => {
    if (!member || !formTitle.trim() || !formContent.trim()) return;
    setSaving(true);

    try {
      const canPublishNow = canDirectPublish && defaultAudience !== "public";
      const status = asDraft ? "draft" : canPublishNow ? "approved" : "submitted";
      const now = new Date().toISOString();

      await apiJson("/api/posts", {
        method: "POST",
        body: JSON.stringify({
          title: formTitle.trim(),
          content: formContent.trim(),
          category: formCategory,
          audience: defaultAudience,
          owner_type: event.owner_type,
          owner_id: event.owner_id,
          event_id: event.id,
          publication_status: status,
          submitted_at: !asDraft && !canPublishNow ? now : null,
          approved_at: canPublishNow && !asDraft ? now : null,
          approved_by_member_id: canPublishNow && !asDraft ? member.id : null,
        }),
      });

      if (asDraft) {
        toast.success("Entwurf gespeichert");
      } else if (canPublishNow) {
        toast.success("Beitrag veröffentlicht");
      } else {
        toast.success("Beitrag zur Freigabe eingereicht");
      }

      onSuccess();
      handleClose();
    } catch (error: unknown) {
      console.error("CreateEventPostDialog save error:", error);
      toast.error(
        error instanceof Error ? error.message : "Fehler beim Speichern"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="w-5 h-5" />
            Beitrag für „{event.title}" erstellen
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Titel</Label>
            <Input
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="Titel des Beitrags..."
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>Inhalt</Label>
            <Textarea
              value={formContent}
              onChange={(e) => setFormContent(e.target.value)}
              placeholder="Inhalt der Ankündigung..."
              rows={5}
            />
          </div>

          <div className="space-y-2">
            <Label>Kategorie</Label>
            <Select value={formCategory} onValueChange={setFormCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="flex-wrap gap-2 pt-4 border-t">
          <Button variant="outline" onClick={handleClose} disabled={saving}>
            Abbrechen
          </Button>
          <Button
            variant="secondary"
            onClick={() => handleSave(true)}
            disabled={saving || !formTitle.trim() || !formContent.trim()}
          >
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Als Entwurf speichern
          </Button>
          <Button
            onClick={() => handleSave(false)}
            disabled={saving || !formTitle.trim() || !formContent.trim()}
          >
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            {canDirectPublish ? "Veröffentlichen" : "Zur Freigabe einreichen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateEventPostDialog;
