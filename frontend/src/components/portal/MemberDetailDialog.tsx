import { useState, useEffect } from "react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Building2, Calendar, Loader2, Award, Shield, UserCog } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

interface MembershipHistory {
  id: string;
  company_id: string;
  company_name: string;
  valid_from: string;
  valid_to: string | null;
}

interface AppointmentInfo {
  id: string;
  role_name: string;
  scope_type: "club" | "company";
  scope_name: string;
  valid_from: string;
  valid_to: string | null;
}

interface DelegationInfo {
  id: string;
  permission_key: string;
  company_name: string;
  granted_by_name: string | null;
  valid_from: string;
}

interface MemberDetailDialogProps {
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
}

const statusLabels: Record<string, { label: string; className: string }> = {
  prospect: { label: "Interessent", className: "bg-blue-500/10 text-blue-500" },
  active: { label: "Aktiv", className: "bg-green-500/10 text-green-500" },
  passive: { label: "Passiv", className: "bg-yellow-500/10 text-yellow-500" },
  resigned: { label: "Ausgetreten", className: "bg-red-500/10 text-red-500" },
};

const permissionLabels: Record<string, string> = {
  "company.events.manage": "Termine verwalten",
  "company.events.submit_publication": "Termine zur Veröffentlichung einreichen",
  "company.documents.manage": "Dokumente verwalten",
  "company.workshifts.manage": "Arbeitsdienste verwalten",
};

const MemberDetailDialog = ({
  open,
  onOpenChange,
  member,
  clubId,
}: MemberDetailDialogProps) => {
  const [memberships, setMemberships] = useState<MembershipHistory[]>([]);
  const [appointments, setAppointments] = useState<AppointmentInfo[]>([]);
  const [delegations, setDelegations] = useState<DelegationInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open && member) {
      fetchData();
    }
  }, [open, member]);

  const fetchData = async () => {
    if (!member) return;
    setIsLoading(true);

    // Fetch memberships, appointments, and delegations in parallel
    const [membershipRes, appointmentRes, companiesRes, rolesRes, delegationsRes, permissionsRes] = await Promise.all([
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
      supabase.from("companies").select("id, name").eq("club_id", clubId),
      supabase.from("roles").select("id, name").eq("club_id", clubId),
      supabase
        .from("delegations")
        .select("id, permission_id, company_id, granted_by_member_id, valid_from")
        .eq("grantee_member_id", member.id)
        .is("valid_to", null),
      supabase.from("permissions").select("id, key"),
    ]);

    const companyMap = new Map((companiesRes.data || []).map((c) => [c.id, c.name]));
    const roleMap = new Map((rolesRes.data || []).map((r) => [r.id, r.name]));
    const permissionMap = new Map((permissionsRes.data || []).map((p) => [p.id, p.key]));

    // Process memberships
    if (membershipRes.data) {
      const enrichedMemberships: MembershipHistory[] = membershipRes.data.map((m) => ({
        ...m,
        company_name: companyMap.get(m.company_id) || "Unbekannt",
      }));
      setMemberships(enrichedMemberships);
    }

    // Process appointments
    if (appointmentRes.data) {
      const enrichedAppointments: AppointmentInfo[] = appointmentRes.data.map((a) => ({
        id: a.id,
        role_name: roleMap.get(a.role_id) || "Unbekannt",
        scope_type: a.scope_type,
        scope_name: a.scope_type === "club" ? "Hauptverein" : companyMap.get(a.scope_id) || "Unbekannt",
        valid_from: a.valid_from,
        valid_to: a.valid_to,
      }));
      setAppointments(enrichedAppointments);
    }

    // Process delegations
    if (delegationsRes.data && delegationsRes.data.length > 0) {
      const grantedByIds = [...new Set(delegationsRes.data.map(d => d.granted_by_member_id).filter(Boolean))];
      let grantedByNames: Record<string, string> = {};
      
      if (grantedByIds.length > 0) {
        const { data: grantersData } = await supabase
          .from("members")
          .select("id, first_name, last_name")
          .in("id", grantedByIds);
        
        grantedByNames = (grantersData || []).reduce((acc, m) => {
          acc[m.id] = `${m.first_name} ${m.last_name}`;
          return acc;
        }, {} as Record<string, string>);
      }

      setDelegations(
        delegationsRes.data.map((d) => ({
          id: d.id,
          permission_key: permissionMap.get(d.permission_id) || "",
          company_name: companyMap.get(d.company_id) || "Unbekannt",
          granted_by_name: d.granted_by_member_id ? grantedByNames[d.granted_by_member_id] || null : null,
          valid_from: d.valid_from,
        }))
      );
    } else {
      setDelegations([]);
    }

    setIsLoading(false);
  };

  if (!member) return null;

  const status = statusLabels[member.status] || statusLabels.prospect;
  const currentMembership = memberships.find((m) => m.valid_to === null);
  const pastMemberships = memberships.filter((m) => m.valid_to !== null);
  const activeAppointments = appointments.filter((a) => a.valid_to === null);
  const pastAppointments = appointments.filter((a) => a.valid_to !== null);

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), "dd.MM.yyyy", { locale: de });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">
            {member.first_name} {member.last_name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className={status.className}>
                {status.label}
              </Badge>
            </div>

            <div className="grid gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">E-Mail</span>
                <span>{member.email}</span>
              </div>
              {member.phone && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Telefon</span>
                  <span>{member.phone}</span>
                </div>
              )}
              {(member.street || member.zip || member.city) && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Adresse</span>
                  <span className="text-right">
                    {member.street && <div>{member.street}</div>}
                    {(member.zip || member.city) && (
                      <div>
                        {member.zip} {member.city}
                      </div>
                    )}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Current Company */}
          <div className="space-y-3">
            <h3 className="font-medium flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Aktuelle Kompanie
            </h3>
            {isLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : currentMembership ? (
              <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                <div className="font-medium text-primary">
                  {currentMembership.company_name}
                </div>
                <div className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                  <Calendar className="w-3 h-3" />
                  seit {formatDate(currentMembership.valid_from)}
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm italic">
                Keine aktive Zuordnung
              </p>
            )}
          </div>

          {/* Active Appointments (Ämter) */}
          <div className="space-y-3">
            <h3 className="font-medium flex items-center gap-2">
              <Award className="w-4 h-4" />
              Aktive Ämter
            </h3>
            {isLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : activeAppointments.length > 0 ? (
              <div className="space-y-2">
                {activeAppointments.map((a) => (
                  <div
                    key={a.id}
                    className="p-3 bg-primary/5 border border-primary/20 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      {a.scope_type === "club" ? (
                        <Shield className="w-4 h-4 text-primary" />
                      ) : (
                        <Building2 className="w-4 h-4 text-primary" />
                      )}
                      <span className="font-medium">{a.role_name}</span>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {a.scope_name} · seit {formatDate(a.valid_from)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm italic">
                Keine aktiven Ämter
              </p>
            )}
          </div>

          {/* Delegations */}
          {delegations.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-medium flex items-center gap-2">
                <UserCog className="w-4 h-4" />
                Delegierte Rechte
              </h3>
              <div className="space-y-2">
                {delegations.map((d) => (
                  <div
                    key={d.id}
                    className="p-3 bg-accent/50 border border-accent rounded-lg"
                  >
                    <div className="font-medium text-sm">
                      {permissionLabels[d.permission_key] || d.permission_key}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {d.company_name}
                      {d.granted_by_name && ` · von ${d.granted_by_name}`}
                      {` · seit ${formatDate(d.valid_from)}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Company History */}
          {pastMemberships.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-medium flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Kompanie-Historie
              </h3>
              <div className="space-y-2">
                {pastMemberships.map((m) => (
                  <div
                    key={m.id}
                    className="p-3 bg-muted/50 rounded-lg text-sm"
                  >
                    <div className="font-medium">{m.company_name}</div>
                    <div className="text-muted-foreground">
                      {formatDate(m.valid_from)} – {formatDate(m.valid_to!)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Appointment History */}
          {pastAppointments.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-medium flex items-center gap-2">
                <Award className="w-4 h-4" />
                Ämter-Historie
              </h3>
              <div className="space-y-2">
                {pastAppointments.map((a) => (
                  <div
                    key={a.id}
                    className="p-3 bg-muted/50 rounded-lg text-sm"
                  >
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
            </div>
          )}
        </div>

        <div className="mt-4">
          <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
            Schließen
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MemberDetailDialog;
