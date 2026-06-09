import { useQuery } from "@tanstack/react-query";
import {
  Settings2, LayoutGrid, Mail, Shield, HardDrive, Plug,
  AlertCircle, RefreshCw,
} from "lucide-react";
import { apiJson } from "@/integrations/api/client";
import { Button } from "@/components/ui/button";

interface PlatformInfo {
  env: string;
  nodeVersion: string;
  port: number;
  frontendUrl: string | null;
  uptimeSeconds: number;
}

interface ModulesInfo {
  events: number;
  posts: number;
  gallery: number;
  documents: number;
  awards: number;
  magazines: number;
  companies: number;
}

interface StorageInfo {
  provider: "local" | "s3";
  uploadDir: string | null;
  maxFileSizeMb: number;
  s3Bucket: string | null;
  s3Region: string | null;
}

interface EmailInfo {
  configured: boolean;
  provider: string | null;
}

interface SettingsData {
  platform: PlatformInfo;
  modules: ModulesInfo;
  storage: StorageInfo;
  email: EmailInfo;
  openReports: number;
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m} Min.`;
  return `${h} Std. ${m} Min.`;
}

const StatusBadge = ({ status }: { status: "active" | "inactive" | "warning" }) => {
  const map = {
    active:   "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    inactive: "bg-muted text-muted-foreground",
    warning:  "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  };
  const labels = { active: "Aktiv", inactive: "Nicht konfiguriert", warning: "Warnung" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${map[status]}`}>
      {labels[status]}
    </span>
  );
};

const StatusDot = ({ active }: { active: boolean }) => (
  <span className={`inline-block w-2 h-2 rounded-full mr-2 shrink-0 ${active ? "bg-green-500" : "bg-muted-foreground/40"}`} />
);

const InfoRow = ({
  label,
  children,
  last = false,
}: {
  label: string;
  children: React.ReactNode;
  last?: boolean;
}) => (
  <div className={`flex items-center justify-between py-2.5 gap-4 ${last ? "" : "border-b border-border"}`}>
    <span className="text-sm text-muted-foreground shrink-0">{label}</span>
    <span className="text-sm font-medium text-foreground text-right">{children}</span>
  </div>
);

const SectionCard = ({
  title,
  icon: Icon,
  iconColor,
  children,
  loading = false,
}: {
  title: string;
  icon: React.ElementType;
  iconColor: string;
  children: React.ReactNode;
  loading?: boolean;
}) => (
  <div className="bg-card border rounded-xl overflow-hidden">
    <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-muted/30">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${iconColor}`}>
        <Icon className="w-4 h-4" />
      </div>
      <h2 className="font-semibold text-foreground text-sm">{title}</h2>
    </div>
    <div className="px-5">
      {loading ? (
        <div className="space-y-1 py-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex justify-between items-center py-2.5 border-b border-border last:border-0">
              <div className="h-4 bg-muted rounded animate-pulse w-28" />
              <div className="h-4 bg-muted rounded animate-pulse w-20" />
            </div>
          ))}
        </div>
      ) : (
        children
      )}
    </div>
  </div>
);

const SuperadminSettings = () => {
  const { data, isLoading, isError, refetch } = useQuery<SettingsData>({
    queryKey: ["superadmin-settings"],
    queryFn: () => apiJson<SettingsData>("/api/superadmin/settings"),
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Systemeinstellungen</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Plattformkonfiguration – nur lesend</p>
      </div>

      {/* Fehlerzustand */}
      {isError && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Systemdaten konnten nicht geladen werden.</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            className="ml-auto text-destructive hover:text-destructive"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            Erneut versuchen
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* 1. Plattformstatus */}
        <SectionCard
          title="Plattformstatus"
          icon={Settings2}
          iconColor="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
          loading={isLoading}
        >
          <InfoRow label="Umgebung">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
              data?.platform.env === "production"
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
            }`}>
              {data?.platform.env ?? "–"}
            </span>
          </InfoRow>
          <InfoRow label="Node.js-Version">
            <span className="font-mono text-xs">{data?.platform.nodeVersion ?? "–"}</span>
          </InfoRow>
          <InfoRow label="Server-Port">
            {data?.platform.port ?? "–"}
          </InfoRow>
          <InfoRow label="Frontend-URL">
            <span className="font-mono text-xs">{data?.platform.frontendUrl ?? <span className="opacity-40">–</span>}</span>
          </InfoRow>
          <InfoRow label="Betriebszeit" last>
            {data ? formatUptime(data.platform.uptimeSeconds) : "–"}
          </InfoRow>
        </SectionCard>

        {/* 2. Module */}
        <SectionCard
          title="Module"
          icon={LayoutGrid}
          iconColor="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
          loading={isLoading}
        >
          {([
            ["Termine",        data?.modules.events],
            ["Beiträge",       data?.modules.posts],
            ["Galerie",        data?.modules.gallery],
            ["Dokumente",      data?.modules.documents],
            ["Auszeichnungen", data?.modules.awards],
            ["Zeitschriften",  data?.modules.magazines],
            ["Kompanien",      data?.modules.companies],
          ] as [string, number | undefined][]).map(([label, value], i, arr) => (
            <InfoRow key={label} label={label} last={i === arr.length - 1}>
              <span className="tabular-nums text-muted-foreground">{value ?? "–"}</span>
            </InfoRow>
          ))}
        </SectionCard>

        {/* 3. E-Mail & Benachrichtigungen */}
        <SectionCard
          title="E-Mail & Benachrichtigungen"
          icon={Mail}
          iconColor="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
          loading={isLoading}
        >
          <InfoRow label="In-App-Benachrichtigungen">
            <StatusBadge status="active" />
          </InfoRow>
          <InfoRow label="E-Mail-Anbieter">
            <StatusBadge status="inactive" />
          </InfoRow>
          <InfoRow label="SMTP-Konfiguration" last>
            <StatusBadge status="inactive" />
          </InfoRow>
          <p className="text-xs text-muted-foreground py-3 border-t border-border">
            Kein externer E-Mail-Dienst eingerichtet. In-App-Benachrichtigungen sind aktiv.
          </p>
        </SectionCard>

        {/* 4. Datenschutz & Rechtliches */}
        <SectionCard
          title="Datenschutz & Rechtliches"
          icon={Shield}
          iconColor="bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400"
          loading={isLoading}
        >
          <InfoRow label="Offene Meldungen">
            {data !== undefined ? (
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                data.openReports > 0
                  ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                  : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
              }`}>
                {data.openReports}
              </span>
            ) : "–"}
          </InfoRow>
          <InfoRow label="Compliance-Modul">
            <StatusBadge status="active" />
          </InfoRow>
          <InfoRow label="Datenarchiv" last>
            <StatusBadge status="active" />
          </InfoRow>
          <p className="text-xs text-muted-foreground py-3 border-t border-border">
            Details zu Meldungen unter <span className="font-medium">Meldungen &amp; Compliance</span>.
          </p>
        </SectionCard>

        {/* 5. Speicher & Uploads */}
        <SectionCard
          title="Speicher & Uploads"
          icon={HardDrive}
          iconColor="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
          loading={isLoading}
        >
          <InfoRow label="Speicheranbieter">
            {data ? (
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                data.storage.provider === "s3"
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                  : "bg-muted text-muted-foreground"
              }`}>
                {data.storage.provider === "s3" ? "AWS S3" : "Lokal"}
              </span>
            ) : "–"}
          </InfoRow>
          {data?.storage.provider === "local" && (
            <InfoRow label="Speicherordner">
              <span className="font-mono text-xs">{data.storage.uploadDir ?? "uploads"}/</span>
            </InfoRow>
          )}
          {data?.storage.provider === "s3" && (
            <>
              <InfoRow label="S3-Bucket">
                <span className="font-mono text-xs">{data.storage.s3Bucket ?? "–"}</span>
              </InfoRow>
              <InfoRow label="S3-Region">
                <span className="font-mono text-xs">{data.storage.s3Region ?? "–"}</span>
              </InfoRow>
            </>
          )}
          <InfoRow label="Max. Dateigröße" last>
            {data ? `${data.storage.maxFileSizeMb} MB` : "–"}
          </InfoRow>
        </SectionCard>

        {/* 6. Integrationen */}
        <SectionCard
          title="Integrationen"
          icon={Plug}
          iconColor="bg-muted text-muted-foreground"
          loading={isLoading}
        >
          {([
            { label: "AWS S3",                  active: data?.storage.provider === "s3" },
            { label: "E-Mail-Dienst",            active: false },
            { label: "Push-Benachrichtigungen",  active: false },
          ] as { label: string; active: boolean | undefined }[]).map(({ label, active }, i, arr) => (
            <InfoRow key={label} label={label} last={i === arr.length - 1}>
              <span className={`text-xs flex items-center ${active ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
                <StatusDot active={!!active} />
                {active ? "Konfiguriert" : "Nicht konfiguriert"}
              </span>
            </InfoRow>
          ))}
        </SectionCard>

      </div>
    </div>
  );
};

export default SuperadminSettings;
