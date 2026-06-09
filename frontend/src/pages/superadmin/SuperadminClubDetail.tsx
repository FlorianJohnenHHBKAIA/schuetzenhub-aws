import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { motion } from "framer-motion";
import {
  ArrowLeft, Loader2, AlertCircle, RefreshCw,
  Users, UserCheck, Shield, CalendarDays,
  Building2, Save, Upload, Trash2,
  ExternalLink, Package, StickyNote, ImageIcon,
  FileText, Calendar, Archive, ArchiveRestore, AlertTriangle,
} from "lucide-react";
import { apiJson, apiUpload, getStorageUrl } from "@/integrations/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ── Interfaces ───────────────────────────────────────────────────────────────

interface ClubDetail {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  city: string | null;
  location_city: string | null;
  location_zip: string | null;
  description: string | null;
  founded_year: number | null;
  website: string | null;
  website_url: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  logo_path: string | null;
  hero_image_path: string | null;
  plan: string;
  plan_started_at: string | null;
  custom_domain: string | null;
  domain_status: string | null;
  created_at: string;
  updated_at: string;
  // Migration A
  club_number: string | null;
  street: string | null;
  house_number: string | null;
  state: string | null;
  country: string | null;
  sales_status: string;
  deleted_at: string | null;
  // Migration B
  acquisition_source: string | null;
  acquisition_owner: string | null;
  last_contact_at: string | null;
  next_contact_at: string | null;
  is_public: boolean;
  is_internal: boolean;
  claim_status: string;
  // Archive (Migration C)
  archived_at: string | null;
  archived_by: string | null;
  archive_reason: string | null;
  // Aggregates
  member_stats: { total: number; active: number; passive: number; prospect: number; resigned: number };
  admin_count: number;
  companies: { id: string; name: string }[];
  events_published: number;
  posts_published: number;
  active_appointments: { title: string; member_name: string }[];
  recent_events: { id: string; title: string; start_at: string; publication_status: string }[];
  recent_posts: { id: string; title: string; created_at: string; publication_status: string }[];
}

interface MemberRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  status: "active" | "passive" | "prospect" | "resigned";
  member_since: string | null;
  created_at: string;
  system_role: "admin" | "member" | null;
  company_name: string | null;
  role_names: string | null;
  appointment_titles: string | null;
}

interface ClubNote {
  id: string;
  note: string;
  created_at: string;
  created_by_email: string;
}

interface StammdatenForm {
  name: string; slug: string; club_number: string;
  street: string; house_number: string;
  location_zip: string; location_city: string;
  state: string; country: string;
}

interface KontaktForm {
  contact_email: string; contact_phone: string; website_url: string;
}

interface VereinsInfoForm {
  founded_year: string; description: string;
}

interface AkquiseForm {
  sales_status: string; acquisition_source: string;
  acquisition_owner: string; last_contact_at: string; next_contact_at: string;
}

// ── Konstanten ───────────────────────────────────────────────────────────────

const SALES_STATUS_OPTIONS = [
  { value: "recherchiert",     label: "Recherchiert",     color: "bg-muted text-muted-foreground" },
  { value: "kontaktiert",      label: "Kontaktiert",      color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  { value: "interessiert",     label: "Interessiert",     color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400" },
  { value: "demo_vereinbart",  label: "Demo vereinbart",  color: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400" },
  { value: "registriert",      label: "Registriert",      color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  { value: "aktiv",            label: "Aktiv",            color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  { value: "abgelehnt",        label: "Abgelehnt",        color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  { value: "nicht_erreichbar", label: "Nicht erreichbar", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
];

const CLAIM_STATUS_OPTIONS = [
  { value: "unclaimed",  label: "Nicht beansprucht" },
  { value: "requested",  label: "Anfrage eingegangen" },
  { value: "claimed",    label: "Übernommen" },
];

const PLAN_OPTIONS = [
  { value: "free",       label: "Kostenlos" },
  { value: "starter",    label: "Starter" },
  { value: "premium",    label: "Premium" },
  { value: "enterprise", label: "Enterprise" },
];

const MEMBER_STATUS_LABELS: Record<string, string> = {
  all: "Alle", active: "Aktiv", passive: "Passiv", prospect: "Anfragen", resigned: "Ausgetreten",
};

// ── Hilfskomponenten ──────────────────────────────────────────────────────────

const KpiCard = ({ label, value, icon: Icon, color }: {
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

const SalesBadge = ({ status }: { status: string }) => {
  const opt = SALES_STATUS_OPTIONS.find((o) => o.value === status) ?? SALES_STATUS_OPTIONS[0];
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${opt.color}`}>
      {opt.label}
    </span>
  );
};

const PlanBadge = ({ plan }: { plan: string }) => (
  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
    plan !== "free"
      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
      : "bg-muted text-muted-foreground"
  }`}>
    {plan !== "free" ? `Aktiv · ${plan}` : "Kostenlos"}
  </span>
);

const MemberStatusBadge = ({ status }: { status: MemberRow["status"] }) => {
  const styles: Record<MemberRow["status"], string> = {
    active:   "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    passive:  "bg-muted text-muted-foreground",
    prospect: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    resigned: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
      {MEMBER_STATUS_LABELS[status] ?? status}
    </span>
  );
};

const StatusChip = ({ status }: { status: string }) => (
  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
    status === "published"
      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
      : "bg-muted text-muted-foreground"
  }`}>
    {status === "published" ? "Veröffentlicht" : "Entwurf"}
  </span>
);

const SectionCard = ({ title, icon: Icon, children }: {
  title: string; icon: React.ElementType; children: React.ReactNode;
}) => (
  <Card>
    <CardHeader className="pb-3">
      <CardTitle className="text-base flex items-center gap-2">
        <Icon className="w-4 h-4 text-muted-foreground" />
        {title}
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-3">
      {children}
    </CardContent>
  </Card>
);

const FormRow = ({ children }: { children: React.ReactNode }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
);

const FormField = ({ label, error, children }: {
  label: string; error?: string | null; children: React.ReactNode;
}) => (
  <div className="space-y-1">
    <label className="text-xs text-muted-foreground font-medium">{label}</label>
    {children}
    {error && <p className="text-xs text-destructive">{error}</p>}
  </div>
);

const SaveButton = ({ isPending, dirty, onClick }: {
  isPending: boolean; dirty: boolean; onClick: () => void;
}) => (
  <Button size="sm" disabled={!dirty || isPending} onClick={onClick} className="mt-1">
    {isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
    Änderungen speichern
  </Button>
);

const SectionError = ({ msg }: { msg: string | null }) => {
  if (!msg) return null;
  return (
    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-destructive/10 text-destructive text-xs mt-2">
      <AlertCircle className="w-3.5 h-3.5 shrink-0" />{msg}
    </div>
  );
};

const SidebarCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="bg-card border rounded-xl overflow-hidden">
    <div className="px-4 py-3 border-b border-border bg-muted/30">
      <p className="text-sm font-semibold text-foreground">{title}</p>
    </div>
    <div className="px-4 py-3 space-y-3">{children}</div>
  </div>
);

const UploadArea = ({ label, imagePath, isUploading, onFile }: {
  label: string; imagePath: string | null; isUploading: boolean;
  onFile: (file: File) => void;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const imageUrl = getStorageUrl("club-assets", imagePath);

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground font-medium">{label}</p>
      <div className="flex items-center gap-3">
        <div className="relative w-20 h-14 rounded-lg border border-border bg-muted flex items-center justify-center overflow-hidden shrink-0">
          {isUploading ? (
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          ) : imageUrl ? (
            <img src={imageUrl} alt={label} className="w-full h-full object-cover" />
          ) : (
            <ImageIcon className="w-5 h-5 text-muted-foreground/40" />
          )}
        </div>
        <div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onFile(file);
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={isUploading}
          >
            <Upload className="w-3.5 h-3.5 mr-1.5" />
            Bild hochladen
          </Button>
          {imagePath && (
            <p className="text-[10px] text-muted-foreground mt-1 font-mono truncate max-w-[160px]">
              {imagePath.split("/").pop()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Hauptkomponente ───────────────────────────────────────────────────────────

const SuperadminClubDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // ── Form State ──────────────────────────────────────────────────────────────
  const [stammdaten, setStammdaten] = useState<StammdatenForm>({
    name: "", slug: "", club_number: "", street: "", house_number: "",
    location_zip: "", location_city: "", state: "", country: "",
  });
  const [kontakt, setKontakt] = useState<KontaktForm>({
    contact_email: "", contact_phone: "", website_url: "",
  });
  const [vereinsInfo, setVereinsInfo] = useState<VereinsInfoForm>({
    founded_year: "", description: "",
  });
  const [akquise, setAkquise] = useState<AkquiseForm>({
    sales_status: "recherchiert", acquisition_source: "",
    acquisition_owner: "", last_contact_at: "", next_contact_at: "",
  });

  // ── Section errors ──────────────────────────────────────────────────────────
  const [stammdatenError, setStammdatenError] = useState<string | null>(null);
  const [kontaktError, setKontaktError] = useState<string | null>(null);
  const [vereinsInfoError, setVereinsInfoError] = useState<string | null>(null);
  const [akquiseError, setAkquiseError] = useState<string | null>(null);

  // ── Member list state ───────────────────────────────────────────────────────
  const [memberSearch, setMemberSearch] = useState("");
  const [memberStatusFilter, setMemberStatusFilter] = useState("all");

  // ── Plan management state ───────────────────────────────────────────────────
  const [selectedPlan, setSelectedPlan] = useState<string>("");
  const [showPlanConfirm, setShowPlanConfirm] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);

  // ── Notes state ─────────────────────────────────────────────────────────────
  const [newNote, setNewNote] = useState("");

  // Archive state
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [showUnarchiveDialog, setShowUnarchiveDialog] = useState(false);
  const [archiveReason, setArchiveReason] = useState("");

  // ── Track which section is saving ───────────────────────────────────────────
  const savingSectionRef = useRef<string | null>(null);

  // ── Queries ─────────────────────────────────────────────────────────────────
  const { data: club, isLoading, isError, refetch } = useQuery<ClubDetail>({
    queryKey: ["superadmin-club", id],
    queryFn: () => apiJson<ClubDetail>(`/api/superadmin/clubs/${id}`),
    enabled: !!id,
  });

  const { data: members = [], isLoading: membersLoading, isError: membersError } =
    useQuery<MemberRow[]>({
      queryKey: ["superadmin-club-members", id],
      queryFn: () => apiJson<MemberRow[]>(`/api/superadmin/clubs/${id}/members`),
      enabled: !!id,
    });

  const { data: notes = [], isLoading: notesLoading } =
    useQuery<ClubNote[]>({
      queryKey: ["superadmin-club-notes", id],
      queryFn: () => apiJson<ClubNote[]>(`/api/superadmin/clubs/${id}/notes`),
      enabled: !!id,
    });

  // ── Initialize form state when club loads ───────────────────────────────────
  useEffect(() => {
    if (!club) return;
    setStammdaten({
      name: club.name ?? "",
      slug: club.slug ?? "",
      club_number: club.club_number ?? "",
      street: club.street ?? "",
      house_number: club.house_number ?? "",
      location_zip: club.location_zip ?? "",
      location_city: club.location_city ?? "",
      state: club.state ?? "",
      country: club.country ?? "Deutschland",
    });
    setKontakt({
      contact_email: club.contact_email ?? "",
      contact_phone: club.contact_phone ?? "",
      website_url: club.website_url ?? "",
    });
    setVereinsInfo({
      founded_year: club.founded_year != null ? String(club.founded_year) : "",
      description: club.description ?? "",
    });
    setAkquise({
      sales_status: club.sales_status ?? "recherchiert",
      acquisition_source: club.acquisition_source ?? "",
      acquisition_owner: club.acquisition_owner ?? "",
      last_contact_at: club.last_contact_at ? club.last_contact_at.substring(0, 10) : "",
      next_contact_at: club.next_contact_at ? club.next_contact_at.substring(0, 10) : "",
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [club?.id]);

  // ── Dirty checks ────────────────────────────────────────────────────────────
  const isDirtyStammdaten = club != null && (
    stammdaten.name !== (club.name ?? "") ||
    stammdaten.slug !== (club.slug ?? "") ||
    stammdaten.club_number !== (club.club_number ?? "") ||
    stammdaten.street !== (club.street ?? "") ||
    stammdaten.house_number !== (club.house_number ?? "") ||
    stammdaten.location_zip !== (club.location_zip ?? "") ||
    stammdaten.location_city !== (club.location_city ?? "") ||
    stammdaten.state !== (club.state ?? "") ||
    stammdaten.country !== (club.country ?? "Deutschland")
  );

  const isDirtyKontakt = club != null && (
    kontakt.contact_email !== (club.contact_email ?? "") ||
    kontakt.contact_phone !== (club.contact_phone ?? "") ||
    kontakt.website_url !== (club.website_url ?? "")
  );

  const isDirtyVereinsInfo = club != null && (
    vereinsInfo.founded_year !== (club.founded_year != null ? String(club.founded_year) : "") ||
    vereinsInfo.description !== (club.description ?? "")
  );

  const isDirtyAkquise = club != null && (
    akquise.sales_status !== (club.sales_status ?? "recherchiert") ||
    akquise.acquisition_source !== (club.acquisition_source ?? "") ||
    akquise.acquisition_owner !== (club.acquisition_owner ?? "") ||
    akquise.last_contact_at !== (club.last_contact_at ? club.last_contact_at.substring(0, 10) : "") ||
    akquise.next_contact_at !== (club.next_contact_at ? club.next_contact_at.substring(0, 10) : "")
  );

  // ── Mutations ───────────────────────────────────────────────────────────────
  const patchClub = useMutation({
    mutationFn: (fields: Record<string, unknown>) =>
      apiJson<ClubDetail>(`/api/superadmin/clubs/${id}`, {
        method: "PATCH",
        body: JSON.stringify(fields),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["superadmin-club", id] });
      queryClient.invalidateQueries({ queryKey: ["superadmin-clubs"] });
      setStammdatenError(null);
      setKontaktError(null);
      setVereinsInfoError(null);
      setAkquiseError(null);
    },
    onError: (err: Error) => {
      const is409 = err.message.includes("Slug") || err.message.includes("409");
      const msg = is409 ? err.message : "Speichern fehlgeschlagen. Bitte erneut versuchen.";
      const section = savingSectionRef.current;
      if (section === "stammdaten") setStammdatenError(is409 ? err.message : msg);
      else if (section === "kontakt") setKontaktError(msg);
      else if (section === "vereinsInfo") setVereinsInfoError(msg);
      else if (section === "akquise") setAkquiseError(msg);
    },
  });

  const patchLogo = useMutation({
    mutationFn: (file: File) => apiUpload(`/api/superadmin/clubs/${id}/logo`, file, {}, "PATCH"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["superadmin-club", id] }),
  });

  const patchHero = useMutation({
    mutationFn: (file: File) => apiUpload(`/api/superadmin/clubs/${id}/hero`, file, {}, "PATCH"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["superadmin-club", id] }),
  });

  const createNote = useMutation({
    mutationFn: () =>
      apiJson(`/api/superadmin/clubs/${id}/notes`, {
        method: "POST",
        body: JSON.stringify({ note: newNote }),
      }),
    onSuccess: () => {
      setNewNote("");
      queryClient.invalidateQueries({ queryKey: ["superadmin-club-notes", id] });
    },
  });

  const deleteNote = useMutation({
    mutationFn: (noteId: string) =>
      apiJson(`/api/superadmin/clubs/${id}/notes/${noteId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["superadmin-club-notes", id] }),
  });

  const planMutation = useMutation({
    mutationFn: (newPlan: string) =>
      apiJson(`/api/superadmin/clubs/${id}/plan`, {
        method: "PATCH",
        body: JSON.stringify({ plan: newPlan }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["superadmin-club", id] });
      queryClient.invalidateQueries({ queryKey: ["superadmin-packages"] });
      queryClient.invalidateQueries({ queryKey: ["superadmin-stats"] });
      setSelectedPlan("");
      setShowPlanConfirm(false);
      setPlanError(null);
    },
    onError: () => {
      setShowPlanConfirm(false);
      setPlanError("Plan konnte nicht gespeichert werden.");
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (reason: string) =>
      apiJson(`/api/superadmin/clubs/${id}/archive`, {
        method: "PATCH",
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["superadmin-club", id] });
      queryClient.invalidateQueries({ queryKey: ["superadmin-clubs"] });
      setShowArchiveDialog(false);
      setArchiveReason("");
    },
  });

  const unarchiveMutation = useMutation({
    mutationFn: () =>
      apiJson(`/api/superadmin/clubs/${id}/unarchive`, { method: "PATCH" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["superadmin-club", id] });
      queryClient.invalidateQueries({ queryKey: ["superadmin-clubs"] });
      setShowUnarchiveDialog(false);
    },
  });

  // ── Section save handlers ───────────────────────────────────────────────────
  function saveStammdaten() {
    savingSectionRef.current = "stammdaten";
    setStammdatenError(null);
    patchClub.mutate({ ...stammdaten });
  }

  function saveKontakt() {
    savingSectionRef.current = "kontakt";
    setKontaktError(null);
    patchClub.mutate({ ...kontakt });
  }

  function saveVereinsInfo() {
    savingSectionRef.current = "vereinsInfo";
    setVereinsInfoError(null);
    patchClub.mutate({
      founded_year: vereinsInfo.founded_year || null,
      description: vereinsInfo.description || null,
    });
  }

  function saveAkquise() {
    savingSectionRef.current = "akquise";
    setAkquiseError(null);
    patchClub.mutate({ ...akquise });
  }

  function autoSave(fields: Record<string, unknown>) {
    savingSectionRef.current = "auto";
    patchClub.mutate(fields);
  }

  // ── Loading / Error states ───────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !club) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate("/superadmin/clubs")} className="-ml-2">
          <ArrowLeft className="w-4 h-4 mr-2" />Alle Vereine
        </Button>
        {isError ? (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Vereinsdaten konnten nicht geladen werden.</span>
            <Button variant="ghost" size="sm" onClick={() => refetch()} className="ml-auto text-destructive hover:text-destructive">
              <RefreshCw className="w-3.5 h-3.5 mr-1" />Erneut versuchen
            </Button>
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Building2 className="w-10 h-10 opacity-30 mx-auto mb-3" />
            <p>Verein nicht gefunden.</p>
            <Button variant="outline" onClick={() => navigate("/superadmin/clubs")} className="mt-4">Zurück</Button>
          </div>
        )}
      </div>
    );
  }

  const activePlan = selectedPlan || club.plan;
  const planChanged = selectedPlan !== "" && selectedPlan !== club.plan;
  const filteredMembers = members.filter((m) => {
    const q = memberSearch.toLowerCase();
    return (
      (`${m.first_name} ${m.last_name}`.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)) &&
      (memberStatusFilter === "all" || m.status === memberStatusFilter)
    );
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-5"
    >
      {/* Back */}
      <Button variant="ghost" onClick={() => navigate("/superadmin/clubs")} className="-ml-2">
        <ArrowLeft className="w-4 h-4 mr-2" />Alle Vereine
      </Button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground">{club.name}</h1>
            <SalesBadge status={club.sales_status} />
          </div>
          <p className="text-xs text-muted-foreground">
            Angelegt {format(new Date(club.created_at), "dd.MM.yyyy", { locale: de })}
            {" · "}Zuletzt geändert {format(new Date(club.updated_at), "dd.MM.yyyy HH:mm", { locale: de })}
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Mitglieder gesamt" value={club.member_stats.total} icon={Users}
          color="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" />
        <KpiCard label="Aktive Mitglieder" value={club.member_stats.active} icon={UserCheck}
          color="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" />
        <KpiCard label="Admins" value={club.admin_count} icon={Shield}
          color="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" />
        <KpiCard label="Events publiziert" value={club.events_published} icon={CalendarDays}
          color="bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400" />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── LEFT COLUMN ──────────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-5">

          {/* 1. Stammdaten */}
          <SectionCard title="Stammdaten" icon={Building2}>
            <FormRow>
              <FormField label="Vereinsname *">
                <Input value={stammdaten.name}
                  onChange={(e) => setStammdaten((p) => ({ ...p, name: e.target.value }))} />
              </FormField>
              <FormField label="Vereinsnummer">
                <Input value={stammdaten.club_number}
                  onChange={(e) => setStammdaten((p) => ({ ...p, club_number: e.target.value }))} />
              </FormField>
            </FormRow>
            <FormRow>
              <FormField label="Straße">
                <Input value={stammdaten.street}
                  onChange={(e) => setStammdaten((p) => ({ ...p, street: e.target.value }))} />
              </FormField>
              <FormField label="Hausnummer">
                <Input value={stammdaten.house_number}
                  onChange={(e) => setStammdaten((p) => ({ ...p, house_number: e.target.value }))} />
              </FormField>
            </FormRow>
            <FormRow>
              <FormField label="PLZ">
                <Input value={stammdaten.location_zip}
                  onChange={(e) => setStammdaten((p) => ({ ...p, location_zip: e.target.value }))} />
              </FormField>
              <FormField label="Ort">
                <Input value={stammdaten.location_city}
                  onChange={(e) => setStammdaten((p) => ({ ...p, location_city: e.target.value }))} />
              </FormField>
            </FormRow>
            <FormRow>
              <FormField label="Bundesland">
                <Input value={stammdaten.state}
                  onChange={(e) => setStammdaten((p) => ({ ...p, state: e.target.value }))} />
              </FormField>
              <FormField label="Land">
                <Input value={stammdaten.country}
                  onChange={(e) => setStammdaten((p) => ({ ...p, country: e.target.value }))} />
              </FormField>
            </FormRow>
            <FormField label="Slug (URL-Pfad)" error={stammdatenError?.includes("Slug") ? stammdatenError : null}>
              <Input
                value={stammdaten.slug}
                onChange={(e) => { setStammdaten((p) => ({ ...p, slug: e.target.value })); setStammdatenError(null); }}
                className={stammdatenError?.includes("Slug") ? "border-destructive" : ""}
              />
            </FormField>
            <SectionError msg={stammdatenError?.includes("Slug") ? null : stammdatenError} />
            <SaveButton isPending={patchClub.isPending && savingSectionRef.current === "stammdaten"}
              dirty={isDirtyStammdaten} onClick={saveStammdaten} />
          </SectionCard>

          {/* 2. Kontaktinformationen */}
          <SectionCard title="Kontaktinformationen" icon={FileText}>
            <FormRow>
              <FormField label="E-Mail">
                <Input type="email" value={kontakt.contact_email}
                  onChange={(e) => setKontakt((p) => ({ ...p, contact_email: e.target.value }))} />
              </FormField>
              <FormField label="Telefon">
                <Input value={kontakt.contact_phone}
                  onChange={(e) => setKontakt((p) => ({ ...p, contact_phone: e.target.value }))} />
              </FormField>
            </FormRow>
            <FormField label="Website">
              <Input value={kontakt.website_url}
                onChange={(e) => setKontakt((p) => ({ ...p, website_url: e.target.value }))}
                placeholder="https://www.verein.de" />
            </FormField>
            <SectionError msg={kontaktError} />
            <SaveButton isPending={patchClub.isPending && savingSectionRef.current === "kontakt"}
              dirty={isDirtyKontakt} onClick={saveKontakt} />
          </SectionCard>

          {/* 3. Vereinsinformationen */}
          <SectionCard title="Vereinsinformationen" icon={Calendar}>
            <FormField label="Gründungsjahr">
              <Input
                type="number"
                value={vereinsInfo.founded_year}
                onChange={(e) => setVereinsInfo((p) => ({ ...p, founded_year: e.target.value }))}
                min={1800} max={new Date().getFullYear()}
                placeholder="z.B. 1872"
              />
            </FormField>
            <FormField label="Kurzbeschreibung">
              <textarea
                value={vereinsInfo.description}
                onChange={(e) => setVereinsInfo((p) => ({ ...p, description: e.target.value }))}
                rows={4}
                placeholder="Kurze Beschreibung des Vereins …"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </FormField>
            <SectionError msg={vereinsInfoError} />
            <SaveButton isPending={patchClub.isPending && savingSectionRef.current === "vereinsInfo"}
              dirty={isDirtyVereinsInfo} onClick={saveVereinsInfo} />
            <div className="border-t border-border pt-3 space-y-4">
              <UploadArea
                label="Vereinslogo / Wappen"
                imagePath={club.logo_path}
                isUploading={patchLogo.isPending}
                onFile={(file) => patchLogo.mutate(file)}
              />
              <UploadArea
                label="Titelbild (Hero)"
                imagePath={club.hero_image_path}
                isUploading={patchHero.isPending}
                onFile={(file) => patchHero.mutate(file)}
              />
            </div>
          </SectionCard>

          {/* 4. Akquise */}
          <SectionCard title="Akquise" icon={Shield}>
            <FormField label="Sales-Status">
              <select
                value={akquise.sales_status}
                onChange={(e) => setAkquise((p) => ({ ...p, sales_status: e.target.value }))}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {SALES_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </FormField>
            <FormRow>
              <FormField label="Quelle">
                <Input value={akquise.acquisition_source}
                  onChange={(e) => setAkquise((p) => ({ ...p, acquisition_source: e.target.value }))}
                  placeholder="z.B. Empfehlung, Messe …" />
              </FormField>
              <FormField label="Zuständiger Mitarbeiter">
                <Input value={akquise.acquisition_owner}
                  onChange={(e) => setAkquise((p) => ({ ...p, acquisition_owner: e.target.value }))}
                  placeholder="Name des Bearbeiters" />
              </FormField>
            </FormRow>
            <FormRow>
              <FormField label="Letzter Kontakt">
                <Input type="date" value={akquise.last_contact_at}
                  onChange={(e) => setAkquise((p) => ({ ...p, last_contact_at: e.target.value }))} />
              </FormField>
              <FormField label="Nächster Kontakt">
                <Input type="date" value={akquise.next_contact_at}
                  onChange={(e) => setAkquise((p) => ({ ...p, next_contact_at: e.target.value }))} />
              </FormField>
            </FormRow>
            <SectionError msg={akquiseError} />
            <SaveButton isPending={patchClub.isPending && savingSectionRef.current === "akquise"}
              dirty={isDirtyAkquise} onClick={saveAkquise} />
          </SectionCard>

          {/* 5. Notizen */}
          <SectionCard title="Notizen" icon={StickyNote}>
            {/* New note input */}
            <div className="space-y-2">
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                rows={3}
                placeholder="Neue Notiz eingeben …"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
              <Button
                size="sm"
                disabled={!newNote.trim() || createNote.isPending}
                onClick={() => createNote.mutate()}
              >
                {createNote.isPending
                  ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  : <StickyNote className="w-3.5 h-3.5 mr-1.5" />}
                Notiz hinzufügen
              </Button>
            </div>

            {/* Notes list */}
            <div className="space-y-2 pt-1">
              {notesLoading && (
                <div className="space-y-2">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
                  ))}
                </div>
              )}
              {!notesLoading && notes.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Noch keine Notizen vorhanden.</p>
              )}
              {notes.map((note) => (
                <div key={note.id} className="bg-muted/40 rounded-lg px-3 py-2.5 flex items-start gap-2 group">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground whitespace-pre-wrap break-words">{note.note}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {note.created_by_email} · {format(new Date(note.created_at), "dd.MM.yyyy HH:mm", { locale: de })}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteNote.mutate(note.id)}
                    disabled={deleteNote.isPending}
                    className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                    title="Notiz löschen"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* 6. Mitgliederliste */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <span className="flex items-center gap-2">
                    <Users className="w-4 h-4" />Mitglieder
                    {!membersLoading && (
                      <span className="text-sm font-normal text-muted-foreground">({members.length})</span>
                    )}
                  </span>
                  <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
                    <div className="relative">
                      <Input
                        placeholder="Name oder E-Mail …"
                        value={memberSearch}
                        onChange={(e) => setMemberSearch(e.target.value)}
                        className="h-8 text-sm w-44 pl-3"
                      />
                    </div>
                    {(["all", "active", "passive", "prospect", "resigned"] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => setMemberStatusFilter(s)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                          memberStatusFilter === s
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        {MEMBER_STATUS_LABELS[s]}
                      </button>
                    ))}
                  </div>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {membersError && (
                <div className="flex items-center gap-3 mx-4 mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Mitglieder konnten nicht geladen werden.</span>
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">Name</th>
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">E-Mail</th>
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">Status</th>
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">Kompanie</th>
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">Rollen & Ämter</th>
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">Beigetreten</th>
                    </tr>
                  </thead>
                  <tbody>
                    {membersLoading &&
                      Array.from({ length: 4 }).map((_, i) => (
                        <tr key={i} className="border-b border-border">
                          {Array.from({ length: 6 }).map((_, j) => (
                            <td key={j} className="px-4 py-3">
                              <div className="h-4 bg-muted rounded animate-pulse" style={{ width: `${50 + (j % 4) * 15}%` }} />
                            </td>
                          ))}
                        </tr>
                      ))}
                    {!membersLoading && !membersError && filteredMembers.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                          <Users className="w-8 h-8 opacity-30 mx-auto mb-2" />
                          {memberSearch || memberStatusFilter !== "all" ? "Keine Mitglieder gefunden." : "Keine Mitglieder vorhanden."}
                        </td>
                      </tr>
                    )}
                    {!membersLoading &&
                      filteredMembers.map((m) => {
                        const joinedDate = m.member_since ?? m.created_at;
                        const rolesAndAmts = [m.role_names, m.appointment_titles].filter(Boolean).join(" · ");
                        return (
                          <tr key={m.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5">
                                <span className="font-medium text-foreground whitespace-nowrap">
                                  {m.last_name}, {m.first_name}
                                </span>
                                {m.system_role === "admin" && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                    Admin
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">{m.email}</td>
                            <td className="px-4 py-3"><MemberStatusBadge status={m.status} /></td>
                            <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                              {m.company_name ?? <span className="opacity-40">–</span>}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground max-w-[200px]">
                              {rolesAndAmts
                                ? <span className="truncate block" title={rolesAndAmts}>{rolesAndAmts}</span>
                                : <span className="opacity-40">–</span>}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                              {format(new Date(joinedDate), "dd.MM.yyyy", { locale: de })}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
              {!membersLoading && filteredMembers.length < members.length && (
                <p className="px-4 py-2.5 text-xs text-muted-foreground border-t border-border">
                  Zeige {filteredMembers.length} von {members.length} Mitgliedern
                </p>
              )}
            </CardContent>
          </Card>

        </div>

        {/* ── RIGHT SIDEBAR ─────────────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Vereinsstatus */}
          <SidebarCard title="Vereinsstatus">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Sales-Status</span>
              <SalesBadge status={club.sales_status} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Paket</span>
              <PlanBadge plan={club.plan} />
            </div>
            <p className="text-xs text-muted-foreground pt-1 border-t border-border">
              Status wird über Akquise-Sektion geändert.
            </p>
          </SidebarCard>

          {/* Sichtbarkeit */}
          <SidebarCard title="Sichtbarkeit">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">Öffentlich sichtbar</p>
                <p className="text-xs text-muted-foreground">Sichtbar für alle Besucher</p>
              </div>
              <Switch
                checked={club.is_public}
                onCheckedChange={(checked) => autoSave({ is_public: checked })}
                disabled={patchClub.isPending && savingSectionRef.current === "auto"}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">Intern sichtbar</p>
                <p className="text-xs text-muted-foreground">Nur für Mitglieder</p>
              </div>
              <Switch
                checked={club.is_internal}
                onCheckedChange={(checked) => autoSave({ is_internal: checked })}
                disabled={patchClub.isPending && savingSectionRef.current === "auto"}
              />
            </div>
          </SidebarCard>

          {/* Übernahmestatus */}
          <SidebarCard title="Vereinsübernahme">
            <select
              value={club.claim_status}
              onChange={(e) => autoSave({ claim_status: e.target.value })}
              disabled={patchClub.isPending && savingSectionRef.current === "auto"}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {CLAIM_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {patchClub.isPending && savingSectionRef.current === "auto" && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />Wird gespeichert …
              </p>
            )}
          </SidebarCard>

          {/* Paket verwalten */}
          <SidebarCard title="Paket verwalten">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Aktueller Plan</span>
              <PlanBadge plan={club.plan} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-2">Plan ändern</p>
              <div className="flex flex-wrap gap-1.5">
                {PLAN_OPTIONS.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setSelectedPlan(value === club.plan ? "" : value)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      activePlan === value
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {planError && (
              <p className="text-xs text-destructive flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />{planError}
              </p>
            )}
            <Button
              size="sm"
              disabled={!planChanged || planMutation.isPending}
              onClick={() => setShowPlanConfirm(true)}
              className="w-full"
            >
              {planMutation.isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              Plan speichern
            </Button>
            <p className="text-xs text-muted-foreground">Keine Auswirkung auf Portalzugang.</p>
          </SidebarCard>

          {/* Archivierung */}
          <SidebarCard title="Archivierung">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Status</span>
              {club.archived_at ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/15 text-red-400 border border-red-500/30">
                  <Archive className="w-3 h-3" /> Archiviert
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/15 text-green-400 border border-green-500/30">
                  Aktiv
                </span>
              )}
            </div>
            {club.archived_at && (
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>Archiviert am: {format(new Date(club.archived_at), "dd.MM.yyyy", { locale: de })}</p>
                {club.archive_reason && (
                  <p className="italic">„{club.archive_reason}"</p>
                )}
              </div>
            )}
            {club.archived_at ? (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setShowUnarchiveDialog(true)}
              >
                <ArchiveRestore className="w-3.5 h-3.5 mr-1.5" />
                Archivierung aufheben
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="w-full text-destructive hover:text-destructive border-destructive/30 hover:border-destructive/60"
                onClick={() => setShowArchiveDialog(true)}
              >
                <Archive className="w-3.5 h-3.5 mr-1.5" />
                Verein archivieren
              </Button>
            )}
            <p className="text-xs text-muted-foreground">Kein Datenverlust. Aktion ist umkehrbar.</p>
          </SidebarCard>

          {/* Öffentliche Seite */}
          <SidebarCard title="Öffentliche Vereinsseite">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => window.open(`/vereine/${club.slug}`, "_blank")}
            >
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
              Öffentliche Seite öffnen
            </Button>
            <p className="text-xs text-muted-foreground font-mono truncate">/vereine/{club.slug}</p>
          </SidebarCard>

        </div>
      </div>

      {/* Plan-Bestätigungs-Dialog */}
      <AlertDialog open={showPlanConfirm} onOpenChange={setShowPlanConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Plan ändern?</AlertDialogTitle>
            <AlertDialogDescription>
              Der Plan für <strong>{club.name}</strong> wird von{" "}
              <strong>{club.plan}</strong> auf <strong>{selectedPlan}</strong> geändert.
              Dies hat keinen Einfluss auf den Portalzugang der Mitglieder.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={() => planMutation.mutate(selectedPlan)}>
              Ja, Plan ändern
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Archive-Dialog */}
      <AlertDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Verein archivieren?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-700 dark:text-amber-300 text-sm">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p>Der Verein wird als archiviert markiert. Bestehende Mitglieder behalten weiterhin Zugriff auf das Portal. Daten werden nicht gelöscht.</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Grund (optional)</label>
                  <textarea
                    value={archiveReason}
                    onChange={(e) => setArchiveReason(e.target.value)}
                    rows={3}
                    placeholder="Begründung für die Archivierung…"
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => archiveMutation.mutate(archiveReason)}
              disabled={archiveMutation.isPending}
            >
              {archiveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Archivieren"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unarchive-Dialog */}
      <AlertDialog open={showUnarchiveDialog} onOpenChange={setShowUnarchiveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archivierung aufheben?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie die Archivierung aufheben? Der Verein wird wieder als aktiv geführt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => unarchiveMutation.mutate()}
              disabled={unarchiveMutation.isPending}
            >
              {unarchiveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Aufheben"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </motion.div>
  );
};

export default SuperadminClubDetail;
