import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  CalendarIcon, Loader2, Medal, Award, Crown, Trophy, ScrollText,
  Star, Sparkles, Shield, Gem, Heart, Upload, FileText, X, Lock
} from "lucide-react";
import { apiJson, apiUpload, getStorageUrl } from "@/integrations/api/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";

export interface AwardType {
  id: string;
  name: string;
  icon: string;
  badge_color: string;
  category: string;
  is_bhds_standard: boolean;
  requirements: string | null;
  special_notes: string | null;
  sort_order: number;
  is_active: boolean;
}

interface MemberAward {
  id: string;
  title: string;
  description: string | null;
  awarded_at: string;
  award_type: string;
  award_type_id: string | null;
  company_id?: string | null;
  is_regiment?: boolean;
  awarded_by?: string | null;
  notes?: string | null;
  certificate_url?: string | null;
}

interface AwardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId: string;
  clubId: string;
  award?: MemberAward | null;
  onSave: () => void;
}

const ICON_MAP: Record<string, React.ElementType> = {
  medal: Medal,
  order: Star,
  honor: Sparkles,
  certificate: ScrollText,
  crown: Crown,
  trophy: Trophy,
  shield: Shield,
  gem: Gem,
  heart: Heart,
  star: Star,
  other: Award,
};

const CATEGORY_LABELS: Record<string, string> = {
  orden: "Orden",
  ehrenzeichen: "Ehrenzeichen",
  vereinsauszeichnung: "Vereinsauszeichnung",
  custom: "Vereinsintern",
};

const CATEGORY_COLORS: Record<string, string> = {
  orden: "bg-blue-500/10 text-blue-700 border-blue-200",
  ehrenzeichen: "bg-purple-500/10 text-purple-700 border-purple-200",
  vereinsauszeichnung: "bg-amber-500/10 text-amber-700 border-amber-200",
  custom: "bg-muted text-muted-foreground",
};

export const getAwardTypeConfig = (iconName: string) => {
  const Icon = ICON_MAP[iconName] || Award;
  const colorMap: Record<string, string> = {
    medal: "text-amber-500",
    order: "text-blue-500",
    honor: "text-purple-500",
    certificate: "text-green-500",
    crown: "text-yellow-500",
    trophy: "text-orange-500",
    shield: "text-slate-500",
    gem: "text-emerald-500",
    heart: "text-red-500",
    star: "text-yellow-500",
    other: "text-muted-foreground",
  };
  const bgMap: Record<string, string> = {
    medal: "bg-amber-500/10",
    order: "bg-blue-500/10",
    honor: "bg-purple-500/10",
    certificate: "bg-green-500/10",
    crown: "bg-yellow-500/10",
    trophy: "bg-orange-500/10",
    shield: "bg-slate-500/10",
    gem: "bg-emerald-500/10",
    heart: "bg-red-500/10",
    star: "bg-yellow-500/10",
    other: "bg-muted/50",
  };
  return {
    icon: Icon,
    color: colorMap[iconName] || "text-muted-foreground",
    bgColor: bgMap[iconName] || "bg-muted/50",
  };
};

const AwardDialog = ({ open, onOpenChange, memberId, clubId, award, onSave }: AwardDialogProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [awardTypes, setAwardTypes] = useState<AwardType[]>([]);
  const [typesLoading, setTypesLoading] = useState(false);

  const [selectedTypeId, setSelectedTypeId] = useState<string>("");
  const [customTitle, setCustomTitle] = useState("");
  const [description, setDescription] = useState("");
  const [awardedAt, setAwardedAt] = useState<Date>(new Date());
  const [awardedBy, setAwardedBy] = useState("");
  const [notes, setNotes] = useState("");
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [existingCertUrl, setExistingCertUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setTypesLoading(true);
    apiJson<AwardType[]>("/api/award-types?is_active=true")
      .then(data => setAwardTypes(data || []))
      .catch(() => toast.error("Auszeichnungstypen konnten nicht geladen werden"))
      .finally(() => setTypesLoading(false));
  }, [open]);

  useEffect(() => {
    if (award) {
      setSelectedTypeId(award.award_type_id || "");
      setCustomTitle(award.award_type_id ? "" : award.title);
      setDescription(award.description || "");
      setAwardedAt(new Date(award.awarded_at));
      setAwardedBy(award.awarded_by || "");
      setNotes(award.notes || "");
      setExistingCertUrl(award.certificate_url || null);
    } else {
      setSelectedTypeId("");
      setCustomTitle("");
      setDescription("");
      setAwardedAt(new Date());
      setAwardedBy("");
      setNotes("");
      setExistingCertUrl(null);
    }
    setCertificateFile(null);
  }, [award, open]);

  const selectedType = awardTypes.find(t => t.id === selectedTypeId);

  const bhdsTypes = awardTypes.filter(t => t.is_bhds_standard);
  const customTypes = awardTypes.filter(t => !t.is_bhds_standard);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const resolvedTitle = selectedType ? selectedType.name : customTitle.trim();
    if (!resolvedTitle) {
      toast.error("Bitte eine Auszeichnung auswählen oder einen Titel eingeben.");
      return;
    }

    setIsLoading(true);
    try {
      const payload = {
        member_id: memberId,
        title: resolvedTitle,
        description: description.trim() || null,
        awarded_at: format(awardedAt, "yyyy-MM-dd"),
        award_type_id: selectedTypeId || null,
        award_type: selectedType?.icon || "medal",
        awarded_by: awardedBy.trim() || null,
        notes: notes.trim() || null,
        status: "approved",
      };

      let savedAward: MemberAward;
      if (award) {
        savedAward = await apiJson<MemberAward>(`/api/awards/${award.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        toast.success("Auszeichnung aktualisiert.");
      } else {
        savedAward = await apiJson<MemberAward>("/api/awards", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast.success("Auszeichnung erfolgreich verliehen.");
      }

      // Zertifikat hochladen falls ausgewählt
      if (certificateFile && savedAward?.id) {
        await apiUpload(`/api/awards/${savedAward.id}/certificate`, certificateFile);
      }

      onOpenChange(false);
      onSave();
    } catch (err) {
      console.error("Error saving award:", err);
      toast.error("Die Auszeichnung konnte nicht gespeichert werden.");
    } finally {
      setIsLoading(false);
    }
  };

  const certFileName = certificateFile?.name
    || (existingCertUrl ? existingCertUrl.split("/").pop() : null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {award ? "Auszeichnung bearbeiten" : "Auszeichnung verleihen"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Auszeichnung wählen */}
          <div className="space-y-2">
            <Label>Auszeichnung *</Label>
            {typesLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Lade Auszeichnungen…
              </div>
            ) : (
              <Select value={selectedTypeId} onValueChange={setSelectedTypeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Auszeichnung wählen…" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {bhdsTypes.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        BHDS-Auszeichnungen
                      </div>
                      {bhdsTypes.map(t => {
                        const cfg = getAwardTypeConfig(t.icon);
                        const Icon = cfg.icon;
                        return (
                          <SelectItem key={t.id} value={t.id}>
                            <div className="flex items-center gap-2">
                              <Icon className={cn("w-4 h-4 shrink-0", cfg.color)} />
                              <span className="truncate">{t.name}</span>
                              <Lock className="w-3 h-3 text-muted-foreground ml-auto shrink-0" />
                            </div>
                          </SelectItem>
                        );
                      })}
                    </>
                  )}
                  {customTypes.length > 0 && (
                    <>
                      {bhdsTypes.length > 0 && <Separator className="my-1" />}
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Vereinsinterne Auszeichnungen
                      </div>
                      {customTypes.map(t => {
                        const cfg = getAwardTypeConfig(t.icon);
                        const Icon = cfg.icon;
                        return (
                          <SelectItem key={t.id} value={t.id}>
                            <div className="flex items-center gap-2">
                              <Icon className={cn("w-4 h-4 shrink-0", cfg.color)} />
                              <span className="truncate">{t.name}</span>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </>
                  )}
                  <Separator className="my-1" />
                  <SelectItem value="">
                    <span className="text-muted-foreground italic">Andere / Freitext</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            )}

            {/* Info zur gewählten BHDS-Auszeichnung */}
            {selectedType && (
              <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={cn("text-xs", CATEGORY_COLORS[selectedType.category])}>
                    {CATEGORY_LABELS[selectedType.category] || selectedType.category}
                  </Badge>
                  {selectedType.is_bhds_standard && (
                    <Badge variant="outline" className="text-xs gap-1">
                      <Lock className="w-3 h-3" />
                      BHDS-Standard
                    </Badge>
                  )}
                </div>
                {selectedType.requirements && (
                  <p className="text-muted-foreground">
                    <span className="font-medium text-foreground">Voraussetzung:</span> {selectedType.requirements}
                  </p>
                )}
                {selectedType.special_notes && (
                  <p className="text-amber-700 dark:text-amber-400">
                    <span className="font-medium">Hinweis:</span> {selectedType.special_notes}
                  </p>
                )}
              </div>
            )}

            {/* Freitext-Titel wenn kein Typ gewählt */}
            {!selectedTypeId && (
              <div className="space-y-1 mt-2">
                <Input
                  value={customTitle}
                  onChange={e => setCustomTitle(e.target.value)}
                  placeholder="Titel der Auszeichnung eingeben…"
                  className="bg-muted/30"
                />
              </div>
            )}
          </div>

          {/* Verleihungsdatum */}
          <div className="space-y-2">
            <Label>Verleihungsdatum</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={cn("w-full justify-start text-left font-normal bg-muted/30")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(awardedAt, "PPP", { locale: de })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={awardedAt}
                  onSelect={date => date && setAwardedAt(date)}
                  initialFocus
                  captionLayout="dropdown"
                  fromYear={1900}
                  toYear={new Date().getFullYear() + 1}
                  locale={de}
                  className="p-3"
                  classNames={{
                    caption: "flex justify-center pt-2 relative items-center h-10",
                    caption_label: "hidden",
                    caption_dropdowns: "flex justify-center gap-2 w-full",
                    vhidden: "hidden",
                    dropdown: "bg-transparent font-semibold hover:text-primary transition-colors cursor-pointer focus:outline-none appearance-none px-1 rounded-md",
                    nav: "hidden",
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Verleihende Stelle */}
          <div className="space-y-2">
            <Label htmlFor="awarded_by">Verleihende Stelle / Ebene</Label>
            <Input
              id="awarded_by"
              value={awardedBy}
              onChange={e => setAwardedBy(e.target.value)}
              placeholder="z. B. BHDS-Diözesanverband, Vorstand, …"
              className="bg-muted/30"
            />
          </div>

          {/* Beschreibung */}
          <div className="space-y-2">
            <Label htmlFor="description">Begründung / Beschreibung</Label>
            <Textarea
              id="description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optionale Begründung oder Beschreibung…"
              rows={2}
              className="bg-muted/30"
            />
          </div>

          {/* Bemerkung */}
          <div className="space-y-2">
            <Label htmlFor="notes">Bemerkung</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Interne Bemerkung…"
              rows={2}
              className="bg-muted/30"
            />
          </div>

          {/* Urkunde / Nachweis */}
          <div className="space-y-2">
            <Label>Urkunde / Nachweis (optional)</Label>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="shrink-0"
              >
                <Upload className="w-4 h-4 mr-2" />
                Datei wählen
              </Button>
              {certFileName ? (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground min-w-0">
                  <FileText className="w-4 h-4 shrink-0" />
                  <span className="truncate">{certFileName}</span>
                  <button
                    type="button"
                    onClick={() => { setCertificateFile(null); setExistingCertUrl(null); }}
                    className="shrink-0 hover:text-destructive"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">Keine Datei ausgewählt</span>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={e => setCertificateFile(e.target.files?.[0] || null)}
            />
            <p className="text-xs text-muted-foreground">PDF oder Bild (max. 10 MB)</p>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {award ? "Speichern" : "Verleihen"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AwardDialog;
