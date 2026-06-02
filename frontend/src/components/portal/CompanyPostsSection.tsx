import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { supabase, getStorageUrl } from "@/integrations/api/client";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import {
  Megaphone,
  CalendarDays,
  Info,
  AlertTriangle,
  CheckCircle2,
  Hammer,
  Eye,
  MessageSquare,
  ArrowRight,
  Clock,
  Loader2,
} from "lucide-react";

interface Post {
  id: string;
  title: string;
  created_at: string;
  cover_image_path: string | null;
  category: string;
  content: string | null;
}

interface PostStats {
  commentCount: number;
  attendingCount: number;
  helpingCount: number;
  readCount: number;
}

interface CompanyPostsSectionProps {
  companyId: string;
  clubId: string;
  isMember: boolean;
}

const CATEGORY_LABELS: Record<string, { label: string; Icon: React.ElementType }> = {
  event:        { label: 'Termine & Veranstaltungen', Icon: CalendarDays },
  info:         { label: 'Vereinsinformation',         Icon: Info },
  announcement: { label: 'Vereinsinformation',         Icon: Info },
  warning:      { label: 'Wichtige Mitteilung',        Icon: AlertTriangle },
  other:        { label: 'Sonstiges',                  Icon: Megaphone },
  arbeit:       { label: 'Arbeitseinsatz',             Icon: Hammer },
};

const CompanyPostsSection = ({ companyId, clubId, isMember }: CompanyPostsSectionProps) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [statsMap, setStatsMap] = useState<Map<string, PostStats>>(new Map());
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isMember || !companyId || !clubId) return;
    fetchPosts();
  }, [companyId, clubId, isMember]);

  const fetchPosts = async () => {
    setIsLoading(true);
    try {
      const { data: postsData } = await supabase
        .from("posts")
        .select("id, title, created_at, cover_image_path, category, content")
        .eq("club_id", clubId)
        .eq("publication_status", "approved")
        .eq("audience", "company_only")
        .eq("owner_id", companyId)
        .order("created_at", { ascending: false })
        .limit(3);

      const allPosts = (postsData as Post[]) || [];
      const validPosts = allPosts.filter(p =>
        !(p as any).visible_until || new Date((p as any).visible_until) >= new Date()
      );
      setPosts(validPosts);

      if (validPosts.length > 0) {
        const postIds = validPosts.map(p => p.id);
        const [commentsRes, reactionsRes] = await Promise.all([
          supabase.from("post_comments").select("post_id").in("post_id", postIds),
          supabase.from("post_reactions").select("post_id, reaction").in("post_id", postIds),
        ]);

        const newMap = new Map<string, PostStats>();
        for (const p of validPosts) {
          const comments = (commentsRes.data || []) as Array<{ post_id: string }>;
          const reactions = (reactionsRes.data || []) as Array<{ post_id: string; reaction: string }>;
          newMap.set(p.id, {
            commentCount:   comments.filter(c => c.post_id === p.id).length,
            attendingCount: reactions.filter(r => r.post_id === p.id && r.reaction === 'attending').length,
            helpingCount:   reactions.filter(r => r.post_id === p.id && r.reaction === 'helping').length,
            readCount:      reactions.filter(r => r.post_id === p.id && r.reaction === 'read').length,
          });
        }
        setStatsMap(newMap);
      }
    } catch (error) {
      console.error("Error fetching company posts:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isMember) return null;

  return (
    <div>
      <h2 className="font-display text-xl font-semibold mb-4 flex items-center gap-2">
        <Megaphone className="w-5 h-5 text-primary" />
        Aktuelle Aushänge der Kompanie
      </h2>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : posts.length === 0 ? (
        <div className="p-6 bg-card rounded-xl border text-center">
          <Megaphone className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm">
            Aktuell gibt es keine neuen Aushänge für deine Kompanie.
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-3 gap-4">
          {posts.map(post => {
            const stats = statsMap.get(post.id);
            const categoryMeta = CATEGORY_LABELS[post.category];
            const hasEngagement = stats && (
              stats.attendingCount > 0 || stats.helpingCount > 0 ||
              stats.readCount > 0 || stats.commentCount > 0
            );

            return (
              <Link
                key={post.id}
                to={`/portal/posts/${post.id}`}
                className="group p-4 rounded-xl bg-card border border-border hover:border-primary/20 hover:shadow-md transition-all block space-y-2"
              >
                {post.cover_image_path && (
                  <div className="h-24 rounded-lg overflow-hidden">
                    <img
                      src={getStorageUrl("post-images", post.cover_image_path) || ""}
                      alt={post.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {categoryMeta && (
                  <Badge variant="outline" className="text-xs gap-1 w-fit">
                    <categoryMeta.Icon className="w-3 h-3" />{categoryMeta.label}
                  </Badge>
                )}

                <h3 className="font-medium text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                  {post.title}
                </h3>

                {post.content && (
                  <p className="text-xs text-muted-foreground line-clamp-2 whitespace-pre-wrap">
                    {post.content}
                  </p>
                )}

                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {format(new Date(post.created_at), "dd. MMMM yyyy", { locale: de })}
                </p>

                {hasEngagement && (
                  <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1 border-t">
                    {stats!.attendingCount > 0 && (
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-green-600" />
                        {stats!.attendingCount}
                      </span>
                    )}
                    {stats!.helpingCount > 0 && (
                      <span className="flex items-center gap-1">
                        <Hammer className="w-3 h-3 text-orange-600" />
                        {stats!.helpingCount}
                      </span>
                    )}
                    {stats!.readCount > 0 && (
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3 text-blue-600" />
                        {stats!.readCount}
                      </span>
                    )}
                    {stats!.commentCount > 0 && (
                      <span className="flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" />
                        {stats!.commentCount}
                      </span>
                    )}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}

      <Link
        to="/portal/posts"
        className="mt-3 flex items-center gap-1 text-xs text-primary hover:underline"
      >
        Alle Kompanie-Aushänge ansehen <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
  );
};

export default CompanyPostsSection;
