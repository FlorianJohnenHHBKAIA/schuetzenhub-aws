import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

interface Comment {
  id: string;
  post_id: string;
  author_member_id: string;
  content: string;
  created_at: string;
  deleted_at: string | null;
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
      const { data, error } = await supabase
        .from('post_comments')
        .select(`
          *,
          author:members!author_member_id(first_name, last_name, avatar_url)
        `)
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setComments(data || []);
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const addComment = async (content: string, clubId: string) => {
    if (!member || !postId || !content.trim()) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('post_comments')
        .insert({
          club_id: clubId,
          post_id: postId,
          author_member_id: member.id,
          content: content.trim(),
        });

      if (error) throw error;
      toast({ title: 'Kommentar hinzugefügt' });
      fetchComments();
    } catch (error: any) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const deleteComment = async (commentId: string) => {
    try {
      const { error } = await supabase
        .from('post_comments')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', commentId);

      if (error) throw error;
      toast({ title: 'Kommentar entfernt' });
      fetchComments();
    } catch (error: any) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
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
      const { data, error } = await supabase
        .from('post_reactions')
        .select('*')
        .eq('post_id', postId);

      if (error) throw error;
      setReactions(data || []);
    } catch (error) {
      console.error('Error fetching reactions:', error);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    fetchReactions();
  }, [fetchReactions]);

  const toggleReaction = async (clubId: string, reaction = 'like') => {
    if (!member || !postId) return;
    
    const existingReaction = reactions.find(
      r => r.member_id === member.id && r.reaction === reaction
    );

    try {
      if (existingReaction) {
        const { error } = await supabase
          .from('post_reactions')
          .delete()
          .eq('id', existingReaction.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('post_reactions')
          .insert({
            club_id: clubId,
            post_id: postId,
            member_id: member.id,
            reaction,
          });

        if (error) throw error;
      }
      fetchReactions();
    } catch (error: any) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
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
