import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Edit, Users, Shield, Camera, Loader2 } from "lucide-react";
import PortalLayout from "@/components/portal/PortalLayout";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/api/client";
import { useToast } from "@/hooks/use-toast";
import CompanyEditDialog from "@/components/portal/CompanyEditDialog";

interface Company {
  id: string;
  name: string;
  logo_url: string | null;
  cover_url: string | null;
  description: string | null;
  created_at: string;
}

interface CompanyMember {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  title: string | null;
  status: string;
}

interface CompanyRole {
  member_id: string;
  role_name: string;
  member_first_name: string;
  member_last_name: string;
}

interface RawMembership {
  member_id: string;
}

interface RawAppointment {
  member_id: string;
  role_id: string;
  roles: {
    name: string;
    level: string;
  };
}

interface RawMemberName {
  first_name: string;
  last_name: string;
}

const CompanyProfile = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { member, hasPermission } = useAuth();
  const { toast } = useToast();
  
  const [company, setCompany] = useState<Company | null>(null);
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [roles, setRoles] = useState<CompanyRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditOpen, setIsEditOpen] = useState(false);

  useEffect(() => {
    if (id) fetchCompanyData();
  }, [id]);

  const fetchCompanyData = async () => {
    setIsLoading(true);
    try {
      const { data: companyData, error: companyError } = await supabase
        .from("companies")
        .select("*")
        .eq("id", id)
        .single();

      if (companyError) throw companyError;
      setCompany(companyData as Company);

      const { data: membershipsData } = await supabase
        .from("member_company_memberships")
        .select("member_id")
        .eq("company_id", id)
        .is("valid_to", null);

      const memberships = (membershipsData as RawMembership[]) || [];

      if (memberships.length > 0) {
        const memberIds = memberships.map(m => m.member_id);
        const { data: membersData } = await supabase
          .from("members")
          .select("id, first_name, last_name, avatar_url, title, status")
          .in("id", memberIds)
          .order("last_name");
        
        setMembers((membersData as CompanyMember[]) || []);
      }

      const { data: appointmentsData } = await supabase
        .from("appointments")
        .select(`
          member_id,
          role_id,
          roles!inner(name, level)
        `)
        .eq("scope_type", "company")
        .eq("scope_id", id)
        .is("valid_to", null);

      const appointments = (appointmentsData as RawAppointment[]) || [];

      if (appointments.length > 0) {
        const rolesWithMembers: CompanyRole[] = [];
        for (const apt of appointments) {
          const { data: memberData } = await supabase
            .from("members")
            .select("first_name, last_name")
            .eq("id", apt.member_id)
            .single();
          
          if (memberData) {
            const md = memberData as RawMemberName;
            rolesWithMembers.push({
              member_id: apt.member_id,
              role_name: apt.roles.name,
              member_first_name: md.first_name,
              member_last_name: md.last_name,
            });
          }
        }
        setRoles(rolesWithMembers);
      }
    } catch (error: unknown) {
      console.error("Error fetching company:", error);
      toast({ title: "Fehler beim Laden", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const canEdit = hasPermission("club.companies.manage");

  if (isLoading) {
    return (
      <PortalLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </PortalLayout>
    );
  }

  if (!company) {
    return (
      <PortalLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Kompanie nicht gefunden</p>
          <Button variant="outline" onClick={() => navigate("/portal/companies")} className="mt-4">
            Zurück
          </Button>
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <div className="max-w-5xl mx-auto">
        <Button variant="ghost" onClick={() => navigate("/portal/companies")} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Zurück
        </Button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative h-48 md:h-64 rounded-xl overflow-hidden bg-gradient-to-r from-primary/20 to-primary/5 border"
        >
          {company.cover_url ? (
            <img src={company.cover_url} alt="Cover" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Shield className="w-16 h-16 text-muted-foreground/30" />
            </div>
          )}
          
          <div className="absolute -bottom-12 left-8">
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-xl border-4 border-background bg-card flex items-center justify-center shadow-lg overflow-visible">
              {company.logo_url ? (
                <img src={company.logo_url} alt={company.name} className="w-full h-full object-contain" />
              ) : (
                <Shield className="w-12 h-12 text-primary" />
              )}
            </div>
          </div>

          {canEdit && (
            <Button
              size="sm"
              variant="secondary"
              className="absolute top-4 right-4"
              onClick={() => setIsEditOpen(true)}
            >
              <Edit className="w-4 h-4 mr-2" />
              Bearbeiten
            </Button>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-16 md:mt-20"
        >
          <h1 className="font-display text-3xl md:text-4xl font-bold">{company.name}</h1>
          {company.description && (
            <p className="text-muted-foreground mt-2 max-w-2xl">{company.description}</p>
          )}
        </motion.div>

        {roles.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-8"
          >
            <h2 className="font-display text-xl font-semibold mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Führung
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {roles.map((role, idx) => (
                <div
                  key={idx}
                  className="p-4 bg-card rounded-xl border flex items-center gap-3 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => navigate(`/portal/member/${role.member_id}`)}
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{role.member_first_name} {role.member_last_name}</p>
                    <p className="text-sm text-muted-foreground">{role.role_name}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-8"
        >
          <h2 className="font-display text-xl font-semibold mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Mitglieder ({members.length})
          </h2>
          
          {members.length === 0 ? (
            <div className="text-center py-8 bg-card rounded-xl border">
              <Users className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
              <p className="text-muted-foreground">Noch keine Mitglieder</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {members.map((m) => (
                <div
                  key={m.id}
                  className="p-4 bg-card rounded-xl border flex items-center gap-3 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => navigate(`/portal/member/${m.id}`)}
                >
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={m.avatar_url || undefined} alt={m.first_name} />
                    <AvatarFallback className="bg-primary/10 text-primary font-medium">
                      {m.first_name[0]}{m.last_name[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{m.first_name} {m.last_name}</p>
                    {m.title && (
                      <p className="text-sm text-muted-foreground truncate">{m.title}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {company && (
        <CompanyEditDialog
          open={isEditOpen}
          onOpenChange={setIsEditOpen}
          company={company}
          onSave={() => {
            fetchCompanyData();
            setIsEditOpen(false);
          }}
        />
      )}
    </PortalLayout>
  );
};

export default CompanyProfile;