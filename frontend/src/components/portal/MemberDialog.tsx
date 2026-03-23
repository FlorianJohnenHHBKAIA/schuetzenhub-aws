import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/api/client";
import { useToast } from "@/hooks/use-toast";

interface Company {
  id: string;
  name: string;
}

interface MemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    street?: string | null;
    zip?: string | null;
    city?: string | null;
    status: string;
  } | null;
  clubId: string;
  onSave: () => void;
}

const MemberDialog = ({ open, onOpenChange, member, clubId, onSave }: MemberDialogProps) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    street: "",
    zip: "",
    city: "",
    status: "prospect" as string,
    company_id: "",
    valid_from: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    if (open && clubId) {
      fetchCompanies();
    }
  }, [open, clubId]);

  useEffect(() => {
    if (member) {
      setFormData({
        first_name: member.first_name,
        last_name: member.last_name,
        email: member.email,
        phone: member.phone || "",
        street: member.street || "",
        zip: member.zip || "",
        city: member.city || "",
        status: member.status,
        company_id: "",
        valid_from: new Date().toISOString().split("T")[0],
      });
    } else {
      setFormData({
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        street: "",
        zip: "",
        city: "",
        status: "prospect",
        company_id: "",
        valid_from: new Date().toISOString().split("T")[0],
      });
    }
  }, [member, open]);

  const fetchCompanies = async () => {
    const { data } = await supabase
      .from("companies")
      .select("id, name")
      .eq("club_id", clubId)
      .order("name");
    setCompanies((data as Company[]) || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!member && !formData.company_id) {
      toast({
        title: "Kompanie erforderlich",
        description: "Bitte wählen Sie eine Kompanie für das neue Mitglied.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      if (member) {
        const { error } = await supabase
          .from("members")
          .update({
            first_name: formData.first_name,
            last_name: formData.last_name,
            email: formData.email,
            phone: formData.phone || null,
            street: formData.street || null,
            zip: formData.zip || null,
            city: formData.city || null,
            status: formData.status as "prospect" | "active" | "passive" | "resigned",
          })
          .eq("id", member.id);

        if (error) throw error;

        toast({
          title: "Mitglied aktualisiert",
          description: `${formData.first_name} ${formData.last_name} wurde aktualisiert.`,
        });
      } else {
        const { data: newMember, error: memberError } = await supabase
          .from("members")
          .insert({
            club_id: clubId,
            first_name: formData.first_name,
            last_name: formData.last_name,
            email: formData.email?.trim() || null,
            phone: formData.phone || null,
            street: formData.street || null,
            zip: formData.zip || null,
            city: formData.city || null,
            status: formData.status as "prospect" | "active" | "passive" | "resigned",
          })
          .select("id")
          .single();

        if (memberError) throw memberError;

        const newMemberData = newMember as { id: string };

        const { error: membershipError } = await supabase
          .from("member_company_memberships")
          .insert({
            member_id: newMemberData.id,
            company_id: formData.company_id,
            valid_from: formData.valid_from,
            valid_to: null,
          });

        if (membershipError) throw membershipError;

        toast({
          title: "Mitglied hinzugefügt",
          description: `${formData.first_name} ${formData.last_name} wurde hinzugefügt.`,
        });
      }

      onSave();
    } catch (error: unknown) {
      console.error("Error saving member:", error);
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Mitglied konnte nicht gespeichert werden.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isNewMember = !member;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">
            {member ? "Mitglied bearbeiten" : "Neues Mitglied"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="first_name">Vorname *</Label>
              <Input
                id="first_name"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="last_name">Nachname *</Label>
              <Input
                id="last_name"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="email">E-Mail</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="Optional"
            />
          </div>

          <div>
            <Label htmlFor="phone">Telefon</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="street">Straße</Label>
            <Input
              id="street"
              value={formData.street}
              onChange={(e) => setFormData({ ...formData, street: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="zip">PLZ</Label>
              <Input
                id="zip"
                value={formData.zip}
                onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="city">Ort</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="status">Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData({ ...formData, status: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="prospect">Interessent</SelectItem>
                <SelectItem value="active">Aktiv</SelectItem>
                <SelectItem value="passive">Passiv</SelectItem>
                <SelectItem value="resigned">Ausgetreten</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isNewMember && (
            <>
              <div>
                <Label htmlFor="company">Kompanie *</Label>
                <Select
                  value={formData.company_id}
                  onValueChange={(value) => setFormData({ ...formData, company_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Kompanie auswählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {companies.length === 0 && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Bitte legen Sie zuerst eine Kompanie an.
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="valid_from">Gültig ab</Label>
                <Input
                  id="valid_from"
                  type="date"
                  value={formData.valid_from}
                  onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
                />
              </div>
            </>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={isSubmitting || (isNewMember && companies.length === 0)}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Speichern...
                </>
              ) : (
                "Speichern"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default MemberDialog;