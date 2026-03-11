import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { supabase, getStorageUrl } from "@/integrations/supabase/client";
import { toast } from "sonner";
import PortalLayout from "@/components/portal/PortalLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import {
  Users,
  Building2,
  Loader2,
  X,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Share2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PhotoUploadDialog } from "@/components/portal/PhotoUploadDialog";

interface SharedImage {
  id: string;
  member_id: string;
  club_id: string;
  company_id: string | null;
  title: string | null;
  description: string | null;
  image_path: string;
  visibility: "private" | "company" | "club";
  created_at: string;
  member?: {
    first_name: string;
    last_name: string;
    avatar_url: string | null;
  };
}

const SharedGallery = () => {
  const { member } = useAuth();
  const [companyImages, setCompanyImages] = useState<SharedImage[]>([]);
  const [clubImages, setClubImages] = useState<SharedImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentImages, setCurrentImages] = useState<SharedImage[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  const fetchSharedImages = useCallback(async () => {
    if (!member?.club_id) return;

    setLoading(true);
    try {
      // Fetch company-shared images (where visibility is 'company' and user is member of that company)
      const { data: companyData, error: companyError } = await supabase
        .from("member_gallery_images")
        .select(`
          *,
          member:members!member_gallery_images_member_id_fkey(first_name, last_name, avatar_url)
        `)
        .eq("visibility", "company")
        .neq("member_id", member.id)
        .order("created_at", { ascending: false });

      if (companyError) throw companyError;

      // Fetch club-shared images (where visibility is 'club')
      const { data: clubData, error: clubError } = await supabase
        .from("member_gallery_images")
        .select(`
          *,
          member:members!member_gallery_images_member_id_fkey(first_name, last_name, avatar_url)
        `)
        .eq("visibility", "club")
        .eq("club_id", member.club_id)
        .neq("member_id", member.id)
        .order("created_at", { ascending: false });

      if (clubError) throw clubError;

      setCompanyImages(companyData || []);
      setClubImages(clubData || []);
    } catch (error) {
      console.error("Error fetching shared images:", error);
      toast.error("Fehler beim Laden der Bilder");
    } finally {
      setLoading(false);
    }
  }, [member?.club_id, member?.id]);

  useEffect(() => {
    fetchSharedImages();
  }, [fetchSharedImages]);

  const getImageUrl = (path: string) =>
    `${getStorageUrl("gallery-images", path) || ""}`;

  const openLightbox = (images: SharedImage[], index: number) => {
    setCurrentImages(images);
    setCurrentIndex(index);
    setLightboxOpen(true);
  };

  const navigateLightbox = (direction: "prev" | "next") => {
    if (direction === "prev") {
      setCurrentIndex((prev) =>
        prev === 0 ? currentImages.length - 1 : prev - 1
      );
    } else {
      setCurrentIndex((prev) =>
        prev === currentImages.length - 1 ? 0 : prev + 1
      );
    }
  };

  const ImageGrid = ({
    images,
    emptyMessage,
  }: {
    images: SharedImage[];
    emptyMessage: string;
  }) => {
    if (images.length === 0) {
      return (
        <Card>
          <CardContent className="py-12 text-center">
            <ImageIcon className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">{emptyMessage}</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {images.map((image, index) => (
          <Card
            key={image.id}
            className="overflow-hidden group cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => openLightbox(images, index)}
          >
            <div className="aspect-square relative">
              <img
                src={getImageUrl(image.image_path)}
                alt={image.title || "Geteiltes Bild"}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
            </div>
            <CardContent className="p-3">
              {image.title && (
                <p className="font-medium text-sm truncate mb-1">
                  {image.title}
                </p>
              )}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {image.member?.avatar_url ? (
                  <img
                    src={image.member.avatar_url}
                    alt=""
                    className="w-4 h-4 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-4 h-4 rounded-full bg-muted flex items-center justify-center">
                    <span className="text-[8px]">
                      {image.member?.first_name?.[0]}
                      {image.member?.last_name?.[0]}
                    </span>
                  </div>
                )}
                <span className="truncate">
                  {image.member?.first_name} {image.member?.last_name}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const currentImage = currentImages[currentIndex];

  return (
    <PortalLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Share2 className="w-8 h-8" />
              Geteilte Bilder
            </h1>
            <p className="text-muted-foreground mt-1">
              Bilder, die von Mitgliedern freigegeben wurden
            </p>
          </div>
          <Button onClick={() => setUploadDialogOpen(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Fotos hochladen
          </Button>
        </div>

        <PhotoUploadDialog
          open={uploadDialogOpen}
          onOpenChange={setUploadDialogOpen}
          onSuccess={fetchSharedImages}
          defaultScope="club"
        />

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <Tabs defaultValue="company" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="company" className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Kompanie
              {companyImages.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {companyImages.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="club" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Regiment
              {clubImages.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {clubImages.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="company" className="mt-6">
            <ImageGrid
              images={companyImages}
              emptyMessage="Noch keine Bilder von Kompanie-Mitgliedern freigegeben"
            />
          </TabsContent>

          <TabsContent value="club" className="mt-6">
            <ImageGrid
              images={clubImages}
              emptyMessage="Noch keine Bilder für das Regiment freigegeben"
            />
          </TabsContent>
        </Tabs>
      )}

      {/* Lightbox */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-5xl p-0 bg-black/95 border-none">
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 z-10 text-white hover:bg-white/20"
              onClick={() => setLightboxOpen(false)}
            >
              <X className="w-6 h-6" />
            </Button>

            {currentImages.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-4 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/20"
                  onClick={() => navigateLightbox("prev")}
                >
                  <ChevronLeft className="w-8 h-8" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-4 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/20"
                  onClick={() => navigateLightbox("next")}
                >
                  <ChevronRight className="w-8 h-8" />
                </Button>
              </>
            )}

            {currentImage && (
              <div className="flex flex-col items-center">
                <img
                  src={getImageUrl(currentImage.image_path)}
                  alt={currentImage.title || "Bild"}
                  className="max-h-[80vh] w-auto object-contain"
                />
                <div className="p-4 text-center text-white">
                  {currentImage.title && (
                    <h3 className="text-lg font-semibold mb-1">
                      {currentImage.title}
                    </h3>
                  )}
                  {currentImage.description && (
                    <p className="text-sm text-white/70 mb-2">
                      {currentImage.description}
                    </p>
                  )}
                  <p className="text-xs text-white/50">
                    Von {currentImage.member?.first_name}{" "}
                    {currentImage.member?.last_name}
                  </p>
                  {currentImages.length > 1 && (
                    <p className="text-xs text-white/50 mt-2">
                      {currentIndex + 1} / {currentImages.length}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </PortalLayout>
  );
};

export default SharedGallery;
