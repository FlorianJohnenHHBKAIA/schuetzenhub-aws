import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { 
  Calendar, 
  MapPin, 
  ArrowLeft, 
  Shield,
  Clock,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShareButtons } from "@/components/ui/share-buttons";
import { supabase } from "@/integrations/supabase/client";

interface EventData {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_at: string;
  end_at: string | null;
  category: string;
  club_id: string;
}

interface ClubData {
  id: string;
  name: string;
  slug: string;
  logo_path: string | null;
}

const categoryLabels: Record<string, string> = {
  training: "Training",
  meeting: "Versammlung",
  fest: "Fest/Feier",
  work: "Arbeitsdienst",
  other: "Sonstiges",
};

const PublicEventDetail = () => {
  const { slug, eventId } = useParams<{ slug: string; eventId: string }>();
  const [event, setEvent] = useState<EventData | null>(null);
  const [club, setClub] = useState<ClubData | null>(null);
  const [clubLogoUrl, setClubLogoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (slug && eventId) {
      fetchData();
    }
  }, [slug, eventId]);

  const fetchData = async () => {
    if (!slug || !eventId) return;

    try {
      // Fetch club
      const { data: clubData, error: clubError } = await supabase
        .from("clubs")
        .select("id, name, slug, logo_path")
        .eq("slug", slug)
        .single();

      if (clubError) throw clubError;
      setClub(clubData);

      if (clubData.logo_path) {
        const { data: urlData } = supabase.storage.from("club-assets").getPublicUrl(clubData.logo_path);
        setClubLogoUrl(urlData.publicUrl);
      }

      // Fetch event
      const { data: eventData, error: eventError } = await supabase
        .from("events")
        .select("id, title, description, location, start_at, end_at, category, club_id")
        .eq("id", eventId)
        .eq("club_id", clubData.id)
        .eq("audience", "public")
        .eq("publication_status", "approved")
        .single();

      if (eventError) throw eventError;
      setEvent(eventData);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-forest-dark flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold"></div>
      </div>
    );
  }

  if (!club || !event) {
    return (
      <div className="min-h-screen bg-forest-dark flex flex-col items-center justify-center">
        <Calendar className="w-16 h-16 text-gold mb-4" />
        <h1 className="text-2xl font-bold text-cream mb-2">Termin nicht gefunden</h1>
        <p className="text-cream/60 mb-4">Der gesuchte Termin existiert nicht oder ist nicht öffentlich.</p>
        <Button variant="hero" asChild>
          <Link to={slug ? `/verein/${slug}` : "/"}>
            {slug ? "Zurück zum Verein" : "Zur Startseite"}
          </Link>
        </Button>
      </div>
    );
  }

  const startDate = new Date(event.start_at);
  const endDate = event.end_at ? new Date(event.end_at) : null;
  const shareUrl = `/verein/${club.slug}/termin/${event.id}`;
  const fullUrl = `${window.location.origin}${shareUrl}`;
  const ogDescription = event.description 
    ? event.description.substring(0, 160) 
    : `${format(startDate, "EEEE, d. MMMM yyyy", { locale: de })} um ${format(startDate, "HH:mm")} Uhr${event.location ? ` in ${event.location}` : ""}`;

  return (
    <>
      <Helmet>
        <title>{event.title} | {club.name}</title>
        <meta name="description" content={ogDescription} />
        
        {/* Open Graph */}
        <meta property="og:type" content="event" />
        <meta property="og:title" content={event.title} />
        <meta property="og:description" content={ogDescription} />
        <meta property="og:url" content={fullUrl} />
        <meta property="og:site_name" content={club.name} />
        {clubLogoUrl && <meta property="og:image" content={clubLogoUrl} />}
        
        {/* Event specific */}
        <meta property="event:start_time" content={event.start_at} />
        {event.end_at && <meta property="event:end_time" content={event.end_at} />}
        {event.location && <meta property="event:location" content={event.location} />}
        
        {/* Twitter */}
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={event.title} />
        <meta name="twitter:description" content={ogDescription} />
        {clubLogoUrl && <meta name="twitter:image" content={clubLogoUrl} />}
      </Helmet>

      <div className="min-h-screen bg-forest-dark">
        {/* Header */}
        <header className="fixed top-0 left-0 right-0 z-50 bg-forest-dark/90 backdrop-blur-md border-b border-gold/10">
          <div className="container mx-auto px-6 h-16 flex items-center justify-between">
            <Link 
              to={`/verein/${club.slug}`}
              className="flex items-center gap-3 text-cream hover:text-gold transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <div className="flex items-center gap-2">
                {clubLogoUrl ? (
                  <img src={clubLogoUrl} alt={club.name} className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <Shield className="w-8 h-8 text-gold" />
                )}
                <span className="font-medium hidden sm:inline">{club.name}</span>
              </div>
            </Link>
            
            <ShareButtons 
              url={shareUrl} 
              title={event.title} 
              description={ogDescription}
              variant="compact"
              className="text-cream hover:text-gold"
            />
          </div>
        </header>

        {/* Content */}
        <main className="pt-24 pb-16">
          <div className="container mx-auto px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-3xl mx-auto"
            >
              {/* Date Header */}
              <div className="flex items-start gap-6 mb-8">
                <div className="flex-shrink-0 w-24 h-24 bg-gold/20 rounded-2xl flex flex-col items-center justify-center border border-gold/30">
                  <span className="text-sm text-gold font-medium uppercase">
                    {format(startDate, "MMM", { locale: de })}
                  </span>
                  <span className="text-4xl font-bold text-cream">
                    {format(startDate, "d")}
                  </span>
                  <span className="text-xs text-cream/60">
                    {format(startDate, "yyyy")}
                  </span>
                </div>

                <div className="flex-grow">
                  <Badge className="bg-gold/20 text-gold border-gold/30 mb-3">
                    {categoryLabels[event.category] || event.category}
                  </Badge>
                  <h1 className="font-display text-3xl md:text-4xl font-bold text-cream mb-4">
                    {event.title}
                  </h1>
                </div>
              </div>

              {/* Event Details Card */}
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 md:p-8 mb-8">
                <div className="space-y-4">
                  {/* Time */}
                  <div className="flex items-center gap-3 text-cream/80">
                    <Clock className="w-5 h-5 text-gold flex-shrink-0" />
                    <span>
                      {format(startDate, "EEEE, d. MMMM yyyy", { locale: de })}
                      <br />
                      <span className="text-cream">
                        {format(startDate, "HH:mm")} Uhr
                        {endDate && ` – ${format(endDate, "HH:mm")} Uhr`}
                      </span>
                    </span>
                  </div>

                  {/* Location */}
                  {event.location && (
                    <div className="flex items-center gap-3 text-cream/80">
                      <MapPin className="w-5 h-5 text-gold flex-shrink-0" />
                      <span>{event.location}</span>
                    </div>
                  )}

                  {/* Club */}
                  <div className="flex items-center gap-3 text-cream/80">
                    <Building2 className="w-5 h-5 text-gold flex-shrink-0" />
                    <span>{club.name}</span>
                  </div>
                </div>

                {/* Description */}
                {event.description && (
                  <div className="mt-6 pt-6 border-t border-white/10">
                    <p className="text-cream/70 whitespace-pre-wrap leading-relaxed">
                      {event.description}
                    </p>
                  </div>
                )}
              </div>

              {/* Share Section */}
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
                <h3 className="text-cream font-medium mb-4">Termin teilen</h3>
                <ShareButtons 
                  url={shareUrl} 
                  title={event.title} 
                  description={ogDescription}
                  className="[&_button]:bg-white/10 [&_button]:border-white/20 [&_button]:text-cream [&_button:hover]:bg-white/20"
                />
              </div>

              {/* Back to Club */}
              <div className="mt-8 text-center">
                <Button variant="heroOutline" asChild>
                  <Link to={`/verein/${club.slug}`}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Alle Termine ansehen
                  </Link>
                </Button>
              </div>
            </motion.div>
          </div>
        </main>
      </div>
    </>
  );
};

export default PublicEventDetail;
