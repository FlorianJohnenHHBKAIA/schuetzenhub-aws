import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Edit, Trash2, Loader2, Shield, Building2 } from "lucide-react";
import PortalLayout from "@/components/portal/PortalLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { apiJson } from "@/integrations/api/client";

interface Role {
  id: string;
  name: string;
  level: "club" | "company";
  is_default: boolean;
  created_at: string;
  appointment_count?: number;
}

const DEFAULT_CLUB_ROLES = [
  "Brudermeister / 1. Vorsitzender", "2. Vorsitzender", "Geschäftsführer",
  "Schriftführer", "Kassenwart", "Schießmeister", "Jugendwart",
  "Medienwart / Webmaster", "Vereins-Admin (technisch)",
];

const DEFAULT_COMPANY_ROLES = [
  "Hauptmann", "Stellv. Hauptmann", "Spieß", "Kassierer", "Schriftführer", "Beisitzer",
];

const Roles = () => {
  const { member, hasPermission } = useAuth();
  const { toast } = useToast();
  const [clubRoles, setClubRoles] = useState<Role[]>([]);
  const [companyRoles, setCompanyRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [deletingRole, setDeletingRole] = useState<Role | null>(null);
  const [roleName, setRoleName] = useState("");
  const [roleLevel, setRoleLevel] = useState<"club" | "company">("club");
  const [isDefault, setIsDefault] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);

  useEffect(() => {
    if (member?.club_id) fetchRoles();
  }, [member?.club_id]);

  const fetchRoles = async () => {
    setIsLoading(true);
    try {
      const rolesData = await apiJson<Role[]>("/api/roles");
      if (rolesData) {
        setClubRoles(rolesData.filter((r) => r.level === "club"));
        setCompanyRoles(rolesData.filter((r) => r.level === "company"));
      }
    } catch (err) {
      console.error("Fehler beim Abrufen von Rollen:", err);
      const errorMsg = err instanceof Error ? err.message : String(err);
      toast({ title: "Fehler", description: "Fehler beim Laden der Ämter: " + errorMsg, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const seedDefaultRoles = async () => {
    setIsSeeding(true);

    try {
      // Prüfe ob bereits Rollen existieren
      const existingRoles = await apiJson<Role[]>("/api/roles");
      if (existingRoles && existingRoles.length > 0) {
        toast({ title: "Standard-Ämter wurden bereits angelegt" });
        setIsSeeding(false);
        return;
      }

      // Erstelle Club-Rollen
      for (const name of DEFAULT_CLUB_ROLES) {
        await apiJson("/api/roles", {
          method: "POST",
          body: JSON.stringify({ name, level: "club", is_default: true }),
        });
      }

      // Erstelle Company-Rollen
      for (const name of DEFAULT_COMPANY_ROLES) {
        await apiJson("/api/roles", {
          method: "POST",
          body: JSON.stringify({ name, level: "company", is_default: true }),
        });
      }

      toast({ title: "Standard-Ämter angelegt" });
      await fetchRoles();
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("Fehler beim Anlegen von Standard-Ämtern:", errorMsg);
      toast({ title: "Fehler", description: errorMsg, variant: "destructive" });
    }

    setIsSeeding(false);
  };

  const handleSave = async () => {
    if (!roleName.trim()) return;
    setIsSubmitting(true);

    try {
      if (editingRole) {
        // UPDATE
        await apiJson(`/api/roles/${editingRole.id}`, {
          method: "PUT",
          body: JSON.stringify({ name: roleName, is_default: isDefault }),
        });
        toast({ title: "Amt aktualisiert" });
      } else {
        // INSERT
        await apiJson("/api/roles", {
          method: "POST",
          body: JSON.stringify({ name: roleName, level: roleLevel, is_default: isDefault }),
        });
        toast({ title: "Amt erstellt" });
      }
      await fetchRoles();
      setIsDialogOpen(false);
      setIsDefault(false);
      setEditingRole(null);
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("Fehler beim Speichern:", errorMsg);
      toast({ title: "Fehler", description: errorMsg, variant: "destructive" });
    }

    setIsSubmitting(false);
  };

  const handleDelete = async () => {
    if (!deletingRole) return;
    try {
      await apiJson(`/api/roles/${deletingRole.id}`, {
        method: "DELETE",
      });
      toast({ title: "Amt gelöscht" });
      fetchRoles();
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      toast({ title: "Fehler", description: errorMsg, variant: "destructive" });
    }
    setDeletingRole(null);
  };

  const openNewDialog = (level: "club" | "company") => { setEditingRole(null); setRoleName(""); setRoleLevel(level); setIsDefault(false); setIsDialogOpen(true); };
  const openEditDialog = (role: Role) => { setEditingRole(role); setRoleName(role.name); setRoleLevel(role.level); setIsDefault(role.is_default); setIsDialogOpen(true); };

  if (!hasPermission("club.roles.manage")) {
    return <PortalLayout><p className="text-center py-12 text-muted-foreground">Keine Berechtigung</p></PortalLayout>;
  }

  const RoleList = ({ roles, level }: { roles: Role[]; level: "club" | "company" }) => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{roles.length} {roles.length === 1 ? "Amt" : "Ämter"}</p>
        <Button size="sm" onClick={() => openNewDialog(level)}><Plus className="w-4 h-4" /> Amt hinzufügen</Button>
      </div>
      {roles.length === 0 ? (
        <div className="text-center py-8 bg-card rounded-xl border"><p className="text-muted-foreground">Noch keine Ämter definiert</p></div>
      ) : (
        <div className="space-y-2">
          {roles.map((role) => (
            <div key={role.id} className="p-4 bg-card rounded-lg border flex items-center justify-between">
              <div className="flex items-center gap-3">
                {level === "club" ? <Shield className="w-5 h-5 text-primary" /> : <Building2 className="w-5 h-5 text-primary" />}
                <div>
                  <span className="font-medium">{role.name}</span>
                  {role.is_default && <Badge variant="secondary" className="ml-2 text-xs">Standard</Badge>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {(role.appointment_count ?? 0) > 0 && <Badge variant="outline">{role.appointment_count} besetzt</Badge>}
                <Button variant="ghost" size="icon" onClick={() => openEditDialog(role)}><Edit className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => setDeletingRole(role)} disabled={(role.appointment_count ?? 0) > 0} title={(role.appointment_count ?? 0) > 0 ? "Amt ist besetzt" : "Löschen"}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <PortalLayout>
      <div className="max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex justify-between items-center mb-8">
          <div>
            <h1 className="font-display text-3xl font-bold">Ämter</h1>
            <p className="text-muted-foreground">Ämter für Hauptverein und Kompanien definieren</p>
          </div>
          {clubRoles.length === 0 && companyRoles.length === 0 && (
            <Button onClick={seedDefaultRoles} disabled={isSeeding}>
              {isSeeding ? <Loader2 className="w-4 h-4 animate-spin" /> : "Standard-Ämter anlegen"}
            </Button>
          )}
        </motion.div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
        ) : (
          <Tabs defaultValue="club">
            <TabsList className="mb-6">
              <TabsTrigger value="club" className="flex items-center gap-2"><Shield className="w-4 h-4" />Hauptverein ({clubRoles.length})</TabsTrigger>
              <TabsTrigger value="company" className="flex items-center gap-2"><Building2 className="w-4 h-4" />Kompanien ({companyRoles.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="club"><RoleList roles={clubRoles} level="club" /></TabsContent>
            <TabsContent value="company"><RoleList roles={companyRoles} level="company" /></TabsContent>
          </Tabs>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingRole ? "Amt bearbeiten" : "Neues Amt"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Name</Label><Input value={roleName} onChange={(e) => setRoleName(e.target.value)} placeholder="z.B. Kassenwart" /></div>
            {!editingRole && (
              <div>
                <Label>Ebene</Label>
                <Select value={roleLevel} onValueChange={(v) => setRoleLevel(v as "club" | "company")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="club">Hauptverein</SelectItem>
                    <SelectItem value="company">Kompanie</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Checkbox id="is-default" checked={isDefault} onCheckedChange={(checked) => setIsDefault(checked as boolean)} />
              <Label htmlFor="is-default" className="cursor-pointer">Als Standard-Amt markieren</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={handleSave} disabled={isSubmitting || !roleName.trim()}>{isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Speichern"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingRole} onOpenChange={() => setDeletingRole(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Amt löschen?</AlertDialogTitle><AlertDialogDescription>Sind Sie sicher, dass Sie das Amt „{deletingRole?.name}" löschen möchten?</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PortalLayout>
  );
};

export default Roles;