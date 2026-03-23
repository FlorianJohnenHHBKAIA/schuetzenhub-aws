import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/api/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Company {
  id: string;
  name: string;
}

interface AssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId: string;
  memberName: string;
  currentCompanyId: string | null;
  companies: Company[];
  onSave: () => void;
}

const AssignmentDialog = ({
  open,
  onOpenChange,
  memberId,
  memberName,
  currentCompanyId,
  companies,
  onSave,
}: AssignmentDialogProps) => {
  const { toast } = useToast();
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [validFrom, setValidFrom] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setSelectedCompanyId("");
      setValidFrom(new Date().toISOString().split("T")[0]);
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!selectedCompanyId) {
      toast({ title: "Bitte Kompanie auswählen", variant: "destructive" });
      return;
    }

    if (selectedCompanyId === currentCompanyId) {
      toast({ title: "Mitglied ist bereits in dieser Kompanie", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      if (currentCompanyId) {
        const { error: updateError } = await supabase
          .from("member_company_memberships")
          .update({ valid_to: validFrom })
          .eq("member_id", memberId)
          .is("valid_to", null);

        if (updateError) throw updateError;
      }

      const { error: insertError } = await supabase
        .from("member_company_memberships")
        .insert({
          member_id: memberId,
          company_id: selectedCompanyId,
          valid_from: validFrom,
          valid_to: null,
        });

      if (insertError) {
        if ((insertError as { code?: string }).code === "23505") {
          toast({
            title: "Fehler: Aktive Zuordnung existiert",
            description: "Es gibt bereits eine aktive Kompanie-Zuordnung. Bitte beenden Sie diese zuerst.",
            variant: "destructive",
          });
          return;
        }
        throw insertError;
      }

      toast({ title: currentCompanyId ? "Kompanie gewechselt" : "Kompanie zugeordnet" });
      onSave();
      onOpenChange(false);
    } catch (error: unknown) {
      console.error("Assignment error:", error);
      toast({
        title: "Fehler bei der Zuordnung",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {currentCompanyId ? "Kompanie wechseln" : "Kompanie zuordnen"}
          </DialogTitle>
          <DialogDescription>
            {memberName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Ziel-Kompanie</Label>
            <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
              <SelectTrigger>
                <SelectValue placeholder="Kompanie auswählen" />
              </SelectTrigger>
              <SelectContent>
                {companies
                  .filter((c) => c.id !== currentCompanyId)
                  .map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Gültig ab</Label>
            <Input
              type="date"
              value={validFrom}
              onChange={(e) => setValidFrom(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Bestätigen"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AssignmentDialog;