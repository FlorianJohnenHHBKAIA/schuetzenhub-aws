import { useState } from "react";
import { Bell, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiJson } from "@/integrations/api/client";
import { toast } from "sonner";

interface Company {
  id: string;
  name: string;
}

export interface NotifyMembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: "event" | "post" | "work_shift";
  entityId: string;
  entityTitle: string;
  ownerType: "club" | "company";
  ownerId: string;
  clubId: string;
  companies?: Company[];
  currentMemberId?: string;
}

function defaultMessage(entityType: string, entityTitle: string): string {
  if (entityType === "event") return `Bitte beachte den Termin: ${entityTitle}`;
  if (entityType === "post") return `Bitte beachte den Aushang: ${entityTitle}`;
  return `Für „${entityTitle}" werden noch Helfer gesucht.`;
}

function entityLink(entityType: string, entityId: string): string {
  if (entityType === "post") return `/portal/posts/${entityId}`;
  return `/portal/events/${entityId}/organize`;
}

function notificationType(entityType: string): string {
  if (entityType === "post") return "new_post";
  if (entityType === "work_shift") return "workshift_assigned";
  return "new_event";
}

function notificationTitle(entityType: string, entityTitle: string): string {
  if (entityType === "post") return `Neuer Aushang: ${entityTitle}`;
  if (entityType === "work_shift") return `Helfer gesucht: ${entityTitle}`;
  return `Termin: ${entityTitle}`;
}

const NotifyMembersDialog = ({
  open,
  onOpenChange,
  entityType,
  entityId,
  entityTitle,
  ownerType,
  ownerId,
  companies = [],
  currentMemberId,
}: NotifyMembersDialogProps) => {
  const defaultScope = ownerType === "company" ? "company" : "club";
  const [scope, setScope] = useState<"company" | "club">(defaultScope);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(ownerId);
  const [message, setMessage] = useState(() => defaultMessage(entityType, entityTitle));
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    setSending(true);
    try {
      const result = await apiJson<{ sent: number }>("/api/notifications/notify-audience", {
        method: "POST",
        body: JSON.stringify({
          scope,
          companyId: scope === "company" ? selectedCompanyId : undefined,
          type: notificationType(entityType),
          title: notificationTitle(entityType, entityTitle),
          message: message.trim() || undefined,
          link: entityLink(entityType, entityId),
          relatedEntityType: entityType === "work_shift" ? "event" : entityType,
          relatedEntityId: entityId,
          excludeMemberId: currentMemberId,
        }),
      });
      toast.success(`${result?.sent ?? 0} Mitglieder benachrichtigt`);
      onOpenChange(false);
    } catch (err) {
      console.error("NotifyMembersDialog send error:", err);
      toast.error("Fehler beim Senden der Benachrichtigung");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Mitglieder benachrichtigen
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Empfängergruppe</Label>
            <Select value={scope} onValueChange={(v) => setScope(v as "company" | "club")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="club">Gesamter Verein / Regiment</SelectItem>
                {companies.length > 0 && (
                  <SelectItem value="company">Kompanie</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {scope === "company" && companies.length > 0 && (
            <div className="space-y-2">
              <Label>Kompanie auswählen</Label>
              <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Nachricht</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="Nachricht an die Empfänger..."
            />
          </div>
        </div>

        <DialogFooter className="pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleSend} disabled={sending || !message.trim()}>
            {sending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Bell className="w-4 h-4 mr-2" />
            )}
            Benachrichtigung senden
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NotifyMembersDialog;
