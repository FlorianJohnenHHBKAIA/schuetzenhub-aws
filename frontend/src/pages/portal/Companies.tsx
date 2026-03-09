import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, Edit, Loader2, Building2, Eye, Shield, Users, Calendar } from "lucide-react";
import PortalLayout from "@/components/portal/PortalLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

interface CompanyWithStats {
  id: string;
  name: string;
  logo_url: string | null;
  cover_url: string | null;
  description: string | null;
  created_at: string;
  member_count: number;
}

const Companies = () => {
  const navigate = useNavigate();
  const { member, hasPermission } = useAuth();
  const { toast } = useToast();
  const [companies, setCompanies] = useState<CompanyWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<CompanyWithStats | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (member?.club_id) fetchCompanies();
  }, [member?.club_id]);

  const fetchCompanies = async () => {
    // Fetch companies
    const { data: companiesData, error: companiesError } = await supabase
      .from("companies")
      .select("*")
      .eq("club_id", member!.club_id)
      .order("name");

    if (companiesError) {
      setIsLoading(false);
      return;
    }

    // Fetch member counts for each company
    const { data: membershipsData } = await supabase
      .from("member_company_memberships")
      .select("company_id")
      .is("valid_to", null);

    const memberCounts: Record<string, number> = {};
    membershipsData?.forEach((m) => {
      memberCounts[m.company_id] = (memberCounts[m.company_id] || 0) + 1;
    });

    const companiesWithStats: CompanyWithStats[] = (companiesData || []).map((c) => ({
      ...c,
      member_count: memberCounts[c.id] || 0,
    }));

    setCompanies(companiesWithStats);
    setIsLoading(false);
  };

  const handleSave = async () => {
    if (!companyName.trim()) return;
    setIsSubmitting(true);
    try {
      if (editingCompany) {
        await supabase.from("companies").update({ name: companyName }).eq("id", editingCompany.id);
        toast({ title: "Kompanie aktualisiert" });
      } else {
        await supabase.from("companies").insert({ club_id: member!.club_id, name: companyName });
        toast({ title: "Kompanie erstellt" });
      }
      fetchCompanies();
      setIsDialogOpen(false);
      setCompanyName("");
      setEditingCompany(null);
    } catch (e) {
      toast({ title: "Fehler", variant: "destructive" });
    }
    setIsSubmitting(false);
  };

  const getFoundingYear = (createdAt: string) => {
    return new Date(createdAt).getFullYear();
  };

  const canManage = hasPermission("club.companies.manage");

  return (
    <PortalLayout>
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-between items-center mb-8"
        >
          <div>
            <h1 className="font-display text-3xl font-bold">Kompanien</h1>
            <p className="text-muted-foreground">
              {companies.length} Kompanie{companies.length !== 1 ? "n" : ""} im Verein
            </p>
          </div>
          {canManage && (
            <Button onClick={() => { setEditingCompany(null); setCompanyName(""); setIsDialogOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" /> Kompanie anlegen
            </Button>
          )}
        </motion.div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : companies.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-16 bg-card rounded-2xl border border-dashed"
          >
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
              <Building2 className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Noch keine Kompanien</h3>
            <p className="text-muted-foreground mb-6">Erstellen Sie die erste Kompanie für Ihren Verein</p>
            <Button onClick={() => { setEditingCompany(null); setCompanyName(""); setIsDialogOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" /> Erste Kompanie anlegen
            </Button>
          </motion.div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {companies.map((c, index) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="group relative bg-card rounded-2xl border overflow-hidden hover:shadow-lg hover:border-primary/20 transition-all duration-300 cursor-pointer"
                onClick={() => navigate(`/portal/company/${c.id}`)}
              >
                {/* Header with cover image */}
                <div className="h-24 relative overflow-hidden">
                  {c.cover_url ? (
                    <img src={c.cover_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary/20 via-primary/10 to-transparent" />
                  )}
                  <div className="absolute -bottom-10 left-5">
                    <div className="w-20 h-20 rounded-xl bg-card border-4 border-card shadow-md flex items-center justify-center overflow-visible">
                      {c.logo_url ? (
                        <img src={c.logo_url} alt={c.name} className="w-full h-full object-contain" />
                      ) : (
                        <Shield className="w-8 h-8 text-primary" />
                      )}
                    </div>
                  </div>
                  {canManage && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm hover:bg-background"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingCompany(c);
                        setCompanyName(c.name);
                        setIsDialogOpen(true);
                      }}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                  )}
                </div>

                {/* Content */}
                <div className="pt-12 px-5 pb-5">
                  <h3 className="font-semibold text-lg mb-1 group-hover:text-primary transition-colors">
                    {c.name}
                  </h3>
                  {c.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                      {c.description}
                    </p>
                  )}

                  {/* Stats */}
                  <div className="flex items-center gap-4 pt-4 border-t">
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Users className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{c.member_count}</p>
                        <p className="text-xs text-muted-foreground">Mitglieder</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-8 h-8 rounded-lg bg-accent/50 flex items-center justify-center">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium">{getFoundingYear(c.created_at)}</p>
                        <p className="text-xs text-muted-foreground">Gegründet</p>
                      </div>
                    </div>
                  </div>

                  {/* Action Button */}
                  <Button
                    variant="outline"
                    className="w-full mt-4 group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/portal/company/${c.id}`);
                    }}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Profil anzeigen
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCompany ? "Kompanie bearbeiten" : "Neue Kompanie"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Name</Label>
            <Input 
              value={companyName} 
              onChange={(e) => setCompanyName(e.target.value)} 
              placeholder="Name der Kompanie"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleSave} disabled={isSubmitting || !companyName.trim()}>
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
};

export default Companies;
