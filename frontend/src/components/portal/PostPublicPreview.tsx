import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Megaphone, Share2, Image as ImageIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ShareButtons } from "@/components/ui/share-buttons";

interface PostPublicPreviewProps {
  title: string;
  content: string;
  category: string;
  coverImageUrl?: string | null;
  postId?: string;
  clubSlug?: string;
  createdAt?: string;
}

const categoryLabels: Record<string, string> = {
  announcement: "Ankündigung",
  info: "Information",
  event: "Veranstaltung",
  warning: "Wichtig",
  other: "Sonstiges",
};

const PostPublicPreview = ({
  title,
  content,
  category,
  coverImageUrl,
  postId,
  clubSlug,
  createdAt,
}: PostPublicPreviewProps) => {
  const shareUrl = postId && clubSlug ? `/verein/${clubSlug}/beitrag/${postId}` : "";
  const shareDescription = content?.trim() 
    ? content.substring(0, 100) + (content.length > 100 ? "..." : "")
    : "";

  if (!title.trim()) {
    return (
      <div className="rounded-xl bg-muted/50 p-6 text-center">
        <Megaphone className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">
          Füllen Sie die Felder aus, um eine Vorschau zu sehen
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden">
      {/* Label */}
      <div className="bg-forest-dark px-4 py-2 flex items-center gap-2">
        <Megaphone className="w-4 h-4 text-gold" />
        <span className="text-xs text-gold font-medium tracking-wide uppercase">
          Vorschau: Öffentliche Homepage
        </span>
      </div>
      
      {/* Post Card Preview - mimics PublicClubProfile style */}
      <div className="bg-forest-dark/95 p-4 sm:p-6">
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden hover:border-gold/30 transition-all duration-300">
          {/* Cover Image Preview */}
          {coverImageUrl ? (
            <div className="w-full h-32 sm:h-40 overflow-hidden">
              <img 
                src={coverImageUrl} 
                alt="Titelbild" 
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-full h-32 sm:h-40 bg-forest-medium/50 flex items-center justify-center">
              <ImageIcon className="w-12 h-12 text-cream/20" />
            </div>
          )}
          
          <div className="p-4 sm:p-6">
            {/* Category Badge */}
            <Badge className="mb-3 bg-gold/20 text-gold border-gold/30 hover:bg-gold/30 text-xs">
              {categoryLabels[category] || category}
            </Badge>
            
            {/* Title */}
            <h3 className="font-display text-lg sm:text-xl font-semibold text-cream mb-2 line-clamp-2">
              {title.trim() || "Titel des Beitrags"}
            </h3>
            
            {/* Content Preview */}
            {content.trim() && (
              <p className="text-cream/60 text-sm line-clamp-3 mb-3">
                {content.trim()}
              </p>
            )}
            
            {/* Date */}
            {createdAt && (
              <p className="text-cream/40 text-xs">
                {format(new Date(createdAt), "d. MMMM yyyy", { locale: de })}
              </p>
            )}
          </div>
          
          {/* Share Preview */}
          <div className="px-4 sm:px-6 pb-4 sm:pb-6 pt-0">
            <div className="pt-4 border-t border-white/10">
              {postId && clubSlug ? (
                <>
                  <div className="flex items-center gap-2 text-cream/60 text-sm mb-2">
                    <Share2 className="w-4 h-4" />
                    <span>Teilen-Link nach Veröffentlichung:</span>
                  </div>
                  <ShareButtons 
                    url={shareUrl} 
                    title={title.trim()} 
                    description={shareDescription}
                    variant="compact"
                    className="text-cream/80 hover:text-gold"
                  />
                </>
              ) : (
                <div className="flex items-center gap-2 text-cream/50 text-sm">
                  <Share2 className="w-4 h-4" />
                  <span>Share-Buttons werden nach dem Speichern angezeigt</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PostPublicPreview;
