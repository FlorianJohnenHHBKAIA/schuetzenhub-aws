import { motion } from "framer-motion";
import { Heart, Clock, CheckCircle, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { getAwardTypeConfig } from "@/components/portal/AwardDialog";

interface LatestAward {
  id: string;
  title: string;
  awarded_at: string;
  award_type: string;
}

interface WorkStats {
  totalHours: number;
  completedShifts: number;
  upcomingShifts: number;
}

interface EngagementSectionProps {
  latestAward: LatestAward | null;
  workStats: WorkStats;
  workStatsLoading: boolean;
  currentYear: number;
}

const EngagementSection = ({ 
  latestAward, 
  workStats, 
  workStatsLoading,
  currentYear 
}: EngagementSectionProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="space-y-3"
    >
      <h2 className="font-display text-xl font-semibold text-foreground flex items-center gap-2">
        <Heart className="w-5 h-5 text-primary" />
        Anerkennung & Engagement
      </h2>
      
      <div className="grid md:grid-cols-2 gap-4">
        {/* Latest Award Card */}
        <Link
          to="/portal/my-awards"
          className="p-5 rounded-xl bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-500/20 hover:border-amber-500/40 hover:shadow-md transition-all group"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
              {latestAward ? (
                (() => {
                  const config = getAwardTypeConfig(latestAward.award_type);
                  const AwardIcon = config.icon;
                  return <AwardIcon className={`w-6 h-6 ${config.color}`} />;
                })()
              ) : (
                <Sparkles className="w-6 h-6 text-amber-600" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              {latestAward ? (
                <>
                  <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">Letzte Auszeichnung</p>
                  <p className="font-semibold text-foreground truncate">{latestAward.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(new Date(latestAward.awarded_at), "MMMM yyyy", { locale: de })}
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-foreground">Deine Auszeichnungen</p>
                  <p className="text-sm text-muted-foreground">
                    Beantrage Ehrungen und werde Teil der Vereinsgeschichte
                  </p>
                </>
              )}
            </div>
          </div>
        </Link>

        {/* Engagement Card */}
        <Link
          to="/portal/my-awards?tab=engagement"
          className="p-5 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 hover:border-primary/40 hover:shadow-md transition-all group"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <Clock className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-primary font-medium">Dein Engagement {currentYear}</p>
              <div className="flex items-baseline gap-3 mt-1">
                <span className="text-2xl font-bold text-foreground">
                  {workStatsLoading ? "..." : workStats.totalHours}
                </span>
                <span className="text-sm text-muted-foreground">Stunden</span>
                <span className="text-lg font-semibold text-foreground">
                  {workStatsLoading ? "..." : workStats.completedShifts}
                </span>
                <span className="text-sm text-muted-foreground">Einsätze</span>
              </div>
              {workStats.totalHours >= 10 && (
                <Badge variant="secondary" className="mt-2 bg-green-500/20 text-green-700 dark:text-green-400">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Soll erfüllt
                </Badge>
              )}
            </div>
          </div>
        </Link>
      </div>
    </motion.div>
  );
};

export default EngagementSection;
