import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Calendar,
  Users,
  Newspaper,
  Image,
  FileText,
  ChevronRight,
  ChevronLeft,
  Check,
  Sparkles,
  Shield,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useUIMode } from "@/hooks/useUIMode";
import { OnboardingInterests } from "@/hooks/useOnboarding";
import { cn } from "@/lib/utils";

interface OnboardingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: (interests: OnboardingInterests) => void;
  onSkip: () => void;
}

const TOTAL_STEPS = 5;

const interestOptions = [
  {
    key: "events" as const,
    label: "Termine & Veranstaltungen",
    icon: Calendar,
    description: "Schützenfeste, Übungen, Versammlungen",
  },
  {
    key: "workshifts" as const,
    label: "Arbeitsdienste & Helfereinsätze",
    icon: Users,
    description: "Helfen und Punkte sammeln",
  },
  {
    key: "news" as const,
    label: "Neuigkeiten & Aushang",
    icon: Newspaper,
    description: "Aktuelles aus dem Verein",
  },
  {
    key: "gallery" as const,
    label: "Fotos & Galerie",
    icon: Image,
    description: "Erinnerungen und Impressionen",
  },
  {
    key: "documents" as const,
    label: "Dokumente & Protokolle",
    icon: FileText,
    description: "Wichtige Unterlagen",
  },
];

export function OnboardingDialog({
  open,
  onOpenChange,
  onComplete,
  onSkip,
}: OnboardingDialogProps) {
  const navigate = useNavigate();
  const { member, isAdmin } = useAuth();
  const { canToggle } = useUIMode();
  const [step, setStep] = useState(1);
  const [interests, setInterests] = useState<OnboardingInterests>({
    events: true,
    workshifts: true,
    news: true,
    gallery: false,
    documents: false,
  });

  const handleInterestToggle = (key: keyof OnboardingInterests) => {
    setInterests((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleNext = () => {
    if (step < TOTAL_STEPS) {
      setStep(step + 1);
    } else {
      onComplete(interests);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSkip = () => {
    onSkip();
  };

  const handleClose = () => {
    onOpenChange(false);
    onSkip();
  };

  const handleNavigateTo = (path: string) => {
    onComplete(interests);
    navigate(path);
  };

  // Get contextual hints based on interests
  const getHints = () => {
    const hints = [];
    if (interests.events) {
      hints.push({
        label: "Termine findest du hier",
        path: "/portal/dashboard",
        icon: Calendar,
      });
    }
    if (interests.workshifts) {
      hints.push({
        label: "Arbeitsdienste findest du direkt im jeweiligen Event",
        path: "/portal/dashboard",
        icon: Users,
      });
    }
    if (interests.news) {
      hints.push({
        label: "Neue Infos findest du im Aushang",
        path: "/portal/posts",
        icon: Newspaper,
      });
    }
    return hints.slice(0, 3); // Max 3 hints
  };

  // Role display
  const getRoleDisplay = () => {
    if (isAdmin || canToggle) {
      return {
        title: "Verantwortlicher / Vorstand",
        description: "Du hast Zugriff auf Verwaltungsfunktionen",
      };
    }
    return {
      title: "Mitglied",
      description: "Du siehst alle relevanten Vereinsinhalte",
    };
  };

  const roleInfo = getRoleDisplay();
  const hints = getHints();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none z-10"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Schließen</span>
        </button>

        {/* Progress bar */}
        <div className="h-1 bg-muted">
          <motion.div
            className="h-full bg-primary"
            initial={{ width: 0 }}
            animate={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        {/* Step indicator */}
        <div className="flex justify-center gap-2 pt-6 pb-2">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "w-2 h-2 rounded-full transition-colors",
                i + 1 === step
                  ? "bg-primary"
                  : i + 1 < step
                    ? "bg-primary/50"
                    : "bg-muted-foreground/20"
              )}
            />
          ))}
        </div>

        {/* Content */}
        <div className="p-6 pt-2 min-h-[320px] flex flex-col">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="flex-1 flex flex-col"
            >
              {/* Step 1: Welcome */}
              {step === 1 && (
                <div className="flex-1 flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                    <Sparkles className="w-8 h-8 text-primary" />
                  </div>
                  <h2 className="text-xl font-bold mb-3">
                    Willkommen im Vereinsportal 👋
                  </h2>
                  <p className="text-muted-foreground max-w-xs">
                    Hier findest du Termine, Arbeitsdienste und Neuigkeiten rund um unseren Verein.
                  </p>
                </div>
              )}

              {/* Step 2: Interests */}
              {step === 2 && (
                <div className="flex-1 flex flex-col">
                  <h2 className="text-lg font-bold mb-1 text-center">
                    Was interessiert dich?
                  </h2>
                  <p className="text-sm text-muted-foreground mb-4 text-center">
                    Wähle aus, was für dich wichtig ist
                  </p>
                  <div className="space-y-2 flex-1">
                    {interestOptions.map((option) => {
                      const Icon = option.icon;
                      const isChecked = interests[option.key];
                      return (
                        <label
                          key={option.key}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                            isChecked
                              ? "border-primary bg-primary/5"
                              : "border-border hover:bg-muted/50"
                          )}
                        >
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={() => handleInterestToggle(option.key)}
                          />
                          <Icon className={cn(
                            "w-5 h-5",
                            isChecked ? "text-primary" : "text-muted-foreground"
                          )} />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium block">
                              {option.label}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {option.description}
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Step 3: Role */}
              {step === 3 && (
                <div className="flex-1 flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                    <Shield className="w-8 h-8 text-primary" />
                  </div>
                  <h2 className="text-lg font-bold mb-2">
                    Deine Rolle im Verein
                  </h2>
                  <div className="bg-muted rounded-lg px-4 py-3 mb-3">
                    <p className="font-medium">{roleInfo.title}</p>
                  </div>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    {roleInfo.description}
                  </p>
                  {(isAdmin || canToggle) && (
                    <p className="text-xs text-muted-foreground mt-4 max-w-xs">
                      Als Verantwortlicher findest du deine Aufgaben im Bereich „Verwaltung".
                    </p>
                  )}
                </div>
              )}

              {/* Step 4: Orientation */}
              {step === 4 && (
                <div className="flex-1 flex flex-col">
                  <h2 className="text-lg font-bold mb-1 text-center">
                    Kurze Orientierung
                  </h2>
                  <p className="text-sm text-muted-foreground mb-4 text-center">
                    Hier findest du, was dich interessiert
                  </p>
                  <div className="space-y-3 flex-1">
                    {hints.length > 0 ? (
                      hints.map((hint, index) => {
                        const Icon = hint.icon;
                        return (
                          <div
                            key={index}
                            className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                          >
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <Icon className="w-5 h-5 text-primary" />
                            </div>
                            <p className="flex-1 text-sm">{hint.label}</p>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleNavigateTo(hint.path)}
                              className="shrink-0"
                            >
                              Anzeigen
                              <ChevronRight className="w-4 h-4 ml-1" />
                            </Button>
                          </div>
                        );
                      })
                    ) : (
                      <div className="flex-1 flex items-center justify-center text-center text-muted-foreground">
                        <p>Wähle im vorherigen Schritt deine Interessen aus.</p>
                      </div>
                    )}
                  </div>
                  {(isAdmin || canToggle) && (
                    <div className="mt-4 p-3 rounded-lg border border-primary/20 bg-primary/5">
                      <div className="flex items-center gap-3">
                        <Shield className="w-5 h-5 text-primary shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">Verwaltungsbereich</p>
                          <p className="text-xs text-muted-foreground">
                            Hier findest du alle Admin-Funktionen
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleNavigateTo("/portal/admin")}
                          className="shrink-0"
                        >
                          Öffnen
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Step 5: Done */}
              {step === 5 && (
                <div className="flex-1 flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-6">
                    <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
                  </div>
                  <h2 className="text-xl font-bold mb-3">
                    Du bist startklar 👍
                  </h2>
                  <p className="text-muted-foreground max-w-xs">
                    Wenn du Fragen hast, melde dich gerne beim Vorstand.
                  </p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-muted/30 flex items-center justify-between">
          {step === 1 ? (
            <>
              <Button variant="ghost" onClick={handleSkip}>
                Später ansehen
              </Button>
              <Button onClick={handleNext}>
                Los geht's
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </>
          ) : step === TOTAL_STEPS ? (
            <>
              <Button variant="ghost" onClick={handleBack}>
                <ChevronLeft className="w-4 h-4 mr-1" />
                Zurück
              </Button>
              <Button onClick={() => onComplete(interests)}>
                Zum Portal
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={handleBack}>
                <ChevronLeft className="w-4 h-4 mr-1" />
                Zurück
              </Button>
              <Button onClick={handleNext}>
                Weiter
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
