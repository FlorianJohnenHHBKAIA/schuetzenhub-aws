import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { getStorageUrl } from "@/integrations/api/client";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import {
  Megaphone,
  ClipboardList,
  ChevronRight,
  Clock,
  CalendarDays,
  Info,
  AlertTriangle,
  CheckCircle2,
  Hammer,
  Eye,
  MessageSquare,
  ArrowRight,
} from "lucide-react";

interface Post {
  id: string;
  title: string;
  created_at: string;
  cover_image_path: string | null;
  category: string;
  content: string | null;
  audience: string;
}

interface PostStats {
  commentCount: number;
  attendingCount: number;
  helpingCount: number;
  readCount: number;
}

interface WorkShift {
  id: string;
  title: string;
  start_at: string;
  open_slots: number;
}

interface CompanyUpdatesSectionProps {
  latestPost: Post | null;
  latestPostStats: PostStats | null;
  upcomingShifts: WorkShift[];
  isLoading: boolean;
  companyName: string | null;
}

const CATEGORY_LABELS: Record<string, { label: string; Icon: React.ElementType }> = {
  event:        { label: 'Termine & Veranstaltungen', Icon: CalendarDays },
  info:         { label: 'Vereinsinformation',         Icon: Info },
  announcement: { label: 'Vereinsinformation',         Icon: Info },
  warning:      { label: 'Wichtige Mitteilung',        Icon: AlertTriangle },
  other:        { label: 'Sonstiges',                  Icon: Megaphone },
};

const CompanyUpdatesSection = ({
  latestPost,
  latestPostStats,
  upcomingShifts,
  isLoading,
  companyName,
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
          <div className="h-40 rounded-xl bg-muted animate-pulse" />
          <div className="h-40 rounded-xl bg-muted animate-pulse" />
        </div>
      </motion.div>
    );
  }

  const categoryMeta = latestPost ? CATEGORY_LABELS[latestPost.category] : null;
  const hasEngagement = latestPostStats && (
    latestPostStats.attendingCount > 0 ||
    latestPostStats.helpingCount > 0 ||
    latestPostStats.readCount > 0 ||
    latestPostStats.commentCount > 0
  );

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

      <div className="grid md:grid-cols-2 gap-4">
        {/* Neuester Aushang */}
        <div className="p-4 rounded-xl bg-card border border-border hover:border-primary/20 hover:shadow-md transition-all flex flex-col">
          <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
            <Megaphone className="w-3 h-3" /> Neuester Aushang
          </p>

          {latestPost ? (
            <Link to={`/portal/posts/${latestPost.id}`} className="group block space-y-2 flex-1">
              {latestPost.cover_image_path && (
                <div className="h-24 rounded-lg overflow-hidden">
                  <img
                    src={getStorageUrl("post-images", latestPost.cover_image_path) || ""}
                    alt={latestPost.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {categoryMeta && (
                <Badge variant="outline" className="text-xs gap-1 w-fit">
                  <categoryMeta.Icon className="w-3 h-3" />{categoryMeta.label}
                </Badge>
              )}

              <h3 className="font-medium text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                {latestPost.title}
              </h3>

              {latestPost.content && (
                <p className="text-xs text-muted-foreground line-clamp-2 whitespace-pre-wrap">
                  {latestPost.content}
                </p>
              )}

              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {format(new Date(latestPost.created_at), "dd. MMMM yyyy", { locale: de })}
              </p>

              {hasEngagement && (
                <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1 border-t">
                  {latestPostStats!.attendingCount > 0 && (
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-green-600" />
                      {latestPostStats!.attendingCount}
                    </span>
                  )}
                  {latestPostStats!.helpingCount > 0 && (
                    <span className="flex items-center gap-1">
                      <Hammer className="w-3 h-3 text-orange-600" />
                      {latestPostStats!.helpingCount}
                    </span>
                  )}
                  {latestPostStats!.readCount > 0 && (
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3 text-blue-600" />
                      {latestPostStats!.readCount}
                    </span>
                  )}
                  {latestPostStats!.commentCount > 0 && (
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      {latestPostStats!.commentCount}
                    </span>
                  )}
                </div>
              )}
            </Link>
          ) : (
            <p className="text-sm text-muted-foreground flex-1">
              Aktuell gibt es keine neuen Aushänge.
            </p>
          )}

          <Link
            to="/portal/posts"
            className="mt-3 flex items-center gap-1 text-xs text-primary hover:underline"
          >
            Alle Aushänge ansehen <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {/* Offene Arbeitsdienste */}
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
    </motion.div>
  );
};

export default CompanyUpdatesSection;
