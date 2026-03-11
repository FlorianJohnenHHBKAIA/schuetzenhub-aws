import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import {
  Image as ImageIcon,
  Filter,
  Check,
  X,
  Globe,
  Book,
  Archive,
  Loader2,
  Building2,
  Calendar,
  User,
} from "lucide-react";
import { supabase, getStorageUrl } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import PortalLayout from "@/components/portal/PortalLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

type PhotoStatus = "pending" | "approved" | "rejected" | "archived";
type UsagePermission = "internal" | "homepage" | "magazine" | "all";

interface GalleryImage {
  id: string;
  image_path: string;
  description: string | null;
  visibility: string;
  usage_permission: UsagePermission;
  status: PhotoStatus;
  created_at: string;
  rejection_reason: string | null;
  member_id: string;
  company_id: string | null;
  member: {
    first_name: string;
    last_name: string;
  };
  company: {
    name: string;
  } | null;
}

const STATUS_CONFIG: Record<PhotoStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Ausstehend", variant: "secondary" },
  approved: { label: "Freigegeben", variant: "default" },
  rejected: { label: "Abgelehnt", variant: "destructive" },
  archived: { label: "Archiviert", variant: "outline" },
};

const USAGE_LABELS: Record<UsagePermission, string> = {
  internal: "Intern",
  homepage: "Homepage",
  magazine: "Schützenheft",
  all: "Alle Nutzungen",
};

export default function PhotoManagement() {
  const { member } = useAuth();
  const queryClient = useQueryClient();
  
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [usageFilter, setUsageFilter] = useState<string>("all");
  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  // Fetch companies for filter
  const { data: companies } = useQuery({
    queryKey: ["companies", member?.club_id],
    queryFn: async () => {
      if (!member?.club_id) return [];
      const { data } = await supabase
        .from("companies")
        .select("id, name")
        .eq("club_id", member.club_id)
        .order("name");
      return data || [];
    },
    enabled: !!member?.club_id,
  });

  // Fetch images with filters
  const { data: images, isLoading } = useQuery({
    queryKey: ["admin-gallery-images", member?.club_id, statusFilter, companyFilter, usageFilter],
    queryFn: async () => {
      if (!member?.club_id) return [];

      let query = supabase
        .from("member_gallery_images")
        .select(`
          *,
          member:members!member_gallery_images_member_id_fkey(first_name, last_name),
          company:companies!member_gallery_images_company_id_fkey(name)
        `)
        .eq("club_id", member.club_id)
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter as PhotoStatus);
      }

      if (companyFilter !== "all") {
        query = query.eq("company_id", companyFilter);
      }

      if (usageFilter !== "all") {
        if (usageFilter === "homepage") {
          query = query.in("usage_permission", ["homepage", "all"] as UsagePermission[]);
        } else if (usageFilter === "magazine") {
          query = query.in("usage_permission", ["magazine", "all"] as UsagePermission[]);
        } else {
          query = query.eq("usage_permission", usageFilter as UsagePermission);
        }
      }

      const { data, error } = await query.limit(100);
      if (error) throw error;
      return data as GalleryImage[];
    },
    enabled: !!member?.club_id,
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ 
      imageId, 
      status, 
      reason 
    }: { 
      imageId: string; 
      status: PhotoStatus; 
      reason?: string;
    }) => {
      const { error } = await supabase
        .from("member_gallery_images")
        .update({
          status,
          rejection_reason: reason || null,
          reviewed_by_member_id: member?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", imageId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-gallery-images"] });
      toast({ title: "Status aktualisiert" });
      setSelectedImage(null);
      setShowRejectDialog(false);
      setRejectionReason("");
    },
    onError: () => {
      toast({ title: "Fehler", description: "Status konnte nicht aktualisiert werden.", variant: "destructive" });
    },
  });

  const getImageUrl = (path: string) => getStorageUrl("gallery-images", path) || "";

  const handleApprove = (image: GalleryImage) => {
    updateStatusMutation.mutate({ imageId: image.id, status: "approved" });
  };

  const handleReject = () => {
    if (selectedImage) {
      updateStatusMutation.mutate({ 
        imageId: selectedImage.id, 
        status: "rejected", 
        reason: rejectionReason 
      });
    }
  };

  const handleArchive = (image: GalleryImage) => {
    updateStatusMutation.mutate({ imageId: image.id, status: "archived" });
  };

  const pendingCount = images?.filter(i => i.status === "pending").length || 0;

  return (
    <PortalLayout>
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ImageIcon className="w-6 h-6" />
          Foto-Verwaltung
        </h1>
        <p className="text-muted-foreground mt-1">
          Hochgeladene Fotos prüfen und für Veröffentlichung freigeben
        </p>
      </div>

      {/* Pending Banner */}
      {pendingCount > 0 && statusFilter !== "pending" && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex items-center justify-between">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            <strong>{pendingCount}</strong> Foto{pendingCount !== 1 ? "s" : ""} warten auf Freigabe
          </p>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setStatusFilter("pending")}
          >
            Anzeigen
          </Button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Filter className="w-4 h-4 text-muted-foreground" />
        
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            <SelectItem value="pending">Ausstehend</SelectItem>
            <SelectItem value="approved">Freigegeben</SelectItem>
            <SelectItem value="rejected">Abgelehnt</SelectItem>
            <SelectItem value="archived">Archiviert</SelectItem>
          </SelectContent>
        </Select>

        <Select value={companyFilter} onValueChange={setCompanyFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Kompanie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Kompanien</SelectItem>
            {companies?.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={usageFilter} onValueChange={setUsageFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Nutzung" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Nutzungen</SelectItem>
            <SelectItem value="internal">Nur intern</SelectItem>
            <SelectItem value="homepage">Für Homepage</SelectItem>
            <SelectItem value="magazine">Für Schützenheft</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Image Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-lg" />
          ))}
        </div>
      ) : images?.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <ImageIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Keine Fotos mit diesen Filtern gefunden</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {images?.map((image) => (
            <div
              key={image.id}
              className="group relative aspect-square rounded-lg overflow-hidden bg-muted cursor-pointer"
              onClick={() => setSelectedImage(image)}
            >
              <img
                src={getImageUrl(image.image_path)}
                alt={image.description || "Foto"}
                className="w-full h-full object-cover transition-transform group-hover:scale-105"
                loading="lazy"
              />
              
              {/* Status Badge */}
              <div className="absolute top-2 left-2">
                <Badge variant={STATUS_CONFIG[image.status].variant} className="text-xs">
                  {STATUS_CONFIG[image.status].label}
                </Badge>
              </div>

              {/* Usage Icons */}
              <div className="absolute top-2 right-2 flex gap-1">
                {(image.usage_permission === "homepage" || image.usage_permission === "all") && (
                  <div className="bg-background/80 backdrop-blur rounded p-1">
                    <Globe className="w-3 h-3" />
                  </div>
                )}
                {(image.usage_permission === "magazine" || image.usage_permission === "all") && (
                  <div className="bg-background/80 backdrop-blur rounded p-1">
                    <Book className="w-3 h-3" />
                  </div>
                )}
              </div>

              {/* Hover Actions */}
              {image.status === "pending" && (
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleApprove(image);
                    }}
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="bg-red-600 hover:bg-red-700 text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedImage(image);
                      setShowRejectDialog(true);
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Image Detail Dialog */}
      <Dialog open={!!selectedImage && !showRejectDialog} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Foto-Details</DialogTitle>
          </DialogHeader>
          
          {selectedImage && (
            <div className="space-y-4">
              <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
                <img
                  src={getImageUrl(selectedImage.image_path)}
                  alt={selectedImage.description || "Foto"}
                  className="w-full h-full object-contain"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <User className="w-4 h-4" />
                    <span>
                      {selectedImage.member.first_name} {selectedImage.member.last_name}
                    </span>
                  </div>
                  {selectedImage.company && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Building2 className="w-4 h-4" />
                      <span>{selectedImage.company.name}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    <span>{format(new Date(selectedImage.created_at), "dd.MM.yyyy HH:mm", { locale: de })}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Status:</span>
                    <Badge variant={STATUS_CONFIG[selectedImage.status].variant}>
                      {STATUS_CONFIG[selectedImage.status].label}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Nutzung:</span>
                    <span>{USAGE_LABELS[selectedImage.usage_permission]}</span>
                  </div>
                </div>
              </div>

              {selectedImage.description && (
                <div>
                  <span className="text-sm text-muted-foreground">Beschreibung:</span>
                  <p className="mt-1">{selectedImage.description}</p>
                </div>
              )}

              {selectedImage.rejection_reason && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                  <span className="text-sm font-medium text-destructive">Ablehnungsgrund:</span>
                  <p className="mt-1 text-sm">{selectedImage.rejection_reason}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                {selectedImage.status === "pending" && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setShowRejectDialog(true)}
                    >
                      <X className="w-4 h-4 mr-2" />
                      Ablehnen
                    </Button>
                    <Button
                      onClick={() => handleApprove(selectedImage)}
                      disabled={updateStatusMutation.isPending}
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Freigeben
                    </Button>
                  </>
                )}
                {selectedImage.status === "approved" && (
                  <Button
                    variant="outline"
                    onClick={() => handleArchive(selectedImage)}
                  >
                    <Archive className="w-4 h-4 mr-2" />
                    Archivieren
                  </Button>
                )}
                {selectedImage.status === "rejected" && (
                  <Button
                    onClick={() => handleApprove(selectedImage)}
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Doch freigeben
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Foto ablehnen</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Grund (optional)</Label>
              <Textarea
                id="reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="z.B. Unscharf, unpassendes Motiv..."
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowRejectDialog(false);
                  setRejectionReason("");
                }}
              >
                Abbrechen
              </Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={updateStatusMutation.isPending}
              >
                {updateStatusMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <X className="w-4 h-4 mr-2" />
                )}
                Ablehnen
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </PortalLayout>
  );
}
