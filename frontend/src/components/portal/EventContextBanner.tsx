import { Link } from "react-router-dom";
import { ArrowLeft, Calendar } from "lucide-react";
import { motion } from "framer-motion";
import { useEventContext } from "@/hooks/useEventContext";

/**
 * Banner showing context when navigating from an event.
 * Provides quick "back to event" navigation.
 */
export const EventContextBanner = () => {
  const { hasEventContext, eventTitle, getBackToEventUrl } = useEventContext();
  
  if (!hasEventContext) return null;
  
  const backUrl = getBackToEventUrl();
  if (!backUrl) return null;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6"
    >
      <Link
        to={backUrl}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/5 border border-primary/20 text-primary hover:bg-primary/10 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <Calendar className="w-4 h-4" />
        <span className="text-sm font-medium">
          Zurück zum Event{eventTitle ? `: ${eventTitle}` : ""}
        </span>
      </Link>
    </motion.div>
  );
};

export default EventContextBanner;
