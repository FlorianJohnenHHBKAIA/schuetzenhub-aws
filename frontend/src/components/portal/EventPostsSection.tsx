import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Megaphone,
  Plus,
  Calendar,
  Bell,
  Info,
  AlertTriangle,
  ThumbsUp,
  MessageSquare,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/lib/auth";

interface Post {
  id: string;
  title: string;
  content: string;
  category: string;
  audience: string;
  publication_status: string;
  created_at: string;
  cover_image_path: string | null;
  creator?: { first_name: string; last_name: string } | null;
}

interface EventPostsSectionProps {
  eventId: string;
  clubId: string;
  canManage: boolean;
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  announcement: Bell,
  info: Info,
  event: Calendar,
  warning: AlertTriangle,
  other: Megaphone,
};

const CATEGORY_LABELS: Record<string, string> = {
  announcement: "Ankündigung",
  info: "Information",
  event: "Veranstaltung",
  warning: "Wichtig",
  other: "Sonstiges",
};

const EventPostsSection = ({ eventId, clubId, canManage }: EventPostsSectionProps) => {
  const { member } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [reactions, setReactions] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchEventPosts();
  }, [eventId]);

  const fetchEventPosts = async () => {
    if (!eventId) return;
    setLoading(true);

    try {
      const { data: postsData, error } = await supabase
        .from("posts")
        .select(`
          id,
          title,
          content,
          category,
          audience,
          publication_status,
          created_at,
          cover_image_path,
          creator:members!created_by_member_id(first_name, last_name)
        `)
        .eq("event_id", eventId)
        .in("publication_status", ["approved", "submitted"])
        .order("created_at", { ascending: false });

      if (error) throw error;

      const formattedPosts = (postsData || []).map((p) => ({
        ...p,
        creator: Array.isArray(p.creator) ? p.creator[0] : p.creator,
      }));

      setPosts(formattedPosts);

      // Fetch reaction and comment counts
      if (formattedPosts.length > 0) {
        const postIds = formattedPosts.map((p) => p.id);

        const { data: reactionsData } = await supabase
          .from("post_reactions")
          .select("post_id")
          .in("post_id", postIds);

        const reactionCounts: Record<string, number> = {};
        (reactionsData || []).forEach((r) => {
          reactionCounts[r.post_id] = (reactionCounts[r.post_id] || 0) + 1;
        });
        setReactions(reactionCounts);

        const { data: commentsData } = await supabase
          .from("post_comments")
          .select("post_id")
          .in("post_id", postIds)
          .is("deleted_at", null);

        const commentCounts: Record<string, number> = {};
        (commentsData || []).forEach((c) => {
          commentCounts[c.post_id] = (commentCounts[c.post_id] || 0) + 1;
        });
        setComments(commentCounts);
      }
    } catch (error) {
      console.error("Error fetching event posts:", error);
    } finally {
      setLoading(false);
    }
  };

  const CategoryIcon = (category: string) => {
    const Icon = CATEGORY_ICONS[category] || Megaphone;
    return <Icon className="w-4 h-4" />;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg flex items-center gap-2">
          <Megaphone className="w-5 h-5" />
          Ankündigungen & Infos ({posts.length})
        </CardTitle>
        {canManage && (
          <Button size="sm" variant="outline" asChild>
            <Link to={`/portal/posts?event=${eventId}`}>
              <Plus className="w-4 h-4 mr-2" />
              Beitrag erstellen
            </Link>
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Megaphone className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Noch keine Ankündigungen für dieses Event</p>
            {canManage && (
              <Button variant="outline" className="mt-4" asChild>
                <Link to={`/portal/posts?event=${eventId}`}>
                  <Plus className="w-4 h-4 mr-2" />
                  Erste Ankündigung erstellen
                </Link>
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => (
              <Link
                key={post.id}
                to={`/portal/posts?view=${post.id}`}
                className="block border rounded-lg p-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                    {CategoryIcon(post.category)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h4 className="font-medium truncate">{post.title}</h4>
                      <Badge variant="secondary" className="text-xs">
                        {CATEGORY_LABELS[post.category] || post.category}
                      </Badge>
                      {post.publication_status === "submitted" && (
                        <Badge variant="outline" className="text-xs border-amber-500 text-amber-600">
                          Eingereicht
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                      {post.content}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{format(new Date(post.created_at), "d. MMM yyyy", { locale: de })}</span>
                      {post.creator && (
                        <span>
                          von {post.creator.first_name} {post.creator.last_name}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <ThumbsUp className="w-3 h-3" />
                        {reactions[post.id] || 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" />
                        {comments[post.id] || 0}
                      </span>
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default EventPostsSection;
