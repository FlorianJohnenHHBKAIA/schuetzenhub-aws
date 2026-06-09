import { useState, useEffect, useRef, useCallback } from "react";
import { ArrowLeft, Send, Loader2, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getStorageUrl } from "@/integrations/api/client";
import { cn } from "@/lib/utils";
import type { ConversationSummary, Message } from "@/lib/messageTypes";
import { ScopeChip, SCOPE_CONFIG } from "@/components/portal/messages/ConversationList";

interface ChatViewProps {
  conversation: ConversationSummary;
  currentMemberId: string;
  fetchMessages: (id: string, before?: string) => Promise<Message[]>;
  sendMessage: (id: string, content: string) => Promise<Message>;
  markRead: (id: string) => void;
  onBack?: () => void;
}

export function ChatView({
  conversation,
  currentMemberId,
  fetchMessages,
  sendMessage,
  markRead,
  onBack,
}: ChatViewProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isNearBottomRef = useRef(true);

  const scrollToBottom = useCallback((smooth = false) => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: smooth ? "smooth" : "instant",
      });
    }
  }, []);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isNearBottomRef.current = distanceFromBottom < 100;
    setShowScrollDown(distanceFromBottom > 200);
  };

  // Nachrichten laden
  useEffect(() => {
    setLoading(true);
    setMessages([]);
    fetchMessages(conversation.id)
      .then((msgs) => {
        setMessages(msgs);
        markRead(conversation.id);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [conversation.id]);

  // Nach laden scrollen
  useEffect(() => {
    if (!loading) {
      scrollToBottom();
    }
  }, [loading, scrollToBottom]);

  // Polling für neue Nachrichten
  useEffect(() => {
    const interval = setInterval(async () => {
      if (document.hidden) return;
      const newest = messages[messages.length - 1];
      const fresh = await fetchMessages(conversation.id).catch(() => []);
      if (fresh.length > messages.length) {
        setMessages(fresh);
        markRead(conversation.id);
        if (isNearBottomRef.current) {
          setTimeout(() => scrollToBottom(), 50);
        }
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [conversation.id, messages, fetchMessages, markRead, scrollToBottom]);

  const handleSend = async () => {
    const content = input.trim();
    if (!content || sending) return;
    setInput("");
    setSending(true);
    // Optimistisch hinzufügen
    const optimistic: Message = {
      id: `optimistic-${Date.now()}`,
      conversation_id: conversation.id,
      sender_member_id: currentMemberId,
      sender_first_name: "",
      sender_last_name: "",
      sender_avatar_url: null,
      content,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setTimeout(() => scrollToBottom(true), 50);
    try {
      const confirmed = await sendMessage(conversation.id, content);
      setMessages((prev) =>
        prev.map((m) => (m.id === optimistic.id ? confirmed : m))
      );
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setInput(content);
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isGroup = conversation.type === "group";
  const scope = conversation.scope ?? "club";
  const scopeCfg = SCOPE_CONFIG[scope];

  const displayName = isGroup
    ? conversation.name
    : conversation.other_member_first_name && conversation.other_member_last_name
    ? `${conversation.other_member_first_name} ${conversation.other_member_last_name}`
    : "Unbekannt";

  // Header-Hintergrund je Scope (nur Gruppen)
  const headerBg = isGroup
    ? scope === "external"
      ? "bg-amber-50"
      : scope === "company"
      ? "bg-blue-50"
      : "bg-green-50"
    : "bg-card";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className={cn("flex items-center gap-3 px-4 py-3 border-b shrink-0", headerBg)}>
        {onBack && (
          <Button variant="ghost" size="icon" className="lg:hidden h-8 w-8" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        {isGroup ? (
          <div
            className={cn(
              "h-9 w-9 rounded-full flex items-center justify-center shrink-0",
              scopeCfg.iconBg
            )}
          >
            <span className={cn("text-sm font-bold", scopeCfg.iconColor)}>
              {(conversation.name ?? "GR").slice(0, 2).toUpperCase()}
            </span>
          </div>
        ) : (
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarImage
              src={
                conversation.other_member_avatar_url
                  ? conversation.other_member_avatar_url.startsWith("http") ||
                    conversation.other_member_avatar_url.startsWith("/")
                    ? conversation.other_member_avatar_url
                    : getStorageUrl("avatars", conversation.other_member_avatar_url)
                  : undefined
              }
            />
            <AvatarFallback className="text-xs font-semibold">
              {`${conversation.other_member_first_name?.[0] ?? ""}${
                conversation.other_member_last_name?.[0] ?? ""
              }`.toUpperCase()}
            </AvatarFallback>
          </Avatar>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-sm leading-tight truncate">{displayName}</p>
            {isGroup && <ScopeChip scope={scope} />}
          </div>
          {isGroup && conversation.scope_company_name && (
            <p className="text-xs text-muted-foreground truncate">{conversation.scope_company_name}</p>
          )}
        </div>
      </div>

      {/* Nachrichtenverlauf */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-2"
      >
        {loading && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {!loading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-12">
            <p className="text-sm text-muted-foreground">Noch keine Nachrichten.</p>
            <p className="text-xs text-muted-foreground">Schreibe die erste Nachricht!</p>
          </div>
        )}
        {messages.map((msg, idx) => {
          const isOwn = msg.sender_member_id === currentMemberId;
          const prev = messages[idx - 1];
          const showDate =
            !prev ||
            new Date(msg.created_at).toDateString() !==
              new Date(prev.created_at).toDateString();
          const showSender =
            !isOwn &&
            conversation.type === "group" &&
            (!prev || prev.sender_member_id !== msg.sender_member_id || showDate);

          return (
            <div key={msg.id}>
              {showDate && (
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground shrink-0">
                    {format(new Date(msg.created_at), "EEEE, d. MMMM", { locale: de })}
                  </span>
                  <div className="flex-1 h-px bg-border" />
                </div>
              )}
              <div className={cn("flex gap-2", isOwn ? "justify-end" : "justify-start")}>
                {!isOwn && (
                  <Avatar className="h-7 w-7 mt-1 shrink-0">
                    <AvatarImage
                      src={
                        msg.sender_avatar_url
                          ? msg.sender_avatar_url.startsWith("http") ||
                            msg.sender_avatar_url.startsWith("/")
                            ? msg.sender_avatar_url
                            : getStorageUrl("avatars", msg.sender_avatar_url)
                          : undefined
                      }
                    />
                    <AvatarFallback className="text-[10px]">
                      {`${msg.sender_first_name?.[0] ?? ""}${
                        msg.sender_last_name?.[0] ?? ""
                      }`.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                )}
                <div className={cn("max-w-[70%] flex flex-col", isOwn && "items-end")}>
                  {showSender && (
                    <span className="text-xs text-muted-foreground mb-1 px-1">
                      {msg.sender_first_name} {msg.sender_last_name}
                    </span>
                  )}
                  <div
                    className={cn(
                      "px-3 py-2 text-sm leading-relaxed",
                      isOwn
                        ? "bg-primary text-primary-foreground rounded-2xl rounded-br-sm"
                        : "bg-muted text-foreground rounded-2xl rounded-bl-sm"
                    )}
                  >
                    {msg.content}
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-1 px-1">
                    {format(new Date(msg.created_at), "HH:mm")}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Scroll-to-bottom Pill */}
      {showScrollDown && (
        <div className="absolute bottom-20 right-6">
          <Button
            size="sm"
            variant="secondary"
            className="rounded-full shadow-md gap-1 h-8 text-xs"
            onClick={() => scrollToBottom(true)}
          >
            <ChevronDown className="h-3 w-3" />
            Nach unten
          </Button>
        </div>
      )}

      {/* Eingabebereich */}
      <div className="border-t bg-card px-4 py-3 shrink-0">
        <div className="flex items-end gap-2">
          <Textarea
            ref={textareaRef}
            rows={1}
            className="resize-none min-h-[40px] max-h-32 flex-1 text-sm"
            placeholder="Nachricht schreiben… (Enter zum Senden, Shift+Enter für neue Zeile)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <Button
            size="icon"
            className="h-10 w-10 shrink-0"
            disabled={!input.trim() || sending}
            onClick={handleSend}
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
