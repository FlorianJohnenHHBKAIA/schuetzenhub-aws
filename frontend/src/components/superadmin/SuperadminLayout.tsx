import { ReactNode, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { LogOut, Menu, X, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import SuperadminSidebar from "./SuperadminSidebar";

interface SuperadminLayoutProps {
  children: ReactNode;
}

const SuperadminLayout = ({ children }: SuperadminLayoutProps) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const closeSidebar = () => setIsSidebarOpen(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-card border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-4 h-4 text-destructive" />
            </div>
            <div>
              <span className="font-bold text-sm text-foreground">SchützenHub</span>
              <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-destructive/10 text-destructive">
                SUPERADMIN
              </span>
            </div>
          </div>
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-40 h-screen w-64 bg-sidebar border-r border-sidebar-border transition-transform duration-300 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
      >
        <div className="flex flex-col h-full">
          {/* Branding */}
          <div className="p-4 border-b border-sidebar-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5 text-destructive" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-bold text-sm text-sidebar-foreground block truncate">
                  SchützenHub
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-destructive/15 text-destructive">
                  SUPERADMIN
                </span>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <SuperadminSidebar onNavigate={closeSidebar} />

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
    </div>
  );
};

export default SuperadminLayout;
