import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiJson } from "@/integrations/api/client";
import { toast } from "sonner";
import { Loader2, Medal } from "lucide-react";

interface Company {
  id: string;
  name: string;
}

interface AwardHonorDialogProps {
  memberId: string;
  memberName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function AwardHonorDialog({ memberId, memberName, open, onOpenChange, onSuccess }: AwardHonorDialogProps) {
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isRegiment, setIsRegiment] = useState(true);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [honorTitle, setHonorTitle] = useState("");
  const [awardedAt, setAwardedAt] = useState(new Date().toISOString().split('T')[0]);

  // Lade Kompanien wenn der Dialog geöffnet wird
  useEffect(() => {
    if (open) {
      fetchCompanies();
    }
  }, [open]);

  const fetchCompanies = async () => {
    try {
      const data = await apiJson<Company[]>("/api/companies");
      setCompanies(data || []);
    } catch (error) {
      console.error("Fehler beim Laden der Kompanien:", error);
    }
  };

  const handleSave = async () => {
    if (!honorTitle) {
      toast.error("Bitte gib einen Titel für die Auszeichnung an.");
      return;
    }
    if (!isRegiment && !selectedCompanyId) {
      toast.error("Bitte wähle eine Kompanie aus.");
      return;
    }

    setLoading(true);
    try {
      await apiJson(`/api/members/${memberId}/honors`, {
        method: "POST",
        body: JSON.stringify({
          title: honorTitle,
          awarded_at: awardedAt,
          is_regiment: isRegiment,
          company_id: isRegiment ? null : selectedCompanyId
        })
      });
      
      toast.success(`Auszeichnung an ${memberName} verliehen.`);
      onSuccess?.();
      onOpenChange(false);
      // Reset fields
      setHonorTitle("");
      setIsRegiment(true);
    } catch (error) {
      toast.error("Die Auszeichnung konnte nicht gespeichert werden.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Medal className="w-5 h-5 text-yellow-600" />
            Auszeichnung verleihen
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <p className="text-sm text-muted-foreground">Mitglied: <strong>{memberName}</strong></p>
          
          <div className="grid gap-2">
            <Label htmlFor="title">Titel der Auszeichnung</Label>
            <Input id="title" value={honorTitle} onChange={(e) => setHonorTitle(e.target.value)} placeholder="z.B. Silberne Ehrennadel" />
          </div>
          
          <div className="flex items-center space-x-2 pt-2">
            <Checkbox id="is_regiment" checked={isRegiment} onCheckedChange={(checked) => setIsRegiment(!!checked)} />
            <Label htmlFor="is_regiment" className="cursor-pointer">Vom Regiment</Label>
          </div>

          {!isRegiment && (
            <div className="grid gap-2 animate-in fade-in slide-in-from-top-1">
              <Label>Kompanie auswählen</Label>
              <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                <SelectTrigger><SelectValue placeholder="Wähle eine Kompanie..." /></SelectTrigger>
                <SelectContent>{companies.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}</SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={handleSave} disabled={loading}>{loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Verleihen</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}