import { useEffect, useState } from "react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { motion } from "framer-motion";
import { Calendar, MapPin, ArrowRight, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

type EventCategory = "training" | "meeting" | "fest" | "work" | "other";

interface PublicEvent {
  id: string;
  title: string;
  location: string | null;
  start_at: string;
  category: EventCategory;
}

const categoryLabels: Record<EventCategory, { label: string; color: string }> = {
  training: { label: "Training", color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  meeting: { label: "Versammlung", color: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
  fest: { label: "Fest/Feier", color: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  work: { label: "Arbeitsdienst", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  other: { label: "Sonstiges", color: "bg-slate-500/10 text-slate-600 border-slate-500/20" },
};

const UpcomingEvents = () => {
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchPublicEvents();
  }, []);

  const fetchPublicEvents = async () => {
    try {
      const { data, error } = await supabase
        .from("events")
        .select("id, title, location, start_at, category")
        .eq("audience", "public")
        .eq("publication_status", "approved")
        .gte("start_at", new Date().toISOString())
        .order("start_at", { ascending: true })
        .limit(4);

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error("Error fetching public events:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading || events.length === 0) {
    return null;
  }

  return (
    <section className="py-32 bg-background relative">
      {/* Top decorative line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <motion.div
            initial={{ scale: 0 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-6"
          >
            <Calendar className="w-8 h-8 text-primary" />
          </motion.div>
          
          <h2 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-6">
            Nächste Termine
          </h2>
          
          <div className="w-24 h-1 bg-gradient-to-r from-gold to-gold-dark mx-auto" />
        </motion.div>

        <div className="max-w-4xl mx-auto">
          <div className="grid gap-4">
            {events.map((event, index) => {
              const cat = categoryLabels[event.category];
              const startDate = new Date(event.start_at);

              return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                >
                  <div className="group p-6 rounded-2xl bg-card border border-border hover:border-gold/30 hover:shadow-lg transition-all duration-300">
                    <div className="flex items-center gap-6">
                      {/* Date Block */}
                      <div className="flex-shrink-0 w-20 h-20 bg-gradient-to-br from-forest to-forest-light rounded-xl flex flex-col items-center justify-center text-cream shadow-lg">
                        <span className="text-xs font-medium uppercase tracking-wider text-gold">
                          {format(startDate, "MMM", { locale: de })}
                        </span>
                        <span className="text-3xl font-display font-bold">
                          {format(startDate, "d")}
                        </span>
                      </div>
                      
                      {/* Content */}
                      <div className="flex-grow min-w-0">
                        <h3 className="font-display text-xl font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">
                          {event.title}
                        </h3>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1.5">
                            <Clock className="w-4 h-4" />
                            {format(startDate, "HH:mm", { locale: de })} Uhr
                          </span>
                          {event.location && (
                            <span className="flex items-center gap-1.5">
                              <MapPin className="w-4 h-4" />
                              {event.location}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* Category Badge */}
                      <Badge variant="outline" className={`${cat.color} border hidden sm:flex`}>
                        {cat.label}
                      </Badge>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mt-10"
          >
            <Button variant="outline" size="lg" asChild className="group">
              <Link to="/termine">
                Alle Termine anzeigen
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default UpcomingEvents;
