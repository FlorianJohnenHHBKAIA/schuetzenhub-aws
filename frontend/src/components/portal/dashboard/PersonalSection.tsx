import { motion } from "framer-motion";
import { User, Bell, ClipboardCheck, Sparkles, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

interface PersonalSectionProps {
  openShifts: number;
  unreadNotifications: number;
  pendingAwardRequests: number;
}

const PersonalSection = ({ 
  openShifts, 
  unreadNotifications, 
  pendingAwardRequests 
}: PersonalSectionProps) => {
  const items = [
    {
      label: "Meine Arbeitsdienste",
      href: "/portal/workshifts",
      icon: ClipboardCheck,
      count: openShifts,
      countLabel: openShifts === 1 ? "anstehend" : "anstehend",
      color: "text-forest",
      bgColor: "bg-forest/10",
    },
    {
      label: "Benachrichtigungen",
      href: "/portal/notifications",
      icon: Bell,
      count: unreadNotifications,
      countLabel: "ungelesen",
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      label: "Offene Anträge",
      href: "/portal/my-awards?tab=requests",
      icon: Sparkles,
      count: pendingAwardRequests,
      countLabel: "ausstehend",
      color: "text-amber-600",
      bgColor: "bg-amber-500/10",
      hideIfZero: true,
    },
  ].filter(item => !item.hideIfZero || item.count > 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="space-y-3"
    >
      <h2 className="font-display text-xl font-semibold text-foreground flex items-center gap-2">
        <User className="w-5 h-5 text-primary" />
        Persönlicher Bereich
      </h2>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {items.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            className="p-4 rounded-xl bg-card border border-border hover:border-primary/20 hover:shadow-md transition-all group flex items-center gap-3"
          >
            <div className={`w-10 h-10 rounded-lg ${item.bgColor} flex items-center justify-center shrink-0`}>
              <item.icon className={`w-5 h-5 ${item.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground text-sm group-hover:text-primary transition-colors">
                {item.label}
              </p>
              {item.count > 0 && (
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{item.count}</span> {item.countLabel}
                </p>
              )}
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
          </Link>
        ))}
        
        {/* Profile Link */}
        <Link
          to="/portal/profile"
          className="p-4 rounded-xl bg-card border border-border hover:border-primary/20 hover:shadow-md transition-all group flex items-center gap-3"
        >
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <User className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground text-sm group-hover:text-primary transition-colors">
              Mein Profil
            </p>
            <p className="text-xs text-muted-foreground">Profil bearbeiten</p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
        </Link>
      </div>
    </motion.div>
  );
};

export default PersonalSection;
