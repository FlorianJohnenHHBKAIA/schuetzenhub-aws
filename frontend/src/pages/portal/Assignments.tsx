import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Search, ArrowRightLeft, Loader2, UserX } from "lucide-react";
import PortalLayout from "@/components/portal/PortalLayout";
import AssignmentDialog from "@/components/portal/AssignmentDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/api/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

interface RawMember {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  status: string;
}

interface RawMembership {
  member_id: string;
  company_id: string;
}

interface MemberWithAssignment {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  status: string;
  current_company_id: string | null;
  current_company_name: string | null;
}

const statusLabels: Record<string, { label: string; className: string }> = {
  prospect: { label: "Anwärter", className: "bg-blue-500/10 text-blue-500" },
  active: { label: "Aktiv", className: "bg-green-500/10 text-green-500" },
  passive: { label: "Passiv", className: "bg-yellow-500/10 text-yellow-500" },
  resigned: { label: "Ausgetreten", className: "bg-red-500/10 text-red-500" },
};

const Assignments = () => {
  const { member, hasPermission } = useAuth();
  const [members, setMembers] = useState<MemberWithAssignment[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCompanyId, setFilterCompanyId] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<MemberWithAssignment | null>(null);

  useEffect(() => {
    if (member?.club_id) {
      fetchData();
    }
  }, [member?.club_id]);

  const fetchData = async () => {
    setIsLoading(true);

    const { data: companiesData } = await supabase
      .from("companies")
      .select("id, name")
      .eq("club_id", member!.club_id)
      .order("name");

    const companiesList = (companiesData as Company[]) || [];
    setCompanies(companiesList);

    const { data: membersData } = await supabase
      .from("members")
      .select("id, first_name, last_name, email, status")
      .eq("club_id", member!.club_id)
      .order("last_name");

    const membersList = (membersData as RawMember[]) || [];

    if (membersList.length > 0) {
      const { data: membershipsData } = await supabase
        .from("member_company_memberships")
        .select("member_id, company_id")
        .is("valid_to", null);

      const memberships = (membershipsData as RawMembership[]) || [];

      const membershipMap = new Map<string, string>(
        memberships.map((m) => [m.member_id, m.company_id])
      );

      const companyMap = new Map<string, string>(
        companiesList.map((c) => [c.id, c.name])
      );

      const enrichedMembers: MemberWithAssignment[] = membersList.map((m) => {
        const companyId = membershipMap.get(m.id) || null;
        return {
          ...m,
          current_company_id: companyId,
          current_company_name: companyId ? companyMap.get(companyId) || null : null,
        };
      });

      setMembers(enrichedMembers);
    }

    setIsLoading(false);
  };

  const filteredMembers = members.filter((m) => {
    const matchesSearch =
      m.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCompany =
      filterCompanyId === "all" ||
      filterCompanyId === "unassigned"
        ? filterCompanyId === "all" || m.current_company_id === null
        : m.current_company_id === filterCompanyId;

    return matchesSearch && matchesCompany;
  });

  const handleOpenDialog = (m: MemberWithAssignment) => {
    setSelectedMember(m);
    setDialogOpen(true);
  };

  if (!hasPermission("club.members.manage")) {
    return (
      <PortalLayout>
        <p className="text-center py-12 text-muted-foreground">
          Keine Berechtigung
        </p>
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
          <h1 className="font-display text-3xl font-bold">Kompanie-Zuordnungen</h1>
          <p className="text-muted-foreground">
            Mitglieder Kompanien zuordnen und Wechsel durchführen
          </p>
        </motion.div>

        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Name oder E-Mail suchen..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterCompanyId} onValueChange={setFilterCompanyId}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Alle Kompanien" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Kompanien</SelectItem>
              <SelectItem value="unassigned">Ohne Zuordnung</SelectItem>
              {companies.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="text-center py-12 bg-card rounded-xl border">
            <UserX className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Keine Mitglieder gefunden</p>
          </div>
        ) : (
          <div className="bg-card rounded-xl border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mitglied</TableHead>
                  <TableHead className="hidden sm:table-cell">E-Mail</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Kompanie</TableHead>
                  <TableHead className="text-right">Aktion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMembers.map((m) => {
                  const status = statusLabels[m.status] || statusLabels.prospect;
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">
                        {m.first_name} {m.last_name}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">
                        {m.email}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={status.className}>
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {m.current_company_name ? (
                          <span>{m.current_company_name}</span>
                        ) : (
                          <span className="text-muted-foreground italic">
                            Nicht zugeordnet
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenDialog(m)}
                        >
                          <ArrowRightLeft className="w-4 h-4 mr-1" />
                          {m.current_company_id ? "Wechseln" : "Zuordnen"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {selectedMember && (
        <AssignmentDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          memberId={selectedMember.id}
          memberName={`${selectedMember.first_name} ${selectedMember.last_name}`}
          currentCompanyId={selectedMember.current_company_id}
          companies={companies}
          onSave={fetchData}
        />
      )}
    </PortalLayout>
  );
};

export default Assignments;