import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Bell,
  Download,
  Loader2,
  Lock,
  Mail,
  Save,
  Shield,
  Trash2,
  Upload,
  UserCircle,
} from "lucide-react";
import PortalLayout from "@/components/portal/PortalLayout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api, apiJson, apiUpload, clearToken, getStorageUrl } from "@/integrations/api/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";

interface AccountMember {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  status: string;
  avatar_url: string | null;
  street?: string | null;
  zip?: string | null;
  city?: string | null;
  birthday?: string | null;
  member_since?: string | null;
  title?: string | null;
  bio?: string | null;
  created_at?: string;
}

interface AccountNotifications {
  email_enabled: boolean;
  notify_posts: boolean;
  notify_events: boolean;
}

interface AccountData {
  member: AccountMember;
  role: { role: string } | null;
  notifications: AccountNotifications;
}

const AccountSettings = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { refreshPermissions } = useAuth();
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [account, setAccount] = useState<AccountData | null>(null);
  const [profile, setProfile] = useState({ first_name: "", last_name: "", email: "", phone: "" });
  const [passwords, setPasswords] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [notifications, setNotifications] = useState<AccountNotifications>({
    email_enabled: true,
    notify_posts: true,
    notify_events: true,
  });
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1);
  const [deleteForm, setDeleteForm] = useState({ password: "", confirmText: "", reason: "" });
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    void loadAccount();
  }, []);

  const avatarUrl = useMemo(() => {
    const avatar = account?.member.avatar_url;
    if (!avatar) return undefined;
    if (avatar.startsWith("http") || avatar.startsWith("/")) return avatar;
    return getStorageUrl("avatars", avatar) || undefined;
  }, [account?.member.avatar_url]);

  const loadAccount = async () => {
    setLoading(true);
    try {
      const data = await apiJson<AccountData>("/api/account");
      setAccount(data);
      setProfile({
        first_name: data.member.first_name || "",
        last_name: data.member.last_name || "",
        email: data.member.email || "",
        phone: data.member.phone || "",
      });
      setNotifications({
        email_enabled: data.notifications.email_enabled,
        notify_posts: data.notifications.notify_posts,
        notify_events: data.notifications.notify_events,
      });
    } catch (error) {
      toast({ title: "Fehler", description: (error as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      const member = await apiJson<AccountMember>("/api/account/profile", {
        method: "PATCH",
        body: JSON.stringify(profile),
      });
      setAccount((prev) => prev ? { ...prev, member } : prev);
      await refreshPermissions();
      toast({ title: "Gespeichert", description: "Profil wurde aktualisiert." });
    } catch (error) {
      toast({ title: "Fehler", description: (error as Error).message, variant: "destructive" });
    } finally {
      setSavingProfile(false);
    }
  };

  const uploadAvatar = async (file: File | null) => {
    if (!file) return;
    try {
      const result = await apiUpload("/api/account/avatar", file);
      setAccount((prev) => prev ? { ...prev, member: { ...prev.member, avatar_url: result.avatar_url } } : prev);
      await refreshPermissions();
      toast({ title: "Gespeichert", description: "Profilbild wurde aktualisiert." });
    } catch (error) {
      toast({ title: "Fehler", description: (error as Error).message, variant: "destructive" });
    }
  };

  const savePassword = async () => {
    setSavingPassword(true);
    try {
      await apiJson("/api/account/password", { method: "POST", body: JSON.stringify(passwords) });
      setPasswords({ currentPassword: "", newPassword: "", confirmPassword: "" });
      toast({ title: "Passwort geaendert", description: "Ihr Passwort wurde erfolgreich aktualisiert." });
    } catch (error) {
      toast({ title: "Fehler", description: (error as Error).message, variant: "destructive" });
    } finally {
      setSavingPassword(false);
    }
  };

  const saveNotifications = async () => {
    setSavingNotifications(true);
    try {
      const updated = await apiJson<AccountNotifications>("/api/account/notifications", {
        method: "PUT",
        body: JSON.stringify(notifications),
      });
      setNotifications({
        email_enabled: updated.email_enabled,
        notify_posts: updated.notify_posts,
        notify_events: updated.notify_events,
      });
      toast({ title: "Gespeichert", description: "Benachrichtigungen wurden aktualisiert." });
    } catch (error) {
      toast({ title: "Fehler", description: (error as Error).message, variant: "destructive" });
    } finally {
      setSavingNotifications(false);
    }
  };

  const downloadData = async () => {
    try {
      const response = await api.fetch("/api/account/export");
      if (!response.ok) throw new Error("Export konnte nicht erstellt werden");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `konto-export-${account?.member.id || "daten"}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast({ title: "Fehler", description: (error as Error).message, variant: "destructive" });
    }
  };

  const deactivateAccount = async () => {
    setDeleting(true);
    try {
      await apiJson("/api/account/deactivate", { method: "POST", body: JSON.stringify(deleteForm) });
      clearToken();
      navigate("/", { replace: true });
    } catch (error) {
      toast({ title: "Fehler", description: (error as Error).message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
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

  return (
    <PortalLayout>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Kontoeinstellungen</h1>
          <p className="text-muted-foreground mt-1">Profil, Sicherheit und Datenschutz verwalten</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><UserCircle className="w-5 h-5" />Profil</CardTitle>
            <CardDescription>Persoenliche Angaben fuer Ihr Mitgliedskonto</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
              <Avatar className="w-20 h-20">
                <AvatarImage src={avatarUrl} className="object-cover" />
                <AvatarFallback>{profile.first_name[0]}{profile.last_name[0]}</AvatarFallback>
              </Avatar>
              <div>
                <Label htmlFor="avatar" className="inline-flex items-center gap-2 cursor-pointer">
                  <Button type="button" variant="outline" asChild>
                    <span><Upload className="w-4 h-4 mr-2" />Profilbild ändern</span>
                  </Button>
                </Label>
                <Input id="avatar" type="file" accept="image/*" className="hidden" onChange={(e) => uploadAvatar(e.target.files?.[0] || null)} />
                <p className="text-xs text-muted-foreground mt-2">JPG oder PNG, wird als Profilbild gespeichert.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><Label>Vorname</Label><Input value={profile.first_name} onChange={(e) => setProfile((p) => ({ ...p, first_name: e.target.value }))} /></div>
              <div><Label>Nachname</Label><Input value={profile.last_name} onChange={(e) => setProfile((p) => ({ ...p, last_name: e.target.value }))} /></div>
              <div><Label>E-Mail-Adresse</Label><Input type="email" value={profile.email} onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))} /></div>
              <div><Label>Telefonnummer</Label><Input value={profile.phone} onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))} placeholder="+49 ..." /></div>
            </div>
            <Button onClick={saveProfile} disabled={savingProfile}>
              {savingProfile ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Änderungen speichern
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Lock className="w-5 h-5" />Passwort & Sicherheit</CardTitle>
            <CardDescription>Verwenden Sie ein sicheres Passwort mit mindestens 8 Zeichen</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><Label>Aktuelles Passwort</Label><Input type="password" value={passwords.currentPassword} onChange={(e) => setPasswords((p) => ({ ...p, currentPassword: e.target.value }))} /></div>
              <div><Label>Neues Passwort</Label><Input type="password" value={passwords.newPassword} onChange={(e) => setPasswords((p) => ({ ...p, newPassword: e.target.value }))} /></div>
              <div><Label>Passwort bestätigen</Label><Input type="password" value={passwords.confirmPassword} onChange={(e) => setPasswords((p) => ({ ...p, confirmPassword: e.target.value }))} /></div>
            </div>
            <Button onClick={savePassword} disabled={savingPassword}>
              {savingPassword ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Shield className="w-4 h-4 mr-2" />}
              Passwort ändern
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Bell className="w-5 h-5" />Benachrichtigungen</CardTitle>
            <CardDescription>Grundlegende Benachrichtigungen fuer Ihr Konto</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ToggleRow icon={<Mail className="w-5 h-5" />} title="E-Mail-Benachrichtigungen" description="Wichtige Meldungen per E-Mail erhalten" checked={notifications.email_enabled} onChange={(v) => setNotifications((n) => ({ ...n, email_enabled: v }))} />
            <Separator />
            <ToggleRow icon={<Bell className="w-5 h-5" />} title="Vereins-News" description="Neue Beitraege und Aushang-Meldungen" checked={notifications.notify_posts} onChange={(v) => setNotifications((n) => ({ ...n, notify_posts: v }))} />
            <Separator />
            <ToggleRow icon={<Bell className="w-5 h-5" />} title="Event-Benachrichtigungen" description="Termine, Aenderungen und Erinnerungen" checked={notifications.notify_events} onChange={(v) => setNotifications((n) => ({ ...n, notify_events: v }))} />
            <Button onClick={saveNotifications} disabled={savingNotifications}>
              {savingNotifications ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Einstellungen speichern
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Shield className="w-5 h-5" />Datenschutz</CardTitle>
            <CardDescription>Auskunft ueber gespeicherte personenbezogene Daten</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <DataItem label="Name" value={`${account?.member.first_name} ${account?.member.last_name}`} />
              <DataItem label="E-Mail" value={account?.member.email} />
              <DataItem label="Telefon" value={account?.member.phone || "Nicht hinterlegt"} />
              <DataItem label="Mitgliedsstatus" value={account?.member.status} />
              <DataItem label="Rolle" value={account?.role?.role || "Mitglied"} />
              <DataItem label="Profilbild" value={account?.member.avatar_url ? "Hinterlegt" : "Nicht hinterlegt"} />
            </div>
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertTitle>DSGVO-Hinweis</AlertTitle>
              <AlertDescription>
                Der Export enthaelt Ihre Kontodaten in strukturierter JSON-Form. Vereins-, Buchhaltungs- und Nachweisdaten koennen gesetzlichen Aufbewahrungspflichten unterliegen.
              </AlertDescription>
            </Alert>
            <Button variant="outline" onClick={downloadData}><Download className="w-4 h-4 mr-2" />Meine Daten herunterladen</Button>
          </CardContent>
        </Card>

        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="w-5 h-5" />Danger Zone</CardTitle>
            <CardDescription>Account deaktivieren und Löschanforderung vormerken</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Ihr Login wird deaktiviert. Mitgliedschafts-, Vereins- und Nachweisdaten werden zunaechst aufbewahrt, soweit rechtliche Pflichten dies erfordern.
            </p>
            <Button variant="destructive" onClick={() => { setDeleteStep(1); setDeleteOpen(true); }}><Trash2 className="w-4 h-4 mr-2" />Account löschen</Button>
          </CardContent>
        </Card>

        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{deleteStep === 1 ? "Account löschen?" : "Endgültig bestätigen"}</AlertDialogTitle>
              <AlertDialogDescription>
                {deleteStep === 1
                  ? "Dies ist eine zweistufige Sicherheitsabfrage. Im naechsten Schritt bestaetigen Sie mit Passwort und Text."
                  : "Geben Sie Ihr Passwort ein und schreiben Sie ACCOUNT LOESCHEN in das Bestaetigungsfeld."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            {deleteStep === 2 && (
              <div className="space-y-3">
                <div><Label>Passwort</Label><Input type="password" value={deleteForm.password} onChange={(e) => setDeleteForm((f) => ({ ...f, password: e.target.value }))} /></div>
                <div><Label>Bestätigungstext</Label><Input value={deleteForm.confirmText} onChange={(e) => setDeleteForm((f) => ({ ...f, confirmText: e.target.value }))} placeholder="ACCOUNT LOESCHEN" /></div>
                <div><Label>Grund optional</Label><Textarea value={deleteForm.reason} onChange={(e) => setDeleteForm((f) => ({ ...f, reason: e.target.value }))} rows={2} /></div>
              </div>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
              {deleteStep === 1 ? (
                <Button variant="destructive" onClick={() => setDeleteStep(2)}>Weiter</Button>
              ) : (
                <AlertDialogAction onClick={(e) => { e.preventDefault(); void deactivateAccount(); }} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Account deaktivieren
                </AlertDialogAction>
              )}
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </motion.div>
    </PortalLayout>
  );
};

const ToggleRow = ({ icon, title, description, checked, onChange }: { icon: React.ReactNode; title: string; description: string; checked: boolean; onChange: (value: boolean) => void }) => (
  <div className="flex items-center justify-between gap-4">
    <div className="flex items-center gap-3">
      <div className="text-muted-foreground">{icon}</div>
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
    <Switch checked={checked} onCheckedChange={onChange} />
  </div>
);

const DataItem = ({ label, value }: { label: string; value?: string | null }) => (
  <div className="rounded-lg border bg-muted/30 px-3 py-2">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="font-medium break-words">{value || "-"}</p>
  </div>
);

export default AccountSettings;
