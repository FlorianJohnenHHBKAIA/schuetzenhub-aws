import { useEffect, useState } from "react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { motion } from "framer-motion";
import { Loader2, Calendar, MapPin, ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { supabase, getStorageUrl } from "@/integrations/supabase/client";
import PublicHeader from "@/components/public/PublicHeader";
import PublicFooter from "@/components/public/PublicFooter";

type EventCategory = "training" | "meeting" | "fest" | "work" | "other";

interface PublicEvent {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_at: string;
  end_at: string | null;
  category: EventCategory;
}

interface ClubData {
  id: string;
  name: string;
  slug: string;
  logo_path: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website_url: string | null;
  location_city: string | null;
  imprint_text: string | null;
  privacy_text: string | null;
}

const categoryLabels: Record<EventCategory, { label: string; color: string }> = {
  training: { label: "Training", color: "bg-blue-500/10 text-blue-500" },
  meeting: { label: "Versammlung", color: "bg-purple-500/10 text-purple-500" },
  fest: { label: "Fest/Feier", color: "bg-amber-500/10 text-amber-500" },
  work: { label: "Arbeitsdienst", color: "bg-green-500/10 text-green-500" },
  other: { label: "Sonstiges", color: "bg-muted text-muted-foreground" },
};

const PublicEvents = () => {
  const { slug } = useParams<{ slug?: string }>();
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [club, setClub] = useState<ClubData | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (slug) {
      fetchClubAndEvents();
    } else {
      fetchPublicEvents();
    }
  }, [slug]);

  const fetchClubAndEvents = async () => {
    try {
      // First fetch club by slug (use clubs table for full data)
      const { data: clubReg, error: regError } = await supabase
        .from("clubs_registration")
        .select("id, name, slug")
        .eq("slug", slug)
        .maybeSingle();

      if (regError) throw regError;
      if (!clubReg) {
        setIsLoading(false);
        return;
      }

      // Fetch full club data
      const { data: clubData, error: clubError } = await supabase
        .from("clubs")
        .select("id, name, slug, logo_path, contact_email, contact_phone, website_url, location_city, imprint_text, privacy_text")
        .eq("id", clubReg.id)
        .maybeSingle();

      if (clubError) throw clubError;
      
      // Use clubs_registration data if full club not accessible (RLS)
      const effectiveClub = clubData || { ...clubReg, logo_path: null, contact_email: null, contact_phone: null, website_url: null, location_city: null, imprint_text: null, privacy_text: null };
      setClub(effectiveClub);

      // Resolve logo URL
      if (effectiveClub.logo_path) {
        const { data: urlData } = { data: { publicUrl: getStorageUrl("club-assets", effectiveClub.logo_path) || "" } };
        setLogoUrl(urlData?.publicUrl || null);
      }

      setClub(effectiveClub);

      // Then fetch events for this club only
      const { data, error } = await supabase
        .from("events")
        .select("id, title, description, location, start_at, end_at, category")
        .eq("club_id", effectiveClub.id)
        .eq("audience", "public")
        .eq("publication_status", "approved")
        .gte("start_at", new Date().toISOString())
        .order("start_at", { ascending: true });

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error("Error fetching club events:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPublicEvents = async () => {
    try {
      const { data, error } = await supabase
        .from("events")
        .select("id, title, description, location, start_at, end_at, category")
        .eq("audience", "public")
        .eq("publication_status", "approved")
        .gte("start_at", new Date().toISOString())
        .order("start_at", { ascending: true });

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error("Error fetching public events:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const backLink = slug ? `/verein/${slug}` : "/";

  const renderEventsList = () => {
    if (isLoading) {
      return (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (events.length === 0) {
      return (
        <Card>
          <CardContent className="py-16 text-center">
            <Calendar className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="font-display text-xl font-semibold mb-2">
              Keine Termine vorhanden
            </h2>
            <p className="text-muted-foreground">
              Aktuell sind keine öffentlichen Veranstaltungen geplant.
            </p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-4">
        {events.map((event, index) => {
          const cat = categoryLabels[event.category];
          const startDate = new Date(event.start_at);
          const endDate = event.end_at ? new Date(event.end_at) : null;

          return (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex gap-6">
                    <div className="flex-shrink-0 w-20 h-20 bg-primary/10 rounded-xl flex flex-col items-center justify-center">
                      <span className="text-sm text-primary font-medium uppercase">
                        {format(startDate, "MMM", { locale: de })}
                      </span>
                      <span className="text-3xl font-bold text-primary">
                        {format(startDate, "d")}
                      </span>
                      <span className="text-xs text-primary/70">
                        {format(startDate, "yyyy")}
                      </span>
                    </div>

                    <div className="flex-grow min-w-0">
                      <h3 className="font-display text-xl font-semibold text-foreground mb-2">
                        {event.title}
                      </h3>
                      <div className="flex flex-wrap items-center gap-3 text-muted-foreground mb-3">
                        <span className="text-sm font-medium">
                          {format(startDate, "HH:mm", { locale: de })} Uhr
                          {endDate && ` – ${format(endDate, "HH:mm", { locale: de })} Uhr`}
                        </span>
                        {event.location && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1 text-sm">
                              <MapPin className="w-4 h-4" />
                              {event.location}
                            </span>
                          </>
                        )}
                      </div>
                      {event.description && (
                        <p className="text-muted-foreground text-sm mb-4">
                          {event.description}
                        </p>
                      )}
                      <Badge variant="secondary" className={cat.color}>
                        {cat.label}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    );
  };

  // If no slug (global events page), use simple header
  if (!slug) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <header className="fixed top-0 left-0 right-0 z-50 bg-background border-b">
          <div className="container mx-auto px-6 h-16 flex items-center">
            <Link to="/" className="flex items-center gap-2 text-foreground hover:text-primary transition-colors">
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">Zurück</span>
            </Link>
          </div>
        </header>
        <main className="flex-grow pt-24 pb-16">
          <div className="container mx-auto px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-4xl mx-auto"
            >
              <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-2">
                Termine
              </h1>
              <p className="text-muted-foreground mb-8">
                Öffentliche Veranstaltungen und Termine
              </p>
              {renderEventsList()}
            </motion.div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader 
        clubName={club?.name || ""} 
        clubSlug={slug} 
        logoUrl={logoUrl}
      />
      <main className="flex-grow pt-24 pb-16">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto"
          >
            <div className="flex items-center gap-4 mb-8">
              <Button variant="ghost" size="icon" asChild>
                <Link to={backLink}>
                  <ArrowLeft className="w-5 h-5" />
                </Link>
              </Button>
              <div>
                <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground">
                  Termine {club ? `– ${club.name}` : ""}
                </h1>
                <p className="text-muted-foreground">
                  {club ? "Öffentliche Termine des Vereins" : "Öffentliche Veranstaltungen und Termine"}
                </p>
              </div>
            </div>

            {renderEventsList()}
          </motion.div>
        </div>
      </main>
      <PublicFooter 
        clubName={club?.name || ""} 
        clubSlug={slug} 
        logoUrl={logoUrl}
        contactEmail={club?.contact_email}
        contactPhone={club?.contact_phone}
        websiteUrl={club?.website_url}
        locationCity={club?.location_city}
        imprintText={club?.imprint_text}
        privacyText={club?.privacy_text}
      />
    </div>
  );
};

export default PublicEvents;
