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
import { api } from "@/integrations/api/client";

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
  title: string;
  from_member_name: string | null;
  valid_from: string;
  valid_to: string | null;
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
  active:   { label: "Aktiv",       className: "bg-green-500/10 text-green-500" },
  passive:  { label: "Passiv",      className: "bg-yellow-500/10 text-yellow-500" },
  resigned: { label: "Ausgetreten", className: "bg-red-500/10 text-red-500" },
};

const MemberDetailDialog = ({
  open,
  onOpenChange,
  member,
  clubId,
}: MemberDetailDialogProps) => {
  const [memberships,  setMemberships]  = useState<MembershipHistory[]>([]);
  const [appointments, setAppointments] = useState<AppointmentInfo[]>([]);
  const [delegations,  setDelegations]  = useState<DelegationInfo[]>([]);
  const [isLoading,    setIsLoading]    = useState(false);

  useEffect(() => {
    if (open && member) fetchData();
  }, [open, member]);

  const fetchData = async () => {
    if (!member) return;
    setIsLoading(true);

    try {
      interface ApiMembership {
        id: string;
        company_id: string;
        valid_from: string;
        valid_to: string | null;
      }
      interface ApiAppointment {
        id: string;
        role_id: string;
        scope_type: string;
        scope_id: string;
        valid_from: string;
        valid_to: string | null;
      }
      interface ApiCompany   { id: string; name: string }
      interface ApiRole      { id: string; name: string }
      interface ApiDelegation {
        id: string;
        title: string;
        from_member_id: string;
        valid_from: string;
        valid_to: string | null;
      }
      interface ApiMember    { id: string; first_name: string; last_name: string }

      const [
        membershipData,
        appointmentData,
        companies,
        roles,
        delegationData,
      ] = await Promise.all([
        api.json<ApiMembership[]>(`/api/memberships?member_id=${member.id}`).catch((): ApiMembership[] => []),
        api.json<ApiAppointment[]>(`/api/appointments?member_id=${member.id}`).catch((): ApiAppointment[] => []),
        api.json<ApiCompany[]>("/api/companies").catch((): ApiCompany[] => []),
        api.json<ApiRole[]>("/api/roles").catch((): ApiRole[] => []),
        api.json<ApiDelegation[]>(`/api/delegations?to_member_id=${member.id}`).catch((): ApiDelegation[] => []),
      ]);

      const companyMap = new Map<string, string>(companies.map((c): [string, string] => [c.id, c.name]));
      const roleMap    = new Map<string, string>(roles.map((r): [string, string] => [r.id, r.name]));

      // Memberships anreichern
      setMemberships(
        membershipData.map((m): MembershipHistory => ({
          id:           m.id,
          company_id:   m.company_id,
          valid_from:   m.valid_from,
          valid_to:     m.valid_to,
          company_name: companyMap.get(m.company_id) ?? "Unbekannt",
        }))
      );

      // Appointments anreichern
      setAppointments(
        appointmentData.map((a): AppointmentInfo => ({
          id:         a.id,
          role_name:  roleMap.get(a.role_id) ?? "Unbekannt",
          scope_type: (a.scope_type === "club" ? "club" : "company"),
          scope_name:
            a.scope_type === "club"
              ? "Hauptverein"
              : companyMap.get(a.scope_id) ?? "Unbekannt",
          valid_from: a.valid_from,
          valid_to:   a.valid_to,
        }))
      );

      // Delegationen: Namen der delegierenden Mitglieder nachladen
      if (delegationData.length > 0) {
        const fromIds = [...new Set(delegationData.map((d) => d.from_member_id))];
        const fromMembers = await api
          .json<ApiMember[]>(`/api/members?ids=${fromIds.join(",")}`)
          .catch((): ApiMember[] => []);

        const fromMap = new Map<string, string>(
          fromMembers.map((m): [string, string] => [m.id, `${m.first_name} ${m.last_name}`])
        );

        setDelegations(
          delegationData
            .filter((d) => !d.valid_to || new Date(d.valid_to) >= new Date())
            .map((d): DelegationInfo => ({
              id:               d.id,
              title:            d.title,
              from_member_name: fromMap.get(d.from_member_id) ?? null,
              valid_from:       d.valid_from,
              valid_to:         d.valid_to,
            }))
        );
      } else {
        setDelegations([]);
      }
    } catch (err) {
      console.error("MemberDetailDialog fetchData error:", err);
    }

    setIsLoading(false);
  };

  if (!member) return null;

  const status             = statusLabels[member.status] || statusLabels.prospect;
  const currentMembership  = memberships.find((m) => m.valid_to === null);
  const pastMemberships    = memberships.filter((m) => m.valid_to !== null);
  const activeAppointments = appointments.filter((a) => a.valid_to === null);
  const pastAppointments   = appointments.filter((a) => a.valid_to !== null);

  const formatDate = (dateStr: string) =>
    format(new Date(dateStr), "dd.MM.yyyy", { locale: de });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">
            {member.first_name} {member.last_name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">

          {/* ── Basisdaten ── */}
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
                      <div>{member.zip} {member.city}</div>
                    )}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* ── Aktuelle Kompanie ── */}
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

          {/* ── Aktive Ämter ── */}
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

          {/* ── Delegierte Aufgaben ── */}
          {delegations.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-medium flex items-center gap-2">
                <UserCog className="w-4 h-4" />
                Delegierte Aufgaben
              </h3>
              <div className="space-y-2">
                {delegations.map((d) => (
                  <div
                    key={d.id}
                    className="p-3 bg-accent/50 border border-accent rounded-lg"
                  >
                    <div className="font-medium text-sm">{d.title}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {d.from_member_name && `von ${d.from_member_name} · `}
                      seit {formatDate(d.valid_from)}
                      {d.valid_to && ` bis ${formatDate(d.valid_to)}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Kompanie-Historie ── */}
          {pastMemberships.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-medium flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Kompanie-Historie
              </h3>
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
            </div>
          )}

          {/* ── Ämter-Historie ── */}
          {pastAppointments.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-medium flex items-center gap-2">
                <Award className="w-4 h-4" />
                Ämter-Historie
              </h3>
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