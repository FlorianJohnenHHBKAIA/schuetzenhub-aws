import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Download, Share, Plus, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSDialog, setShowIOSDialog] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }

    const dismissedAt = localStorage.getItem("pwa-install-dismissed");
    if (dismissedAt) {
      const dismissedDate = new Date(dismissedAt);
      const daysSinceDismissed = (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < 7) {
        setDismissed(true);
      }
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    window.addEventListener("appinstalled", () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const isIOS = () => {
    return (
      /iPad|iPhone|iPod/.test(navigator.userAgent) &&
      !("MSStream" in window)
    );
  };

  const handleInstallClick = async () => {
    if (isIOS()) {
      setShowIOSDialog(true);
      return;
    }

    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setDeferredPrompt(null);
      }
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem("pwa-install-dismissed", new Date().toISOString());
  };

  if (isInstalled || dismissed) {
    return null;
  }

  if (!deferredPrompt && !isIOS()) {
    return null;
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleInstallClick}
          className="flex items-center gap-2 border-primary/30 hover:bg-primary/10"
        >
          <Download className="w-4 h-4" />
          <span className="hidden sm:inline">App installieren</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDismiss}
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <Dialog open={showIOSDialog} onOpenChange={setShowIOSDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="w-5 h-5 text-primary" />
              App auf iPhone/iPad installieren
            </DialogTitle>
            <DialogDescription>
              Folge diesen Schritten, um das Schützenportal auf deinem Home-Bildschirm zu installieren:
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                1
              </div>
              <div className="flex-1">
                <p className="font-medium">Tippe auf "Teilen"</p>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  Tippe auf das <Share className="w-4 h-4 inline" /> Symbol in der Safari-Leiste
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                2
              </div>
              <div className="flex-1">
                <p className="font-medium">Wähle "Zum Home-Bildschirm"</p>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  Scrolle nach unten und tippe auf <Plus className="w-4 h-4 inline" /> "Zum Home-Bildschirm"
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                3
              </div>
              <div className="flex-1">
                <p className="font-medium">Bestätige mit "Hinzufügen"</p>
                <p className="text-sm text-muted-foreground">
                  Das Portal erscheint als App auf deinem Home-Bildschirm
                </p>
              </div>
            </div>
          </div>
          
          <Button onClick={() => setShowIOSDialog(false)} className="w-full">
            Verstanden
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}