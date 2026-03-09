import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotifications, type GroupedNotifications } from "@/hooks/useNotifications";
import { NOTIFICATION_TYPES, type NotificationType } from "@/lib/notificationTypes";
import { format, formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import {
  Bell,
  Megaphone,
  MessageSquare,
  Calendar,
  CalendarX,
  UserCheck,
  UserX,
  Clock,
  AlertCircle,
  CheckSquare,
  FileText,
  Image,
  Shield,
  Key,
  BellRing,
  AlarmClock,
  CheckCheck,
  Loader2,
  Settings,
} from "lucide-react";
import { Link } from "react-router-dom";

const NotificationBell = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const {
    groupedNotifications,
    loading,
    unreadCount,
    markGroupAsRead,
    markAllAsRead,
  } = useNotifications();

  const handleNotificationClick = async (group: GroupedNotifications) => {
    await markGroupAsRead(group);
    setOpen(false);
    navigate(group.deepLink);
  };

  const getNotificationIcon = (type: NotificationType) => {
    const iconMap: Record<string, React.ReactNode> = {
      'new_post': <Megaphone className="w-4 h-4 text-primary" />,
      'post_comment': <MessageSquare className="w-4 h-4 text-blue-500" />,
      'event_cancelled': <CalendarX className="w-4 h-4 text-destructive" />,
      'event_changed': <Calendar className="w-4 h-4 text-orange-500" />,
      'event_updated': <Calendar className="w-4 h-4 text-muted-foreground" />,
      'workshift_assigned': <UserCheck className="w-4 h-4 text-green-500" />,
      'workshift_removed': <UserX className="w-4 h-4 text-destructive" />,
      'workshift_changed': <Clock className="w-4 h-4 text-orange-500" />,
      'action_required': <AlertCircle className="w-4 h-4 text-destructive" />,
      'approval_request': <CheckSquare className="w-4 h-4 text-primary" />,
      'new_document': <FileText className="w-4 h-4 text-muted-foreground" />,
      'gallery_shared': <Image className="w-4 h-4 text-purple-500" />,
      'role_changed': <Shield className="w-4 h-4 text-slate-500" />,
      'delegation_granted': <Key className="w-4 h-4 text-green-500" />,
      'delegation_revoked': <Key className="w-4 h-4 text-destructive" />,
      'event_reminder': <BellRing className="w-4 h-4 text-purple-500" />,
      'workshift_reminder': <AlarmClock className="w-4 h-4 text-purple-500" />,
    };

    return iconMap[type] || <Bell className="w-4 h-4" />;
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'important':
        return <Badge variant="destructive" className="text-[10px] px-1 py-0">Wichtig</Badge>;
      case 'reminder':
        return <Badge variant="secondary" className="text-[10px] px-1 py-0">Erinnerung</Badge>;
      case 'system':
        return <Badge variant="outline" className="text-[10px] px-1 py-0">System</Badge>;
      default:
        return null;
    }
  };

  const hasUnreadInGroup = (group: GroupedNotifications) => {
    return group.notifications.some(n => !n.is_read);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative hover:bg-sidebar-accent/50"
        >
          <Bell className="w-5 h-5 text-sidebar-foreground/70" />
          {unreadCount > 0 && (
            <Badge
              className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center p-0 text-xs"
              variant="destructive"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h4 className="font-semibold">Benachrichtigungen</h4>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                className="h-8 text-xs"
              >
                <CheckCheck className="w-3 h-3 mr-1" />
                Alle gelesen
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              asChild
            >
              <Link to="/portal/notifications" onClick={() => setOpen(false)}>
                <Settings className="w-4 h-4" />
              </Link>
            </Button>
          </div>
        </div>

        <ScrollArea className="h-[400px]">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : groupedNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Bell className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">Keine Benachrichtigungen</p>
            </div>
          ) : (
            <div className="divide-y">
              {groupedNotifications.map((group) => (
                <button
                  key={group.key}
                  onClick={() => handleNotificationClick(group)}
                  className={`w-full px-4 py-3 flex items-start gap-3 hover:bg-muted/50 transition-colors text-left ${
                    hasUnreadInGroup(group) ? 'bg-primary/5' : ''
                  }`}
                >
                  <div className="shrink-0 mt-0.5">
                    {getNotificationIcon(group.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      {getCategoryBadge(group.category)}
                      {group.count > 1 && (
                        <Badge variant="secondary" className="text-[10px] px-1 py-0">
                          {group.count}×
                        </Badge>
                      )}
                    </div>
                    <p className={`text-sm line-clamp-2 ${hasUnreadInGroup(group) ? 'font-medium' : ''}`}>
                      {group.count > 1 
                        ? getGroupedLabel(group)
                        : group.label
                      }
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(group.latestAt), { 
                        addSuffix: true, 
                        locale: de 
                      })}
                    </p>
                  </div>
                  {hasUnreadInGroup(group) && (
                    <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" />
                  )}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="border-t px-4 py-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs text-muted-foreground"
            asChild
          >
            <Link to="/portal/notifications" onClick={() => setOpen(false)}>
              Einstellungen verwalten
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

// Helper to get grouped label (e.g., "3 neue Beiträge")
function getGroupedLabel(group: GroupedNotifications): string {
  const count = group.count;
  
  switch (group.type) {
    case 'new_post':
      return `${count} neue Beiträge`;
    case 'post_comment':
      return `${count} neue Kommentare`;
    case 'workshift_assigned':
      return `${count} neue Einteilungen`;
    case 'workshift_changed':
      return `${count} Arbeitsdienst-Änderungen`;
    case 'event_updated':
      return `${count} Event-Updates`;
    case 'new_document':
      return `${count} neue Dokumente`;
    case 'gallery_shared':
      return `${count} geteilte Fotos`;
    default:
      return `${count} Benachrichtigungen`;
  }
}

export default NotificationBell;
