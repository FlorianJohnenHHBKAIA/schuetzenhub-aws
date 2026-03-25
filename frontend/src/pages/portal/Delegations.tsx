import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/api/client";
import PortalLayout from "@/components/portal/PortalLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Info, Shield, User } from "lucide-react";
import { toast } from "sonner";
import { Navigate } from "react-router-dom";

interface CompanyMember {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  status: string;
}

interface Delegation {
  id: string;
  grantee_member_id: string;
  permission_id: string;
  permission_key: string;
  granted_by_name: string | null;
  valid_from: string;
}

interface Permission {
  id: string;
  key: string;
  description: string | null;
}

interface RawMembership {
  member_id: string;
  members: CompanyMember | null;
}

interface RawDelegation {
  id: string;
  grantee_member_id: string;
  permission_id: string;
  valid_from: string;
  granted_by_member_id: string | null;
  permissions: { key: string } | null;
}

interface RawGranter {
  id: string;
  first_name: string;
  last_name: string;
}

interface NewDelegationData {
  id: string;
  valid_from: string;
}

const DELEGATABLE_PERMISSIONS = [
  "company.events.manage",
  "company.events.submit_publication",
  "company.documents.manage",
  "company.workshifts.manage",
];

const Delegations = () => {
  const { member, hasPermission, isLoading: authLoading } = useAuth();
  const [companyMembers, setCompanyMembers] = useState<CompanyMember[]>([]);
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [userCompany, setUserCompany] = useState<{ id: string; name: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [togglingState, setTogglingState] = useState<Record<string, boolean>>({});

  const canManageDelegations = hasPermission("company.delegations.manage");

  useEffect(() => {
    if (member && canManageDelegations) {
      fetchData();
    }
  }, [member, canManageDelegations]);

  const fetchData = async () => {
    if (!member) return;

    try {
      const { data: membershipData, error: membershipError } = await supabase
        .from("member_company_memberships")
        .select("company_id, companies(id, name)")
        .eq("member_id", member.id)
        .is("valid_to", null)
        .maybeSingle();

      if (membershipError) throw membershipError;

      const rawMembership = membershipData as { company_id: string; companies: { id: string; name: string } | null } | null;

      if (!rawMembership?.companies) {
        setIsLoading(false);
        return;
      }

      const company = rawMembership.companies;
      setUserCompany(company);

      const { data: membershipsData, error: membershipsError } = await supabase
        .from("member_company_memberships")
        .select("member_id, members(id, first_name, last_name, email, status)")
        .eq("company_id", company.id)
        .is("valid_to", null);

      if (membershipsError) throw membershipsError;

      const members = ((membershipsData as RawMembership[]) || [])
        .map((m) => m.members)
        .filter((m): m is CompanyMember => m !== null && m.id !== member.id);

      setCompanyMembers(members);

      const { data: permData, error: permError } = await supabase
        .from("permissions")
        .select("*")
        .in("key", DELEGATABLE_PERMISSIONS);

      if (permError) throw permError;
      setPermissions((permData as Permission[]) || []);

      const { data: delegationsData, error: delegationsError } = await supabase
        .from("delegations")
        .select(`
          id,
          grantee_member_id,
          permission_id,
          valid_from,
          granted_by_member_id,
          permissions(key)
        `)
        .eq("company_id", company.id)
        .is("valid_to", null);

      if (delegationsError) throw delegationsError;

      const rawDelegations = (delegationsData as RawDelegation[]) || [];
      const grantedByIds = [...new Set(rawDelegations.map(d => d.granted_by_member_id).filter((id): id is string => id !== null))];
      let grantedByNames: Record<string, string> = {};
      
      if (grantedByIds.length > 0) {
        const { data: grantersData } = await supabase
          .from("members")
          .select("id, first_name, last_name")
          .in("id", grantedByIds);
        
        grantedByNames = ((grantersData as RawGranter[]) || []).reduce((acc, m) => {
          acc[m.id] = `${m.first_name} ${m.last_name}`;
          return acc;
        }, {} as Record<string, string>);
      }

      setDelegations(
        rawDelegations.map((d) => ({
          id: d.id,
          grantee_member_id: d.grantee_member_id,
          permission_id: d.permission_id,
          permission_key: d.permissions?.key || "",
          granted_by_name: d.granted_by_member_id ? grantedByNames[d.granted_by_member_id] || null : null,
          valid_from: d.valid_from,
        }))
      );
    } catch (error: unknown) {
      console.error("Error fetching data:", error);
      toast.error("Fehler beim Laden der Daten");
    } finally {
      setIsLoading(false);
    }
  };

  const hasDelegation = (memberId: string, permissionKey: string) => {
    return delegations.some(
      (d) => d.grantee_member_id === memberId && d.permission_key === permissionKey
    );
  };

  const getDelegation = (memberId: string, permissionKey: string) => {
    return delegations.find(
      (d) => d.grantee_member_id === memberId && d.permission_key === permissionKey
    );
  };

  const toggleDelegation = async (memberId: string, permissionKey: string) => {
    if (!member || !userCompany) return;

    const toggleKey = `${memberId}-${permissionKey}`;
    setTogglingState((prev) => ({ ...prev, [toggleKey]: true }));

    try {
      const existingDelegation = getDelegation(memberId, permissionKey);
      const permission = permissions.find((p) => p.key === permissionKey);

      if (!permission) {
        throw new Error("Permission nicht gefunden");
      }

      if (existingDelegation) {
        const { error } = await supabase
          .from("delegations")
          .update({ valid_to: new Date().toISOString().split("T")[0] })
          .eq("id", existingDelegation.id);

        if (error) throw error;

        setDelegations((prev) => prev.filter((d) => d.id !== existingDelegation.id));
        toast.success("Delegation beendet");
      } else {
        if (!member.club_id) throw new Error("Club ID fehlt");

        const { data, error } = await supabase
          .from("delegations")
          .insert({
            club_id: member.club_id,
            company_id: userCompany.id,
            grantee_member_id: memberId,
            granted_by_member_id: member.id,
            permission_id: permission.id,
          })
          .select("*");

        if (error) throw error;

        const newData = (Array.isArray(data) ? data[0] : data) as NewDelegationData;

        setDelegations((prev) => [
          ...prev,
          {
            id: newData.id,
            grantee_member_id: memberId,
            permission_id: permission.id,
            permission_key: permissionKey,
            granted_by_name: `${member.first_name} ${member.last_name}`,
            valid_from: newData.valid_from,
          },
        ]);
        toast.success("Delegation erteilt");
      }
    } catch (error: unknown) {
      console.error("Error toggling delegation:", error);
      toast.error(error instanceof Error ? error.message : "Fehler beim Ändern der Delegation");
    } finally {
      setTogglingState((prev) => ({ ...prev, [toggleKey]: false }));
    }
  };

  if (authLoading) {
    return (
      <PortalLayout>
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      </PortalLayout>
    );
  }

  if (!canManageDelegations) {
    return <Navigate to="/portal" replace />;
  }

  const getPermissionLabel = (key: string) => {
    const labels: Record<string, string> = {
      "company.events.manage": "Termine verwalten",
      "company.events.submit_publication": "Termine zur Veröffentlichung einreichen",
      "company.documents.manage": "Dokumente verwalten",
      "company.workshifts.manage": "Arbeitsdienste verwalten",
    };
    return labels[key] || key;
  };

  return (
    <PortalLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">
            Delegationen
          </h1>
          <p className="text-muted-foreground mt-1">
            Zusätzliche Rechte an Kompanie-Mitglieder vergeben
          </p>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Delegierte Rechte gelten nur innerhalb dieser Kompanie. Sie ergänzen die Rechte aus Ämtern und ersetzen sie nicht.
          </AlertDescription>
        </Alert>

        {isLoading ? (
          <Card>
            <CardContent className="py-8">
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            </CardContent>
          </Card>
        ) : !userCompany ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                Sie sind keiner Kompanie zugeordnet.
              </p>
            </CardContent>
          </Card>
        ) : companyMembers.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                {userCompany.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="py-8 text-center">
              <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                Keine weiteren Mitglieder in dieser Kompanie.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                {userCompany.name}
              </CardTitle>
              <CardDescription>
                {companyMembers.length} Mitglieder
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[200px]">Mitglied</TableHead>
                      {permissions.map((perm) => (
                        <TableHead key={perm.id} className="text-center min-w-[120px]">
                          <div className="text-xs leading-tight">
                            {getPermissionLabel(perm.key)}
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {companyMembers.map((cm) => (
                      <TableRow key={cm.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-medium">
                              {cm.first_name[0]}{cm.last_name[0]}
                            </div>
                            <div>
                              <div className="font-medium">
                                {cm.first_name} {cm.last_name}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {cm.email}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        {permissions.map((perm) => {
                          const toggleKey = `${cm.id}-${perm.key}`;
                          const delegation = getDelegation(cm.id, perm.key);
                          const isToggling = togglingState[toggleKey];

                          return (
                            <TableCell key={perm.id} className="text-center">
                              <div className="flex flex-col items-center gap-1">
                                <Checkbox
                                  checked={hasDelegation(cm.id, perm.key)}
                                  onCheckedChange={() => toggleDelegation(cm.id, perm.key)}
                                  disabled={isToggling}
                                />
                                {delegation && (
                                  <div className="text-[10px] text-muted-foreground leading-tight">
                                    {delegation.granted_by_name && (
                                      <div>von {delegation.granted_by_name}</div>
                                    )}
                                    <div>{new Date(delegation.valid_from).toLocaleDateString("de-DE")}</div>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PortalLayout>
  );
};

export default Delegations;