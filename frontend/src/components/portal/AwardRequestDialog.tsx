import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/api/client";
import { useAuth } from "@/lib/auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { CalendarIcon, Loader2, Award, Building2, CheckCircle, Medal, Star, Sparkles, ScrollText, Crown, Trophy, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

interface AwardType {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  badge_color: string;
  scope_type: "club" | "company";
  scope_id: string | null;
  is_active: boolean;
  club_id: string;
}

interface AwardRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId: string;
  clubId: string;
  onSuccess: () => void;
}

const getAwardIcon = (name: string | null | undefined) => {
  const icons: Record<string, { icon: typeof Medal, color: string, bgColor: string }> = {
    medal: { icon: Medal, color: "text-amber-500", bgColor: "bg-amber-500/10" },
    order: { icon: Star, color: "text-blue-500", bgColor: "bg-blue-500/10" },
    honor: { icon: Sparkles, color: "text-purple-500", bgColor: "bg-purple-500/10" },
    certificate: { icon: ScrollText, color: "text-green-500", bgColor: "bg-green-500/10" },
    crown: { icon: Crown, color: "text-yellow-500", bgColor: "bg-yellow-500/10" },
    trophy: { icon: Trophy, color: "text-orange-500", bgColor: "bg-orange-500/10" },
    shield: { icon: Shield, color: "text-slate-500", bgColor: "bg-slate-500/10" },
    other: { icon: Award, color: "text-primary", bgColor: "bg-primary/10" },
  };
  return icons[name?.toLowerCase() || "other"] || icons.other;
};

export default function AwardRequestDialog({
  open,
  onOpenChange,
  memberId,
  clubId,
  onSuccess,
}: AwardRequestDialogProps) {
  const { member } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedType, setSelectedType] = useState<AwardType | null>(null);
  const [description, setDescription] = useState("");
  const [awardedAt, setAwardedAt] = useState<Date>(new Date());

  const { data: awardTypes, isLoading: isTypesLoading } = useQuery({
    queryKey: ["available-award-types", clubId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("award_types")
        .select("id, name, description, icon, badge_color, scope_type, scope_id, is_active, club_id")
        .eq("club_id", clubId)
        // Wir zeigen alle an, sofern sie nicht explizit deaktiviert wurden
        .neq("is_active", false)
        .order("name", { ascending: true });
      if (error) throw error;
      return data as AwardType[];
    },
    enabled: open && !!clubId,
  });

  // Fetch existing awards to check for duplicates or pending requests
  const { data: existingAwards, isLoading: isAwardsLoading } = useQuery({
    queryKey: ["member-awards-status-check", memberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("member_awards")
        .select("award_type_id, status, title, award_type, description")
        .eq("member_id", memberId);
      if (error) throw error;
      return data;
    },
    enabled: open && !!memberId,
  });

  const isLoading = isTypesLoading || isAwardsLoading;

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!selectedType || !member) throw new Error("Missing data");
      
      const { error } = await supabase
        .from("member_awards")
        .insert({
          member_id: memberId,
          club_id: clubId,
          title: selectedType.name,
          description: description.trim() || null,
          awarded_at: format(awardedAt, "yyyy-MM-dd"),
          award_type: selectedType.icon,
          award_type_id: selectedType.id,
          status: "pending",
          requested_by_member_id: member.id,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["member-awards"] });
      queryClient.invalidateQueries({ queryKey: ["award-requests"] });
      toast({ 
        title: "Antrag eingereicht", 
        description: "Ihr Antrag wurde zur Genehmigung eingereicht." 
      });
      onSuccess();
      handleClose();
    },
    onError: (error: unknown) => {
      console.error("Error submitting award request:", error);
      toast({ title: "Fehler beim Einreichen", variant: "destructive" });
    },
  });

  const handleClose = () => {
    setSelectedType(null);
    setDescription("");
    setAwardedAt(new Date());
    onOpenChange(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedType) {
      toast({ title: "Bitte wählen Sie einen Auszeichnungstyp", variant: "destructive" });
      return;
    }
    submitMutation.mutate();
  };

  const clubTypes = awardTypes?.filter(t => t.scope_type === "club") || [];
  const companyTypes = awardTypes?.filter(t => t.scope_type === "company") || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Auszeichnung beantragen</DialogTitle>
          <DialogDescription>
            Wählen Sie eine Auszeichnung aus und reichen Sie einen Antrag zur Genehmigung ein.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {isLoading || !existingAwards ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : (awardTypes?.length === 0 && (!existingAwards || existingAwards.length === 0)) ? (
            <div className="text-center py-8 text-muted-foreground">
              <Award className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Keine Auszeichnungstypen verfügbar.</p>
              <p className="text-sm">Bisher wurden keine Auszeichnungstypen für diesen Verein definiert.</p>
              <p className="text-xs mt-2 italic">Administratoren können diese unter "Einstellungen → Auszeichnungstypen" anlegen.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Display manually added awards or awards that don't match a defined type */}
              {existingAwards && (() => {
                const manualAwards = existingAwards?.filter(ea => 
                  !awardTypes?.some(at => at.id === ea.award_type_id || at.name === ea.title)
                ) || [];
                
                if (manualAwards.length === 0) return null;
                
                return (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-muted-foreground">
                      <CheckCircle className="w-4 h-4" />
                      Bereits verliehene Auszeichnungen
                    </Label>
                    <div className="grid gap-2">
                      {manualAwards.map((award, idx) => (
                        <AwardTypeOption
                          key={`manual-${idx}`}
                          type={{
                            id: `manual-${idx}`,
                            name: award.title || "Unbenannte Auszeichnung",
                            description: award.description,
                            icon: award.award_type || 'medal',
                            badge_color: 'gold',
                            scope_type: 'club',
                            scope_id: null,
                            is_active: true,
                            club_id: clubId
                          }}
                          selected={false}
                          onSelect={() => {}}
                          status={award.status}
                        />
                      ))}
                    </div>
                  </div>
                );
              })()}

              {clubTypes.length > 0 && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-muted-foreground">
                    <Award className="w-4 h-4" />
                    Verfügbare Vereinsauszeichnungen
                  </Label>
                  <div className="grid gap-2">
                    {clubTypes.map(type => (
                      <AwardTypeOption
                        key={type.id}
                        type={type}
                        selected={selectedType?.id === type.id}
                        onSelect={() => setSelectedType(type)}
                        status={existingAwards?.find(ea => 
                          (ea?.award_type_id === type.id) || 
                          (!ea?.award_type_id && ea?.title === type.name)
                        )?.status}
                      />
                    ))}
                  </div>
                </div>
              )}

              {companyTypes.length > 0 && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-muted-foreground">
                    <Building2 className="w-4 h-4" />
                    Verfügbare Kompanieauszeichnungen
                  </Label>
                  <div className="grid gap-2">
                    {companyTypes.map(type => (
                      <AwardTypeOption
                        key={type.id}
                        type={type}
                        selected={selectedType?.id === type.id}
                        onSelect={() => setSelectedType(type)}
                        status={existingAwards?.find(ea => 
                          (ea?.award_type_id === type.id) || 
                          (!ea?.award_type_id && ea?.title === type.name)
                        )?.status}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {selectedType && (
            <>
              <div className="space-y-2">
                <Label htmlFor="description">Begründung (optional)</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Warum sollten Sie diese Auszeichnung erhalten?"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Gewünschtes Verleihungsdatum</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
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
            </>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={handleClose}>
              Abbrechen
            </Button>
            <Button 
              type="submit" 
              disabled={!selectedType || submitMutation.isPending}
            >
              {submitMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Antrag einreichen
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AwardTypeOption({ 
  type, 
  selected, 
  onSelect,
  status
}: { 
  type: AwardType; 
  selected: boolean; 
  onSelect: () => void;
  status?: string;
}) {
  const iconConfig = getAwardIcon(type.icon);
  
  // Fallback, falls ein Icon-Name in lucide-react nicht existiert (verhindert White-Screen)
  const Icon = iconConfig.icon || Award;

  const isAlreadyOwned = status === "approved";
  const isPending = status === "pending";

  return (
    <button
      type="button"
      onClick={isAlreadyOwned || isPending ? undefined : onSelect}
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-all w-full",
        selected ? "border-primary bg-primary/5" : "border-transparent bg-muted/50",
        (isAlreadyOwned || isPending) ? "opacity-60 cursor-default" : "hover:bg-muted cursor-pointer"
      )}
      disabled={isAlreadyOwned || isPending}
    >
      <div className={cn("p-2 rounded-full shrink-0", iconConfig.bgColor)}>
        <Icon className={cn("w-4 h-4", iconConfig.color)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium">{type.name}</p>
        {type.description && (
          <p className="text-sm text-muted-foreground truncate">{type.description}</p>
        )}
      </div>
      {isAlreadyOwned ? (
        <Badge variant="secondary" className="shrink-0 bg-green-500/10 text-green-600 border-green-500/20">Verliehen</Badge>
      ) : isPending ? (
        <Badge variant="secondary" className="shrink-0 bg-amber-500/10 text-amber-600 border-amber-500/20">Beantragt</Badge>
      ) : selected && (
        <Badge variant="default" className="shrink-0">Ausgewählt</Badge>
      )}
    </button>
  );
}