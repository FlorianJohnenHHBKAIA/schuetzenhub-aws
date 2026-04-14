import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, Search, Edit, Trash2, Loader2, User, Settings2, Eye, Building2 } from "lucide-react";
import PortalLayout from "@/components/portal/PortalLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/api/client";
import { useToast } from "@/hooks/use-toast";
import MemberDialog from "@/components/portal/MemberDialog";
import MemberManagementDialog from "@/components/portal/MemberManagementDialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Member {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  street: string | null;
  zip: string | null;
  city: string | null;
  status: string;
  created_at: string;
  user_id: string | null;
}

interface Company {
  id: string;
  name: string;
}

interface MemberCompanyMembership {
  member_id: string;
  company_id: string;
}

const Members = () => {
  const navigate = useNavigate();
  const { member: currentMember, hasPermission } = useAuth();
  const { toast } = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [memberCompanyMap, setMemberCompanyMap] = useState<Map<string, string[]>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [deletingMember, setDeletingMember] = useState<Member | null>(null);
  const [managingMember, setManagingMember] = useState<Member | null>(null);

  useEffect(() => {
    if (currentMember?.club_id) fetchData();
  }, [currentMember?.club_id]);

  const fetchData = async () => {
    if (!currentMember?.club_id) return;

    try {
      const [membersRes, companiesRes, membershipsRes] = await Promise.all([
        supabase.from("members").select("*").eq("club_id", currentMember.club_id).order("last_name", { ascending: true }),
        supabase.from("companies").select("id, name").eq("club_id", currentMember.club_id).order("name", { ascending: true }),
        supabase.from("member_company_memberships").select("member_id, company_id").is("valid_to", null),
      ]);

      if (membersRes.error) throw membersRes.error;
      if (companiesRes.error) throw companiesRes.error;
      if (membershipsRes.error) throw membershipsRes.error;

      setMembers((membersRes.data as Member[]) || []);
      setCompanies((companiesRes.data as Company[]) || []);

      const map = new Map<string, string[]>();
      ((membershipsRes.data as MemberCompanyMembership[]) || []).forEach((m) => {
        const existing = map.get(m.member_id) || [];
        existing.push(m.company_id);
        map.set(m.member_id, existing);
      });
      setMemberCompanyMap(map);
    } catch (error: unknown) {
      console.error("Error fetching data:", error);
      toast({ title: "Fehler", description: "Daten konnten nicht geladen werden.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingMember) return;
    try {
      const { error } = await supabase.from("members").delete().eq("id", deletingMember.id);
      if (error) throw error;
      setMembers(members.filter((m) => m.id !== deletingMember.id));
      toast({ title: "Mitglied gelöscht", description: `${deletingMember.first_name} ${deletingMember.last_name} wurde entfernt.` });
    } catch (error: unknown) {
      console.error("Error deleting member:", error);
      toast({ title: "Fehler", description: "Mitglied konnte nicht gelöscht werden.", variant: "destructive" });
    } finally {
      setDeletingMember(null);
    }
  };

  const handleSave = () => {
    fetchData();
    setIsDialogOpen(false);
    setEditingMember(null);
  };

  const filteredMembers = members.filter((member) => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      member.first_name.toLowerCase().includes(searchLower) ||
      member.last_name.toLowerCase().includes(searchLower) ||
      (member.email?.toLowerCase().includes(searchLower) ?? false);

    const matchesCompany =
      companyFilter === "all" ||
      (companyFilter === "none"
        ? !memberCompanyMap.has(member.id)
        : memberCompanyMap.get(member.id)?.includes(companyFilter));

    return matchesSearch && matchesCompany;
  });

  const statusLabels: Record<string, { label: string; className: string }> = {
    prospect: { label: "Interessent", className: "bg-gold/10 text-gold-dark" },
    active: { label: "Aktiv", className: "bg-forest/10 text-forest" },
    passive: { label: "Passiv", className: "bg-muted text-muted-foreground" },
    resigned: { label: "Ausgetreten", className: "bg-destructive/10 text-destructive" },
  };

  const canManage = hasPermission("club.members.manage");

  if (!canManage) {
    return (
      <PortalLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-muted-foreground">Sie haben keine Berechtigung für diese Seite.</p>
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <div className="max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Mitglieder</h1>
            <p className="text-muted-foreground">Verwalten Sie die Mitglieder Ihres Vereins</p>
          </div>
          <Button onClick={() => setIsDialogOpen(true)}><Plus className="w-4 h-4" />Mitglied hinzufügen</Button>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Mitglieder suchen..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
            </div>
            <Select value={companyFilter} onValueChange={setCompanyFilter}>
              <SelectTrigger className="w-full sm:w-[220px]">
                <Building2 className="w-4 h-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Kompanie filtern" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Kompanien</SelectItem>
                <SelectItem value="none">Ohne Kompanie</SelectItem>
                {companies.map((company) => <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : filteredMembers.length === 0 ? (
            <div className="text-center py-12 bg-card rounded-xl border border-border">
              <User className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">{searchTerm ? "Keine Mitglieder gefunden" : "Noch keine Mitglieder vorhanden"}</p>
            </div>
          ) : (
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">Name</th>
                      <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">E-Mail</th>
                      <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">Telefon</th>
                      <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">Status</th>
                      <th className="text-right px-6 py-4 text-sm font-medium text-muted-foreground">Aktionen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredMembers.map((member) => {
                      const status = statusLabels[member.status] || statusLabels.prospect;
                      return (
                        <tr key={member.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-6 py-4"><span className="font-medium text-foreground">{member.last_name}, {member.first_name}</span></td>
                          <td className="px-6 py-4 text-muted-foreground">{member.email}</td>
                          <td className="px-6 py-4 text-muted-foreground">{member.phone || "–"}</td>
                          <td className="px-6 py-4"><span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${status.className}`}>{status.label}</span></td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-end gap-2">
                              <Button variant="ghost" size="icon" onClick={() => navigate(`/portal/member/${member.id}`)} title="Profil anzeigen"><Eye className="w-4 h-4" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => setManagingMember(member)} title="Verwalten"><Settings2 className="w-4 h-4" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => { setEditingMember(member); setIsDialogOpen(true); }} title="Bearbeiten"><Edit className="w-4 h-4" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => setDeletingMember(member)} title="Löschen"><Trash2 className="w-4 h-4 text-destructive" /></Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      <MemberDialog
        open={isDialogOpen}
        onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setEditingMember(null); }}
        member={editingMember}
        clubId={currentMember?.club_id || ""}
        onSave={handleSave}
      />

      <MemberManagementDialog
        open={!!managingMember}
        onOpenChange={(open) => { if (!open) setManagingMember(null); }}
        member={managingMember}
        clubId={currentMember?.club_id || ""}
        onRefresh={fetchData}
      />

      <AlertDialog open={!!deletingMember} onOpenChange={() => setDeletingMember(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mitglied löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Sind Sie sicher, dass Sie {deletingMember?.first_name} {deletingMember?.last_name} löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PortalLayout>
  );
};

export default Members;