import { motion } from "framer-motion";
import { Megaphone, Image, ClipboardList, ChevronRight, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface Post {
  id: string;
  title: string;
  created_at: string;
  cover_image_path: string | null;
}

interface WorkShift {
  id: string;
  title: string;
  start_at: string;
  open_slots: number;
}

interface CompanyUpdatesSectionProps {
  latestPost: Post | null;
  upcomingShifts: WorkShift[];
  isLoading: boolean;
  companyName: string | null;
}

const CompanyUpdatesSection = ({ 
  latestPost, 
  upcomingShifts, 
  isLoading,
  companyName 
}: CompanyUpdatesSectionProps) => {
  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-3"
      >
        <h2 className="font-display text-xl font-semibold text-foreground flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-primary" />
          Aktuelles
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="h-32 rounded-xl bg-muted animate-pulse" />
          <div className="h-32 rounded-xl bg-muted animate-pulse" />
        </div>
      </motion.div>
    );
  }

  const hasContent = latestPost || upcomingShifts.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="space-y-3"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold text-foreground flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-primary" />
          Aktuelles {companyName && `aus der ${companyName}`}
        </h2>
      </div>

      {!hasContent ? (
        <div className="p-6 rounded-xl bg-card border border-border text-center">
          <Megaphone className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-muted-foreground">Keine aktuellen Neuigkeiten</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {/* Latest Post Card */}
          <Link 
            to={latestPost ? `/portal/posts/${latestPost.id}` : "/portal/posts"}
            className="p-4 rounded-xl bg-card border border-border hover:border-primary/20 hover:shadow-md transition-all group"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-gold/10 flex items-center justify-center shrink-0">
                <Megaphone className="w-5 h-5 text-gold-dark" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground mb-1">Neuester Aushang</p>
                {latestPost ? (
                  <>
                    <h3 className="font-medium text-foreground truncate group-hover:text-primary transition-colors">
                      {latestPost.title}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {format(new Date(latestPost.created_at), "dd. MMMM yyyy", { locale: de })}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Keine Beiträge vorhanden</p>
                )}
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
            </div>
          </Link>

          {/* Upcoming Work Shifts Card */}
          <Link 
            to="/portal/workshifts"
            className="p-4 rounded-xl bg-card border border-border hover:border-primary/20 hover:shadow-md transition-all group"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-forest/10 flex items-center justify-center shrink-0">
                <ClipboardList className="w-5 h-5 text-forest" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground mb-1">Offene Arbeitsdienste</p>
                {upcomingShifts.length > 0 ? (
                  <>
                    <h3 className="font-medium text-foreground group-hover:text-primary transition-colors">
                      {upcomingShifts.length} {upcomingShifts.length === 1 ? 'Dienst' : 'Dienste'} mit freien Plätzen
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Nächster: {format(new Date(upcomingShifts[0].start_at), "dd.MM.", { locale: de })}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Alle Dienste besetzt</p>
                )}
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
            </div>
          </Link>
        </div>
      )}
    </motion.div>
  );
};

export default CompanyUpdatesSection;
