import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Bell, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { useNotifications } from "@/hooks/useNotifications";

const NotificationsSection = () => {
  const navigate = useNavigate();
  const { notifications, markAsRead } = useNotifications();

  const recent = notifications.slice(0, 5);

  const handleClick = async (notif: (typeof notifications)[number]) => {
    if (!notif.is_read) {
      await markAsRead(notif.id);
    }
    const target = notif.link || "/portal/notifications";
    navigate(target);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
      className="space-y-3"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold text-foreground flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary" />
          Benachrichtigungen
        </h2>
      </div>

      <div className="rounded-xl bg-card border border-border overflow-hidden">
        {recent.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
            <Bell className="w-8 h-8 opacity-40" />
            <p className="text-sm">Keine Benachrichtigungen</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {recent.map((notif) => (
              <button
                key={notif.id}
                onClick={() => handleClick(notif)}
                className={`w-full px-4 py-3 flex items-start gap-3 hover:bg-muted/50 transition-colors text-left ${
                  !notif.is_read ? "bg-primary/5" : ""
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm truncate ${
                      !notif.is_read ? "font-semibold text-foreground" : "text-foreground"
                    }`}
                  >
                    {notif.title}
                  </p>
                  {notif.message && (
                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                      {notif.message}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(notif.created_at), {
                      addSuffix: true,
                      locale: de,
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 mt-0.5">
                  {!notif.is_read && (
                    <div className="w-2 h-2 rounded-full bg-primary" />
                  )}
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="border-t border-border px-4 py-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs text-muted-foreground"
            onClick={() => navigate("/portal/notifications")}
          >
            Alle Benachrichtigungen anzeigen
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default NotificationsSection;
