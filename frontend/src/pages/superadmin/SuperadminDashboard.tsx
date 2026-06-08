import { useQuery } from "@tanstack/react-query";
import { Building2, CheckCircle2, Users, Flag } from "lucide-react";
import { apiJson } from "@/integrations/api/client";

interface SuperadminStats {
  totalClubs: number;
  activeClubs: number;
  totalUsers: number;
  openReports: number;
}

const KpiCard = ({
  label,
  value,
  icon: Icon,
  color,
  loading,
}: {
  label: string;
  value: number | undefined;
  icon: React.ElementType;
  color: string;
  loading: boolean;
}) => (
  <div className="bg-card border rounded-xl p-5 flex items-start gap-4">
    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
      <Icon className="w-5 h-5" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm text-muted-foreground truncate">{label}</p>
      {loading ? (
        <div className="h-7 w-16 bg-muted rounded animate-pulse mt-1" />
      ) : (
        <p className="text-2xl font-bold text-foreground">{value ?? "–"}</p>
      )}
    </div>
  </div>
);

const SuperadminDashboard = () => {
  const { data: stats, isLoading } = useQuery<SuperadminStats>({
    queryKey: ["superadmin-stats"],
    queryFn: () => apiJson<SuperadminStats>("/api/superadmin/stats"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Plattformübersicht SchützenHub</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Vereine gesamt"
          value={stats?.totalClubs}
          icon={Building2}
          color="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
          loading={isLoading}
        />
        <KpiCard
          label="Aktive Vereine"
          value={stats?.activeClubs}
          icon={CheckCircle2}
          color="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
          loading={isLoading}
        />
        <KpiCard
          label="Benutzer gesamt"
          value={stats?.totalUsers}
          icon={Users}
          color="bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400"
          loading={isLoading}
        />
        <KpiCard
          label="Offene Meldungen"
          value={stats?.openReports}
          icon={Flag}
          color="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
          loading={isLoading}
        />
      </div>

      <div className="bg-muted/40 border border-dashed rounded-xl p-8 text-center text-muted-foreground text-sm">
        Weitere Widgets folgen – Vereine, aktuelle Meldungen, Paket-Übersicht.
      </div>
    </div>
  );
};

export default SuperadminDashboard;
