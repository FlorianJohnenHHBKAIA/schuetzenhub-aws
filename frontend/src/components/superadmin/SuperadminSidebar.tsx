import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  Users,
  ShieldCheck,
  Package,
  Flag,
  Settings,
  ClipboardList,
  Store,
  ScrollText,
} from "lucide-react";

const NAV_ITEMS = [
  { label: "Dashboard", to: "/superadmin", icon: LayoutDashboard, exact: true },
  { label: "Vereine", to: "/superadmin/clubs", icon: Building2 },
  { label: "Benutzer", to: "/superadmin/users", icon: Users },
  { label: "Rollen & Rechte", to: "/superadmin/roles", icon: ShieldCheck },
  { label: "Pakete & Abrechnung", to: "/superadmin/packages", icon: Package },
  { label: "Meldungen & Compliance", to: "/superadmin/reports", icon: Flag },
  { label: "Übernahmeanfragen", to: "/superadmin/claim-requests", icon: ClipboardList },
  { label: "Anbieter", to: "/superadmin/providers", icon: Store },
  { label: "Audit-Log", to: "/superadmin/audit-logs", icon: ScrollText },
  { label: "Systemeinstellungen", to: "/superadmin/settings", icon: Settings },
];

const SuperadminSidebar = ({ onNavigate }: { onNavigate?: () => void }) => {
  const location = useLocation();

  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
      {NAV_ITEMS.map(({ label, to, icon: Icon, exact }) => {
        const isActive = exact
          ? location.pathname === to
          : location.pathname.startsWith(to);

        return (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span className="truncate">{label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
};

export default SuperadminSidebar;
