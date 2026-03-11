import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { CalendarIcon, Loader2, Award, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getIconConfig } from "@/pages/portal/AwardTypesManagement";

type AwardType = Tables<"award_types">;

interface AwardRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId: string;
  clubId: string;
  onSuccess: () => void;
}

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

  // Fetch available award types
  const { data: awardTypes, isLoading } = useQuery({
    queryKey: ["available-award-types", clubId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("award_types")
        .select("*")
        .eq("club_id", clubId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as AwardType[];
    },
    enabled: open && !!clubId,
  });

  // Submit request mutation
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
    onError: (error) => {
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

  // Group award types by scope
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
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : awardTypes?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Award className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Keine Auszeichnungstypen verfügbar.</p>
              <p className="text-sm">Bitte kontaktieren Sie einen Administrator.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Club-level types */}
              {clubTypes.length > 0 && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-muted-foreground">
                    <Award className="w-4 h-4" />
                    Vereinsauszeichnungen
                  </Label>
                  <div className="grid gap-2">
                    {clubTypes.map(type => (
                      <AwardTypeOption
                        key={type.id}
                        type={type}
                        selected={selectedType?.id === type.id}
                        onSelect={() => setSelectedType(type)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Company-level types */}
              {companyTypes.length > 0 && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-muted-foreground">
                    <Building2 className="w-4 h-4" />
                    Kompanieauszeichnungen
                  </Label>
                  <div className="grid gap-2">
                    {companyTypes.map(type => (
                      <AwardTypeOption
                        key={type.id}
                        type={type}
                        selected={selectedType?.id === type.id}
                        onSelect={() => setSelectedType(type)}
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
                      locale={de}
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
  onSelect 
}: { 
  type: AwardType; 
  selected: boolean; 
  onSelect: () => void;
}) {
  const iconConfig = getIconConfig(type.icon);
  const Icon = iconConfig.icon;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-all w-full",
        selected
          ? "border-primary bg-primary/5"
          : "border-transparent bg-muted/50 hover:bg-muted"
      )}
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
      {selected && (
        <Badge variant="default" className="shrink-0">Ausgewählt</Badge>
      )}
    </button>
  );
}
