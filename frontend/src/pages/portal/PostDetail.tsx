import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import PortalLayout from "@/components/portal/PortalLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { usePostComments, usePostReactions } from "@/hooks/usePostInteractions";
import { createNotification } from "@/hooks/useNotifications";
import { supabase, getStorageUrl } from "@/integrations/api/client";
import { useCachedData, CacheKeys } from "@/hooks/useCachedData";
import { OfflineEmptyState } from "@/components/pwa/OfflineEmptyState";
import { useOfflineStatus } from "@/components/pwa/OfflineBanner";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import {
  MessageSquare,
  Send,
  Trash2,
  ArrowLeft,
  Clock,
  CheckCircle2,
  XCircle,
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
  creator?: { first_name: string; last_name: string; avatar_url?: string } | null;
  approver?: { first_name: string; last_name: string } | null;
}

interface RawPermission {
  permission_key: string;
  scope_type?: string;
  scope_id?: string;
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

export default function PostDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, member } = useAuth();
  const { isOffline } = useOfflineStatus();
  const [newComment, setNewComment] = useState('');
  const [canComment, setCanComment] = useState(false);
  const [canModerate, setCanModerate] = useState(false);

  const fetchPost = useCallback(async (): Promise<Post | null> => {
    if (!id) return null;
    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        creator:members!created_by_member_id(first_name, last_name, avatar_url),
        approver:members!approved_by_member_id(first_name, last_name)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as Post;
  }, [id]);

  const { data: post, isLoading, isFromCache, error, refetch } = useCachedData({
    cacheKey: CacheKeys.postDetail(id || ''),
    fetchFn: fetchPost,
    enabled: !!id,
    ttlMinutes: 30,
  });

  const { comments, loading: commentsLoading, submitting, addComment, deleteComment } = usePostComments(post?.id || null);
  const { reactions, toggleReaction, hasReacted, reactionCount } = usePostReactions(post?.id || null);
  const [activeReactionList, setActiveReactionList] = useState<string | null>(null);

  useEffect(() => {
    const checkPermissions = async () => {
      if (!user || !member || !post) return;

      const { data: permData } = await supabase.rpc('get_user_permissions', {
        _user_id: user.id,
        _club_id: member.club_id
      });

      const permissions = (permData as RawPermission[]) || [];
      const hasFullAdmin = permissions.some((p) => p.permission_key === 'club.admin.full');
      const hasModerate = permissions.some((p) => p.permission_key === 'club.posts.moderate');
      setCanModerate(hasFullAdmin || hasModerate);

      if (post.audience !== 'public') {
        if (post.audience === 'club_internal') {
          const hasClubComment = permissions.some((p) => p.permission_key === 'club.posts.comment');
          setCanComment(hasClubComment || hasFullAdmin);
        } else if (post.audience === 'company_only') {
          const hasCompanyComment = permissions.some((p) =>
            p.permission_key === 'company.posts.comment' &&
            p.scope_type === 'company' &&
            p.scope_id === post.owner_id
          );
          setCanComment(hasCompanyComment || hasFullAdmin);
        }
      } else {
        setCanComment(true);
      }
    };

    checkPermissions();
  }, [user, member, post]);

  const handleAddComment = async () => {
    if (!post || !newComment.trim() || isOffline) return;
    await addComment(newComment, post.club_id);
    setNewComment('');

    if (post.created_by_member_id && post.created_by_member_id !== member?.id) {
      await createNotification(post.club_id, post.created_by_member_id, 'post_comment', post.id);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft': return <Badge variant="secondary" className="gap-1"><Clock className="w-3 h-3" />Entwurf</Badge>;
      case 'submitted': return <Badge variant="outline" className="gap-1 border-yellow-500 text-yellow-600"><Send className="w-3 h-3" />Eingereicht</Badge>;
      case 'approved': return <Badge variant="default" className="gap-1 bg-green-600"><CheckCircle2 className="w-3 h-3" />Freigegeben</Badge>;
      case 'rejected': return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" />Abgelehnt</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getAudienceBadge = (audience: string) => {
    switch (audience) {
      case 'company_only': return <Badge variant="outline" className="gap-1"><Building2 className="w-3 h-3" />Kompanie</Badge>;
      case 'club_internal': return <Badge variant="outline" className="gap-1"><Users className="w-3 h-3" />Verein</Badge>;
      case 'public': return <Badge variant="outline" className="gap-1"><Globe className="w-3 h-3" />Öffentlich</Badge>;
      default: return <Badge variant="outline">{audience}</Badge>;
    }
  };

  const getCategoryBadge = (category: string) => {
    const meta = CATEGORY_META[category];
    if (!meta) return null;
    const Icon = meta.icon;
    return <Badge variant="outline" className="gap-1"><Icon className="w-3 h-3" />{meta.label}</Badge>;
  };

  if (isLoading) {
    return (
      <PortalLayout>
        <div className="max-w-3xl mx-auto space-y-6">
          <Skeleton className="h-8 w-32" />
          <Card>
            <CardHeader>
              <Skeleton className="h-8 w-3/4" />
              <div className="flex gap-2 mt-2"><Skeleton className="h-5 w-20" /><Skeleton className="h-5 w-24" /></div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </CardContent>
          </Card>
        </div>
      </PortalLayout>
    );
  }

  if (error?.message === 'offline_no_cache' || (!post && !isLoading)) {
    return (
      <PortalLayout>
        <div className="max-w-3xl mx-auto">
          <Button variant="ghost" onClick={() => navigate('/portal/posts')} className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />Zurück
          </Button>
          <OfflineEmptyState onRetry={refetch} />
        </div>
      </PortalLayout>
    );
  }

  if (!post) return null;

  const isInternal = post.audience !== 'public';

  return (
    <PortalLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate('/portal/posts')}>
            <ArrowLeft className="w-4 h-4 mr-2" />Zurück zum Aushang
          </Button>
          {isFromCache && <Badge variant="outline" className="text-xs">Offline-Daten</Badge>}
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-start gap-4">
              {post.creator && (
                <Avatar className="w-12 h-12">
                  <AvatarImage src={post.creator.avatar_url} />
                  <AvatarFallback>{post.creator.first_name?.[0]}{post.creator.last_name?.[0]}</AvatarFallback>
                </Avatar>
              )}
              <div className="flex-1 min-w-0">
                <CardTitle className="text-2xl mb-2">{post.title}</CardTitle>
                <div className="flex flex-wrap gap-2 mb-2">
                  {getStatusBadge(post.publication_status)}
                  {getAudienceBadge(post.audience)}
                  {getCategoryBadge(post.category)}
                </div>
                <p className="text-sm text-muted-foreground">
                  {post.creator && `${post.creator.first_name} ${post.creator.last_name} · `}
                  {format(new Date(post.created_at), 'dd. MMMM yyyy', { locale: de })}
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {post.cover_image_path && (
              <img src={`${getStorageUrl("post-images", post.cover_image_path) || ""}`} alt={post.title} className="w-full rounded-lg object-cover max-h-[400px]" loading="lazy" />
            )}
            <div className="prose prose-sm max-w-none">
              <p className="whitespace-pre-wrap text-foreground">{post.content}</p>
            </div>
            {post.publication_status === 'rejected' && post.rejection_reason && (
              <div className="p-4 bg-destructive/10 rounded-lg">
                <p className="text-destructive font-medium mb-1">Ablehnungsgrund:</p>
                <p className="text-sm">{post.rejection_reason}</p>
              </div>
            )}
            {post.approver && post.approved_at && (
              <p className="text-sm text-muted-foreground">
                Freigegeben von {post.approver.first_name} {post.approver.last_name} am {format(new Date(post.approved_at), 'dd.MM.yyyy HH:mm', { locale: de })}
              </p>
            )}
          </CardContent>
        </Card>

        {isInternal && (
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2 mb-4">
                <div className="flex flex-wrap items-center gap-2">
                  {REACTION_CONFIG.map(({ type, label, activeLabel, icon: Icon, activeClass }) => (
                    <Button
                      key={type}
                      variant={hasReacted(type) ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleReaction(post.club_id, type)}
                      className={`gap-2 ${hasReacted(type) ? activeClass : ''}`}
                      disabled={isOffline}
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

              <Separator className="my-4" />

              {post.comments_enabled === false ? (
                <p className="text-sm text-muted-foreground text-center py-2 flex items-center justify-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Kommentare sind für diesen Beitrag deaktiviert.
                </p>
              ) : (
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2"><MessageSquare className="w-5 h-5" />Kommentare</h3>

                {commentsLoading ? (
                  <div className="flex justify-center py-4"><Loader2 className="w-6 h-6 animate-spin" /></div>
                ) : comments.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-4">Noch keine Kommentare</p>
                ) : (
                  <div className="space-y-4">
                    {comments.map((comment) => (
                      <div key={comment.id} className={`flex gap-3 ${comment.deleted_at ? 'opacity-50' : ''}`}>
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={comment.author?.avatar_url || undefined} />
                          <AvatarFallback className="text-xs">{comment.author?.first_name?.[0]}{comment.author?.last_name?.[0]}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 bg-muted rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium">{comment.author?.first_name} {comment.author?.last_name}</span>
                            <span className="text-xs text-muted-foreground">{format(new Date(comment.created_at), 'dd.MM.yyyy HH:mm', { locale: de })}</span>
                          </div>
                          {comment.deleted_at ? (
                            <p className="text-sm text-muted-foreground italic">Kommentar wurde entfernt</p>
                          ) : (
                            <p className="text-sm">{comment.content}</p>
                          )}
                          {!comment.deleted_at && !isOffline && (
                            (comment.author_member_id === member?.id || canModerate) && (
                              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive mt-1" onClick={() => deleteComment(comment.id)}>
                                <Trash2 className="w-3 h-3 mr-1" />Löschen
                              </Button>
                            )
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {canComment && (
                  <div className="flex gap-2 pt-2">
                    <Textarea
                      placeholder={isOffline ? "Offline – Kommentieren nicht möglich" : "Kommentar schreiben..."}
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      className="min-h-[60px]"
                      disabled={isOffline}
                    />
                    <Button onClick={handleAddComment} disabled={submitting || !newComment.trim() || isOffline} size="icon" className="shrink-0">
                      {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                  </div>
                )}
              </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </PortalLayout>
  );
}