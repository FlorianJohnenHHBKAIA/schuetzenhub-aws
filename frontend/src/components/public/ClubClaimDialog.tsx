import { useState } from "react";
import { CheckCircle, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

interface ClubClaimDialogProps {
  clubSlug: string;
  clubName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const ClubClaimDialog = ({ clubSlug, clubName, open, onOpenChange, onSuccess }: ClubClaimDialogProps) => {
  const [claimForm, setClaimForm] = useState({ firstname: "", lastname: "", position: "", email: "", phone: "", message: "" });
  const [claimSubmitting, setClaimSubmitting] = useState(false);
  const [claimSuccess, setClaimSuccess] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);

  function handleOpenChange(o: boolean) {
    if (!o) {
      setClaimSuccess(false);
      setClaimError(null);
      setClaimForm({ firstname: "", lastname: "", position: "", email: "", phone: "", message: "" });
    }
    onOpenChange(o);
  }

  async function handleClaimSubmit(e: React.FormEvent) {
    e.preventDefault();
    setClaimSubmitting(true);
    setClaimError(null);
    try {
      const res = await fetch(`/api/public/clubs/${clubSlug}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(claimForm),
      });
      const data = await res.json();
      if (!res.ok) {
        setClaimError(data.error || "Ein Fehler ist aufgetreten.");
      } else {
        setClaimSuccess(true);
        onSuccess?.();
      }
    } catch {
      setClaimError("Verbindungsfehler. Bitte versuchen Sie es erneut.");
    } finally {
      setClaimSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Verein übernehmen</DialogTitle>
        </DialogHeader>
        {claimSuccess ? (
          <div className="py-4 space-y-4">
            <div className="flex items-start gap-3 bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-3">
              <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
              <p className="text-sm text-green-700 dark:text-green-400">
                Ihre Übernahmeanfrage wurde erfolgreich übermittelt. Unser Team prüft die Angaben.
              </p>
            </div>
            <DialogFooter>
              <Button onClick={() => handleOpenChange(false)}>Schließen</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleClaimSubmit} className="space-y-4">
            <p className="text-sm text-muted-foreground">{clubName}</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Vorname *</Label>
                <Input value={claimForm.firstname} onChange={(e) => setClaimForm((f) => ({ ...f, firstname: e.target.value }))} required />
              </div>
              <div>
                <Label>Nachname *</Label>
                <Input value={claimForm.lastname} onChange={(e) => setClaimForm((f) => ({ ...f, lastname: e.target.value }))} required />
              </div>
            </div>
            <div>
              <Label>Position im Verein</Label>
              <Input value={claimForm.position} onChange={(e) => setClaimForm((f) => ({ ...f, position: e.target.value }))} placeholder="z.B. 1. Vorsitzender" />
            </div>
            <div>
              <Label>E-Mail *</Label>
              <Input type="email" value={claimForm.email} onChange={(e) => setClaimForm((f) => ({ ...f, email: e.target.value }))} required />
            </div>
            <div>
              <Label>Telefon</Label>
              <Input type="tel" value={claimForm.phone} onChange={(e) => setClaimForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <Label>Nachricht</Label>
              <Textarea value={claimForm.message} onChange={(e) => setClaimForm((f) => ({ ...f, message: e.target.value }))} rows={3} placeholder="Weitere Angaben…" />
            </div>
            {claimError && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="w-4 h-4 shrink-0" /> {claimError}
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>Abbrechen</Button>
              <Button type="submit" disabled={claimSubmitting || !claimForm.firstname || !claimForm.lastname || !claimForm.email}>
                {claimSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Anfrage senden"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ClubClaimDialog;
