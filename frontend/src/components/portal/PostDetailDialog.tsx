import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/lib/auth";
import { usePostComments, usePostReactions } from "@/hooks/usePostInteractions";
import { createNotification } from "@/hooks/useNotifications";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import {
  ThumbsUp,
  MessageSquare,
  Send,
  Trash2,
  Clock,
  CheckCircle,
  XCircle,
  Shield,
  Building2,
  Globe,
  Users,
  Loader2,
  AlertTriangle,
  Info,
  Calendar,
  Bell,
  Megaphone,
} from "lucide-react";

interface Post {
  id: string;
  club_id: string;
  owner_type: 'club' | 'company';
  owner_id: string;
  title: string;
  content: string;
  cover_image_path: string | null;
  category: 'announcement' | 'info' | 'event' | 'warning' | 'other';
  audience: 'company_only' | 'club_internal' | 'public';
  publication_status: 'draft' | 'submitted' | 'approved' | 'rejected';
  submitted_at: string | null;
  approved_at: string | null;
  approved_by_member_id: string | null;
  rejection_reason: string | null;
  created_by_member_id: string | null;
  created_at: string;
  creator?: { first_name: string; last_name: string } | null;
  approver?: { first_name: string; last_name: string } | null;
}

interface PostDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  post: Post | null;
}

const CATEGORIES = [
  { value: 'announcement', label: 'Ankündigung', icon: Bell },
  { value: 'info', label: 'Information', icon: Info },
  { value: 'event', label: 'Veranstaltung', icon: Calendar },
  { value: 'warning', label: 'Wichtig', icon: AlertTriangle },
  { value: 'other', label: 'Sonstiges', icon: Megaphone },
];

const PostDetailDialog = ({ open, onOpenChange, post }: PostDetailDialogProps) => {
  const { user, member } = useAuth();
  const [newComment, setNewComment] = useState('');
  const [canComment, setCanComment] = useState(false);
  const [canModerate, setCanModerate] = useState(false);

  const {
    comments,
    loading: commentsLoading,
    submitting,
    addComment,
    deleteComment,
  } = usePostComments(post?.id || null);

  const {
    toggleReaction,
    hasReacted,
    reactionCount,
  } = usePostReactions(post?.id || null);

  useEffect(() => {
    const checkPermissions = async () => {
      if (!user || !member || !post) return;

      const { data: permData } = await supabase.rpc('get_user_permissions', {
        _user_id: user.id,
        _club_id: member.club_id
      });

      const permissions = permData || [];
      const hasFullAdmin = permissions.some((p: any) => p.permission_key === 'club.admin.full');
      const hasModerate = permissions.some((p: any) => p.permission_key === 'club.posts.moderate');
      
      setCanModerate(hasFullAdmin || hasModerate);

      // Can comment only on non-public posts
      if (post.audience !== 'public') {
        if (post.audience === 'club_internal') {
          const hasClubComment = permissions.some((p: any) => p.permission_key === 'club.posts.comment');
          setCanComment(hasClubComment || hasFullAdmin);
        } else if (post.audience === 'company_only') {
          const hasCompanyComment = permissions.some((p: any) => 
            p.permission_key === 'company.posts.comment' && 
            p.scope_type === 'company' && 
            p.scope_id === post.owner_id
          );
          setCanComment(hasCompanyComment || hasFullAdmin);
        }
      } else {
        // For public posts, allow internal comments for club members
        setCanComment(true);
      }
    };

    checkPermissions();
  }, [user, member, post]);

  const handleAddComment = async () => {
    if (!post || !newComment.trim()) return;
    await addComment(newComment, post.club_id);
    setNewComment('');

    // Create notification for post author
    if (post.created_by_member_id && post.created_by_member_id !== member?.id) {
      await createNotification(
        post.club_id,
        post.created_by_member_id,
        'post_comment',
        post.id
      );
    }
  };

  const handleToggleLike = () => {
    if (!post) return;
    toggleReaction(post.club_id, 'like');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="secondary" className="gap-1"><Clock className="w-3 h-3" />Entwurf</Badge>;
      case 'submitted':
        return <Badge variant="outline" className="gap-1 border-yellow-500 text-yellow-600"><Send className="w-3 h-3" />Eingereicht</Badge>;
      case 'approved':
        return <Badge variant="default" className="gap-1 bg-green-600"><CheckCircle className="w-3 h-3" />Freigegeben</Badge>;
      case 'rejected':
        return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" />Abgelehnt</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getAudienceBadge = (audience: string) => {
    switch (audience) {
      case 'company_only':
        return <Badge variant="outline" className="gap-1"><Building2 className="w-3 h-3" />Kompanie</Badge>;
      case 'club_internal':
        return <Badge variant="outline" className="gap-1"><Users className="w-3 h-3" />Verein</Badge>;
      case 'public':
        return <Badge variant="outline" className="gap-1"><Globe className="w-3 h-3" />Öffentlich</Badge>;
      default:
        return <Badge variant="outline">{audience}</Badge>;
    }
  };

  const getCategoryIcon = (category: string) => {
    const cat = CATEGORIES.find(c => c.value === category);
    return cat ? <cat.icon className="w-4 h-4" /> : <Megaphone className="w-4 h-4" />;
  };

  if (!post) return null;

  const likeCount = reactionCount('like');
  const userHasLiked = hasReacted('like');
  const isInternal = post.audience !== 'public';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl">{post.title}</DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4">
            {/* Badges */}
            <div className="flex flex-wrap gap-2">
              {getStatusBadge(post.publication_status)}
              {getAudienceBadge(post.audience)}
              <Badge variant="outline" className="gap-1">
                {getCategoryIcon(post.category)}
                {CATEGORIES.find(c => c.value === post.category)?.label}
              </Badge>
            </div>

            {/* Cover Image */}
            {post.cover_image_path && (
              <img
                src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/post-images/${post.cover_image_path}`}
                alt={post.title}
                className="w-full h-48 object-cover rounded-lg"
              />
            )}

            {/* Content */}
            <div className="prose prose-sm max-w-none">
              <p className="whitespace-pre-wrap">{post.content}</p>
            </div>

            {/* Meta info */}
            <div className="text-sm text-muted-foreground">
              {post.creator && (
                <p>Erstellt von {post.creator.first_name} {post.creator.last_name} am {format(new Date(post.created_at), 'dd.MM.yyyy HH:mm', { locale: de })}</p>
              )}
              {post.approver && post.approved_at && (
                <p>Freigegeben von {post.approver.first_name} {post.approver.last_name} am {format(new Date(post.approved_at), 'dd.MM.yyyy HH:mm', { locale: de })}</p>
              )}
            </div>

            {/* Rejection reason */}
            {post.publication_status === 'rejected' && post.rejection_reason && (
              <div className="p-3 bg-destructive/10 rounded-lg">
                <p className="text-destructive font-medium">Ablehnungsgrund:</p>
                <p className="text-sm">{post.rejection_reason}</p>
              </div>
            )}

            <Separator />

            {/* Reactions */}
            {isInternal && (
              <div className="flex items-center gap-4">
                <Button
                  variant={userHasLiked ? "default" : "outline"}
                  size="sm"
                  onClick={handleToggleLike}
                  className="gap-2"
                >
                  <ThumbsUp className={`w-4 h-4 ${userHasLiked ? 'fill-current' : ''}`} />
                  {likeCount > 0 && <span>{likeCount}</span>}
                </Button>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MessageSquare className="w-4 h-4" />
                  <span>{comments.filter(c => !c.deleted_at).length} Kommentare</span>
                </div>
              </div>
            )}

            {/* Comments section - only for internal posts */}
            {isInternal && (
              <>
                <Separator />
                <div className="space-y-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <MessageSquare className="w-5 h-5" />
                    Kommentare
                  </h3>

                  {commentsLoading ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="w-6 h-6 animate-spin" />
                    </div>
                  ) : comments.length === 0 ? (
                    <p className="text-muted-foreground text-sm text-center py-4">
                      Noch keine Kommentare
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {comments.map((comment) => (
                        <div key={comment.id} className={`flex gap-3 ${comment.deleted_at ? 'opacity-50' : ''}`}>
                          <Avatar className="w-8 h-8">
                            <AvatarImage src={comment.author?.avatar_url || undefined} />
                            <AvatarFallback className="text-xs">
                              {comment.author?.first_name?.[0]}{comment.author?.last_name?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">
                                {comment.author?.first_name} {comment.author?.last_name}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(comment.created_at), 'dd.MM.yyyy HH:mm', { locale: de })}
                              </span>
                            </div>
                            {comment.deleted_at ? (
                              <p className="text-sm text-muted-foreground italic">
                                Kommentar wurde entfernt
                              </p>
                            ) : (
                              <p className="text-sm mt-1">{comment.content}</p>
                            )}
                            {!comment.deleted_at && (
                              (comment.author_member_id === member?.id || canModerate) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
                                  onClick={() => deleteComment(comment.id)}
                                >
                                  <Trash2 className="w-3 h-3 mr-1" />
                                  {canModerate && comment.author_member_id !== member?.id ? 'Moderieren' : 'Löschen'}
                                </Button>
                              )
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add comment */}
                  {canComment && (
                    <div className="flex gap-2 pt-2">
                      <Textarea
                        placeholder="Kommentar schreiben..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        className="min-h-[60px]"
                      />
                      <Button
                        onClick={handleAddComment}
                        disabled={submitting || !newComment.trim()}
                        size="icon"
                        className="shrink-0"
                      >
                        {submitting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default PostDetailDialog;
