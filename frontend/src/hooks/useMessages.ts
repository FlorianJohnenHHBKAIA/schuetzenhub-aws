import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { apiJson } from "@/integrations/api/client";
import type {
  ConversationSummary,
  Message,
  CreateConversationParams,
} from "@/lib/messageTypes";

export const useMessages = () => {
  const { member } = useAuth();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [totalUnread, setTotalUnread] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchConversations = useCallback(async () => {
    if (!member) return;
    setLoading(true);
    try {
      const data = await apiJson<ConversationSummary[]>("/api/messages/conversations");
      const list = data || [];
      setConversations(list);
      setTotalUnread(list.reduce((sum, c) => sum + (c.unread_count || 0), 0));
    } catch (err) {
      console.error("useMessages: fetchConversations", err);
    } finally {
      setLoading(false);
    }
  }, [member]);

  useEffect(() => {
    fetchConversations();
    const interval = setInterval(fetchConversations, 30000);
    return () => clearInterval(interval);
  }, [fetchConversations]);

  const fetchMessages = useCallback(
    async (conversationId: string, before?: string): Promise<Message[]> => {
      const url = before
        ? `/api/messages/conversations/${conversationId}/messages?before=${encodeURIComponent(before)}`
        : `/api/messages/conversations/${conversationId}/messages`;
      const data = await apiJson<Message[]>(url);
      return data || [];
    },
    []
  );

  const sendMessage = useCallback(
    async (conversationId: string, content: string): Promise<Message> => {
      const msg = await apiJson<Message>(
        `/api/messages/conversations/${conversationId}/messages`,
        { method: "POST", body: JSON.stringify({ content }) }
      );
      // Konversationsliste aktualisieren (last_message + updated_at)
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                last_message_content: content,
                last_message_at: msg.created_at,
                updated_at: msg.created_at,
              }
            : c
        ).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      );
      return msg;
    },
    []
  );

  const markRead = useCallback(async (conversationId: string) => {
    try {
      await apiJson(`/api/messages/conversations/${conversationId}/read`, { method: "PUT" });
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId ? { ...c, unread_count: 0 } : c
        )
      );
      setTotalUnread((prev) => {
        const conv = conversations.find((c) => c.id === conversationId);
        return Math.max(0, prev - (conv?.unread_count || 0));
      });
    } catch (err) {
      console.error("useMessages: markRead", err);
    }
  }, [conversations]);

  const createConversation = useCallback(
    async (params: CreateConversationParams): Promise<{ id: string }> => {
      const result = await apiJson<{ id: string; existing: boolean }>(
        "/api/messages/conversations",
        { method: "POST", body: JSON.stringify(params) }
      );
      if (!result.existing) {
        await fetchConversations();
      }
      return { id: result.id };
    },
    [fetchConversations]
  );

  return {
    conversations,
    totalUnread,
    loading,
    fetchMessages,
    sendMessage,
    markRead,
    createConversation,
    refetch: fetchConversations,
  };
};
