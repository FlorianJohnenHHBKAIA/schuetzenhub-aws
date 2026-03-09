import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import PortalLayout from "@/components/portal/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { 
  Check, 
  X, 
  Clock, 
  Award, 
  Loader2,
  User,
  Calendar,
  MessageSquare
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getIconConfig } from "./AwardTypesManagement";

interface AwardRequest {
  id: string;
  title: string;
  description: string | null;
  awarded_at: string;
  award_type: string;
  status: string;
  rejection_reason: string | null;
  created_at: string;
  award_type_id: string | null;
  member: {
    id: string;
    first_name: string;
    last_name: string;
    avatar_url: string | null;
  };
  requested_by: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
  approved_by: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
  approved_at: string | null;
  award_type_info: {
    id: string;
    name: string;
    icon: string;
  } | null;
}

export default function AwardRequests() {
  const { member, isAdmin } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const clubId = member?.club_id;

  const [activeTab, setActiveTab] = useState<"pending" | "processed">("pending");
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<AwardRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  // Fetch award requests
  const { data: requests, isLoading } = useQuery({
    queryKey: ["award-requests", clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase
        .from("member_awards")
        .select(`
          id,
          title,
          description,
          awarded_at,
          award_type,
          status,
          rejection_reason,
          created_at,
          award_type_id,
          approved_at,
          member:members!member_awards_member_id_fkey (
            id,
            first_name,
            last_name,
            avatar_url
          ),
          requested_by:members!member_awards_requested_by_member_id_fkey (
            id,
            first_name,
            last_name
          ),
          approved_by:members!member_awards_approved_by_member_id_fkey (
            id,
            first_name,
            last_name
          ),
          award_type_info:award_types!member_awards_award_type_id_fkey (
            id,
            name,
            icon
          )
        `)
        .eq("club_id", clubId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as unknown as AwardRequest[];
    },
    enabled: !!clubId && isAdmin,
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async (requestId: string) => {
      if (!member) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("member_awards")
        .update({
          status: "approved",
          approved_by_member_id: member.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", requestId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["award-requests"] });
      queryClient.invalidateQueries({ queryKey: ["all-awards"] });
      toast({ title: "Auszeichnung genehmigt" });
      setApproveDialogOpen(false);
      setSelectedRequest(null);
    },
    onError: (error) => {
      console.error("Error approving award:", error);
      toast({ title: "Fehler bei der Genehmigung", variant: "destructive" });
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ requestId, reason }: { requestId: string; reason: string }) => {
      if (!member) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("member_awards")
        .update({
          status: "rejected",
          rejection_reason: reason || null,
          approved_by_member_id: member.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", requestId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["award-requests"] });
      toast({ title: "Antrag abgelehnt" });
      setRejectDialogOpen(false);
      setSelectedRequest(null);
      setRejectionReason("");
    },
    onError: (error) => {
      console.error("Error rejecting award:", error);
      toast({ title: "Fehler bei der Ablehnung", variant: "destructive" });
    },
  });

  const pendingRequests = requests?.filter(r => r.status === "pending") || [];
  const processedRequests = requests?.filter(r => r.status !== "pending") || [];

  if (!isAdmin) {
    return (
      <PortalLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Keine Berechtigung für diese Seite.</p>
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Auszeichnungsanträge</h1>
            <p className="text-muted-foreground">
              Bearbeiten Sie Anträge auf Auszeichnungen
            </p>
          </div>
          {pendingRequests.length > 0 && (
            <Badge variant="secondary" className="self-start sm:self-auto">
              <Clock className="w-3 h-3 mr-1" />
              {pendingRequests.length} ausstehend
            </Badge>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "pending" | "processed")}>
          <TabsList>
            <TabsTrigger value="pending" className="gap-2">
              <Clock className="w-4 h-4" />
              Ausstehend
              {pendingRequests.length > 0 && (
                <Badge variant="secondary" className="ml-1">{pendingRequests.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="processed" className="gap-2">
              <Check className="w-4 h-4" />
              Bearbeitet
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-6">
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
              </div>
            ) : pendingRequests.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Check className="h-12 w-12 mx-auto text-green-500 mb-4" />
                  <p className="text-muted-foreground">
                    Keine ausstehenden Anträge
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {pendingRequests.map(request => (
                  <RequestCard
                    key={request.id}
                    request={request}
                    onApprove={() => {
                      setSelectedRequest(request);
                      setApproveDialogOpen(true);
                    }}
                    onReject={() => {
                      setSelectedRequest(request);
                      setRejectDialogOpen(true);
                    }}
                    onViewMember={() => navigate(`/portal/member/${request.member.id}`)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="processed" className="mt-6">
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
              </div>
            ) : processedRequests.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Award className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    Noch keine bearbeiteten Anträge
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {processedRequests.map(request => (
                  <RequestCard
                    key={request.id}
                    request={request}
                    showStatus
                    onViewMember={() => navigate(`/portal/member/${request.member.id}`)}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Approve Dialog */}
      <AlertDialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Auszeichnung genehmigen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie die Auszeichnung "{selectedRequest?.title}" für{" "}
              {selectedRequest?.member.first_name} {selectedRequest?.member.last_name} genehmigen?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedRequest && approveMutation.mutate(selectedRequest.id)}
              className="bg-green-600 hover:bg-green-700"
            >
              {approveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Genehmigen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Antrag ablehnen</DialogTitle>
            <DialogDescription>
              Geben Sie optional einen Grund für die Ablehnung an.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Ablehnungsgrund (optional)</Label>
              <Textarea
                id="reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="z.B. Nicht die erforderlichen Voraussetzungen erfüllt..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedRequest && rejectMutation.mutate({ 
                requestId: selectedRequest.id, 
                reason: rejectionReason 
              })}
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Ablehnen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}

function RequestCard({ 
  request, 
  showStatus = false,
  onApprove, 
  onReject,
  onViewMember 
}: { 
  request: AwardRequest;
  showStatus?: boolean;
  onApprove?: () => void;
  onReject?: () => void;
  onViewMember: () => void;
}) {
  const iconConfig = request.award_type_info 
    ? getIconConfig(request.award_type_info.icon)
    : getIconConfig(request.award_type);
  const Icon = iconConfig.icon;

  const statusConfig = {
    pending: { label: "Ausstehend", variant: "secondary" as const, icon: Clock },
    approved: { label: "Genehmigt", variant: "default" as const, icon: Check },
    rejected: { label: "Abgelehnt", variant: "destructive" as const, icon: X },
  };

  const status = statusConfig[request.status as keyof typeof statusConfig] || statusConfig.pending;
  const StatusIcon = status.icon;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start gap-4">
          <div className={cn("p-3 rounded-full shrink-0", iconConfig.bgColor)}>
            <Icon className={cn("w-5 h-5", iconConfig.color)} />
          </div>
          
          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold">{request.title}</h3>
                {request.award_type_info && (
                  <p className="text-sm text-muted-foreground">
                    Typ: {request.award_type_info.name}
                  </p>
                )}
                {request.description && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {request.description}
                  </p>
                )}
              </div>
              {showStatus && (
                <Badge variant={status.variant} className="shrink-0">
                  <StatusIcon className="w-3 h-3 mr-1" />
                  {status.label}
                </Badge>
              )}
            </div>

            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <button 
                onClick={onViewMember}
                className="flex items-center gap-2 hover:text-foreground transition-colors"
              >
                <Avatar className="h-5 w-5">
                  <AvatarImage src={request.member.avatar_url || undefined} />
                  <AvatarFallback className="text-xs">
                    {request.member.first_name[0]}{request.member.last_name[0]}
                  </AvatarFallback>
                </Avatar>
                {request.member.first_name} {request.member.last_name}
              </button>
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {format(new Date(request.awarded_at), "dd.MM.yyyy", { locale: de })}
              </div>
              {request.requested_by && (
                <div className="flex items-center gap-1">
                  <User className="w-4 h-4" />
                  Beantragt von: {request.requested_by.first_name} {request.requested_by.last_name}
                </div>
              )}
            </div>

            {request.rejection_reason && request.status === "rejected" && (
              <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
                <MessageSquare className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{request.rejection_reason}</span>
              </div>
            )}

            {request.approved_by && request.status !== "pending" && (
              <p className="text-xs text-muted-foreground">
                {request.status === "approved" ? "Genehmigt" : "Abgelehnt"} von{" "}
                {request.approved_by.first_name} {request.approved_by.last_name}
                {request.approved_at && (
                  <> am {format(new Date(request.approved_at), "dd.MM.yyyy 'um' HH:mm", { locale: de })}</>
                )}
              </p>
            )}
          </div>

          {request.status === "pending" && onApprove && onReject && (
            <div className="flex gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                className="text-green-600 hover:text-green-700 hover:bg-green-50"
                onClick={onApprove}
              >
                <Check className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={onReject}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
