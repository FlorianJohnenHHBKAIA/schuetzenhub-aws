import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2, Medal, Award, Crown, Trophy, ScrollText, Star, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";

export const AWARD_TYPES = [
  { value: "medal", label: "Medaille", icon: Medal, color: "text-amber-500", bgColor: "bg-amber-500/10" },
  { value: "order", label: "Orden", icon: Star, color: "text-blue-500", bgColor: "bg-blue-500/10" },
  { value: "honor", label: "Ehrung", icon: Sparkles, color: "text-purple-500", bgColor: "bg-purple-500/10" },
  { value: "certificate", label: "Urkunde", icon: ScrollText, color: "text-green-500", bgColor: "bg-green-500/10" },
  { value: "crown", label: "Königswürde", icon: Crown, color: "text-yellow-500", bgColor: "bg-yellow-500/10" },
  { value: "trophy", label: "Pokal", icon: Trophy, color: "text-orange-500", bgColor: "bg-orange-500/10" },
  { value: "other", label: "Sonstiges", icon: Award, color: "text-accent", bgColor: "bg-accent/10" },
] as const;

export type AwardType = typeof AWARD_TYPES[number]["value"];

export const getAwardTypeConfig = (type: string) => {
  return AWARD_TYPES.find(t => t.value === type) || AWARD_TYPES[AWARD_TYPES.length - 1];
};

interface Award {
  id: string;
  title: string;
  description: string | null;
  awarded_at: string;
  award_type: string;
  company_id?: string | null;
  is_regiment?: boolean; // Füge is_regiment zur Award-Schnittstelle hinzu
}

interface AwardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId: string;
  clubId: string;
  award?: Award | null;
  onSave: () => void;
}

const AwardDialog = ({ open, onOpenChange, memberId, clubId, award, onSave }: AwardDialogProps) => {
  const { toast } = useToast();
  const { member: authMember } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [awardedAt, setAwardedAt] = useState<Date>(new Date());
  const [awardType, setAwardType] = useState<AwardType>("other");
  const [isRegiment, setIsRegiment] = useState(true);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);

  // Kompanien laden, wenn der Dialog geöffnet wird
  useEffect(() => {
    const fetchCompanies = async () => {
      if (!open || !clubId) return;
      const { data, error } = await supabase
        .from("companies")
        .select("id, name")
        .eq("club_id", clubId)
        .order("name");
      if (!error && data) {
        setCompanies(data as { id: string; name: string }[]);
      }
    };
    fetchCompanies();
  }, [open, clubId]);

  useEffect(() => {
    if (award) {
      setTitle(award.title);
      setDescription(award.description || "");
      setAwardedAt(new Date(award.awarded_at));
      setAwardType(award.award_type as AwardType || "other");
      setIsRegiment(award.is_regiment ?? !award.company_id); // Nutze is_regiment, falls vorhanden, sonst leite es von company_id ab
      setSelectedCompanyId(award.company_id || null);
    } else {
      setTitle("");
      setDescription("");
      setAwardedAt(new Date());
      setAwardType("other");
      setIsRegiment(true);
      setSelectedCompanyId(null);
    }
  }, [award, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      toast({ title: "Titel ist erforderlich", variant: "destructive" });
      return;
    }

    if (!isRegiment && !selectedCompanyId) { // Validierung hinzugefügt
      toast({ title: "Bitte eine Kompanie auswählen", variant: "destructive" });
      return;
    }

    if (!clubId) {
      toast({ title: "Vereins-ID fehlt", description: "Bitte versuchen Sie es erneut.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      if (award) {
        // Update existing award
        const { error } = await supabase
          .from("member_awards")
          .update({
            title: title.trim(),
            description: description.trim() || null,
            awarded_at: format(awardedAt, "yyyy-MM-dd"),
            award_type: awardType,
            company_id: isRegiment ? null : (selectedCompanyId || null),
            is_regiment: isRegiment, // Sende is_regiment im Payload
            requested_by_member_id: authMember?.id,
            status: "approved",
          })
          .eq("id", award.id);

        if (error) throw error;
        toast({ title: "Gespeichert", description: "Die Auszeichnung wurde aktualisiert." });
      } else {
        // Create new award
        const { error } = await supabase
          .from("member_awards")
          .insert({
            member_id: memberId,
            club_id: clubId,
            title: title.trim(),
            description: description.trim() || null,
            awarded_at: format(awardedAt, "yyyy-MM-dd"),
            award_type: awardType,
            company_id: isRegiment ? null : (selectedCompanyId || null),
            is_regiment: isRegiment, // Sende is_regiment im Payload
            requested_by_member_id: authMember?.id,
            status: "approved",
          });

        if (error) throw error;
        toast({ title: "Erfolgreich", description: "Die Auszeichnung wurde hinzugefügt." });
      }

      onOpenChange(false);
      onSave();
    } catch (error) {
      console.error("Error saving award:", error);
      toast({ title: "Fehler beim Speichern", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {award ? "Auszeichnung bearbeiten" : "Neue Auszeichnung"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Award Type Selection */}
          <div className="space-y-2">
            <Label>Typ</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {AWARD_TYPES.map((type) => {
                const Icon = type.icon;
                const isSelected = awardType === type.value;
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setAwardType(type.value)}
                    className={cn(
                      "flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all duration-200",
                      isSelected
                        ? `border-primary shadow-sm ${type.bgColor}`
                        : "border-muted/20 bg-muted/30 hover:bg-muted/60"
                    )}
                  >
                    <Icon className={cn("w-6 h-6 mb-1.5", type.color)} />
                    <span className="text-xs font-medium">{type.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Titel *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="z.B. Schützenkönig"
                required
                className="bg-muted/30"
              />
            </div>

            <div className="flex items-center space-x-2 p-3 rounded-lg bg-muted/20 border border-muted/30">
              <Checkbox 
                id="is_regiment" 
                checked={isRegiment} 
                onCheckedChange={(checked) => setIsRegiment(!!checked)} 
              />
              <Label htmlFor="is_regiment" className="cursor-pointer text-sm font-medium">Vom Regiment / Bruderschaft</Label>
            </div>
          </div>

          {!isRegiment && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
              <Label>Ausstellende Kompanie *</Label>
              <Select value={selectedCompanyId || ""} onValueChange={setSelectedCompanyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Wähle eine Kompanie..." />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="description">Beschreibung</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optionale Beschreibung..."
              rows={3}
              className="bg-muted/30"
            />
          </div>

          <div className="space-y-2">
            <Label>Verleihungsdatum</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal bg-muted/30",
                    !awardedAt && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {awardedAt ? format(awardedAt, "PPP", { locale: de }) : "Datum wählen"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={awardedAt}
                  onSelect={(date) => date && setAwardedAt(date)}
                  initialFocus
                  captionLayout="dropdown"
                  fromYear={1900}
                  toYear={new Date().getFullYear() + 1}
                  locale={de}
                  className="p-3"
                  classNames={{
                    caption: "flex justify-center pt-2 relative items-center h-10",
                    caption_label: "hidden", // Entfernt das statische "Monat Jahr"
                    caption_dropdowns: "flex justify-center gap-2 w-full",
                    vhidden: "hidden",
                    dropdown: "bg-transparent font-semibold hover:text-primary transition-colors cursor-pointer focus:outline-none appearance-none px-1 rounded-md",
                    nav: "hidden", // Entfernt die Pfeile für ein cleanes Dropdown-Menü
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {award ? "Speichern" : "Hinzufügen"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AwardDialog;
