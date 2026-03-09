import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { apiJson, setToken, clearToken, getToken } from "@/integrations/api/client";

interface Member {
  id: string;
  club_id: string;
  user_id?: string;
  first_name: string;
  last_name: string;
  email: string;
  status: string;
  avatar_url: string | null;
}

interface UserRole {
  role: "admin" | "member";
  club_id: string;
}

interface UserPermission {
  permission_key: string;
  scope_type: "club" | "company";
  scope_id: string;
}

interface AuthContextType {
  user: { id: string; email: string } | null;
  session: { token: string } | null;
  member: Member | null;
  userRole: UserRole | null;
  permissions: UserPermission[];
  isAdmin: boolean;
  isLoading: boolean;
  hasPermission: (permissionKey: string, scopeType?: "club" | "company", scopeId?: string) => boolean;
  refreshPermissions: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [session, setSession] = useState<{ token: string } | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [permissions, setPermissions] = useState<UserPermission[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadUserData = useCallback(async () => {
    const token = getToken();
    if (!token) { setIsLoading(false); return; }

    try {
      const data = await apiJson<{ member: Member; userRole: UserRole; permissions: UserPermission[] }>("/api/auth/me");
      setMember(data.member);
      setUserRole(data.userRole);
      setPermissions(data.permissions || []);
      setUser({ id: data.member.user_id || data.member.id, email: data.member.email });
      setSession({ token });
    } catch {
      clearToken();
      setMember(null); setUserRole(null); setPermissions([]); setUser(null); setSession(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadUserData(); }, [loadUserData]);

  const refreshPermissions = async () => { await loadUserData(); };

  const hasPermission = useCallback((permissionKey: string, scopeType?: "club" | "company", scopeId?: string): boolean => {
    if (userRole?.role === "admin") return true;
    if (permissions.some(p => p.permission_key === "club.admin.full")) return true;
    if (scopeType && scopeId) {
      if (permissions.some(p => p.permission_key === permissionKey && p.scope_type === "club")) return true;
      return permissions.some(p => p.permission_key === permissionKey && p.scope_type === scopeType && p.scope_id === scopeId);
    }
    return permissions.some(p => p.permission_key === permissionKey);
  }, [permissions, userRole]);

  const signIn = async (email: string, password: string) => {
    try {
      const data = await apiJson<{ token: string }>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
      setToken(data.token);
      await loadUserData();
      return { error: null };
    } catch (err: unknown) { return { error: err as Error }; }
  };

  const signUp = async (_email: string, _password: string) => {
    return { error: new Error("Nutze die Registrierungsseite") };
  };

  const signOut = async () => {
    clearToken();
    setMember(null); setUserRole(null); setPermissions([]); setUser(null); setSession(null);
  };

  const value: AuthContextType = {
    user, session, member, userRole, permissions,
    isAdmin: userRole?.role === "admin" || permissions.some(p => p.permission_key === "club.admin.full"),
    isLoading, hasPermission, refreshPermissions, signIn, signUp, signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
