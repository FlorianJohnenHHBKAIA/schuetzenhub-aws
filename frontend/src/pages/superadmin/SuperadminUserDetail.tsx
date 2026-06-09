import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { motion } from "framer-motion";
import {
  ArrowLeft, Loader2, AlertCircle, RefreshCw,
  Users, UserCheck, Shield, Building2, ShieldAlert,
} from "lucide-react";
import { apiJson } from "@/integrations/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Membership {
  member_id: string;
  first_name: string;
  last_name: string;
  member_email: string;
  status: 'active' | 'passive' | 'prospect' | 'resigned';
  member_since: string | null;
  member_created_at: string;
  club_id: string;
  club_name: string;
  club_slug: string;
  system_role: 'admin' | 'member' | null;
  company_name: string | null;
  role_names: string | null;
  appointment_titles: string | null;
}

interface UserDetail {
  id: string;
  email: string;
  is_superadmin: boolean;
  created_at: string;
  memberships: Membership[];
}

const STATUS_LABELS: Record<Membership['status'], string> = {
  active:   "Aktiv",
  passive:  "Passiv",
  prospect: "Anfrage",
  resigned: "Ausgetreten",
};

const STATUS_STYLES: Record<Membership['status'], string> = {
  active:   "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  passive:  "bg-muted text-muted-foreground",
  prospect: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  resigned: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const MemberStatusBadge = ({ status }: { status: Membership['status'] }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[status]}`}>
    {STATUS_LABELS[status]}
  </span>
);

const KpiCard = ({
  label, value, icon: Icon, color,
}: {
  label: string; value: number; icon: React.ElementType; color: string;
}) => (
  <div className="bg-card border rounded-xl p-4 flex items-start gap-3">
    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
      <Icon className="w-4 h-4" />
    </div>
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-bold text-foreground">{value}</p>
    </div>
  </div>
);

const SuperadminUserDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: user, isLoading, isError, refetch } = useQuery<UserDetail>({
    queryKey: ["superadmin-user", id],
    queryFn: () => apiJson<UserDetail>(`/api/superadmin/users/${id}`),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate("/superadmin/users")}>
          <ArrowLeft className="w-4 h-4 mr-2" />Alle Benutzer
        </Button>
        <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Benutzerdaten konnten nicht geladen werden.</span>
          <Button variant="ghost" size="sm" onClick={() => refetch()} className="ml-auto text-destructive hover:text-destructive">
            <RefreshCw className="w-3.5 h-3.5 mr-1" />Erneut versuchen
          </Button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate("/superadmin/users")}>
          <ArrowLeft className="w-4 h-4 mr-2" />Alle Benutzer
        </Button>
        <div className="text-center py-12 text-muted-foreground">
          <Users className="w-10 h-10 opacity-30 mx-auto mb-3" />
          <p>Benutzer nicht gefunden.</p>
          <Button variant="outline" onClick={() => navigate("/superadmin/users")} className="mt-4">
            Zurück zur Liste
          </Button>
        </div>
      </div>
    );
  }

  const activeCount = user.memberships.filter((m) => m.status === "active").length;
  const adminCount  = user.memberships.filter((m) => m.system_role === "admin").length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      {/* Zurück */}
      <Button variant="ghost" onClick={() => navigate("/superadmin/users")} className="-ml-2">
        <ArrowLeft className="w-4 h-4 mr-2" />Alle Benutzer
      </Button>

      {/* Header */}
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-foreground break-all">{user.email}</h1>
          {user.is_superadmin && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-destructive/10 text-destructive">
              <ShieldAlert className="w-3.5 h-3.5" />
              Superadmin
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Konto angelegt am {format(new Date(user.created_at), "dd.MM.yyyy", { locale: de })}
        </p>
      </div>

      {/* KPI-Karten */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard
          label="Vereinszuordnungen"
          value={user.memberships.length}
          icon={Building2}
          color="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
        />
        <KpiCard
          label="Aktive Mitgliedschaften"
          value={activeCount}
          icon={UserCheck}
          color="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
        />
        <KpiCard
          label="Admin-Rollen"
          value={adminCount}
          icon={Shield}
          color="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
        />
      </div>

      {/* Vereinszuordnungen */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Vereinszuordnungen
            <span className="ml-auto text-sm font-normal text-muted-foreground">
              {user.memberships.length}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {user.memberships.length === 0 ? (
            <div className="px-4 py-10 text-center text-muted-foreground">
              <Users className="w-8 h-8 opacity-30 mx-auto mb-2" />
              <p className="text-sm">
                {user.is_superadmin
                  ? "Superadmins sind keinem Verein direkt zugeordnet."
                  : "Keine Vereinszuordnungen vorhanden."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">Verein</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">Mitglied als</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">Status</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">Kompanie</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">Rollen & Ämter</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">Mitglied seit</th>
                  </tr>
                </thead>
                <tbody>
                  {user.memberships.map((m) => {
                    const joinedDate = m.member_since ?? m.member_created_at;
                    const rolesAndAmts = [m.role_names, m.appointment_titles].filter(Boolean).join(" · ");
                    return (
                      <tr
                        key={m.member_id}
                        className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                      >
                        {/* Verein */}
                        <td className="px-4 py-3">
                          <p className="font-medium text-foreground">{m.club_name}</p>
                          <p className="text-xs text-muted-foreground">{m.club_slug}</p>
                        </td>

                        {/* Mitglied als */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <span className="text-foreground whitespace-nowrap">
                              {m.first_name} {m.last_name}
                            </span>
                            {m.system_role === "admin" && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                Admin
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          <MemberStatusBadge status={m.status} />
                        </td>

                        {/* Kompanie */}
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                          {m.company_name ?? <span className="opacity-40">–</span>}
                        </td>

                        {/* Rollen & Ämter */}
                        <td className="px-4 py-3 text-muted-foreground max-w-[200px]">
                          {rolesAndAmts
                            ? <span className="truncate block" title={rolesAndAmts}>{rolesAndAmts}</span>
                            : <span className="opacity-40">–</span>}
                        </td>

                        {/* Mitglied seit */}
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                          {format(new Date(joinedDate), "dd.MM.yyyy", { locale: de })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default SuperadminUserDetail;
