import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase, getStorageUrl } from "@/integrations/api/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { ArrowRight, Bell, Info, Calendar, AlertTriangle, Megaphone, Loader2, Newspaper } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Post {
  id: string;
  title: string;
  content: string;
  cover_image_path: string | null;
  category: string;
  created_at: string;
}

const CATEGORIES: Record<string, { label: string; icon: LucideIcon; color: string }> = {
  announcement: { label: 'Ankündigung', icon: Bell, color: 'bg-blue-500/10 text-blue-600' },
  info: { label: 'Information', icon: Info, color: 'bg-emerald-500/10 text-emerald-600' },
  event: { label: 'Veranstaltung', icon: Calendar, color: 'bg-purple-500/10 text-purple-600' },
  warning: { label: 'Wichtig', icon: AlertTriangle, color: 'bg-amber-500/10 text-amber-600' },
  other: { label: 'Sonstiges', icon: Megaphone, color: 'bg-slate-500/10 text-slate-600' },
};

const NewsSection = () => {
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<Post[]>([]);

  useEffect(() => {
    fetchPublicPosts();
  }, []);

  const fetchPublicPosts = async () => {
    try {
      const { data } = await supabase
        .from('posts')
        .select('id, title, content, cover_image_path, category, created_at')
        .eq('audience', 'public')
        .eq('publication_status', 'approved')
        .order('created_at', { ascending: false })
        .limit(3);
      setPosts((data as Post[]) || []);
    } catch (error: unknown) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <section className="py-32 bg-cream-dark">
        <div className="container flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </section>
    );
  }

  if (posts.length === 0) return null;

  return (
    <section className="py-32 bg-cream-dark relative">
      {/* Top decorative line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
      
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <motion.div
            initial={{ scale: 0 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-forest/10 mb-6"
          >
            <Newspaper className="w-8 h-8 text-forest" />
          </motion.div>
          
          <h2 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-6">
            Aktuelles
          </h2>
          
          <div className="w-24 h-1 bg-gradient-to-r from-gold to-gold-dark mx-auto mb-6" />
          
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Neuigkeiten und Ankündigungen aus unserem Verein
          </p>
        </motion.div>

        <div className="grid gap-8 md:grid-cols-3 max-w-6xl mx-auto">
          {posts.map((post, index) => {
            const category = CATEGORIES[post.category] || CATEGORIES.other;
            const CategoryIcon = category.icon;
            
            return (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="h-full overflow-hidden hover:shadow-xl hover:border-gold/30 transition-all duration-300 group bg-background">
                  {post.cover_image_path && (
                    <div className="h-48 bg-muted overflow-hidden">
                      <img
                        src={`${getStorageUrl("post-images", post.cover_image_path) || ""}`}
                        alt={post.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </div>
                  )}
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <Badge variant="secondary" className={`gap-1.5 ${category.color}`}>
                        <CategoryIcon className="w-3.5 h-3.5" />
                        {category.label}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(post.created_at), 'dd. MMM yyyy', { locale: de })}
                      </span>
                    </div>
                    <h3 className="font-display text-xl font-semibold mb-3 line-clamp-2 group-hover:text-primary transition-colors">
                      {post.title}
                    </h3>
                    <p className="text-muted-foreground text-sm leading-relaxed line-clamp-3">
                      {post.content}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mt-12"
        >
          <Button asChild variant="outline" size="lg" className="group">
            <Link to="/aktuelles">
              Alle Beiträge anzeigen
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
};

export default NewsSection;