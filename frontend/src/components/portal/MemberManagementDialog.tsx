import { useState, useEffect } from "react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { 
  Building2, Calendar, Loader2, Award, Shield, UserCog, Plus, 
  Edit, Trash2, X, Medal, KeyRound, Check, Eye, EyeOff, Trophy,
  Crown, Star, Sparkles, ScrollText, CheckCircle2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import AwardDialog, { getAwardTypeConfig } from "./AwardDialog";

interface MembershipHistory {
  id: string;
  company_id: string;
  company_name: string;
  valid_from: string;
  valid_to: string | null;
}

interface AppointmentInfo {
  id: string;
  role_id: string;
  role_name: string;
  scope_type: "club" | "company";
  scope_id: string;
  scope_name: string;
  valid_from: string;
  valid_to: string | null;
}

interface MemberAward {
  id: string;
  title: string;
  description: string | null;
  awarded_at: string;
  award_type: string;
  award_type_id?: string | null;
}

interface AwardType {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  badge_color: string;
  scope_type: "club" | "company";
  scope_id: string | null;
}

interface Company {
  id: string;
  name: string;
}

interface Role {
  id: string;
  name: string;
  level: "club" | "company";
}

interface MemberManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
    status: string;
    user_id?: string | null;
  } | null;
  clubId: string;
  onRefresh?: () => void;
}

const statusLabels: Record<string, { label: string; className: string }> = {
  prospect: { label: "Interessent", className: "bg-gold/10 text-gold-dark" },
  active: { label: "Aktiv", className: "bg-forest/10 text-forest" },
  passive: { label: "Passiv", className: "bg-muted text-muted-foreground" },
  resigned: { label: "Ausgetreten", className: "bg-destructive/10 text-destructive" },
};

const MemberManagementDialog = ({
  open,
  onOpenChange,
  member,
  clubId,
  onRefresh,
}: MemberManagementDialogProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  
  // Data states
  const [memberships, setMemberships] = useState<MembershipHistory[]>([]);
  const [appointments, setAppointments] = useState<AppointmentInfo[]>([]);
  const [awards, setAwards] = useState<MemberAward[]>([]);
  const [awardTypes, setAwardTypes] = useState<AwardType[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  
  // Loading state for granting award
  const [grantingAwardTypeId, setGrantingAwardTypeId] = useState<string | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  
  // Dialog states
  const [awardDialogOpen, setAwardDialogOpen] = useState(false);
  const [editingAward, setEditingAward] = useState<MemberAward | null>(null);
  const [deleteAwardId, setDeleteAwardId] = useState<string | null>(null);
  
  const [companyDialogOpen, setCompanyDialogOpen] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [companyValidFrom, setCompanyValidFrom] = useState(new Date().toISOString().split("T")[0]);
  const [editingMembership, setEditingMembership] = useState<MembershipHistory | null>(null);
  const [endingMembership, setEndingMembership] = useState<MembershipHistory | null>(null);
  
  const [appointmentDialogOpen, setAppointmentDialogOpen] = useState(false);
  const [appointmentForm, setAppointmentForm] = useState({
    role_id: "",
    scope_type: "club" as "club" | "company",
    scope_id: "",
    valid_from: new Date().toISOString().split("T")[0],
  });
  const [endingAppointment, setEndingAppointment] = useState<AppointmentInfo | null>(null);
  
  // Account creation states
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [accountPassword, setAccountPassword] = useState("");
  const [accountPasswordConfirm, setAccountPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [memberHasAccount, setMemberHasAccount] = useState<boolean>(false);

  useEffect(() => {
    if (open && member) {
      fetchAllData();
      // Check if member has account
      setMemberHasAccount(!!member.user_id);
    }
  }, [open, member]);

  const fetchAllData = async () => {
    if (!member) return;
    setIsLoading(true);

    const [
      membershipRes,
      appointmentRes,
      awardsRes,
      companiesRes,
      rolesRes,
      awardTypesRes,
    ] = await Promise.all([
      supabase
        .from("member_company_memberships")
        .select("id, company_id, valid_from, valid_to")
        .eq("member_id", member.id)
        .order("valid_from", { ascending: false }),
      supabase
        .from("appointments")
        .select("id, role_id, scope_type, scope_id, valid_from, valid_to")
        .eq("member_id", member.id)
        .order("valid_from", { ascending: false }),
      supabase
        .from("member_awards")
        .select("id, title, description, awarded_at, award_type, award_type_id")
        .eq("member_id", member.id)
        .order("awarded_at", { ascending: false }),
      supabase.from("companies").select("id, name").eq("club_id", clubId),
      supabase.from("roles").select("id, name, level").eq("club_id", clubId),
      supabase
        .from("award_types")
        .select("id, name, description, icon, badge_color, scope_type, scope_id")
        .eq("club_id", clubId)
        .eq("is_active", true)
        .order("name", { ascending: true }),
    ]);

    const companyMap = new Map((companiesRes.data || []).map((c) => [c.id, c.name]));
    const roleMap = new Map((rolesRes.data || []).map((r) => [r.id, r.name]));

    setCompanies(companiesRes.data || []);
    setRoles(rolesRes.data || []);

    if (membershipRes.data) {
      setMemberships(membershipRes.data.map((m) => ({
        ...m,
        company_name: companyMap.get(m.company_id) || "Unbekannt",
      })));
    }

    if (appointmentRes.data) {
      setAppointments(appointmentRes.data.map((a) => ({
        id: a.id,
        role_id: a.role_id,
        role_name: roleMap.get(a.role_id) || "Unbekannt",
        scope_type: a.scope_type,
        scope_id: a.scope_id,
        scope_name: a.scope_type === "club" ? "Hauptverein" : companyMap.get(a.scope_id) || "Unbekannt",
        valid_from: a.valid_from,
        valid_to: a.valid_to,
      })));
    }

    setAwards(awardsRes.data || []);
    setAwardTypes(awardTypesRes.data || []);
    setIsLoading(false);
  };

  // Get icon component for award type
  const getAwardTypeIcon = (iconName: string) => {
    const icons: Record<string, typeof Medal> = {
      medal: Medal,
      award: Award,
      trophy: Trophy,
      crown: Crown,
      star: Star,
      sparkles: Sparkles,
      scroll: ScrollText,
    };
    return icons[iconName.toLowerCase()] || Medal;
  };

  // Get badge color classes
  const getBadgeColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; text: string }> = {
      gold: { bg: "bg-amber-500/10", text: "text-amber-500" },
      silver: { bg: "bg-gray-400/10", text: "text-gray-400" },
      bronze: { bg: "bg-orange-600/10", text: "text-orange-600" },
      blue: { bg: "bg-blue-500/10", text: "text-blue-500" },
      green: { bg: "bg-green-500/10", text: "text-green-500" },
      purple: { bg: "bg-purple-500/10", text: "text-purple-500" },
      red: { bg: "bg-red-500/10", text: "text-red-500" },
    };
    return colors[color.toLowerCase()] || colors.gold;
  };

  // Grant predefined award to member
  const handleGrantAwardType = async (awardType: AwardType) => {
    if (!member) return;
    
    setGrantingAwardTypeId(awardType.id);
    try {
      const { error } = await supabase.from("member_awards").insert({
        member_id: member.id,
        club_id: clubId,
        title: awardType.name,
        description: awardType.description,
        awarded_at: format(new Date(), "yyyy-MM-dd"),
        award_type: awardType.icon,
        award_type_id: awardType.id,
        status: "approved",
      });

      if (error) throw error;
      toast({ title: "Auszeichnung vergeben", description: `${awardType.name} wurde ${member.first_name} verliehen.` });
      fetchAllData();
    } catch (error: any) {
      console.error("Error granting award:", error);
      toast({ title: "Fehler beim Vergeben", description: error.message, variant: "destructive" });
    } finally {
      setGrantingAwardTypeId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), "dd.MM.yyyy", { locale: de });
  };

  // === AWARDS ===
  const handleDeleteAward = async () => {
    if (!deleteAwardId) return;
    try {
      const { error } = await supabase.from("member_awards").delete().eq("id", deleteAwardId);
      if (error) throw error;
      toast({ title: "Auszeichnung gelöscht" });
      fetchAllData();
    } catch (error) {
      toast({ title: "Fehler beim Löschen", variant: "destructive" });
    } finally {
      setDeleteAwardId(null);
    }
  };

  // === COMPANY MEMBERSHIP ===
  const handleSaveCompanyMembership = async () => {
    if (!member || !selectedCompanyId) return;

    try {
      const currentMembership = memberships.find(m => m.valid_to === null);
      
      if (currentMembership) {
        // End current membership
        await supabase
          .from("member_company_memberships")
          .update({ valid_to: companyValidFrom })
          .eq("id", currentMembership.id);
      }

      // Create new membership
      const { error } = await supabase.from("member_company_memberships").insert({
        member_id: member.id,
        company_id: selectedCompanyId,
        valid_from: companyValidFrom,
        valid_to: null,
      });

      if (error) throw error;
      toast({ title: "Kompanie zugeordnet" });
      setCompanyDialogOpen(false);
      setSelectedCompanyId("");
      fetchAllData();
      onRefresh?.();
    } catch (error: any) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    }
  };

  const handleEndMembership = async () => {
    if (!endingMembership) return;
    const endDate = new Date().toISOString().split("T")[0];
    
    try {
      const { error } = await supabase
        .from("member_company_memberships")
        .update({ valid_to: endDate })
        .eq("id", endingMembership.id);

      if (error) throw error;
      toast({ title: "Mitgliedschaft beendet" });
      fetchAllData();
    } catch (error) {
      toast({ title: "Fehler", variant: "destructive" });
    } finally {
      setEndingMembership(null);
    }
  };

  // === APPOINTMENTS ===
  const handleSaveAppointment = async () => {
    if (!member || !appointmentForm.role_id) return;

    const scopeId = appointmentForm.scope_type === "club" ? clubId : appointmentForm.scope_id;
    if (!scopeId) {
      toast({ title: "Bitte Geltungsbereich wählen", variant: "destructive" });
      return;
    }

    try {
      const { error } = await supabase.from("appointments").insert({
        member_id: member.id,
        role_id: appointmentForm.role_id,
        scope_type: appointmentForm.scope_type,
        scope_id: scopeId,
        valid_from: appointmentForm.valid_from,
        valid_to: null,
      });

      if (error) throw error;
      toast({ title: "Amt zugewiesen" });
      setAppointmentDialogOpen(false);
      setAppointmentForm({
        role_id: "",
        scope_type: "club",
        scope_id: "",
        valid_from: new Date().toISOString().split("T")[0],
      });
      fetchAllData();
      onRefresh?.();
    } catch (error: any) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    }
  };

  const handleEndAppointment = async () => {
    if (!endingAppointment) return;
    const endDate = new Date().toISOString().split("T")[0];

    try {
      const { error } = await supabase
        .from("appointments")
        .update({ valid_to: endDate })
        .eq("id", endingAppointment.id);

      if (error) throw error;
      toast({ title: "Amt beendet" });
      fetchAllData();
    } catch (error) {
      toast({ title: "Fehler", variant: "destructive" });
    } finally {
      setEndingAppointment(null);
    }
  };

  // === CREATE ACCOUNT ===
  const handleCreateAccount = async () => {
    if (!member) return;
    
    if (!member.email) {
      toast({ 
        title: "Keine E-Mail-Adresse", 
        description: "Das Mitglied hat keine E-Mail-Adresse hinterlegt. Bitte zuerst eine E-Mail-Adresse im Profil eintragen.",
        variant: "destructive" 
      });
      return;
    }

    if (accountPassword.length < 6) {
      toast({ title: "Passwort zu kurz", description: "Mindestens 6 Zeichen", variant: "destructive" });
      return;
    }

    if (accountPassword !== accountPasswordConfirm) {
      toast({ title: "Passwörter stimmen nicht überein", variant: "destructive" });
      return;
    }

    setIsCreatingAccount(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-member-account", {
        body: { memberId: member.id, password: accountPassword },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast({ 
        title: "Login-Account erstellt", 
        description: `${member.first_name} ${member.last_name} kann sich jetzt mit der E-Mail ${member.email} anmelden.` 
      });
      
      setAccountDialogOpen(false);
      setAccountPassword("");
      setAccountPasswordConfirm("");
      setMemberHasAccount(true);
      onRefresh?.();
    } catch (error: any) {
      console.error("Create account error:", error);
      toast({ 
        title: "Fehler beim Erstellen des Accounts", 
        description: error.message || "Ein unerwarteter Fehler ist aufgetreten",
        variant: "destructive" 
      });
    } finally {
      setIsCreatingAccount(false);
    }
  };

  if (!member) return null;

  const status = statusLabels[member.status] || statusLabels.prospect;
  const currentMembership = memberships.find((m) => m.valid_to === null);
  const pastMemberships = memberships.filter((m) => m.valid_to !== null);
  const activeAppointments = appointments.filter((a) => a.valid_to === null);
  const pastAppointments = appointments.filter((a) => a.valid_to !== null);
  const filteredRoles = roles.filter(r => r.level === appointmentForm.scope_type);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-3">
              {member.first_name} {member.last_name}
              <Badge variant="secondary" className={status.className}>
                {status.label}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <Tabs defaultValue="awards" className="mt-4">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="awards" className="text-xs sm:text-sm">
                  <Medal className="w-4 h-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Auszeichnungen</span>
                  <span className="sm:hidden">Ausze.</span>
                </TabsTrigger>
                <TabsTrigger value="company" className="text-xs sm:text-sm">
                  <Building2 className="w-4 h-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Kompanie</span>
                  <span className="sm:hidden">Komp.</span>
                </TabsTrigger>
                <TabsTrigger value="appointments" className="text-xs sm:text-sm">
                  <Shield className="w-4 h-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Ämter</span>
                  <span className="sm:hidden">Ämter</span>
                </TabsTrigger>
                <TabsTrigger value="account" className="text-xs sm:text-sm">
                  <KeyRound className="w-4 h-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Account</span>
                  <span className="sm:hidden">Acc.</span>
                </TabsTrigger>
                <TabsTrigger value="history" className="text-xs sm:text-sm">
                  <Calendar className="w-4 h-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Historie</span>
                  <span className="sm:hidden">Hist.</span>
                </TabsTrigger>
              </TabsList>

              {/* === AUSZEICHNUNGEN TAB === */}
              <TabsContent value="awards" className="space-y-6 mt-4">
                {/* Predefined Award Types Section */}
                {awardTypes.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                      Vordefinierte Auszeichnungen vergeben
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      {awardTypes.map((awardType) => {
                        const IconComponent = getAwardTypeIcon(awardType.icon);
                        const colorClasses = getBadgeColorClasses(awardType.badge_color);
                        const isGranting = grantingAwardTypeId === awardType.id;
                        // Check if this award type was already granted
                        const alreadyGranted = awards.some(a => a.award_type_id === awardType.id);
                        
                        return (
                          <button
                            key={awardType.id}
                            onClick={() => handleGrantAwardType(awardType)}
                            disabled={isGranting || alreadyGranted}
                            className={`p-3 rounded-lg border-2 transition-all text-left flex items-center gap-3 ${
                              alreadyGranted 
                                ? "border-green-500/50 bg-green-500/10 cursor-default" 
                                : "border-transparent bg-muted/50 hover:bg-muted hover:border-primary/30 cursor-pointer"
                            }`}
                            title={alreadyGranted ? "Bereits vergeben" : `${awardType.name} vergeben`}
                          >
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${colorClasses.bg}`}>
                              {isGranting ? (
                                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                              ) : alreadyGranted ? (
                                <CheckCircle2 className="w-5 h-5 text-green-500" />
                              ) : (
                                <IconComponent className={`w-5 h-5 ${colorClasses.text}`} />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm truncate">{awardType.name}</p>
                              {awardType.description && (
                                <p className="text-xs text-muted-foreground truncate">{awardType.description}</p>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Divider if both sections have content */}
                {awardTypes.length > 0 && (
                  <div className="border-t pt-4">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="font-medium">Vergebene Auszeichnungen</h3>
                      <Button size="sm" variant="outline" onClick={() => { setEditingAward(null); setAwardDialogOpen(true); }}>
                        <Plus className="w-4 h-4 mr-2" />
                        Manuell
                      </Button>
                    </div>
                  </div>
                )}

                {/* No award types - show simple header */}
                {awardTypes.length === 0 && (
                  <div className="flex justify-between items-center">
                    <h3 className="font-medium">Auszeichnungen</h3>
                    <Button size="sm" onClick={() => { setEditingAward(null); setAwardDialogOpen(true); }}>
                      <Plus className="w-4 h-4 mr-2" />
                      Hinzufügen
                    </Button>
                  </div>
                )}

                {/* Existing Awards List */}
                {awards.length === 0 ? (
                  <p className="text-muted-foreground text-sm italic py-4 text-center">
                    Keine Auszeichnungen vorhanden
                  </p>
                ) : (
                  <div className="space-y-2">
                    {awards.map((award) => {
                      const config = getAwardTypeConfig(award.award_type);
                      const Icon = config.icon;
                      return (
                        <div key={award.id} className="p-3 bg-card border rounded-lg flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${config.bgColor}`}>
                              <Icon className={`w-5 h-5 ${config.color}`} />
                            </div>
                            <div>
                              <p className="font-medium">{award.title}</p>
                              <p className="text-sm text-muted-foreground">
                                {formatDate(award.awarded_at)}
                                {award.description && ` · ${award.description}`}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => { setEditingAward(award); setAwardDialogOpen(true); }}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteAwardId(award.id)}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              {/* === KOMPANIE TAB === */}
              <TabsContent value="company" className="space-y-4 mt-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-medium">Aktuelle Kompanie</h3>
                  <Button size="sm" onClick={() => setCompanyDialogOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    {currentMembership ? "Wechseln" : "Zuordnen"}
                  </Button>
                </div>

                {currentMembership ? (
                  <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg flex justify-between items-center">
                    <div>
                      <div className="font-medium text-primary">{currentMembership.company_name}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                        <Calendar className="w-3 h-3" />
                        seit {formatDate(currentMembership.valid_from)}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEndingMembership(currentMembership)}
                    >
                      <X className="w-4 h-4 mr-2" />
                      Beenden
                    </Button>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm italic py-4 text-center">
                    Keine aktive Kompanie-Zuordnung
                  </p>
                )}
              </TabsContent>

              {/* === ÄMTER TAB === */}
              <TabsContent value="appointments" className="space-y-4 mt-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-medium">Aktive Ämter</h3>
                  <Button size="sm" onClick={() => setAppointmentDialogOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Amt zuweisen
                  </Button>
                </div>

                {activeAppointments.length === 0 ? (
                  <p className="text-muted-foreground text-sm italic py-4 text-center">
                    Keine aktiven Ämter
                  </p>
                ) : (
                  <div className="space-y-2">
                    {activeAppointments.map((a) => (
                      <div key={a.id} className="p-3 bg-primary/5 border border-primary/20 rounded-lg flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          {a.scope_type === "club" ? (
                            <Shield className="w-5 h-5 text-primary" />
                          ) : (
                            <Building2 className="w-5 h-5 text-primary" />
                          )}
                          <div>
                            <p className="font-medium">{a.role_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {a.scope_name} · seit {formatDate(a.valid_from)}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEndingAppointment(a)}
                        >
                          <X className="w-4 h-4 mr-2" />
                          Beenden
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* === ACCOUNT TAB === */}
              <TabsContent value="account" className="space-y-4 mt-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-medium">Login-Account</h3>
                </div>

                {memberHasAccount ? (
                  <div className="p-4 bg-forest/10 border border-forest/20 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-forest/20 flex items-center justify-center">
                        <Check className="w-5 h-5 text-forest" />
                      </div>
                      <div>
                        <p className="font-medium text-forest">Account vorhanden</p>
                        <p className="text-sm text-muted-foreground">
                          {member.first_name} kann sich mit {member.email || "der hinterlegten E-Mail"} anmelden.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 bg-muted/50 border rounded-lg">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                          <KeyRound className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium">Kein Login-Account</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {member.email 
                              ? `Sie können für ${member.first_name} einen Login-Account erstellen, damit er/sie sich im Portal anmelden kann.`
                              : "Bitte hinterlegen Sie zuerst eine E-Mail-Adresse für dieses Mitglied, bevor ein Login-Account erstellt werden kann."
                            }
                          </p>
                        </div>
                      </div>
                    </div>

                    {member.email && (
                      <Button onClick={() => setAccountDialogOpen(true)} className="w-full">
                        <KeyRound className="w-4 h-4 mr-2" />
                        Login-Account erstellen
                      </Button>
                    )}
                  </div>
                )}
              </TabsContent>

              {/* === HISTORIE TAB === */}
              <TabsContent value="history" className="space-y-6 mt-4">
                {/* Kompanie Historie */}
                <div>
                  <h3 className="font-medium flex items-center gap-2 mb-3">
                    <Building2 className="w-4 h-4" />
                    Kompanie-Historie
                  </h3>
                  {pastMemberships.length === 0 ? (
                    <p className="text-muted-foreground text-sm italic">Keine historischen Einträge</p>
                  ) : (
                    <div className="space-y-2">
                      {pastMemberships.map((m) => (
                        <div key={m.id} className="p-3 bg-muted/50 rounded-lg text-sm">
                          <div className="font-medium">{m.company_name}</div>
                          <div className="text-muted-foreground">
                            {formatDate(m.valid_from)} – {formatDate(m.valid_to!)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Ämter Historie */}
                <div>
                  <h3 className="font-medium flex items-center gap-2 mb-3">
                    <Award className="w-4 h-4" />
                    Ämter-Historie
                  </h3>
                  {pastAppointments.length === 0 ? (
                    <p className="text-muted-foreground text-sm italic">Keine historischen Einträge</p>
                  ) : (
                    <div className="space-y-2">
                      {pastAppointments.map((a) => (
                        <div key={a.id} className="p-3 bg-muted/50 rounded-lg text-sm">
                          <div className="flex items-center gap-2">
                            {a.scope_type === "club" ? (
                              <Shield className="w-3 h-3 text-muted-foreground" />
                            ) : (
                              <Building2 className="w-3 h-3 text-muted-foreground" />
                            )}
                            <span className="font-medium">{a.role_name}</span>
                          </div>
                          <div className="text-muted-foreground">
                            {a.scope_name} · {formatDate(a.valid_from)} – {formatDate(a.valid_to!)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          )}

          <div className="mt-4 pt-4 border-t">
            <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
              Schließen
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Award Dialog */}
      <AwardDialog
        open={awardDialogOpen}
        onOpenChange={setAwardDialogOpen}
        memberId={member?.id || ""}
        clubId={clubId}
        award={editingAward}
        onSave={fetchAllData}
      />

      {/* Delete Award Confirmation */}
      <AlertDialog open={!!deleteAwardId} onOpenChange={() => setDeleteAwardId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Auszeichnung löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAward} className="bg-destructive text-destructive-foreground">
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Company Assignment Dialog */}
      <Dialog open={companyDialogOpen} onOpenChange={setCompanyDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{currentMembership ? "Kompanie wechseln" : "Kompanie zuordnen"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Kompanie</Label>
              <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Kompanie auswählen" />
                </SelectTrigger>
                <SelectContent>
                  {companies
                    .filter(c => c.id !== currentMembership?.company_id)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Gültig ab</Label>
              <Input
                type="date"
                value={companyValidFrom}
                onChange={(e) => setCompanyValidFrom(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setCompanyDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={handleSaveCompanyMembership} disabled={!selectedCompanyId}>Speichern</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* End Membership Confirmation */}
      <AlertDialog open={!!endingMembership} onOpenChange={() => setEndingMembership(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mitgliedschaft beenden?</AlertDialogTitle>
            <AlertDialogDescription>
              Die Mitgliedschaft bei {endingMembership?.company_name} wird zum heutigen Datum beendet.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleEndMembership}>Beenden</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Appointment Dialog */}
      <Dialog open={appointmentDialogOpen} onOpenChange={setAppointmentDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Amt zuweisen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Geltungsbereich</Label>
              <Select
                value={appointmentForm.scope_type}
                onValueChange={(v: "club" | "company") => setAppointmentForm({ ...appointmentForm, scope_type: v, role_id: "", scope_id: "" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="club">Vereinsebene</SelectItem>
                  <SelectItem value="company">Kompanieebene</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {appointmentForm.scope_type === "company" && (
              <div className="space-y-2">
                <Label>Kompanie</Label>
                <Select value={appointmentForm.scope_id} onValueChange={(v) => setAppointmentForm({ ...appointmentForm, scope_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Kompanie wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Amt / Rolle</Label>
              <Select value={appointmentForm.role_id} onValueChange={(v) => setAppointmentForm({ ...appointmentForm, role_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Amt wählen" />
                </SelectTrigger>
                <SelectContent>
                  {filteredRoles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Gültig ab</Label>
              <Input
                type="date"
                value={appointmentForm.valid_from}
                onChange={(e) => setAppointmentForm({ ...appointmentForm, valid_from: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setAppointmentDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={handleSaveAppointment} disabled={!appointmentForm.role_id}>Speichern</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Account Dialog */}
      <Dialog open={accountDialogOpen} onOpenChange={(open) => {
        setAccountDialogOpen(open);
        if (!open) {
          setAccountPassword("");
          setAccountPasswordConfirm("");
          setShowPassword(false);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5" />
              Login-Account erstellen
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 bg-muted/50 rounded-lg text-sm">
              <p className="font-medium">{member.first_name} {member.last_name}</p>
              <p className="text-muted-foreground">{member.email}</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Passwort</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={accountPassword}
                  onChange={(e) => setAccountPassword(e.target.value)}
                  placeholder="Mindestens 6 Zeichen"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="passwordConfirm">Passwort bestätigen</Label>
              <Input
                id="passwordConfirm"
                type={showPassword ? "text" : "password"}
                value={accountPasswordConfirm}
                onChange={(e) => setAccountPasswordConfirm(e.target.value)}
                placeholder="Passwort wiederholen"
              />
            </div>

            {accountPassword.length > 0 && accountPassword.length < 6 && (
              <p className="text-sm text-destructive">Mindestens 6 Zeichen erforderlich</p>
            )}
            {accountPasswordConfirm.length > 0 && accountPassword !== accountPasswordConfirm && (
              <p className="text-sm text-destructive">Passwörter stimmen nicht überein</p>
            )}
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setAccountDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button 
              onClick={handleCreateAccount} 
              disabled={isCreatingAccount || accountPassword.length < 6 || accountPassword !== accountPasswordConfirm}
            >
              {isCreatingAccount ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Wird erstellt...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Account erstellen
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* End Appointment Confirmation */}
      <AlertDialog open={!!endingAppointment} onOpenChange={() => setEndingAppointment(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Amt beenden?</AlertDialogTitle>
            <AlertDialogDescription>
              Das Amt "{endingAppointment?.role_name}" bei {endingAppointment?.scope_name} wird zum heutigen Datum beendet.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleEndAppointment}>Beenden</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default MemberManagementDialog;
