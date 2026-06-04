import { useState, useEffect, useCallback } from "react";
import { api } from "@/integrations/api/client";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

interface Comment {
  id: string;
  post_id: string;
  author_member_id: string;
  content: string;
  created_at: string;
  author?: {
    first_name: string;
    last_name: string;
    avatar_url: string | null;
  } | null;
}

interface Reaction {
  id: string;
  post_id: string;
  member_id: string;
  reaction: string;
  created_at: string;
  member?: { first_name: string; last_name: string; avatar_url: string | null } | null;
}

export const usePostComments = (postId: string | null) => {
  const { member } = useAuth();
  const { toast } = useToast();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchComments = useCallback(async () => {
    if (!postId) return;
    setLoading(true);
    try {
      const data = await api.json<Comment[]>(`/api/posts/${postId}/comments`);
      setComments(data || []);
    } catch (error: unknown) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const addComment = async (content: string) => {
    if (!member || !postId || !content.trim()) return;
    setSubmitting(true);
    try {
      await api.json(`/api/posts/${postId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content: content.trim() }),
      });
      toast({ title: 'Kommentar hinzugefügt' });
      fetchComments();
    } catch (error: unknown) {
      toast({
        title: 'Fehler',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const deleteComment = async (commentId: string) => {
    try {
      await api.json(`/api/posts/${postId}/comments/${commentId}`, { method: 'DELETE' });
      toast({ title: 'Kommentar entfernt' });
      fetchComments();
    } catch (error: unknown) {
      toast({
        title: 'Fehler',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    }
  };

  return {
    comments,
    loading,
    submitting,
    addComment,
    deleteComment,
    refetch: fetchComments,
  };
};

export const usePostReactions = (postId: string | null) => {
  const { member } = useAuth();
  const { toast } = useToast();
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchReactions = useCallback(async () => {
    if (!postId) return;
    setLoading(true);
    try {
      const data = await api.json<Reaction[]>(`/api/posts/${postId}/reactions`);
      setReactions(data || []);
    } catch (error: unknown) {
      console.error('Error fetching reactions:', error);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    fetchReactions();
  }, [fetchReactions]);

  const toggleReaction = async (reaction = 'like') => {
    if (!member || !postId) return;

    const existingReaction = reactions.find(
      r => r.member_id === member.id && r.reaction === reaction
    );

    try {
      if (existingReaction) {
        await api.json(`/api/posts/${postId}/reactions/${existingReaction.id}`, {
          method: 'DELETE',
        });
      } else {
        await api.json(`/api/posts/${postId}/reactions`, {
          method: 'POST',
          body: JSON.stringify({ reaction }),
        });
      }
      fetchReactions();
    } catch (error: unknown) {
      toast({
        title: 'Fehler',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    }
  };

  const hasReacted = (reaction = 'like'): boolean => {
    if (!member) return false;
    return reactions.some(r => r.member_id === member.id && r.reaction === reaction);
  };

  const reactionCount = (reaction = 'like'): number => {
    return reactions.filter(r => r.reaction === reaction).length;
  };

  return {
    reactions,
    loading,
    toggleReaction,
    hasReacted,
    reactionCount,
    refetch: fetchReactions,
  };
};
