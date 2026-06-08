import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiJson } from "@/integrations/api/client";
import { BookmarkPlus } from "lucide-react";

interface Post {
  id: string;
  title: string;
  content: string;
  audience: "company_only" | "club_internal" | "public";
  owner_type: "club" | "company";
  owner_id: string;
  created_at: string;
}

interface ArchiveEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  post: Post;
  onSuccess: () => void;
}

const CATEGORIES = [
  { value: "aushang", label: "Aushang" },
  { value: "bericht", label: "Bericht" },
  { value: "rueckblick", label: "Rückblick" },
  { value: "presse", label: "Presse" },
  { value: "nachruf", label: "Nachruf" },
  { value: "ehrung", label: "Ehrung" },
  { value: "veranstaltung", label: "Veranstaltung" },
  { value: "sonstiges", label: "Sonstiges" },
];

const VISIBILITY_OPTIONS = [
  { value: "club_internal", label: "Vereinsintern" },
  { value: "company_only", label: "Nur Kompanie" },
  { value: "public", label: "Öffentlich" },
  { value: "admin_only", label: "Nur Admins" },
];

export default function ArchiveEntryDialog({
  open,
  onOpenChange,
  post,
  onSuccess,
}: ArchiveEntryDialogProps) {
  const { toast } = useToast();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("sonstiges");
  const [archiveYear, setArchiveYear] = useState<number>(new Date().getFullYear());
  const [eventDate, setEventDate] = useState("");
  const [visibility, setVisibility] = useState("club_internal");
  const [tags, setTags] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open && post) {
      setTitle(post.title);
      setDescription(post.content ? post.content.slice(0, 300) : "");
      setArchiveYear(new Date(post.created_at).getFullYear());
      setCategory("sonstiges");
      setEventDate("");
      setVisibility(
        post.audience === "public"
          ? "public"
          : post.audience === "company_only"
          ? "company_only"
          : "club_internal"
      );
      setTags("");
    }
  }, [open, post]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast({ title: "Titel ist erforderlich", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      await apiJson("/api/archive/entries", {
        method: "POST",
        body: JSON.stringify({
          source_type: "post",
          source_id: post.id,
          title: title.trim(),
          description: description.trim() || null,
          archive_category: category,
          archive_year: archiveYear,
          event_date: eventDate || null,
          visibility,
          is_public: visibility === "public",
          tags: tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          related_company_id:
            post.owner_type === "company" ? post.owner_id : null,
        }),
      });
      toast({ title: "Beitrag ins Vereinsarchiv übernommen" });
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Fehler beim Archivieren",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const currentYear = new Date().getFullYear();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookmarkPlus className="w-5 h-5 text-primary" />
            Beitrag ins Vereinsarchiv übernehmen
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="archive-title">Archivtitel *</Label>
            <Input
              id="archive-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titel im Archiv"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="archive-description">Beschreibung</Label>
            <Textarea
              id="archive-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Kurze Beschreibung für das Archiv"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Kategorie</Label>
              <Select value={category} onValueChange={setCategory}>
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

            <div className="space-y-2">
              <Label htmlFor="archive-year">Archivjahr</Label>
              <Input
                id="archive-year"
                type="number"
                min={1800}
                max={currentYear + 1}
                value={archiveYear}
                onChange={(e) => setArchiveYear(parseInt(e.target.value) || currentYear)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="event-date">Ereignisdatum (optional)</Label>
            <Input
              id="event-date"
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Sichtbarkeit</Label>
            <Select value={visibility} onValueChange={setVisibility}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VISIBILITY_OPTIONS.map((v) => (
                  <SelectItem key={v.value} value={v.value}>
                    {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="archive-tags">Tags (kommasepariert)</Label>
            <Input
              id="archive-tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="z.B. Schützenfest, Kompanie1, historisch"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Abbrechen
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Wird übernommen…" : "Ins Archiv übernehmen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
