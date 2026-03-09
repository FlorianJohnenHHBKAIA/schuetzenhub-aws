import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Share, Plus, ArrowLeft, Smartphone, Monitor, CheckCircle2 } from "lucide-react";
import { usePWA } from "@/hooks/usePWA";

export default function InstallPage() {
  const navigate = useNavigate();
  const { isInstalled, isStandalone, canInstall, isIOS, promptInstall } = usePWA();

  const handleInstall = async () => {
    if (isIOS) {
      // Scroll to iOS instructions
      document.getElementById("ios-instructions")?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    
    const success = await promptInstall();
    if (success) {
      // Installation triggered
    }
  };

  if (isInstalled || isStandalone) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl">Bereits installiert!</CardTitle>
            <CardDescription>
              Das Schützenportal ist bereits auf deinem Gerät installiert.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button onClick={() => navigate("/portal")} className="w-full">
              Zum Portal
            </Button>
            <Button variant="outline" onClick={() => navigate("/")} className="w-full">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Zur Startseite
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 bg-card border-b border-border z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate(-1)} className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Zurück
          </Button>
          <h1 className="font-display font-bold text-lg">App installieren</h1>
          <div className="w-20" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl space-y-8">
        {/* Hero Section */}
        <div className="text-center space-y-4">
          <div className="mx-auto w-20 h-20 rounded-2xl bg-primary flex items-center justify-center">
            <img src="/pwa-icon-192.png" alt="App Icon" className="w-16 h-16 rounded-xl" />
          </div>
          <h2 className="text-3xl font-display font-bold">Schützenportal</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Installiere das Schützenportal als App auf deinem Gerät für schnellen Zugriff und eine bessere Nutzererfahrung.
          </p>
        </div>

        {/* Benefits */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-primary" />
              Vorteile der App
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Schneller Zugriff</p>
                <p className="text-sm text-muted-foreground">
                  Starte das Portal direkt vom Home-Bildschirm
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Vollbild-Modus</p>
                <p className="text-sm text-muted-foreground">
                  Ohne störende Browserleiste – wie eine echte App
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Offline-Unterstützung</p>
                <p className="text-sm text-muted-foreground">
                  Grundfunktionen auch ohne Internetverbindung
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Install Button (Android/Desktop) */}
        {!isIOS && canInstall && (
          <Button onClick={handleInstall} size="lg" className="w-full text-lg py-6">
            <Download className="w-5 h-5 mr-2" />
            Jetzt installieren
          </Button>
        )}

        {/* iOS Instructions */}
        {isIOS && (
          <Card id="ios-instructions" className="border-primary/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-primary" />
                Installation auf iPhone/iPad
              </CardTitle>
              <CardDescription>
                Folge diesen Schritten, um die App zu installieren:
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                  1
                </div>
                <div className="flex-1 pt-2">
                  <p className="font-medium mb-1">Tippe auf "Teilen"</p>
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    Tippe auf das <Share className="w-4 h-4" /> Symbol in der Safari-Leiste unten
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                  2
                </div>
                <div className="flex-1 pt-2">
                  <p className="font-medium mb-1">Wähle "Zum Home-Bildschirm"</p>
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    Scrolle im Menü nach unten und tippe auf <Plus className="w-4 h-4" /> "Zum Home-Bildschirm"
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                  3
                </div>
                <div className="flex-1 pt-2">
                  <p className="font-medium mb-1">Bestätige mit "Hinzufügen"</p>
                  <p className="text-sm text-muted-foreground">
                    Tippe oben rechts auf "Hinzufügen" – fertig!
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Desktop Info */}
        {!isIOS && !canInstall && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="w-5 h-5 text-primary" />
                Desktop-Installation
              </CardTitle>
              <CardDescription>
                In unterstützten Browsern (Chrome, Edge) erscheint ein Installations-Symbol in der Adressleiste.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Klicke auf das Symbol oder nutze das Browser-Menü → "App installieren" oder "Zum Startbildschirm hinzufügen".
              </p>
            </CardContent>
          </Card>
        )}

        {/* Back to Portal */}
        <div className="pt-4">
          <Button variant="outline" onClick={() => navigate("/portal")} className="w-full">
            Zurück zum Portal
          </Button>
        </div>
      </main>
    </div>
  );
}
