import { useState, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  Building2,
  ArrowRightLeft,
  Settings,
  ChevronRight,
  ChevronDown,
  Award,
  Key,
  UserCog,
  Calendar,
  CheckCircle,
  ClipboardList,
  FileText,
  Megaphone,
  SendHorizontal,
  Globe,
  Images,
  Search,
  Star,
  StarOff,
  Cog,
  BarChart3,
  Bell,
  UserCircle,
  Sparkles,
  Zap,
  Book,
  Home,
  HandHelping,
  Users2,
  FolderOpen,
  ToggleRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/lib/auth";
import { useUIMode } from "@/hooks/useUIMode";
import { useNavFavorites } from "@/hooks/useNavFavorites";
import { cn } from "@/lib/utils";

export interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
  keywords?: string[];
}

export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
  defaultOpen?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
}

// ============================================================
// MITGLIEDER-MENÜ (Default) - Fokus auf Gemeinschaft & Netzwerk
// ============================================================

// Start - Mein Überblick (Dashboard mit Kompanie im Mittelpunkt)
const memberStartItems: NavItem[] = [
  { label: "Mein Überblick", href: "/portal", icon: Home, keywords: ["start", "home", "dashboard", "übersicht"] },
];

// Meine Kompanie - Alles rund um die eigene Kompanie
const memberCompanyItems: NavItem[] = [
  { label: "Kompanie-Termine", href: "/portal/events?scope=company", icon: Calendar, keywords: ["event", "veranstaltung", "kompanie", "termin"] },
  { label: "Kompanie-Aushang", href: "/portal/posts?scope=company", icon: Megaphone, keywords: ["beitrag", "news", "kompanie", "mitteilung"] },
  { label: "Arbeitsdienste", href: "/portal/workshifts", icon: HandHelping, keywords: ["schicht", "dienst", "helfer", "einsatz"] },
  { label: "Kompanie-Galerie", href: "/portal/shared-gallery?scope=company", icon: Images, keywords: ["foto", "bilder", "kompanie", "galerie"] },
  { label: "Kameraden", href: "/portal/members?scope=company", icon: Users, keywords: ["mitglied", "kamerad", "kompanie", "person"] },
];

// Gemeinschaft - Vereinsweite Sichtbarkeit (read-only)
const memberCommunityItems: NavItem[] = [
  { label: "Alle Kompanien", href: "/portal/companies", icon: Building2, keywords: ["kompanie", "gruppe", "einheit", "organisation"] },
  { label: "Vereinsmitglieder", href: "/portal/members", icon: Users, keywords: ["mitglied", "person", "verzeichnis", "liste"] },
];

// Mein Bereich - Persönliche Daten & Anerkennung
const memberPersonalItems: NavItem[] = [
  { label: "Mein Profil", href: "/portal/profile", icon: UserCircle, keywords: ["profil", "account", "ich", "daten"] },
  { label: "Meine Auszeichnungen", href: "/portal/my-awards", icon: Sparkles, keywords: ["orden", "ehren", "auszeichnung", "stolz"] },
  { label: "Mein Engagement", href: "/portal/workshifts/overview", icon: BarChart3, keywords: ["einsatz", "stunden", "statistik", "engagement"] },
  { label: "Benachrichtigungen", href: "/portal/notifications", icon: Bell, keywords: ["notification", "meldung", "alarm"] },
];

// Verein - Vereinsweite Informationen & Dokumente
const memberClubItems: NavItem[] = [
  { label: "Vereinskalender", href: "/portal/events", icon: Calendar, keywords: ["kalender", "termin", "verein", "event"] },
  { label: "Vereins-News", href: "/portal/posts", icon: Megaphone, keywords: ["news", "aktuelles", "beitrag", "aushang"] },
  { label: "Dokumente", href: "/portal/documents", icon: FolderOpen, keywords: ["datei", "protokoll", "download", "dokument"] },
  { label: "Schützenheft", href: "/portal/magazine", icon: Book, keywords: ["magazin", "festbuch", "heft"] },
  { label: "Über den Verein", href: "/portal/club-profile", icon: Globe, keywords: ["verein", "profil", "info", "über"] },
];

// ============================================================
// ADMIN-MENÜ - Nur im Admin-Modus sichtbar
// ============================================================

// Admin Start
const adminStartItems: NavItem[] = [
  { label: "Verwaltung", href: "/portal/admin", icon: LayoutDashboard, keywords: ["admin", "start", "übersicht", "aufgaben"] },
];

// Mitglieder & Organisation
const adminMembersOrgItems: NavItem[] = [
  { label: "Mitglieder", href: "/portal/members", icon: Users, permission: "club.members.manage", keywords: ["member", "person", "liste"] },
  { label: "Kompanien", href: "/portal/companies", icon: Building2, permission: "club.companies.manage", keywords: ["company", "gruppe", "abteilung"] },
  { label: "Zuordnungen", href: "/portal/assignments", icon: ArrowRightLeft, permission: "club.members.manage", keywords: ["zuordnung", "kompanie", "wechsel"] },
  { label: "Ämter & Besetzungen", href: "/portal/roles", icon: Award, permission: "club.roles.manage", keywords: ["rolle", "position", "funktion", "besetzung", "amt"] },
  { label: "Auszeichnungs-Anträge", href: "/portal/awards/requests", icon: Award, permission: "club.members.manage", keywords: ["antrag", "award", "ehrung"] },
  { label: "Auszeichnungstypen", href: "/portal/awards/types", icon: Award, permission: "club.admin.full", keywords: ["award", "auszeichnung", "typ", "kategorie"] },
  { label: "Automatische Ehrungen", href: "/portal/awards/rules", icon: Zap, permission: "club.admin.full", keywords: ["regel", "automatisch", "meilenstein", "gamification"] },
];

// Termine & Einsätze
const adminEventsItems: NavItem[] = [
  { label: "Termine", href: "/portal/events", icon: Calendar, keywords: ["event", "veranstaltung", "kalender"] },
  { label: "Termin-Freigaben", href: "/portal/event-approvals", icon: CheckCircle, permission: "club.events.approve_publication", keywords: ["freigabe", "genehmigung", "event"] },
  { label: "Arbeitsdienste", href: "/portal/workshifts", icon: ClipboardList, keywords: ["schicht", "dienst", "helfer"] },
  { label: "Arbeitsdienste-Übersicht", href: "/portal/workshifts/overview", icon: BarChart3, permission: "club.members.manage", keywords: ["auswertung", "statistik", "schichten"] },
];

// Inhalte & Öffentlichkeit
const adminContentItems: NavItem[] = [
  { label: "Aushang / Beiträge", href: "/portal/posts", icon: Megaphone, keywords: ["beitrag", "news", "aktuelles"] },
  { label: "Beitrags-Freigaben", href: "/portal/post-approvals", icon: SendHorizontal, permission: "club.posts.approve_publication", keywords: ["freigabe", "post", "beitrag"] },
  { label: "Öffentliche Galerie", href: "/portal/gallery", icon: Images, permission: "club.admin.full", keywords: ["galerie", "bilder", "fotos", "verwalten"] },
  { label: "Foto-Freigaben", href: "/portal/photo-management", icon: CheckCircle, permission: "club.gallery.manage", keywords: ["foto", "freigabe", "upload", "redaktion"] },
  { label: "Vereinsprofil", href: "/portal/club-profile", icon: Globe, permission: "club.settings.manage", keywords: ["profil", "verein", "öffentlich"] },
  { label: "Dokumente", href: "/portal/documents", icon: FileText, keywords: ["datei", "protokoll", "download"] },
];

// Schützenheft & Sponsoren
const adminMagazineItems: NavItem[] = [
  { label: "Schützenhefte", href: "/portal/magazine", icon: Book, permission: "club.magazine.manage", keywords: ["magazin", "festbuch", "heft", "pdf"] },
  { label: "Anzeigen", href: "/portal/magazine/ads", icon: FileText, permission: "club.magazine.ads.manage", keywords: ["anzeige", "werbung", "inserat"] },
  { label: "Sponsoren", href: "/portal/magazine/sponsors", icon: Building2, permission: "club.magazine.ads.manage", keywords: ["sponsor", "werbepartner", "unterstützer"] },
];

// Einstellungen & System
const adminSystemItems: NavItem[] = [
  { label: "Rollen & Rechte", href: "/portal/permissions", icon: Key, permission: "club.roles.manage", keywords: ["permission", "berechtigung", "recht", "rolle"] },
  { label: "Delegierte Rechte", href: "/portal/delegations", icon: UserCog, permission: "company.delegations.manage", keywords: ["delegation", "berechtigung", "weitergabe"] },
  { label: "Jahresübersicht", href: "/portal/reports/yearly", icon: BarChart3, permission: "club.admin.full", keywords: ["report", "auswertung", "jahresbericht", "statistik"] },
  { label: "Einstellungen", href: "/portal/settings", icon: Settings, permission: "club.settings.manage", keywords: ["settings", "konfiguration"] },
];

interface SidebarNavigationProps {
  onNavigate?: () => void;
  onRestartOnboarding?: () => void;
}

export function SidebarNavigation({ onNavigate, onRestartOnboarding }: SidebarNavigationProps) {
  const location = useLocation();
  const { hasPermission } = useAuth();
  const { isAdminMode, canToggle, toggleMode } = useUIMode();
  const { favorites, toggleFavorite, isFavorite, canAddMore } = useNavFavorites();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    "meine-kompanie": true,
    "gemeinschaft": false,
    "mein-bereich": false,
    "verein": false,
    "members-org": false,
    "events": false,
    "content": false,
    "magazine": false,
    "system": false,
  });

  // Build navigation structure based on mode
  const navStructure = useMemo(() => {
    // Filter items by permission - defined inside useMemo to avoid closure issues
    const filterByPermission = (items: NavItem[]) => 
      items.filter((item) => !item.permission || hasPermission(item.permission));

    if (isAdminMode) {
      // ADMIN MODE - Full management view
      return {
        startItems: adminStartItems,
        memberGroups: [], // No member groups in admin mode
        adminGroups: [
          { id: "members-org", label: "Organisation", items: filterByPermission(adminMembersOrgItems), icon: Users },
          { id: "events", label: "Planung", items: filterByPermission(adminEventsItems), icon: Calendar },
          { id: "content", label: "Inhalte", items: filterByPermission(adminContentItems), icon: Megaphone },
          { id: "magazine", label: "Schützenheft", items: filterByPermission(adminMagazineItems), icon: Book },
          { id: "system", label: "System", items: filterByPermission(adminSystemItems), icon: Cog },
        ].filter((g) => g.items.length > 0),
      };
    }
    
    // MEMBER MODE - Community-focused view
    return {
      startItems: memberStartItems,
      memberGroups: [
        { id: "meine-kompanie", label: "Meine Kompanie", items: memberCompanyItems, icon: Building2 },
        { id: "gemeinschaft", label: "Gemeinschaft", items: memberCommunityItems, icon: Users2 },
        { id: "mein-bereich", label: "Mein Bereich", items: memberPersonalItems, icon: UserCircle },
        { id: "verein", label: "Verein", items: memberClubItems, icon: Globe },
      ],
      adminGroups: [],
    };
  }, [isAdminMode, hasPermission]);

  // All items flat for search and favorites
  const allItems = useMemo(() => {
    const items = [...navStructure.startItems];
    navStructure.memberGroups.forEach((g) => items.push(...g.items));
    navStructure.adminGroups.forEach((g) => items.push(...g.items));
    return items;
  }, [navStructure]);

  // Favorite items
  const favoriteItems = useMemo(() => {
    return favorites
      .map((href) => allItems.find((item) => item.href === href))
      .filter((item): item is NavItem => !!item);
  }, [favorites, allItems]);

  // Search filtered items
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const query = searchQuery.toLowerCase();
    return allItems.filter((item) => {
      const labelMatch = item.label.toLowerCase().includes(query);
      const keywordMatch = item.keywords?.some((k) => k.toLowerCase().includes(query));
      return labelMatch || keywordMatch;
    });
  }, [searchQuery, allItems]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const isActive = (href: string) => {
    if (href === "/portal" || href === "/portal/admin") {
      return location.pathname === href;
    }
    // Handle query params in href
    const basePath = href.split("?")[0];
    return location.pathname.startsWith(basePath);
  };

  const handleNavClick = () => {
    setSearchQuery("");
    onNavigate?.();
  };

  const renderNavItem = (item: NavItem, showFavorite = true) => {
    const active = isActive(item.href);
    const starred = isFavorite(item.href);

    return (
      <div key={item.href} className="group relative">
        <Link
          to={item.href}
          onClick={handleNavClick}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm",
            active
              ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
              : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
          )}
        >
          <item.icon className="w-4 h-4 shrink-0" />
          <span className="truncate flex-1">{item.label}</span>
          {active && <ChevronRight className="w-4 h-4 shrink-0" />}
        </Link>
        
        {/* Favorite toggle button */}
        {showFavorite && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (starred || canAddMore) {
                    toggleFavorite(item.href);
                  }
                }}
                className={cn(
                  "absolute right-1 top-1/2 -translate-y-1/2 p-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity",
                  starred 
                    ? "text-amber-500 hover:text-amber-600" 
                    : "text-sidebar-foreground/40 hover:text-sidebar-foreground/70",
                  !starred && !canAddMore && "cursor-not-allowed opacity-30"
                )}
                disabled={!starred && !canAddMore}
              >
                {starred ? <Star className="w-3.5 h-3.5 fill-current" /> : <StarOff className="w-3.5 h-3.5" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              {starred ? "Aus Favoriten entfernen" : canAddMore ? "Zu Favoriten hinzufügen" : "Max. 5 Favoriten"}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    );
  };

  const renderGroup = (group: NavGroup, isAdminGroup = false) => {
    const isOpen = expandedGroups[group.id] ?? false;
    const hasActiveItem = group.items.some((item) => isActive(item.href));

    return (
      <div key={group.id} className="space-y-1">
        <button
          onClick={() => toggleGroup(group.id)}
          className={cn(
            "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium uppercase tracking-wide transition-colors",
            hasActiveItem
              ? "text-sidebar-foreground"
              : "text-sidebar-foreground/50 hover:text-sidebar-foreground/70"
          )}
        >
          {group.icon && <group.icon className="w-3.5 h-3.5" />}
          <span className="flex-1 text-left">{group.label}</span>
          <ChevronDown
            className={cn(
              "w-4 h-4 transition-transform",
              isOpen && "rotate-180"
            )}
          />
        </button>
        
        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="pl-2 space-y-0.5">
                {group.items.map((item) => renderNavItem(item))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="px-3 py-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Suchen…"
            className="pl-8 h-9 text-sm bg-sidebar-accent/30 border-sidebar-border"
          />
        </div>
      </div>

      {/* Navigation content */}
      <nav className="flex-1 overflow-y-auto px-2 pb-4 space-y-3">
        {/* Search results */}
        {searchResults ? (
          <div className="space-y-1">
            <p className="px-3 py-1 text-xs text-sidebar-foreground/50">
              {searchResults.length} {searchResults.length === 1 ? "Ergebnis" : "Ergebnisse"}
            </p>
            {searchResults.map((item) => renderNavItem(item))}
            {searchResults.length === 0 && (
              <p className="px-3 py-4 text-sm text-sidebar-foreground/50 text-center">
                Keine Einträge gefunden
              </p>
            )}
          </div>
        ) : (
          <>
            {/* Favorites */}
            {favoriteItems.length > 0 && (
              <div className="space-y-1">
                <div className="px-3 py-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-amber-600 dark:text-amber-500">
                  <Star className="w-3 h-3 fill-current" />
                  <span>Favoriten</span>
                </div>
                {favoriteItems.map((item) => renderNavItem(item, false))}
              </div>
            )}

            {/* Start Item (Dashboard/Verwaltung) - always visible */}
            <div className="space-y-1">
              {(isAdminMode ? adminStartItems : memberStartItems).map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={handleNavClick}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium",
                    isActive(item.href)
                      ? "bg-primary text-primary-foreground"
                      : "bg-sidebar-accent text-sidebar-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground"
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  <span>{item.label}</span>
                  {isActive(item.href) && <ChevronRight className="w-4 h-4 ml-auto" />}
                </Link>
              ))}
            </div>

            {/* Member Groups (only in member mode) */}
            {navStructure.memberGroups.length > 0 && (
              <div className="space-y-1">
                {navStructure.memberGroups.map((group) => renderGroup(group))}
              </div>
            )}

            {/* Admin Groups (only in admin mode) */}
            {isAdminMode && navStructure.adminGroups.length > 0 && (
              <div className="space-y-1 pt-2 border-t border-sidebar-border">
                {navStructure.adminGroups.map((group) => renderGroup(group, true))}
              </div>
            )}

            {/* Mode Toggle - only show if user can toggle */}
            {canToggle && (
              <div className="pt-2 border-t border-sidebar-border">
                <button
                  onClick={() => {
                    toggleMode();
                    onNavigate?.();
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm",
                    isAdminMode
                      ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20"
                      : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                >
                  <ToggleRight className={cn("w-4 h-4 shrink-0", isAdminMode && "text-amber-600")} />
                  <span className="truncate flex-1">
                    {isAdminMode ? "Zum Mitglieder-Menü" : "Admin-Modus aktivieren"}
                  </span>
                </button>
              </div>
            )}

            {/* Onboarding restart link */}
            {onRestartOnboarding && (
              <div className="pt-2 border-t border-sidebar-border">
                <button
                  onClick={() => {
                    onRestartOnboarding();
                    onNavigate?.();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm text-sidebar-foreground/50 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                >
                  <Sparkles className="w-4 h-4 shrink-0" />
                  <span className="truncate">Einführung ansehen</span>
                </button>
              </div>
            )}
          </>
        )}
      </nav>
    </div>
  );
}
