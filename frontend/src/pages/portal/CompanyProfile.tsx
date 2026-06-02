import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Edit, Users, Shield, Loader2 } from "lucide-react";
import PortalLayout from "@/components/portal/PortalLayout";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/lib/auth";
import { supabase, getStorageUrl } from "@/integrations/api/client";
import { useToast } from "@/hooks/use-toast";
import CompanyEditDialog from "@/components/portal/CompanyEditDialog";
import CompanyPostsSection from "@/components/portal/CompanyPostsSection";
import CompanyBirthdaysSection from "@/components/portal/CompanyBirthdaysSection";
import CompanyLeadershipSection from "@/components/portal/CompanyLeadershipSection";
import CompanyEventsSection from "@/components/portal/CompanyEventsSection";

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

interface RawMembership {
  member_id: string;
}

const CompanyProfile = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { member, hasPermission } = useAuth();
  const { toast } = useToast();

  const [company, setCompany] = useState<Company | null>(null);
  const [members, setMembers] = useState<CompanyMember[]>([]);
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
    } catch (error: unknown) {
      console.error("Error fetching company:", error);
      toast({ title: "Fehler beim Laden", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const getAvatarUrl = (avatar_url: string | null): string | undefined => {
    if (!avatar_url) return undefined;
    if (avatar_url.startsWith("/") || avatar_url.startsWith("http")) return avatar_url;
    return getStorageUrl("avatars", avatar_url) || undefined;
  };

  const canEdit = hasPermission("club.companies.manage");
  const isUserMember = members.some(m => m.id === member?.id);

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

        <div className="relative">
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

          <div className="absolute bottom-0 translate-y-1/2 left-8">
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-xl border-4 border-background bg-card flex items-center justify-center shadow-lg overflow-hidden">
              {company.logo_url ? (
                <img src={company.logo_url} alt={company.name} className="w-full h-full object-contain p-1" />
              ) : (
                <Shield className="w-12 h-12 text-primary" />
              )}
            </div>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-14 md:mt-16"
        >
          <h1 className="font-display text-3xl md:text-4xl font-bold">{company.name}</h1>
          {company.description && (
            <p className="text-muted-foreground mt-2 max-w-2xl">{company.description}</p>
          )}
        </motion.div>

        {id && member?.club_id && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-8"
          >
            <CompanyPostsSection
              companyId={id}
              clubId={member.club_id}
              isMember={isUserMember}
            />
          </motion.div>
        )}

        {id && member?.club_id && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22 }}
            className="mt-8"
          >
            <CompanyEventsSection
              companyId={id}
              clubId={member.club_id}
              isMember={isUserMember}
            />
          </motion.div>
        )}

        {id && member && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="mt-8"
          >
            <CompanyBirthdaysSection
              companyId={id}
              isMember={isUserMember}
            />
          </motion.div>
        )}

        {id && member && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-8"
          >
            <CompanyLeadershipSection
              companyId={id}
              isMember={isUserMember}
            />
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
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
                    <AvatarImage src={getAvatarUrl(m.avatar_url)} alt={m.first_name} className="object-cover" />
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
