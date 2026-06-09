import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Plus, MessageSquare } from "lucide-react";
import PortalLayout from "@/components/portal/PortalLayout";
import { ConversationList } from "@/components/portal/messages/ConversationList";
import { ChatView } from "@/components/portal/messages/ChatView";
import { NewConversationDialog } from "@/components/portal/messages/NewConversationDialog";
import { Button } from "@/components/ui/button";
import { useMessages } from "@/hooks/useMessages";
import { useAuth } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export default function Messages() {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const navigate = useNavigate();
  const { member } = useAuth();
  const isMobile = useIsMobile();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { conversations, loading, fetchMessages, sendMessage, markRead, createConversation } =
    useMessages();

  const activeConversation = conversations.find((c) => c.id === conversationId);

  const handleSelectConversation = (id: string) => {
    navigate(`/portal/messages/${id}`);
  };

  const handleBack = () => {
    navigate("/portal/messages");
  };

  const showList = !isMobile || !conversationId;
  const showChat = !isMobile || !!conversationId;

  return (
    <PortalLayout>
      {/* Negativer Margin um PortalLayout-Padding aufzuheben → Vollbild-Split */}
      <div className="flex h-[calc(100vh-4rem)] lg:h-[calc(100vh-0px)] -mx-4 -my-4 lg:-mx-8 lg:-my-8 overflow-hidden rounded-xl border border-border/50 shadow-sm">
        {/* ── Linke Spalte: Konversationsliste ── */}
        <div
          className={cn(
            "flex flex-col w-full lg:w-80 xl:w-96 border-r bg-card shrink-0",
            !showList && "hidden"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
            <h1 className="text-lg font-semibold font-display">Nachrichten</h1>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => setDialogOpen(true)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <ConversationList
            conversations={conversations}
            loading={loading}
            activeId={conversationId}
            onSelect={handleSelectConversation}
            onNewConversation={() => setDialogOpen(true)}
          />
        </div>

        {/* ── Rechte Spalte: Chat oder Leerzustand ── */}
        <div
          className={cn(
            "flex-1 flex flex-col relative",
            !showChat && "hidden"
          )}
        >
          {activeConversation && member ? (
            <ChatView
              conversation={activeConversation}
              currentMemberId={member.id}
              fetchMessages={fetchMessages}
              sendMessage={sendMessage}
              markRead={markRead}
              onBack={isMobile ? handleBack : undefined}
            />
          ) : (
            <div className="hidden lg:flex flex-col items-center justify-center h-full gap-4 text-center">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <MessageSquare className="h-8 w-8 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">Wähle eine Konversation</p>
                <p className="text-sm text-muted-foreground mt-1">
                  oder starte eine neue Nachricht
                </p>
              </div>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4" />
                Neue Nachricht
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Dialog: Neue Konversation */}
      <NewConversationDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreate={createConversation}
        onCreated={(id) => {
          setDialogOpen(false);
          navigate(`/portal/messages/${id}`);
        }}
      />
    </PortalLayout>
  );
}
