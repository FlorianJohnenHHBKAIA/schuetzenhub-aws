import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase, getStorageUrl } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShareButtons } from "@/components/ui/share-buttons";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import {
  ArrowLeft,
  Calendar,
  Info,
  Bell,
  AlertTriangle,
  Megaphone,
  Loader2,
} from "lucide-react";

interface Post {
  id: string;
  club_id: string;
  title: string;
  content: string;
  cover_image_path: string | null;
  category: string;
  created_at: string;
  creator?: { first_name: string; last_name: string } | null;
}

const CATEGORIES: Record<string, { label: string; icon: any }> = {
  announcement: { label: 'Ankündigung', icon: Bell },
  info: { label: 'Information', icon: Info },
  event: { label: 'Veranstaltung', icon: Calendar },
  warning: { label: 'Wichtig', icon: AlertTriangle },
  other: { label: 'Sonstiges', icon: Megaphone },
};

const PublicNews = () => {
  const { slug } = useParams<{ slug: string }>();
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<Post[]>([]);
  const [clubSlug, setClubSlug] = useState<string | null>(slug || null);

  useEffect(() => {
    fetchPublicPosts();
  }, [slug]);

  const fetchPublicPosts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          id,
          club_id,
          title,
          content,
          cover_image_path,
          category,
          created_at,
          creator:members!created_by_member_id(first_name, last_name),
          club:clubs!club_id(slug)
        `)
        .eq('audience', 'public')
        .eq('publication_status', 'approved')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching posts:', error);
      } else {
        setPosts(data || []);
        // If we don't have a slug from URL, use the first post's club slug
        if (!slug && data && data.length > 0 && (data[0] as any).club?.slug) {
          setClubSlug((data[0] as any).club.slug);
        }
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryInfo = (category: string) => {
    return CATEGORIES[category] || CATEGORIES.other;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Zurück zur Startseite
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="font-display text-4xl font-bold flex items-center gap-3">
            <Megaphone className="w-10 h-10" />
            Aktuelles
          </h1>
          <p className="text-muted-foreground mt-2">
            Neuigkeiten und Ankündigungen aus dem Verein
          </p>
        </motion.div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : posts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Megaphone className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Keine aktuellen Beiträge</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {posts.map((post, index) => {
              const category = getCategoryInfo(post.category);
              const CategoryIcon = category.icon;
              
              return (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="overflow-hidden hover:shadow-lg transition-shadow">
                    {post.cover_image_path && (
                      <div className="h-64 bg-muted">
                        <img
                          src={`${getStorageUrl("post-images", post.cover_image_path) || ""}`}
                          alt={post.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <CardContent className="p-6">
                      <div className="flex items-center gap-2 mb-3">
                        <Badge variant="outline" className="gap-1">
                          <CategoryIcon className="w-3 h-3" />
                          {category.label}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(post.created_at), 'dd. MMMM yyyy', { locale: de })}
                        </span>
                      </div>
                      <h2 className="text-2xl font-bold mb-3">{post.title}</h2>
                      <div className="prose prose-sm max-w-none mb-6">
                        <p className="whitespace-pre-wrap text-muted-foreground">{post.content}</p>
                      </div>
                      
                      {/* Share Buttons */}
                      {clubSlug && (
                        <div className="pt-4 border-t flex items-center justify-between">
                          <span className="text-muted-foreground text-sm">Beitrag teilen:</span>
                          <ShareButtons 
                            url={`/verein/${clubSlug}/beitrag/${post.id}`}
                            title={post.title}
                            description={post.content.substring(0, 100)}
                            variant="compact"
                          />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default PublicNews;
