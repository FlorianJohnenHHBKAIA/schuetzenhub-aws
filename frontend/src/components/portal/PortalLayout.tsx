import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { OfflineBanner } from "@/components/pwa/OfflineBanner";
import { motion, AnimatePresence } from "framer-motion";
import { supabase, getStorageUrl } from "@/integrations/api/client";
import {
  LogOut,
  Menu,
  X,
  Shield,
  ChevronRight,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import NotificationBell from "./NotificationBell";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { SidebarNavigation } from "./SidebarNavigation";
import { OnboardingDialog } from "./OnboardingDialog";
import { useAuth } from "@/lib/auth";
import { useUIMode } from "@/hooks/useUIMode";
import { useOnboarding } from "@/hooks/useOnboarding";

interface PortalLayoutProps {
  children: ReactNode;
}

interface ClubInfo {
  name: string;
  slug: string;
  logo_path: string | null;
}

const PortalLayout = ({ children }: PortalLayoutProps) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [clubInfo, setClubInfo] = useState<ClubInfo | null>(null);
  const [clubLogoUrl, setClubLogoUrl] = useState<string | null>(null);
  const navigate = useNavigate();
  const { member, isAdmin, signOut } = useAuth();
  const { isAdminMode } = useUIMode();
  const {
    isOnboardingOpen,
    setIsOnboardingOpen,
    completeOnboarding,
    skipOnboarding,
    restartOnboarding,
  } = useOnboarding();

  useEffect(() => {
    const fetchClubInfo = async () => {
      if (!member?.club_id) return;
      
      const { data: club } = await supabase
        .from("clubs")
        .select("name, slug, logo_path")
        .eq("id", member.club_id)
        .single();
      
      const clubData = club as ClubInfo | null;

      if (clubData) {
        setClubInfo(clubData);
        
        if (clubData.logo_path) {
          const publicUrl = getStorageUrl("club-assets", clubData.logo_path) || "";
          setClubLogoUrl(publicUrl || null);
        }
      }
    };
    
    fetchClubInfo();
  }, [member?.club_id]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const closeSidebar = () => setIsSidebarOpen(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Offline Banner */}
      <div className="fixed top-0 left-0 right-0 z-[60] lg:left-64">
        <OfflineBanner />
      </div>
      
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-card border-b border-border px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <a 
              href={clubInfo?.slug ? `/verein/${clubInfo.slug}` : "/"} 
              target="_blank"
              rel="noopener noreferrer"
              className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center overflow-hidden hover:ring-2 hover:ring-primary/50 transition-all shrink-0"
              title="Zur öffentlichen Vereinsseite"
            >
              {clubLogoUrl ? (
                <img 
                  src={clubLogoUrl} 
                  alt={clubInfo?.name || "Vereinslogo"} 
                  className="w-full h-full object-cover"
                />
              ) : (
                <Shield className="w-4 h-4 text-primary-foreground" />
              )}
            </a>
            <span className="font-display font-bold text-foreground truncate max-w-[100px]">
              {clubInfo?.name || "Portal"}
            </span>
            {isAdminMode && (
              <span className="px-2 py-0.5 ml-1 rounded bg-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-medium">
                Admin
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
            >
              {isSidebarOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-40 h-screen w-64 bg-sidebar transition-transform duration-300 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
      >
        <div className="flex flex-col h-full">
          {/* Club Logo */}
          <div className="p-4 border-b border-sidebar-border">
            <a 
              href={clubInfo?.slug ? `/verein/${clubInfo.slug}` : "/"} 
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 group"
              title="Zur öffentlichen Vereinsseite"
            >
              <div className="w-10 h-10 rounded-xl bg-sidebar-primary flex items-center justify-center overflow-hidden group-hover:ring-2 group-hover:ring-sidebar-accent transition-all shrink-0">
                {clubLogoUrl ? (
                  <img 
                    src={clubLogoUrl} 
                    alt={clubInfo?.name || "Vereinslogo"} 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Shield className="w-5 h-5 text-sidebar-primary-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-display text-sm font-bold text-sidebar-foreground truncate block group-hover:text-sidebar-primary transition-colors">
                  {clubInfo?.name || "SchützenHub"}
                </span>
                <span className="text-xs text-sidebar-foreground/50 flex items-center gap-1">
                  <Globe className="w-3 h-3" />
                  Zur Webseite
                </span>
              </div>
            </a>
          </div>

          {/* User Info */}
          <div className="p-3 border-b border-sidebar-border">
            <button
              onClick={() => {
                if (member?.id) {
                  navigate(`/portal/member/${member.id}`);
                  closeSidebar();
                }
              }}
              className="w-full flex items-center gap-3 p-2 -m-2 rounded-lg hover:bg-sidebar-accent/50 transition-colors group cursor-pointer"
            >
              <div className="w-9 h-9 rounded-full bg-sidebar-accent flex items-center justify-center text-sidebar-accent-foreground text-sm font-medium group-hover:ring-2 group-hover:ring-sidebar-primary transition-all overflow-hidden shrink-0">
                {member?.avatar_url ? (
                  <img src={member.avatar_url} alt="Profilbild" className="w-full h-full object-cover" />
                ) : (
                  <>{member?.first_name?.[0]}{member?.last_name?.[0]}</>
                )}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium text-sidebar-foreground truncate group-hover:text-sidebar-primary transition-colors">
                  {member?.first_name} {member?.last_name}
                </p>
                <p className="text-xs text-sidebar-foreground/60 truncate">
                  {isAdmin ? "Administrator" : "Mitglied"}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-sidebar-foreground/40 group-hover:text-sidebar-primary transition-colors shrink-0" />
            </button>
          </div>

          {/* Desktop Notification Bell & Install Prompt */}
          <div className="hidden lg:flex flex-col gap-2 px-3 py-2 border-b border-sidebar-border">
            <div className="flex items-center justify-between">
              {isAdminMode ? (
                <span className="px-2 py-1 rounded bg-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-medium">
                  Admin-Modus
                </span>
              ) : (
                <span className="text-xs text-sidebar-foreground/50">Mitglieder-Menü</span>
              )}
              <NotificationBell />
            </div>
            <div className="flex justify-center">
              <InstallPrompt />
            </div>
          </div>

          {/* Navigation */}
          <div className="flex-1 overflow-hidden">
            <SidebarNavigation onNavigate={closeSidebar} onRestartOnboarding={restartOnboarding} />
          </div>

          {/* Logout */}
          <div className="p-3 border-t border-sidebar-border">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
              onClick={handleSignOut}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Abmelden
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeSidebar}
            className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="lg:ml-64 pt-16 lg:pt-0 min-h-screen">
        <div className="p-6 lg:p-8">{children}</div>
      </main>

      {/* Onboarding Dialog */}
      <OnboardingDialog
        open={isOnboardingOpen}
        onOpenChange={setIsOnboardingOpen}
        onComplete={completeOnboarding}
        onSkip={skipOnboarding}
      />
    </div>
  );
};

export default PortalLayout;