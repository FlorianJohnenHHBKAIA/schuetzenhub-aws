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
import { getStorageUrl, api } from "@/integrations/api/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import {
  MessageSquare,
  Send,
  Trash2,
  Clock,
  CheckCircle2,
  XCircle,
  Shield,
  Building2,
  Globe,
  Users,
  Loader2,
  AlertTriangle,
  Info,
  CalendarDays,
  Bell,
  Megaphone,
  Hammer,
  Trophy,
  Heart,
  Eye,
  ChevronDown,
} from "lucide-react";

interface Post {
  id: string;
  club_id: string;
  owner_type: 'club' | 'company';
  owner_id: string;
  title: string;
  content: string;
  cover_image_path: string | null;
  category: 'announcement' | 'info' | 'event' | 'warning' | 'other' | 'arbeit' | 'ehrung' | 'jugend' | 'nachruf';
  audience: 'company_only' | 'club_internal' | 'public';
  publication_status: 'draft' | 'submitted' | 'approved' | 'rejected';
  comments_enabled?: boolean | null;
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

const CATEGORY_META: Record<string, { label: string; icon: React.ElementType }> = {
  event:        { label: 'Termine & Veranstaltungen',  icon: CalendarDays },
  info:         { label: 'Vereinsinformation',          icon: Info },
  announcement: { label: 'Vereinsinformation',          icon: Info },
  warning:      { label: 'Wichtige Mitteilung',         icon: AlertTriangle },
  other:        { label: 'Sonstiges',                   icon: Megaphone },
  arbeit:       { label: 'Arbeitseinsatz',              icon: Hammer },
  ehrung:       { label: 'Ehrungen & Auszeichnungen',   icon: Trophy },
  jugend:       { label: 'Jugend',                      icon: Users },
  nachruf:      { label: 'Nachruf',                     icon: Heart },
};

const REACTION_CONFIG = [
  { type: 'attending', label: 'Ich nehme teil', activeLabel: 'Nehme teil', icon: CheckCircle2, countLabel: 'Teilnehmer', activeClass: 'bg-green-600 hover:bg-green-700 text-white' },
  { type: 'helping',   label: 'Ich helfe mit',  activeLabel: 'Helfe mit',  icon: Hammer,       countLabel: 'Helfer',     activeClass: 'bg-orange-600 hover:bg-orange-700 text-white' },
  { type: 'read',      label: 'Gelesen',         activeLabel: 'Gelesen',    icon: Eye,          countLabel: 'Gelesen',    activeClass: 'bg-blue-600 hover:bg-blue-700 text-white' },
] as const;

const PostDetailDialog = ({ open, onOpenChange, post }: PostDetailDialogProps) => {
  const { member, permissions, isAdmin } = useAuth();
  const [newComment, setNewComment] = useState('');
  const [canComment, setCanComment] = useState(false);
  const [canModerate, setCanModerate] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const {
    comments,
    loading: commentsLoading,
    submitting,
    addComment,
    deleteComment,
  } = usePostComments(post?.id || null);

  const {
    reactions,
    toggleReaction,
    hasReacted,
    reactionCount,
  } = usePostReactions(post?.id || null);

  const [activeReactionList, setActiveReactionList] = useState<string | null>(null);

  useEffect(() => {
    if (!member || !post) return;
    const hasFullAdmin = isAdmin || permissions.some(p => p.permission_key === 'club.admin.full');
    const hasPostsManage = permissions.some(p => p.permission_key === 'club.posts.manage');
    setCanModerate(hasFullAdmin || hasPostsManage);
    // Alle aktiven/passiven Mitglieder dürfen interne Beiträge kommentieren.
    // Für company_only wird die Zugriffsprüfung server-seitig durchgeführt (403 bei fehlendem Company-Membership).
    const isMemberActive = member.status !== 'prospect' && member.status !== 'resigned';
    setCanComment(post.audience !== 'public' && isMemberActive);
  }, [member, post, permissions, isAdmin]);

  const handleAddComment = async () => {
    if (!post || !newComment.trim()) return;
    await addComment(newComment);
    setNewComment('');

    if (post.created_by_member_id && post.created_by_member_id !== member?.id) {
      await createNotification(
        post.club_id,
        post.created_by_member_id,
        'post_comment',
        post.id
      );
    }
  };


  const handleStatusUpdate = async (newStatus: Post['publication_status']) => {
    if (!post || !member) return;
    setIsUpdatingStatus(true);
    try {
      const updatePayload: Partial<Post> = {
        publication_status: newStatus,
      };

      if (newStatus === 'approved') {
        updatePayload.approved_at = new Date().toISOString();
        updatePayload.approved_by_member_id = member.id;
      } else if (newStatus === 'submitted') {
        updatePayload.submitted_at = new Date().toISOString();
      }

      await api.json(`/api/posts/${post.id}`, {
        method: 'PUT',
        body: JSON.stringify(updatePayload),
      });

      toast.success(newStatus === 'approved' ? "Beitrag freigegeben" : "Beitrag eingereicht");
      onOpenChange(false);
      window.location.reload(); // Seite neu laden, um die Liste zu aktualisieren
    } catch (error) {
      console.error("Error updating post status:", error);
      toast.error("Fehler beim Aktualisieren des Status");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="secondary" className="gap-1"><Clock className="w-3 h-3" />Entwurf</Badge>;
      case 'submitted':
        return <Badge variant="outline" className="gap-1 border-yellow-500 text-yellow-600"><Send className="w-3 h-3" />Eingereicht</Badge>;
      case 'approved':
        return <Badge variant="default" className="gap-1 bg-green-600"><CheckCircle2 className="w-3 h-3" />Freigegeben</Badge>;
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
    const meta = CATEGORY_META[category];
    if (!meta) return <Megaphone className="w-4 h-4" />;
    const Icon = meta.icon;
    return <Icon className="w-4 h-4" />;
  };

  if (!post) return null;

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
                {CATEGORY_META[post.category]?.label ?? post.category}
              </Badge>
            </div>

            {/* Status-Aktionen für Entwürfe oder eingereichte Beiträge */}
            {((canModerate && (post.publication_status as string) !== 'approved') || 
               (post.created_by_member_id === member?.id && post.publication_status === 'draft')) && (
              <div className="p-4 bg-muted/50 rounded-lg border border-dashed border-primary/20 flex flex-col gap-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Shield className="w-4 h-4 text-primary" />
                  Status-Aktionen
                </div>
                <div className="flex gap-2 flex-wrap">
                  {canModerate && (post.publication_status as string) !== 'approved' && (
                    <Button 
                      size="sm" 
                      className="bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => handleStatusUpdate('approved')}
                      disabled={isUpdatingStatus}
                    >
                      {isUpdatingStatus ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                      Beitrag freigeben
                    </Button>
                  )}
                  {post.created_by_member_id === member?.id && post.publication_status === 'draft' && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleStatusUpdate('submitted')}
                      disabled={isUpdatingStatus}
                    >
                      {isUpdatingStatus ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                      Zur Freigabe einreichen
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Cover Image */}
            {post.cover_image_path && (
              <img
                src={`${getStorageUrl("post-images", post.cover_image_path) || ""}`}
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
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  {REACTION_CONFIG.map(({ type, label, activeLabel, icon: Icon, activeClass }) => (
                    <Button
                      key={type}
                      variant={hasReacted(type) ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleReaction(type)}
                      className={`gap-2 ${hasReacted(type) ? activeClass : ''}`}
                    >
                      <Icon className="w-4 h-4" />
                      {hasReacted(type) ? activeLabel : label}
                      {reactionCount(type) > 0 && (
                        <span className="ml-1 text-xs opacity-80">{reactionCount(type)}</span>
                      )}
                    </Button>
                  ))}
                  <div className="flex items-center gap-2 text-muted-foreground ml-2">
                    <MessageSquare className="w-4 h-4" />
                    <span className="text-sm">{comments.length} Kommentare</span>
                  </div>
                </div>
                {REACTION_CONFIG.some(r => reactionCount(r.type) > 0) && (
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {REACTION_CONFIG.map(({ type, countLabel, icon: Icon }) => {
                      const count = reactionCount(type);
                      if (count === 0) return null;
                      return (
                        <button
                          key={type}
                          onClick={() => setActiveReactionList(activeReactionList === type ? null : type)}
                          className="flex items-center gap-1 hover:text-foreground transition-colors"
                        >
                          <Icon className="w-3 h-3" />
                          {count} {countLabel}
                          <ChevronDown className={`w-3 h-3 transition-transform ${activeReactionList === type ? 'rotate-180' : ''}`} />
                        </button>
                      );
                    })}
                  </div>
                )}
                {activeReactionList && (
                  <div className="flex flex-wrap gap-2 p-3 bg-muted/50 rounded-lg">
                    {reactions.filter(r => r.reaction === activeReactionList).map(r => (
                      <div key={r.id} className="flex items-center gap-1 text-xs">
                        <Avatar className="w-5 h-5">
                          <AvatarImage src={r.member?.avatar_url || undefined} />
                          <AvatarFallback className="text-xs">
                            {r.member?.first_name?.[0]}{r.member?.last_name?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <span>{r.member?.first_name} {r.member?.last_name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Comments section */}
            {isInternal && (
              <>
                <Separator />
                {post.comments_enabled === false ? (
                  <p className="text-sm text-muted-foreground text-center py-2 flex items-center justify-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Kommentare sind für diesen Beitrag deaktiviert.
                  </p>
                ) : (
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
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default PostDetailDialog;