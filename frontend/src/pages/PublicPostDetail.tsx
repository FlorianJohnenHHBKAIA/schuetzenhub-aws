import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { ArrowLeft, Megaphone, User } from "lucide-react";
import { supabase, getStorageUrl } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShareButtons } from "@/components/ui/share-buttons";

interface PostData {
  id: string;
  title: string;
  content: string;
  cover_image_path: string | null;
  category: string;
  created_at: string;
  club_id: string;
  creator?: { first_name: string; last_name: string } | null;
}

interface ClubData {
  id: string;
  name: string;
  slug: string;
  logo_path: string | null;
}

const categoryLabels: Record<string, string> = {
  announcement: "Ankündigung",
  info: "Information",
  event: "Veranstaltung",
  warning: "Wichtig",
  other: "Sonstiges",
};

const PublicPostDetail = () => {
  const { slug, postId } = useParams<{ slug: string; postId: string }>();
  const [post, setPost] = useState<PostData | null>(null);
  const [club, setClub] = useState<ClubData | null>(null);
  const [clubLogoUrl, setClubLogoUrl] = useState<string | null>(null);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!slug || !postId) return;

      try {
        // Fetch club by slug
        const { data: clubData, error: clubError } = await supabase
          .from("clubs")
          .select("id, name, slug, logo_path")
          .eq("slug", slug)
          .single();

        if (clubError || !clubData) {
          setLoading(false);
          return;
        }

        setClub(clubData);

        // Get club logo URL
        if (clubData.logo_path) {
          const { data: logoData } = { data: { publicUrl: getStorageUrl("club-assets", clubData.logo_path) || "" } };
          setClubLogoUrl(logoData?.publicUrl || null);
        }

        // Fetch public approved post
        const { data: postData, error: postError } = await supabase
          .from("posts")
          .select(`
            id, title, content, cover_image_path, category, created_at, club_id,
            creator:members!created_by_member_id(first_name, last_name)
          `)
          .eq("id", postId)
          .eq("club_id", clubData.id)
          .eq("audience", "public")
          .eq("publication_status", "approved")
          .single();

        if (postError || !postData) {
          setLoading(false);
          return;
        }

        setPost(postData as PostData);

        // Get cover image URL
        if (postData.cover_image_path) {
          const { data: coverData } = { data: { publicUrl: getStorageUrl("post-images", postData.cover_image_path) || "" } };
          setCoverImageUrl(coverData?.publicUrl || null);
        }
      } catch (error) {
        console.error("Error fetching post:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [slug, postId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-forest-dark flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gold"></div>
      </div>
    );
  }

  if (!post || !club) {
    return (
      <div className="min-h-screen bg-forest-dark flex flex-col items-center justify-center text-cream">
        <Megaphone className="w-16 h-16 text-gold/50 mb-4" />
        <h1 className="text-2xl font-display mb-2">Beitrag nicht gefunden</h1>
        <p className="text-cream/60 mb-6">Dieser Beitrag existiert nicht oder ist nicht öffentlich.</p>
        <Link to={`/verein/${slug}`}>
          <Button variant="outline" className="border-gold/30 text-gold hover:bg-gold/10">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Zurück zur Vereinsseite
          </Button>
        </Link>
      </div>
    );
  }

  const shareUrl = `/verein/${slug}/beitrag/${postId}`;
  const fullUrl = `${window.location.origin}${shareUrl}`;
  const ogDescription = post.content?.substring(0, 160) || `Beitrag von ${club.name}`;
  const creatorName = post.creator 
    ? `${post.creator.first_name} ${post.creator.last_name}` 
    : null;

  return (
    <>
      <Helmet>
        <title>{post.title} | {club.name}</title>
        <meta name="description" content={ogDescription} />
        
        {/* Open Graph */}
        <meta property="og:title" content={post.title} />
        <meta property="og:description" content={ogDescription} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={fullUrl} />
        {coverImageUrl && <meta property="og:image" content={coverImageUrl} />}
        {clubLogoUrl && !coverImageUrl && <meta property="og:image" content={clubLogoUrl} />}
        
        {/* Twitter Card */}
        <meta name="twitter:card" content={coverImageUrl ? "summary_large_image" : "summary"} />
        <meta name="twitter:title" content={post.title} />
        <meta name="twitter:description" content={ogDescription} />
        {coverImageUrl && <meta name="twitter:image" content={coverImageUrl} />}
      </Helmet>

      <div className="min-h-screen bg-forest-dark">
        {/* Header */}
        <div className="fixed top-0 left-0 right-0 z-50 bg-forest-dark/95 backdrop-blur-sm border-b border-white/10">
          <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            <Link 
              to={`/verein/${slug}`}
              className="flex items-center gap-2 text-cream/80 hover:text-gold transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:inline">Zurück zu {club.name}</span>
              <span className="sm:hidden">Zurück</span>
            </Link>
            <ShareButtons 
              url={shareUrl} 
              title={post.title} 
              description={ogDescription}
              variant="compact"
              className="text-cream/80 hover:text-gold"
            />
          </div>
        </div>

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="pt-24 pb-16 px-4"
        >
          <div className="container mx-auto max-w-3xl">
            {/* Cover Image */}
            {coverImageUrl && (
              <div className="rounded-2xl overflow-hidden mb-8">
                <img 
                  src={coverImageUrl} 
                  alt={post.title}
                  className="w-full h-64 sm:h-80 object-cover"
                />
              </div>
            )}

            {/* Category & Date */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <Badge className="bg-gold/20 text-gold border-gold/30">
                {categoryLabels[post.category] || post.category}
              </Badge>
              <span className="text-cream/50 text-sm">
                {format(new Date(post.created_at), "d. MMMM yyyy", { locale: de })}
              </span>
            </div>

            {/* Title */}
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-cream mb-6">
              {post.title}
            </h1>

            {/* Author */}
            {creatorName && (
              <div className="flex items-center gap-2 text-cream/60 mb-8 pb-8 border-b border-white/10">
                <User className="w-4 h-4" />
                <span className="text-sm">Von {creatorName}</span>
              </div>
            )}

            {/* Content */}
            <div className="prose prose-invert prose-gold max-w-none">
              <p className="text-cream/80 text-lg leading-relaxed whitespace-pre-wrap">
                {post.content}
              </p>
            </div>

            {/* Share Section */}
            <div className="mt-12 pt-8 border-t border-white/10">
              <h3 className="text-cream/60 text-sm mb-4">Beitrag teilen</h3>
              <ShareButtons 
                url={shareUrl} 
                title={post.title} 
                description={ogDescription}
              />
            </div>

            {/* Back Button */}
            <div className="mt-12 text-center">
              <Link to={`/verein/${slug}`}>
                <Button 
                  size="lg"
                  className="bg-gold hover:bg-gold-light text-forest-dark font-semibold"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Alle News von {club.name}
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </>
  );
};

export default PublicPostDetail;
