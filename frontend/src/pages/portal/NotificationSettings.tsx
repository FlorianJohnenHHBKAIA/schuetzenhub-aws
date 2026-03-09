import { useState } from "react";
import { motion } from "framer-motion";
import {
  Bell,
  Mail,
  Smartphone,
  Moon,
  Clock,
  Megaphone,
  Calendar,
  MessageSquare,
  Shield,
  BellRing,
  Loader2,
  Info,
  AlertTriangle,
} from "lucide-react";
import PortalLayout from "@/components/portal/PortalLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useNotificationSettings } from "@/hooks/useNotificationSettings";
import { CATEGORY_LABELS, type NotificationCategory } from "@/lib/notificationTypes";

const NotificationSettings = () => {
  const { settings, loading, saving, updateSettings } = useNotificationSettings();
  const [localSettings, setLocalSettings] = useState(settings);

  // Sync local state when settings load
  if (settings && !localSettings) {
    setLocalSettings(settings);
  }

  const handleChange = async (key: string, value: boolean | string) => {
    if (!localSettings) return;
    
    const updated = { ...localSettings, [key]: value };
    setLocalSettings(updated);
    await updateSettings({ [key]: value });
  };

  if (loading) {
    return (
      <PortalLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </PortalLayout>
    );
  }

  if (!localSettings) {
    return (
      <PortalLayout>
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <AlertTriangle className="w-12 h-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            Einstellungen konnten nicht geladen werden.
          </p>
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-3xl mx-auto space-y-6 p-4 lg:p-6"
      >
        {/* Header */}
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
            Benachrichtigungen
          </h1>
          <p className="text-muted-foreground mt-1">
            Wähle, wie und wann du informiert werden möchtest
          </p>
        </div>

        {/* Channels Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Bell className="w-5 h-5" />
              Benachrichtigungskanäle
            </CardTitle>
            <CardDescription>
              Aktiviere oder deaktiviere ganze Kanäle
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* In-App always on */}
            <div className="flex items-center justify-between py-3 px-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-primary" />
                <div>
                  <p className="font-medium">Im Portal</p>
                  <p className="text-sm text-muted-foreground">
                    Immer aktiv – zeigt die Glocke an
                  </p>
                </div>
              </div>
              <Badge variant="secondary">Immer an</Badge>
            </div>

            {/* Email */}
            <div className="flex items-center justify-between py-3 px-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">E-Mail</p>
                  <p className="text-sm text-muted-foreground">
                    Wichtige Benachrichtigungen per E-Mail
                  </p>
                </div>
              </div>
              <Switch
                checked={localSettings.email_enabled}
                onCheckedChange={(checked) => handleChange('email_enabled', checked)}
                disabled={saving}
              />
            </div>

            {/* Push */}
            <div className="flex items-center justify-between py-3 px-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <Smartphone className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Push-Benachrichtigungen</p>
                  <p className="text-sm text-muted-foreground">
                    Für die installierte App (PWA)
                  </p>
                </div>
              </div>
              <Switch
                checked={localSettings.push_enabled}
                onCheckedChange={(checked) => handleChange('push_enabled', checked)}
                disabled={saving}
              />
            </div>
          </CardContent>
        </Card>

        {/* Categories */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Megaphone className="w-5 h-5" />
              Kategorien
            </CardTitle>
            <CardDescription>
              Wähle, welche Arten von Benachrichtigungen du erhalten möchtest
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {/* Important */}
            <CategoryRow
              icon={<AlertTriangle className="w-5 h-5 text-orange-500" />}
              category="important"
              label={CATEGORY_LABELS.important.label}
              description={CATEGORY_LABELS.important.description}
              inApp={true}
              inAppLocked={true}
              email={localSettings.email_important}
              push={localSettings.push_important}
              onEmailChange={(v) => handleChange('email_important', v)}
              onPushChange={(v) => handleChange('push_important', v)}
              emailEnabled={localSettings.email_enabled}
              pushEnabled={localSettings.push_enabled}
              saving={saving}
            />

            <Separator />

            {/* Info */}
            <CategoryRow
              icon={<Info className="w-5 h-5 text-blue-500" />}
              category="info"
              label={CATEGORY_LABELS.info.label}
              description={CATEGORY_LABELS.info.description}
              inApp={localSettings.notify_posts}
              email={localSettings.email_info}
              push={false}
              pushLocked={true}
              onInAppChange={(v) => handleChange('notify_posts', v)}
              onEmailChange={(v) => handleChange('email_info', v)}
              emailEnabled={localSettings.email_enabled}
              pushEnabled={localSettings.push_enabled}
              saving={saving}
            />

            <Separator />

            {/* Reminders */}
            <CategoryRow
              icon={<BellRing className="w-5 h-5 text-purple-500" />}
              category="reminder"
              label={CATEGORY_LABELS.reminder.label}
              description={CATEGORY_LABELS.reminder.description}
              inApp={localSettings.notify_reminders}
              email={false}
              emailLocked={true}
              push={localSettings.push_reminders}
              onInAppChange={(v) => handleChange('notify_reminders', v)}
              onPushChange={(v) => handleChange('push_reminders', v)}
              emailEnabled={localSettings.email_enabled}
              pushEnabled={localSettings.push_enabled}
              saving={saving}
            />

            <Separator />

            {/* System */}
            <CategoryRow
              icon={<Shield className="w-5 h-5 text-slate-500" />}
              category="system"
              label={CATEGORY_LABELS.system.label}
              description={CATEGORY_LABELS.system.description}
              inApp={localSettings.notify_system}
              email={true}
              emailLocked={true}
              push={false}
              pushLocked={true}
              onInAppChange={(v) => handleChange('notify_system', v)}
              emailEnabled={localSettings.email_enabled}
              pushEnabled={localSettings.push_enabled}
              saving={saving}
            />
          </CardContent>
        </Card>

        {/* Quiet Hours */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Moon className="w-5 h-5" />
              Ruhezeiten
            </CardTitle>
            <CardDescription>
              Keine Push-Benachrichtigungen oder E-Mails in dieser Zeit
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Ruhezeit aktivieren</p>
                  <p className="text-sm text-muted-foreground">
                    Standard: 21:00 – 08:00 Uhr
                  </p>
                </div>
              </div>
              <Switch
                checked={localSettings.quiet_hours_enabled}
                onCheckedChange={(checked) => handleChange('quiet_hours_enabled', checked)}
                disabled={saving}
              />
            </div>

            {localSettings.quiet_hours_enabled && (
              <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                  <Info className="w-4 h-4" />
                  <span>
                    Kritische Benachrichtigungen (z.B. Terminausfall) werden trotzdem zugestellt.
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm">Von</Label>
                    <Select
                      value={localSettings.quiet_hours_start.slice(0, 5)}
                      onValueChange={(v) => handleChange('quiet_hours_start', `${v}:00`)}
                      disabled={saving}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {['20:00', '21:00', '22:00', '23:00'].map((t) => (
                          <SelectItem key={t} value={t}>{t} Uhr</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm">Bis</Label>
                    <Select
                      value={localSettings.quiet_hours_end.slice(0, 5)}
                      onValueChange={(v) => handleChange('quiet_hours_end', `${v}:00`)}
                      disabled={saving}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {['06:00', '07:00', '08:00', '09:00'].map((t) => (
                          <SelectItem key={t} value={t}>{t} Uhr</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Email Digest */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Mail className="w-5 h-5" />
              E-Mail-Zusammenfassung
            </CardTitle>
            <CardDescription>
              Erhalte eine Übersicht statt einzelner E-Mails
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Häufigkeit</p>
                <p className="text-sm text-muted-foreground">
                  Wie oft soll die Zusammenfassung gesendet werden?
                </p>
              </div>
              <Select
                value={localSettings.digest_frequency}
                onValueChange={(v) => handleChange('digest_frequency', v)}
                disabled={saving || !localSettings.email_enabled}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Keine</SelectItem>
                  <SelectItem value="daily">Täglich</SelectItem>
                  <SelectItem value="weekly">Wöchentlich</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Preview Card */}
        <Card className="bg-muted/30">
          <CardHeader>
            <CardTitle className="text-lg">Vorschau</CardTitle>
            <CardDescription>So sieht eine Benachrichtigung aus</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-background border rounded-lg p-4 flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">Neuer Termin: Schützenfest</p>
                <p className="text-sm text-muted-foreground">
                  Das Schützenfest wurde für den 15. Juni geplant
                </p>
                <p className="text-xs text-muted-foreground mt-1">Vor 5 Minuten</p>
              </div>
              <div className="w-2 h-2 rounded-full bg-primary" />
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </PortalLayout>
  );
};

// Category Row Component
interface CategoryRowProps {
  icon: React.ReactNode;
  category: NotificationCategory;
  label: string;
  description: string;
  inApp?: boolean;
  inAppLocked?: boolean;
  email?: boolean;
  emailLocked?: boolean;
  push?: boolean;
  pushLocked?: boolean;
  onInAppChange?: (value: boolean) => void;
  onEmailChange?: (value: boolean) => void;
  onPushChange?: (value: boolean) => void;
  emailEnabled: boolean;
  pushEnabled: boolean;
  saving: boolean;
}

const CategoryRow = ({
  icon,
  label,
  description,
  inApp = true,
  inAppLocked = false,
  email = false,
  emailLocked = false,
  push = false,
  pushLocked = false,
  onInAppChange,
  onEmailChange,
  onPushChange,
  emailEnabled,
  pushEnabled,
  saving,
}: CategoryRowProps) => {
  return (
    <div className="py-4">
      <div className="flex items-start gap-3 mb-3">
        {icon}
        <div>
          <p className="font-medium">{label}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="flex items-center gap-6 ml-8">
        {/* In-App */}
        <div className="flex items-center gap-2">
          <Switch
            checked={inApp}
            onCheckedChange={onInAppChange}
            disabled={saving || inAppLocked}
          />
          <Label className="text-sm text-muted-foreground">Portal</Label>
          {inAppLocked && (
            <Tooltip>
              <TooltipTrigger>
                <Info className="w-3 h-3 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>Immer aktiviert</TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Email */}
        <div className="flex items-center gap-2">
          <Switch
            checked={email && emailEnabled}
            onCheckedChange={onEmailChange}
            disabled={saving || emailLocked || !emailEnabled}
          />
          <Label className="text-sm text-muted-foreground">E-Mail</Label>
        </div>

        {/* Push */}
        <div className="flex items-center gap-2">
          <Switch
            checked={push && pushEnabled}
            onCheckedChange={onPushChange}
            disabled={saving || pushLocked || !pushEnabled}
          />
          <Label className="text-sm text-muted-foreground">Push</Label>
        </div>
      </div>
    </div>
  );
};

export default NotificationSettings;
