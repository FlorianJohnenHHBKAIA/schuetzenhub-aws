import { motion } from "framer-motion";
import { Calendar, MapPin, ChevronRight, Building2, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

interface Event {
  id: string;
  title: string;
  start_at: string;
  location: string | null;
  owner_type: string;
  owner_id: string;
  audience: string;
}

interface UpcomingEventsSectionProps {
  companyEvents: Event[];
  clubEvents: Event[];
  isLoading: boolean;
  companyName: string | null;
}

const UpcomingEventsSection = ({ 
  companyEvents, 
  clubEvents, 
  isLoading, 
  companyName 
}: UpcomingEventsSectionProps) => {
  const allEvents = [
    ...companyEvents.map(e => ({ ...e, isCompanyEvent: true })),
    ...clubEvents.map(e => ({ ...e, isCompanyEvent: false })),
  ].slice(0, 5);

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="space-y-3"
      >
        <h2 className="font-display text-xl font-semibold text-foreground flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          Kommende Termine
        </h2>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      </motion.div>
    );
  }

  if (allEvents.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="space-y-3"
      >
        <h2 className="font-display text-xl font-semibold text-foreground flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          Kommende Termine
        </h2>
        <div className="p-6 rounded-xl bg-card border border-border text-center">
          <Calendar className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-muted-foreground">Keine anstehenden Termine</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="space-y-3"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold text-foreground flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          Kommende Termine
        </h2>
        <Link 
          to="/portal/events" 
          className="text-sm text-primary hover:underline flex items-center gap-1"
        >
          Alle anzeigen
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
      
      <div className="space-y-2">
        {allEvents.map((event, index) => {
          const eventDate = new Date(event.start_at);
          const isCompany = event.isCompanyEvent;
          
          return (
            <Link
              key={event.id}
              to={`/portal/events`}
              className={`block p-4 rounded-xl border transition-all hover:shadow-md ${
                isCompany 
                  ? 'bg-primary/5 border-primary/20 hover:border-primary/40' 
                  : 'bg-card border-border hover:border-primary/20'
              }`}
            >
              <div className="flex items-start gap-4">
                {/* Date Badge */}
                <div className="shrink-0 text-center">
                  <div className={`w-12 h-12 rounded-lg flex flex-col items-center justify-center ${
                    isCompany ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
                  }`}>
                    <span className="text-xs font-medium uppercase">
                      {format(eventDate, "MMM", { locale: de })}
                    </span>
                    <span className="text-lg font-bold leading-none">
                      {format(eventDate, "dd")}
                    </span>
                  </div>
                </div>
                
                {/* Event Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium text-foreground truncate">{event.title}</h3>
                    {isCompany && (
                      <Badge variant="secondary" className="shrink-0 bg-primary/10 text-primary text-xs">
                        <Building2 className="w-3 h-3 mr-1" />
                        {companyName || "Kompanie"}
                      </Badge>
                    )}
                    {!isCompany && event.audience === 'public' && (
                      <Badge variant="outline" className="shrink-0 text-xs">
                        <Users className="w-3 h-3 mr-1" />
                        Verein
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span>{format(eventDate, "EEEE, HH:mm 'Uhr'", { locale: de })}</span>
                    {event.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        <span className="truncate max-w-[150px]">{event.location}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </motion.div>
  );
};

export default UpcomingEventsSection;
