import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { supabase, apiJson } from "@/integrations/api/client";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Calendar, Clock, MapPin, ArrowRight, Loader2, CheckCircle2, XCircle, HelpCircle } from "lucide-react";

interface CompanyEvent {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_at: string;
  end_at: string | null;
  category: string;
  publication_status: string;
}

interface ParticipantCount {
  event_id: string;
  attending_count: number;
  declined_count: number;
  member_count: number;
}

interface CompanyEventsSectionProps {
  companyId: string;
  clubId: string;
  isMember: boolean;
}

const CompanyEventsSection = ({ companyId, clubId, isMember }: CompanyEventsSectionProps) => {
  const [events, setEvents] = useState<CompanyEvent[]>([]);
  const [participantCounts, setParticipantCounts] = useState<Record<string, ParticipantCount>>({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isMember || !companyId || !clubId) return;
    fetchEvents();
  }, [companyId, clubId, isMember]);

  const fetchEvents = async () => {
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from("events")
        .select("id, title, description, location, start_at, end_at, category, publication_status")
        .eq("club_id", clubId)
        .eq("owner_type", "company")
        .eq("owner_id", companyId)
        .in("publication_status", ["approved", "submitted"])
        .gte("start_at", new Date().toISOString())
        .order("start_at", { ascending: true })
        .limit(5);

      const eventsData = (data as CompanyEvent[]) || [];
      setEvents(eventsData);
      if (eventsData.length > 0) {
        apiJson<ParticipantCount[]>(
          `/api/events/participant-counts?ids=${eventsData.map(e => e.id).join(",")}`
        )
          .then(counts => setParticipantCounts(Object.fromEntries(counts.map(c => [c.event_id, c]))))
          .catch(() => {});
      }
    } catch (error) {
      console.error("Error fetching company events:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isMember) return null;

  return (
    <div>
      <h2 className="font-display text-xl font-semibold mb-4 flex items-center gap-2">
        <Calendar className="w-5 h-5 text-primary" />
        Kommende Kompanietermine
      </h2>

      {isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : events.length === 0 ? (
        <div className="p-6 bg-card rounded-xl border text-center">
          <Calendar className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm">
            Aktuell sind keine Kompanietermine geplant.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {events.map(event => {
            const start = new Date(event.start_at);
            return (
              <div
                key={event.id}
                className="flex gap-4 p-4 bg-card rounded-xl border border-border hover:shadow-sm transition-all"
              >
                <div className="shrink-0 text-center bg-primary/10 rounded-lg px-3 py-2 min-w-[52px]">
                  <p className="text-xs text-muted-foreground uppercase leading-none mb-1">
                    {format(start, 'MMM', { locale: de })}
                  </p>
                  <p className="text-xl font-bold text-primary leading-none">
                    {format(start, 'd')}
                  </p>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-medium truncate">{event.title}</h3>
                    {event.publication_status === 'submitted' && (
                      <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-600 shrink-0">
                        Eingereicht
                      </Badge>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-3 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {format(start, 'HH:mm')} Uhr
                    </span>
                    {event.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {event.location}
                      </span>
                    )}
                  </p>

                  {participantCounts[event.id] && (() => {
                    const c = participantCounts[event.id];
                    const pending = Math.max(0, c.member_count - c.attending_count - c.declined_count);
                    return (
                      <div className="flex items-center gap-3 text-xs mt-1">
                        <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                          <CheckCircle2 className="w-3 h-3" /> {c.attending_count}
                        </span>
                        <span className="flex items-center gap-1 text-destructive">
                          <XCircle className="w-3 h-3" /> {c.declined_count}
                        </span>
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <HelpCircle className="w-3 h-3" /> {pending}
                        </span>
                      </div>
                    );
                  })()}

                  {event.description && (
                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                      {event.description}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Link
        to="/portal/events"
        className="mt-3 flex items-center gap-1 text-xs text-primary hover:underline"
      >
        Alle Termine ansehen <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
  );
};

export default CompanyEventsSection;
