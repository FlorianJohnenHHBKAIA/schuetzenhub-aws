import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Plus, Search, Loader2, Users, Shield, Building2, X } from "lucide-react";
import PortalLayout from "@/components/portal/PortalLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Role {
  id: string;
  name: string;
  level: "club" | "company";
}

interface Company {
  id: string;
  name: string;
}

interface Member {
  id: string;
  first_name: string;
  last_name: string;
}

interface Appointment {
  id: string;
  member_id: string;
  member_name: string;
  role_id: string;
  role_name: string;
  scope_type: "club" | "company";
  scope_id: string;
  scope_name: string;
  valid_from: string;
  valid_to: string | null;
}

const Appointments = () => {
  const { member, hasPermission } = useAuth();
  const { toast } = useToast();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [clubRoles, setClubRoles] = useState<Role[]>([]);
  const [companyRoles, setCompanyRoles] = useState<Role[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showHistoric, setShowHistoric] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<"club" | "company">("club");
  const [endingAppointment, setEndingAppointment] = useState<Appointment | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    role_id: "",
    member_id: "",
    company_id: "",
    valid_from: new Date().toISOString().split("T")[0],
    valid_to: "",
  });

  useEffect(() => {
    if (member?.club_id) fetchData();
  }, [member?.club_id]);

  const fetchData = async () => {
    setIsLoading(true);

    const [rolesRes, companiesRes, membersRes, appointmentsRes] = await Promise.all([
      supabase.from("roles").select("*").eq("club_id", member!.club_id).order("name"),
      supabase.from("companies").select("id, name").eq("club_id", member!.club_id).order("name"),
      supabase.from("members").select("id, first_name, last_name").eq("club_id", member!.club_id).order("last_name"),
      supabase.from("appointments").select("*").order("valid_from", { ascending: false }),
    ]);

    const roles = rolesRes.data || [];
    setClubRoles(roles.filter((r) => r.level === "club"));
    setCompanyRoles(roles.filter((r) => r.level === "company"));
    setCompanies(companiesRes.data || []);
    setMembers(membersRes.data || []);

    // Enrich appointments
    if (appointmentsRes.data) {
      const roleMap = new Map(roles.map((r) => [r.id, r]));
      const companyMap = new Map((companiesRes.data || []).map((c) => [c.id, c.name]));
      const memberMap = new Map(
        (membersRes.data || []).map((m) => [m.id, `${m.first_name} ${m.last_name}`])
      );

      // Filter appointments to only those belonging to this club's roles
      const clubRoleIds = new Set(roles.map((r) => r.id));
      const filteredAppointments = appointmentsRes.data.filter((a) => clubRoleIds.has(a.role_id));

      const enriched: Appointment[] = filteredAppointments.map((a) => {
        const role = roleMap.get(a.role_id);
        return {
          ...a,
          member_name: memberMap.get(a.member_id) || "Unbekannt",
          role_name: role?.name || "Unbekannt",
          scope_name:
            a.scope_type === "club"
              ? "Hauptverein"
              : companyMap.get(a.scope_id) || "Unbekannt",
        };
      });

      setAppointments(enriched);
    }

    setIsLoading(false);
  };

  const handleSave = async () => {
    if (!formData.role_id || !formData.member_id) {
      toast({ title: "Bitte alle Pflichtfelder ausfüllen", variant: "destructive" });
      return;
    }

    if (dialogType === "company" && !formData.company_id) {
      toast({ title: "Bitte Kompanie auswählen", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);

    try {
      const scopeId = dialogType === "club" ? member!.club_id : formData.company_id;

      const { error } = await supabase.from("appointments").insert({
        member_id: formData.member_id,
        role_id: formData.role_id,
        scope_type: dialogType,
        scope_id: scopeId,
        valid_from: formData.valid_from,
        valid_to: formData.valid_to || null,
      });

      if (error) throw error;

      toast({ title: "Besetzung gespeichert" });
      fetchData();
      setIsDialogOpen(false);
      resetForm();
    } catch (error: any) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    }

    setIsSubmitting(false);
  };

  const handleEndAppointment = async () => {
    if (!endingAppointment) return;

    try {
      const today = new Date().toISOString().split("T")[0];
      const { error } = await supabase
        .from("appointments")
        .update({ valid_to: today })
        .eq("id", endingAppointment.id);

      if (error) throw error;

      toast({ title: "Besetzung beendet" });
      fetchData();
    } catch (error: any) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    }

    setEndingAppointment(null);
  };

  const resetForm = () => {
    setFormData({
      role_id: "",
      member_id: "",
      company_id: "",
      valid_from: new Date().toISOString().split("T")[0],
      valid_to: "",
    });
  };

  const openDialog = (type: "club" | "company") => {
    setDialogType(type);
    resetForm();
    setIsDialogOpen(true);
  };

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), "dd.MM.yyyy", { locale: de });
  };

  const filteredAppointments = appointments.filter((a) => {
    const isActive = a.valid_to === null;
    if (!showHistoric && !isActive) return false;

    const searchLower = searchTerm.toLowerCase();
    return (
      a.member_name.toLowerCase().includes(searchLower) ||
      a.role_name.toLowerCase().includes(searchLower) ||
      a.scope_name.toLowerCase().includes(searchLower)
    );
  });

  if (!hasPermission("club.appointments.manage")) {
    return (
      <PortalLayout>
        <p className="text-center py-12 text-muted-foreground">Keine Berechtigung</p>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="font-display text-3xl font-bold">Besetzungen</h1>
          <p className="text-muted-foreground">Ämter mit Mitgliedern besetzen</p>
        </motion.div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Suchen..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant={showHistoric ? "default" : "outline"}
              onClick={() => setShowHistoric(!showHistoric)}
            >
              {showHistoric ? "Nur aktive" : "Mit Historie"}
            </Button>
            <Button onClick={() => openDialog("club")}>
              <Shield className="w-4 h-4" /> Hauptverein
            </Button>
            <Button onClick={() => openDialog("company")}>
              <Building2 className="w-4 h-4" /> Kompanie
            </Button>
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredAppointments.length === 0 ? (
          <div className="text-center py-12 bg-card rounded-xl border">
            <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Keine Besetzungen gefunden</p>
          </div>
        ) : (
          <div className="bg-card rounded-xl border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Amt</TableHead>
                  <TableHead>Mitglied</TableHead>
                  <TableHead>Ebene</TableHead>
                  <TableHead>Gültig</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aktion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAppointments.map((a) => {
                  const isActive = a.valid_to === null;
                  return (
                    <TableRow key={a.id} className={!isActive ? "opacity-60" : ""}>
                      <TableCell className="font-medium">{a.role_name}</TableCell>
                      <TableCell>{a.member_name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {a.scope_type === "club" ? (
                            <Shield className="w-4 h-4 text-primary" />
                          ) : (
                            <Building2 className="w-4 h-4 text-primary" />
                          )}
                          {a.scope_name}
                        </div>
                      </TableCell>
                      <TableCell>
                        {formatDate(a.valid_from)}
                        {a.valid_to && ` – ${formatDate(a.valid_to)}`}
                      </TableCell>
                      <TableCell>
                        <Badge variant={isActive ? "default" : "secondary"}>
                          {isActive ? "Aktiv" : "Beendet"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {isActive && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEndingAppointment(a)}
                          >
                            <X className="w-4 h-4" /> Beenden
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogType === "club" ? "Hauptvereins-Amt besetzen" : "Kompanie-Amt besetzen"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {dialogType === "company" && (
              <div>
                <Label>Kompanie *</Label>
                <Select
                  value={formData.company_id}
                  onValueChange={(v) => setFormData({ ...formData, company_id: v })}
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
              </div>
            )}

            <div>
              <Label>Amt *</Label>
              <Select
                value={formData.role_id}
                onValueChange={(v) => setFormData({ ...formData, role_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Amt auswählen" />
                </SelectTrigger>
                <SelectContent>
                  {(dialogType === "club" ? clubRoles : companyRoles).map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Mitglied *</Label>
              <Select
                value={formData.member_id}
                onValueChange={(v) => setFormData({ ...formData, member_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Mitglied auswählen" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.first_name} {m.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Gültig ab *</Label>
                <Input
                  type="date"
                  value={formData.valid_from}
                  onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
                />
              </div>
              <div>
                <Label>Gültig bis (optional)</Label>
                <Input
                  type="date"
                  value={formData.valid_to}
                  onChange={(e) => setFormData({ ...formData, valid_to: e.target.value })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleSave} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* End Confirmation */}
      <AlertDialog open={!!endingAppointment} onOpenChange={() => setEndingAppointment(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Besetzung beenden?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie die Besetzung von {endingAppointment?.member_name} als{" "}
              {endingAppointment?.role_name} beenden?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleEndAppointment}>Beenden</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PortalLayout>
  );
};

export default Appointments;
