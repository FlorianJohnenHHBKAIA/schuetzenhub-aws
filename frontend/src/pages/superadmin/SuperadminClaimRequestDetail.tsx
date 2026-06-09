import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { ArrowLeft, CheckCircle2, XCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { apiJson } from "@/integrations/api/client";

interface ClaimRequestDetail {
  id: string;
  club_id: string;
  club_name: string;
  club_slug: string;
  club_claim_status: string;
  firstname: string;
  lastname: string;
  position: string | null;
  email: string;
  phone: string | null;
  message: string | null;
  status: "open" | "approved" | "rejected";
  created_at: string;
  reviewed_at: string | null;
  reviewed_by_email: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  open: "Offen",
  approved: "Genehmigt",
  rejected: "Abgelehnt",
  unclaimed: "Nicht beansprucht",
  requested: "Anfrage vorhanden",
  claimed: "Übernommen",
};

const STATUS_COLOR: Record<string, string> = {
  open: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  approved: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  rejected: "bg-muted text-muted-foreground",
};

const StatusBadge = ({ status }: { status: string }) => (
  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium ${STATUS_COLOR[status] ?? "bg-muted text-muted-foreground"}`}>
    {STATUS_LABEL[status] ?? status}
  </span>
);

const LabelValue = ({ label, value }: { label: string; value?: string | null }) => (
  <div>
    <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
    <p className="text-sm text-foreground">{value || "–"}</p>
  </div>
);

const SuperadminClaimRequestDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [invitationCreated, setInvitationCreated] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: claim, isLoading, refetch } = useQuery<ClaimRequestDetail>({
    queryKey: ["superadmin-claim-request", id],
    queryFn: () => apiJson<ClaimRequestDetail>(`/api/superadmin/claim-requests/${id}`),
    enabled: !!id,
  });

  const approveMutation = useMutation({
    mutationFn: () => apiJson<{ ok: boolean; invitationCreated: boolean }>(
      `/api/superadmin/claim-requests/${id}/approve`,
      { method: "POST" }
    ),
    onSuccess: (data) => {
      setInvitationCreated(data.invitationCreated);
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ["superadmin-claim-requests"] });
      queryClient.invalidateQueries({ queryKey: ["superadmin-stats"] });
      refetch();
    },
    onError: (err: Error) => setActionError(err.message || "Fehler beim Genehmigen."),
  });

  const rejectMutation = useMutation({
    mutationFn: () => apiJson<{ ok: boolean }>(
      `/api/superadmin/claim-requests/${id}/reject`,
      { method: "POST" }
    ),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ["superadmin-claim-requests"] });
      queryClient.invalidateQueries({ queryKey: ["superadmin-stats"] });
      refetch();
    },
    onError: (err: Error) => setActionError(err.message || "Fehler beim Ablehnen."),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="grid lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            {[1, 2].map((i) => (
              <div key={i} className="bg-card border rounded-xl p-5 space-y-3">
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j} className="h-4 bg-muted rounded animate-pulse" style={{ width: `${50 + j * 10}%` }} />
                ))}
              </div>
            ))}
          </div>
          <div className="bg-card border rounded-xl p-5 h-48 animate-pulse bg-muted/20" />
        </div>
      </div>
    );
  }

  if (!claim) {
    return (
      <div className="text-center py-16 text-muted-foreground">Anfrage nicht gefunden.</div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Back + Header */}
      <div>
        <button
          onClick={() => navigate("/superadmin/claim-requests")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Zurück zu Übernahmeanfragen
        </button>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-foreground">
            Anfrage: {claim.firstname} {claim.lastname}
          </h1>
          <StatusBadge status={claim.status} />
        </div>
        <p className="text-muted-foreground text-sm mt-0.5">
          Eingereicht am {format(new Date(claim.created_at), "dd. MMMM yyyy", { locale: de })}
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">

        {/* Left */}
        <div className="lg:col-span-2 space-y-5">

          {/* Verein */}
          <div className="bg-card border rounded-xl p-5 space-y-4">
            <h2 className="font-semibold text-foreground text-sm">Verein</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Vereinsname</p>
                <Link
                  to={`/superadmin/clubs/${claim.club_id}`}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  {claim.club_name}
                </Link>
              </div>
              <LabelValue label="Slug" value={claim.club_slug} />
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Übernahmestatus</p>
                <span className="text-sm text-foreground">
                  {STATUS_LABEL[claim.club_claim_status] ?? claim.club_claim_status}
                </span>
              </div>
            </div>
          </div>

          {/* Antragsteller */}
          <div className="bg-card border rounded-xl p-5 space-y-4">
            <h2 className="font-semibold text-foreground text-sm">Antragsteller</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <LabelValue label="Vorname" value={claim.firstname} />
              <LabelValue label="Nachname" value={claim.lastname} />
              <LabelValue label="Funktion im Verein" value={claim.position} />
              <LabelValue label="E-Mail" value={claim.email} />
              <LabelValue label="Telefon" value={claim.phone} />
            </div>
            {claim.message && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Nachricht</p>
                <p className="text-sm text-foreground bg-muted/40 rounded-lg p-3 whitespace-pre-wrap">{claim.message}</p>
              </div>
            )}
          </div>
        </div>

        {/* Right – Bearbeitung */}
        <div className="space-y-4">
          <div className="bg-card border rounded-xl p-5 space-y-4">
            <h2 className="font-semibold text-foreground text-sm">Bearbeitung</h2>

            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Aktueller Status</p>
              <StatusBadge status={claim.status} />
            </div>

            {claim.status === "open" && (
              <div className="space-y-2.5">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      className="w-full"
                      disabled={approveMutation.isPending || rejectMutation.isPending}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Anfrage genehmigen
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Anfrage genehmigen?</AlertDialogTitle>
                      <AlertDialogDescription>
                        {claim.firstname} {claim.lastname} ({claim.email}) wird als Administrator für{" "}
                        <strong>{claim.club_name}</strong> eingetragen. Falls noch kein Konto existiert,
                        wird eine Einladung erstellt.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                      <AlertDialogAction onClick={() => approveMutation.mutate()}>
                        Genehmigen
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full text-destructive hover:text-destructive"
                      disabled={approveMutation.isPending || rejectMutation.isPending}
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Anfrage ablehnen
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Anfrage ablehnen?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Die Anfrage von {claim.firstname} {claim.lastname} wird abgelehnt.
                        Der Verein wird wieder als „nicht beansprucht" markiert.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => rejectMutation.mutate()}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Ablehnen
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}

            {claim.status !== "open" && claim.reviewed_at && (
              <div className="text-sm space-y-1">
                <p className="text-muted-foreground">
                  Bearbeitet am{" "}
                  <span className="text-foreground">
                    {format(new Date(claim.reviewed_at), "dd.MM.yyyy", { locale: de })}
                  </span>
                </p>
                {claim.reviewed_by_email && (
                  <p className="text-muted-foreground">
                    von <span className="text-foreground">{claim.reviewed_by_email}</span>
                  </p>
                )}
              </div>
            )}

            {actionError && (
              <p className="text-sm text-destructive">{actionError}</p>
            )}
          </div>

          {invitationCreated && (
            <div className="bg-blue-50 border border-blue-200 dark:bg-blue-900/20 dark:border-blue-700 rounded-xl p-4 flex gap-3">
              <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">Einladung erstellt</p>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
                  Der Antragsteller hat noch kein SchützenHub-Konto. Eine Einladung wurde angelegt
                  und muss manuell weitergeleitet werden.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default SuperadminClaimRequestDetail;
