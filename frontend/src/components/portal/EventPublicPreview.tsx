import { format } from "date-fns";
import { de } from "date-fns/locale";
import { MapPin, Calendar, Share2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ShareButtons } from "@/components/ui/share-buttons";

interface EventPublicPreviewProps {
  title: string;
  description: string;
  location: string;
  startAt: string;
  endAt: string;
  category: string;
  eventId?: string;
  clubSlug?: string;
}

const categoryLabels: Record<string, string> = {
  training: "Training",
  meeting: "Versammlung",
  fest: "Fest",
  work: "Arbeitsdienst",
  other: "Sonstiges",
};

const EventPublicPreview = ({
  title,
  description,
  location,
  startAt,
  endAt,
  category,
  eventId,
  clubSlug,
}: EventPublicPreviewProps) => {
  const startDate = startAt ? new Date(startAt) : null;
  const endDate = endAt ? new Date(endAt) : null;
  
  const shareUrl = eventId && clubSlug ? `/verein/${clubSlug}/termin/${eventId}` : "";
  const shareDescription = description?.trim() 
    ? description.substring(0, 100) 
    : (startDate && location 
      ? `${format(startDate, "d. MMMM yyyy", { locale: de })} in ${location}`
      : "");

  if (!startDate || !title.trim()) {
    return (
      <div className="rounded-xl bg-muted/50 p-6 text-center">
        <Calendar className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
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
        <Calendar className="w-4 h-4 text-gold" />
        <span className="text-xs text-gold font-medium tracking-wide uppercase">
          Vorschau: Öffentliche Homepage
        </span>
      </div>
      
      {/* Event Card Preview - mimics PublicClubProfile style */}
      <div className="bg-forest-dark/95 p-4 sm:p-6">
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4 sm:p-6 hover:border-gold/30 transition-all duration-300">
          <div className="flex gap-4 sm:gap-6">
            {/* Date Box */}
            <div className="flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 bg-gold/20 rounded-xl flex flex-col items-center justify-center">
              <span className="text-xs sm:text-sm text-gold font-medium uppercase">
                {format(startDate, "MMM", { locale: de })}
              </span>
              <span className="text-2xl sm:text-3xl font-bold text-cream">
                {format(startDate, "d")}
              </span>
            </div>

            {/* Content */}
            <div className="flex-grow min-w-0">
              <h3 className="font-display text-lg sm:text-xl font-semibold text-cream mb-2 line-clamp-2">
                {title.trim() || "Titel des Termins"}
              </h3>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-cream/60 mb-2">
                <span className="text-xs sm:text-sm font-medium">
                  {format(startDate, "HH:mm", { locale: de })} Uhr
                  {endDate && ` – ${format(endDate, "HH:mm", { locale: de })} Uhr`}
                </span>
                {location.trim() && (
                  <>
                    <span className="hidden sm:inline">•</span>
                    <span className="flex items-center gap-1 text-xs sm:text-sm">
                      <MapPin className="w-3 h-3 sm:w-4 sm:h-4" />
                      {location.trim()}
                    </span>
                  </>
                )}
              </div>
              {description.trim() && (
                <p className="text-cream/50 text-xs sm:text-sm line-clamp-2">
                  {description.trim()}
                </p>
              )}
              <Badge className="mt-3 bg-gold/20 text-gold border-gold/30 hover:bg-gold/30 text-xs">
                {categoryLabels[category] || category}
              </Badge>
            </div>
          </div>
          
          {/* Share Preview */}
          <div className="mt-4 pt-4 border-t border-white/10">
            {eventId && clubSlug ? (
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
  );
};

export default EventPublicPreview;
