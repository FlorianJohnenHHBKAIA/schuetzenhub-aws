import { useState } from "react";
import { MessageSquare, Hash, Plus, Building2, Globe, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getStorageUrl } from "@/integrations/api/client";
import { cn } from "@/lib/utils";
import type { ConversationSummary, ConversationScope } from "@/lib/messageTypes";

// ─── Scope-Konfiguration ──────────────────────────────────────────────────────

export const SCOPE_CONFIG: Record<
  ConversationScope,
  { label: string; chipClass: string; iconBg: string; iconColor: string }
> = {
  company: {
    label: "Kompanie",
    chipClass: "bg-blue-100 text-blue-700 border-blue-200",
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
  },
  club: {
    label: "Verein",
    chipClass: "bg-green-100 text-green-700 border-green-200",
    iconBg: "bg-green-100",
    iconColor: "text-green-600",
  },
  external: {
    label: "Extern",
    chipClass: "bg-amber-100 text-amber-700 border-amber-200",
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
  },
};

type FilterTab = "all" | "direct" | ConversationScope;

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "all", label: "Alle" },
  { key: "direct", label: "Direkt" },
  { key: "company", label: "Kompanie" },
  { key: "club", label: "Verein" },
  { key: "external", label: "Extern" },
];

// ─── Scope-Chip ───────────────────────────────────────────────────────────────

export function ScopeChip({ scope }: { scope: ConversationScope }) {
  const cfg = SCOPE_CONFIG[scope];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-1.5 py-0 text-[10px] font-medium leading-4 shrink-0",
        cfg.chipClass
      )}
    >
      {cfg.label}
    </span>
  );
}

// ─── ConversationList ─────────────────────────────────────────────────────────

interface ConversationListProps {
  conversations: ConversationSummary[];
  loading: boolean;
  activeId?: string;
  onSelect: (id: string) => void;
  onNewConversation: () => void;
}

export function ConversationList({
  conversations,
  loading,
  activeId,
  onSelect,
  onNewConversation,
}: ConversationListProps) {
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");

  const filtered = conversations.filter((c) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "direct") return c.type === "direct";
    return c.type === "group" && c.scope === activeFilter;
  });

  if (loading && conversations.length === 0) {
    return (
      <div className="flex flex-col gap-2 p-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-lg">
            <div className="h-10 w-10 rounded-full bg-muted animate-pulse shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 bg-muted animate-pulse rounded" />
              <div className="h-3 w-48 bg-muted animate-pulse rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Filter-Tabs */}
      <div className="flex gap-0.5 px-3 py-2 border-b overflow-x-auto shrink-0">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveFilter(tab.key)}
            className={cn(
              "px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors",
              activeFilter === tab.key
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Liste */}
      {filtered.length === 0 && conversations.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-4 p-8 text-center">
          <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
            <MessageSquare className="h-7 w-7 text-primary" />
          </div>
          <div>
            <p className="font-medium text-foreground">Noch keine Nachrichten</p>
            <p className="text-sm text-muted-foreground mt-1">
              Starte eine Konversation mit einem Mitglied
            </p>
          </div>
          <Button onClick={onNewConversation} size="sm">
            <Plus className="h-4 w-4" />
            Neue Nachricht
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-2 p-8 text-center">
          <p className="text-sm text-muted-foreground">Keine Konversationen in dieser Ebene</p>
        </div>
      ) : (
        <div className="flex flex-col overflow-y-auto flex-1">
          {filtered.map((conv) => {
            const isActive = conv.id === activeId;
            const isGroup = conv.type === "group";
            const scope = conv.scope ?? "club";
            const cfg = SCOPE_CONFIG[scope];

            const displayName = isGroup
              ? conv.name
              : conv.other_member_first_name && conv.other_member_last_name
              ? `${conv.other_member_first_name} ${conv.other_member_last_name}`
              : "Unbekannt";

            const avatarUrl =
              !isGroup && conv.other_member_avatar_url
                ? conv.other_member_avatar_url.startsWith("http") ||
                  conv.other_member_avatar_url.startsWith("/")
                  ? conv.other_member_avatar_url
                  : getStorageUrl("avatars", conv.other_member_avatar_url)
                : undefined;

            const initials = isGroup
              ? (conv.name?.slice(0, 2) ?? "GR").toUpperCase()
              : `${conv.other_member_first_name?.[0] ?? ""}${
                  conv.other_member_last_name?.[0] ?? ""
                }`.toUpperCase();

            const relativeTime = formatDistanceToNow(
              new Date(conv.last_message_at ?? conv.updated_at),
              { addSuffix: false, locale: de }
            );

            // Gruppen-Icon je nach Scope
            const GroupIcon =
              scope === "external" ? ExternalLink : scope === "company" ? Building2 : Globe;

            return (
              <button
                key={conv.id}
                onClick={() => onSelect(conv.id)}
                className={cn(
                  "flex items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-accent/50 border-b border-border/50 last:border-0",
                  isActive && "bg-accent"
                )}
              >
                {/* Avatar / Gruppen-Icon */}
                {isGroup ? (
                  <div
                    className={cn(
                      "h-10 w-10 rounded-full flex items-center justify-center shrink-0",
                      cfg.iconBg
                    )}
                  >
                    <GroupIcon className={cn("h-5 w-5", cfg.iconColor)} />
                  </div>
                ) : (
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarImage src={avatarUrl} />
                    <AvatarFallback className="text-xs font-semibold bg-muted">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                )}

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 justify-between">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className={cn(
                          "text-sm font-medium truncate",
                          conv.unread_count > 0 && "font-semibold"
                        )}
                      >
                        {displayName}
                      </span>
                      {isGroup && <ScopeChip scope={scope} />}
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{relativeTime}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p className="text-xs text-muted-foreground truncate line-clamp-1">
                      {conv.last_message_content ?? "Noch keine Nachrichten"}
                    </p>
                    {conv.unread_count > 0 && (
                      <Badge
                        variant="destructive"
                        className="h-4 min-w-4 flex items-center justify-center p-0 text-[10px] shrink-0"
                      >
                        {conv.unread_count > 9 ? "9+" : conv.unread_count}
                      </Badge>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
