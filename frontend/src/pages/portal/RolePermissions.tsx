import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Shield, Building2, Check, Info } from "lucide-react";
import PortalLayout from "@/components/portal/PortalLayout";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Role {
  id: string;
  name: string;
  level: "club" | "company";
  is_default: boolean;
}

interface Permission {
  id: string;
  key: string;
  description: string;
}

interface RolePermission {
  role_id: string;
  permission_id: string;
}

const RolePermissions = () => {
  const { member, hasPermission } = useAuth();
  const { toast } = useToast();
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<Set<string>>(new Set());

  const canManage = hasPermission("club.roles.manage");

  useEffect(() => {
    if (member?.club_id) fetchData();
  }, [member?.club_id]);

  const fetchData = async () => {
    setIsLoading(true);

    const [rolesRes, permissionsRes, rolePermissionsRes] = await Promise.all([
      supabase.from("roles").select("*").eq("club_id", member!.club_id).order("name"),
      supabase.from("permissions").select("*").order("key"),
      supabase.from("role_permissions").select("role_id, permission_id"),
    ]);

    setRoles(rolesRes.data || []);
    setPermissions(permissionsRes.data || []);
    
    // Filter role_permissions to only include roles from this club
    const clubRoleIds = new Set((rolesRes.data || []).map((r) => r.id));
    const filteredRolePermissions = (rolePermissionsRes.data || []).filter(
      (rp) => clubRoleIds.has(rp.role_id)
    );
    setRolePermissions(filteredRolePermissions);

    setIsLoading(false);
  };

  const clubRoles = roles.filter((r) => r.level === "club");
  const companyRoles = roles.filter((r) => r.level === "company");
  const clubPermissions = permissions.filter((p) => p.key.startsWith("club."));
  const companyPermissions = permissions.filter((p) => p.key.startsWith("company."));

  // Use "::" as separator since UUIDs contain dashes
  const SEPARATOR = "::";
  const createKey = (roleId: string, permissionId: string) => `${roleId}${SEPARATOR}${permissionId}`;
  const parseKey = (key: string) => {
    const parts = key.split(SEPARATOR);
    return { roleId: parts[0], permissionId: parts[1] };
  };

  const hasRolePermission = (roleId: string, permissionId: string): boolean => {
    const key = createKey(roleId, permissionId);
    if (pendingChanges.has(key)) {
      // Pending change - invert current state
      return !rolePermissions.some(
        (rp) => rp.role_id === roleId && rp.permission_id === permissionId
      );
    }
    return rolePermissions.some(
      (rp) => rp.role_id === roleId && rp.permission_id === permissionId
    );
  };

  const togglePermission = (permissionId: string) => {
    if (!selectedRole) return;
    const key = createKey(selectedRole.id, permissionId);
    const newPending = new Set(pendingChanges);
    if (newPending.has(key)) {
      newPending.delete(key);
    } else {
      newPending.add(key);
    }
    setPendingChanges(newPending);
  };

  const saveChanges = async () => {
    if (!selectedRole || pendingChanges.size === 0) return;
    setIsSaving(true);

    try {
      for (const key of pendingChanges) {
        const { roleId, permissionId } = parseKey(key);
        
        const exists = rolePermissions.some(
          (rp) => rp.role_id === roleId && rp.permission_id === permissionId
        );

        if (exists) {
          // Remove permission
          const { error } = await supabase
            .from("role_permissions")
            .delete()
            .eq("role_id", roleId)
            .eq("permission_id", permissionId);
          if (error) throw error;
        } else {
          // Add permission
          const { error } = await supabase.from("role_permissions").insert({
            role_id: roleId,
            permission_id: permissionId,
          });
          if (error) throw error;
        }
      }

      toast({ title: "Rechte gespeichert" });
      setPendingChanges(new Set());
      fetchData();
    } catch (error: any) {
      console.error("Save error:", error);
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    }

    setIsSaving(false);
  };

  const discardChanges = () => {
    setPendingChanges(new Set());
  };

  if (!canManage) {
    return (
      <PortalLayout>
        <p className="text-center py-12 text-muted-foreground">Keine Berechtigung</p>
      </PortalLayout>
    );
  }

  const RoleList = ({ roleList }: { roleList: Role[] }) => (
    <div className="space-y-2">
      {roleList.length === 0 ? (
        <p className="text-muted-foreground text-sm">Keine Ämter definiert</p>
      ) : (
        roleList.map((role) => (
          <button
            key={role.id}
            onClick={() => {
              if (pendingChanges.size > 0) {
                toast({ title: "Bitte speichern oder verwerfen Sie zuerst die Änderungen" });
                return;
              }
              setSelectedRole(role);
            }}
            className={`w-full p-3 rounded-lg border text-left transition-colors ${
              selectedRole?.id === role.id
                ? "bg-primary/10 border-primary"
                : "bg-card hover:bg-muted/50"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">{role.name}</span>
              {role.is_default && (
                <Badge variant="secondary" className="text-xs">
                  Standard
                </Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {rolePermissions.filter((rp) => rp.role_id === role.id).length} Rechte
            </div>
          </button>
        ))
      )}
    </div>
  );

  const PermissionList = ({ permissionList, category }: { permissionList: Permission[]; category: string }) => (
    <div className="space-y-3">
      <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
        {category}
      </h4>
      {permissionList.map((permission) => {
        const isChecked = selectedRole ? hasRolePermission(selectedRole.id, permission.id) : false;
        const isPending = selectedRole ? pendingChanges.has(`${selectedRole.id}-${permission.id}`) : false;
        
        return (
          <div
            key={permission.id}
            className={`flex items-start gap-3 p-3 rounded-lg border ${
              isPending ? "bg-yellow-500/10 border-yellow-500/30" : "bg-card"
            }`}
          >
            <Checkbox
              id={permission.id}
              checked={isChecked}
              onCheckedChange={() => togglePermission(permission.id)}
              disabled={!selectedRole}
            />
            <div className="flex-1">
              <Label htmlFor={permission.id} className="font-medium cursor-pointer">
                {permission.key}
              </Label>
              <p className="text-sm text-muted-foreground">{permission.description}</p>
            </div>
            {isPending && (
              <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600">
                Geändert
              </Badge>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <PortalLayout>
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="font-display text-3xl font-bold">Rechte verwalten</h1>
          <p className="text-muted-foreground">Permissions für Ämter konfigurieren</p>
        </motion.div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Role Selection */}
            <div className="lg:col-span-1">
              <div className="bg-card rounded-xl border p-4">
                <h3 className="font-medium mb-4">Amt auswählen</h3>
                <Tabs defaultValue="club">
                  <TabsList className="w-full mb-4">
                    <TabsTrigger value="club" className="flex-1">
                      <Shield className="w-4 h-4 mr-1" />
                      Verein
                    </TabsTrigger>
                    <TabsTrigger value="company" className="flex-1">
                      <Building2 className="w-4 h-4 mr-1" />
                      Kompanie
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="club">
                    <RoleList roleList={clubRoles} />
                  </TabsContent>
                  <TabsContent value="company">
                    <RoleList roleList={companyRoles} />
                  </TabsContent>
                </Tabs>
              </div>
            </div>

            {/* Permission Configuration */}
            <div className="lg:col-span-2">
              <div className="bg-card rounded-xl border p-6">
                {selectedRole ? (
                  <>
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h3 className="font-medium text-lg">{selectedRole.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {selectedRole.level === "club" ? "Hauptverein" : "Kompanie"}-Amt
                        </p>
                      </div>
                      {pendingChanges.size > 0 && (
                        <div className="flex gap-2">
                          <Button variant="outline" onClick={discardChanges}>
                            Verwerfen
                          </Button>
                          <Button onClick={saveChanges} disabled={isSaving}>
                            {isSaving ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <Check className="w-4 h-4" />
                                Speichern ({pendingChanges.size})
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="space-y-6">
                      <PermissionList permissionList={clubPermissions} category="Vereinsrechte" />
                      
                      <Alert>
                        <Info className="w-4 h-4" />
                        <AlertDescription>
                          Kompanie-Rechte wirken nur im jeweiligen Kompanie-Kontext (ab Phase 4/5).
                        </AlertDescription>
                      </Alert>
                      
                      <PermissionList permissionList={companyPermissions} category="Kompanie-Rechte" />
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Wählen Sie ein Amt aus, um dessen Rechte zu konfigurieren</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </PortalLayout>
  );
};

export default RolePermissions;
