import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  Calendar, 
  MapPin, 
  Users, 
  ArrowRight,
  Shield,
  Newspaper,
  Building2,
  ChevronLeft,
  Crown,
  Heart,
  Handshake,
  Award,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface ClubData {
  id: string;
  name: string;
  slug: string;
  logo_path: string | null;
}

interface CompanyData {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  cover_url: string | null;
  club_id: string;
}

interface PublicEvent {
  id: string;
  title: string;
  start_at: string;
  end_at: string | null;
  location: string | null;
  category: string;
  description: string | null;
}

interface PublicPost {
  id: string;
  title: string;
  content: string;
  created_at: string;
  category: string;
  cover_image_path: string | null;
}

interface LeadershipPosition {
  id: string;
  role_name: string;
  member: {
    id: string;
    first_name: string;
    last_name: string;
    avatar_url: string | null;
    title: string | null;
  };
}

const PublicCompanyProfile = () => {
  const { slug, companyId } = useParams<{ slug: string; companyId: string }>();
  const [club, setClub] = useState<ClubData | null>(null);
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [posts, setPosts] = useState<PublicPost[]>([]);
  const [leadership, setLeadership] = useState<LeadershipPosition[]>([]);
  const [memberCount, setMemberCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [clubLogoUrl, setClubLogoUrl] = useState<string | null>(null);
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null);
  const [companyCoverUrl, setCompanyCoverUrl] = useState<string | null>(null);

  useEffect(() => {
    if (slug && companyId) {
      fetchData();
    }
  }, [slug, companyId]);

  const fetchData = async () => {
    if (!slug || !companyId) return;
    
    try {
      // Fetch club data
      const { data: clubData, error: clubError } = await supabase
        .from("clubs")
        .select("id, name, slug, logo_path")
        .eq("slug", slug)
        .single();

      if (clubError) throw clubError;
      setClub(clubData);

      if (clubData.logo_path) {
        const { data: urlData } = supabase.storage.from("club-assets").getPublicUrl(clubData.logo_path);
        setClubLogoUrl(urlData.publicUrl);
      }

      // Fetch company data
      const { data: companyData, error: companyError } = await supabase
        .from("companies")
        .select("*")
        .eq("id", companyId)
        .eq("club_id", clubData.id)
        .single();

      if (companyError) throw companyError;
      setCompany(companyData);

      if (companyData.logo_url) {
        if (companyData.logo_url.startsWith('http')) {
          setCompanyLogoUrl(companyData.logo_url);
        } else {
          const { data: urlData } = supabase.storage.from("company-assets").getPublicUrl(companyData.logo_url);
          setCompanyLogoUrl(urlData.publicUrl);
        }
      }
      if (companyData.cover_url) {
        if (companyData.cover_url.startsWith('http')) {
          setCompanyCoverUrl(companyData.cover_url);
        } else {
          const { data: urlData } = supabase.storage.from("company-assets").getPublicUrl(companyData.cover_url);
          setCompanyCoverUrl(urlData.publicUrl);
        }
      }

      // Fetch public events for this company
      const { data: eventsData } = await supabase
        .from("events")
        .select("id, title, start_at, end_at, location, category, description")
        .eq("club_id", clubData.id)
        .eq("owner_id", companyId)
        .eq("owner_type", "company")
        .in("audience", ["public", "club_internal"])
        .eq("publication_status", "approved")
        .gte("start_at", new Date().toISOString())
        .order("start_at", { ascending: true })
        .limit(5);

      setEvents(eventsData || []);

      // Fetch public posts for this company
      const { data: postsData } = await supabase
        .from("posts")
        .select("id, title, content, created_at, category, cover_image_path")
        .eq("club_id", clubData.id)
        .eq("owner_id", companyId)
        .eq("owner_type", "company")
        .eq("audience", "public")
        .eq("publication_status", "approved")
        .order("created_at", { ascending: false })
        .limit(4);

      setPosts(postsData || []);

      // Get member count (public info)
      const { count } = await supabase
        .from("member_company_memberships")
        .select("*", { count: "exact", head: true })
        .eq("company_id", companyId)
        .is("valid_to", null);

      setMemberCount(count || 0);

      // Fetch leadership positions for this company
      const today = new Date().toISOString().split('T')[0];
      const { data: appointmentsData } = await supabase
        .from("appointments")
        .select(`
          id,
          role_id,
          member_id,
          roles!inner (
            id,
            name,
            level
          ),
          members!inner (
            id,
            first_name,
            last_name,
            avatar_url,
            title
          )
        `)
        .eq("scope_type", "company")
        .eq("scope_id", companyId)
        .lte("valid_from", today)
        .or(`valid_to.is.null,valid_to.gte.${today}`);

      if (appointmentsData) {
        const leadershipData: LeadershipPosition[] = appointmentsData.map((apt: any) => ({
          id: apt.id,
          role_name: apt.roles.name,
          member: {
            id: apt.members.id,
            first_name: apt.members.first_name,
            last_name: apt.members.last_name,
            avatar_url: apt.members.avatar_url,
            title: apt.members.title,
          }
        }));
        setLeadership(leadershipData);
      }

    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      training: "Training",
      meeting: "Versammlung",
      fest: "Fest",
      work: "Arbeitsdienst",
      other: "Sonstiges",
      announcement: "Ankündigung",
      info: "Information",
      event: "Veranstaltung",
      warning: "Hinweis",
    };
    return labels[category] || category;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-forest-dark flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold"></div>
      </div>
    );
  }

  if (!club || !company) {
    return (
      <div className="min-h-screen bg-forest-dark flex flex-col items-center justify-center">
        <Building2 className="w-16 h-16 text-gold mb-4" />
        <h1 className="text-2xl font-bold text-cream mb-2">Kompanie nicht gefunden</h1>
        <p className="text-cream/60 mb-4">Die gesuchte Kompanie existiert nicht.</p>
        <Button variant="hero" asChild>
          <Link to={`/verein/${slug}`}>Zurück zum Verein</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-forest-dark">
      {/* Header with Back Navigation */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-forest-dark/90 backdrop-blur-md border-b border-gold/10">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <Link 
            to={`/verein/${club.slug}`}
            className="flex items-center gap-3 text-cream hover:text-gold transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <div className="flex items-center gap-2">
              {clubLogoUrl ? (
                <img src={clubLogoUrl} alt={club.name} className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <Shield className="w-8 h-8 text-gold" />
              )}
              <span className="font-medium hidden sm:inline">{club.name}</span>
            </div>
          </Link>
          
          <Button variant="heroOutline" size="sm" asChild>
            <Link to="/auth">
              <Shield className="w-4 h-4 mr-2" />
              Zum Portal
            </Link>
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-16 min-h-[60vh] flex items-center justify-center overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0">
          {companyCoverUrl ? (
            <img 
              src={companyCoverUrl} 
              alt={company.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-forest-dark via-forest to-forest-dark" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-forest-dark/80 via-forest-dark/60 to-forest-dark" />
        </div>

        {/* Decorative Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-24 left-10 w-24 h-24 border-l-2 border-t-2 border-gold/20" />
          <div className="absolute top-24 right-10 w-24 h-24 border-r-2 border-t-2 border-gold/20" />
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.1 }}
            transition={{ duration: 2 }}
            className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-gold blur-[120px]"
          />
        </div>

        {/* Content */}
        <div className="relative z-10 container mx-auto px-6 py-20">
          <div className="max-w-4xl mx-auto text-center">
            {/* Company Logo */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8 }}
              className="mb-8"
            >
              <div className="inline-flex flex-col items-center">
                <div className="w-32 h-32 rounded-2xl bg-gradient-to-br from-gold to-gold-dark flex items-center justify-center shadow-xl shadow-gold/20 overflow-hidden border-4 border-gold/30">
                  {companyLogoUrl ? (
                    <img src={companyLogoUrl} alt={company.name} className="w-full h-full object-cover" />
                  ) : (
                    <Building2 className="w-16 h-16 text-forest-dark" />
                  )}
                </div>
              </div>
            </motion.div>

            {/* Company Name */}
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-cream mb-6"
            >
              {company.name}
            </motion.h1>

            {/* Club Reference */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="text-gold text-lg mb-8"
            >
              {club.name}
            </motion.p>

            {/* Quick Stats */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.4 }}
              className="grid grid-cols-3 max-w-md mx-auto"
            >
              {[
                { icon: Users, value: memberCount.toString(), label: "Mitglieder" },
                { icon: Calendar, value: events.length.toString(), label: "Termine" },
                { icon: Newspaper, value: posts.length.toString(), label: "Beiträge" },
              ].map((stat, index) => (
                <div key={index} className="relative px-4 py-3">
                  {index > 0 && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-px h-10 bg-gradient-to-b from-transparent via-gold/30 to-transparent" />
                  )}
                  <div className="flex flex-col items-center">
                    <stat.icon className="w-5 h-5 text-gold mb-2" />
                    <span className="text-2xl font-display font-bold text-cream">
                      {stat.value}
                    </span>
                    <span className="text-cream/50 text-xs">{stat.label}</span>
                  </div>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Leadership Section */}
      {leadership.length > 0 && (
        <section className="py-24 bg-gradient-to-b from-forest-dark to-forest relative overflow-hidden">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-20 left-20 w-60 h-60 rounded-full bg-gold/5 blur-[80px]" />
          </div>

          <div className="container mx-auto px-6 relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gold/20 mb-4">
                <Crown className="w-7 h-7 text-gold" />
              </div>
              <h2 className="font-display text-3xl md:text-4xl font-bold text-cream mb-4">
                Unsere Führung
              </h2>
              <div className="w-16 h-1 bg-gradient-to-r from-gold to-gold-dark mx-auto" />
            </motion.div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto">
              {leadership.map((position, index) => {
                // Avatar URL might be a full URL or a path - handle both
                const avatarUrl = position.member.avatar_url 
                  ? (position.member.avatar_url.startsWith('http') 
                      ? position.member.avatar_url 
                      : supabase.storage.from("avatars").getPublicUrl(position.member.avatar_url).data.publicUrl)
                  : null;
                
                return (
                  <motion.div
                    key={position.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 }}
                    className="group"
                  >
                    <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6 text-center hover:border-gold/30 hover:bg-white/10 transition-all">
                      {/* Avatar */}
                      <div className="relative mx-auto mb-4 w-24 h-24">
                        <div className="w-full h-full rounded-full overflow-hidden border-3 border-gold/30 shadow-lg shadow-gold/10">
                          {avatarUrl ? (
                            <img 
                              src={avatarUrl} 
                              alt={`${position.member.first_name} ${position.member.last_name}`}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-gold/20 to-gold/10 flex items-center justify-center">
                              <Users className="w-10 h-10 text-gold/60" />
                            </div>
                          )}
                        </div>
                        {/* Role Badge */}
                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2">
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gold text-forest-dark text-xs font-semibold whitespace-nowrap shadow-md">
                            <Crown className="w-3 h-3" />
                            {position.role_name}
                          </span>
                        </div>
                      </div>

                      {/* Name */}
                      <h3 className="font-display text-lg font-semibold text-cream mt-6 mb-1">
                        {position.member.title && (
                          <span className="text-gold/80">{position.member.title} </span>
                        )}
                        {position.member.first_name} {position.member.last_name}
                      </h3>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Description Section */}
      {company.description && (
        <section className="py-20 bg-forest relative">
          <div className="container mx-auto px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="max-w-3xl mx-auto text-center"
            >
              <div className="w-16 h-1 bg-gradient-to-r from-gold to-gold-dark mx-auto mb-8" />
              <p className="text-cream/80 text-lg leading-relaxed whitespace-pre-wrap">
                {company.description}
              </p>
            </motion.div>
          </div>
        </section>
      )}

      {/* Events Section */}
      {events.length > 0 && (
        <section className="py-24 bg-forest relative overflow-hidden">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-20 right-20 w-60 h-60 rounded-full bg-gold/5 blur-[80px]" />
          </div>

          <div className="container mx-auto px-6 relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gold/20 mb-4">
                <Calendar className="w-7 h-7 text-gold" />
              </div>
              <h2 className="font-display text-3xl md:text-4xl font-bold text-cream mb-4">
                Kommende Termine
              </h2>
              <div className="w-16 h-1 bg-gradient-to-r from-gold to-gold-dark mx-auto" />
            </motion.div>

            <div className="max-w-3xl mx-auto space-y-4">
              {events.map((event, index) => {
                const startDate = new Date(event.start_at);
                return (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 }}
                    className="flex gap-4 p-4 rounded-xl bg-white/5 border border-white/10 hover:border-gold/30 transition-colors"
                  >
                    <div className="flex-shrink-0 w-16 text-center">
                      <div className="text-2xl font-bold text-gold">
                        {format(startDate, "dd", { locale: de })}
                      </div>
                      <div className="text-sm text-cream/60 uppercase">
                        {format(startDate, "MMM", { locale: de })}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-cream truncate">{event.title}</h3>
                      <div className="flex items-center gap-4 text-sm text-cream/60 mt-1">
                        <span>{format(startDate, "HH:mm", { locale: de })} Uhr</span>
                        {event.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {event.location}
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline" className="flex-shrink-0 text-gold border-gold/30">
                      {getCategoryLabel(event.category)}
                    </Badge>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* News Section */}
      {posts.length > 0 && (
        <section className="py-24 bg-cream-dark relative">
          <div className="container mx-auto px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-forest/10 mb-4">
                <Newspaper className="w-7 h-7 text-forest" />
              </div>
              <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
                Aktuelles
              </h2>
              <div className="w-16 h-1 bg-gradient-to-r from-gold to-gold-dark mx-auto" />
            </motion.div>

            <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {posts.map((post, index) => (
                <motion.article
                  key={post.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="group bg-card rounded-xl overflow-hidden border border-border hover:border-gold/30 hover:shadow-lg transition-all"
                >
                  {post.cover_image_path && (
                    <div className="aspect-video overflow-hidden">
                      <img 
                        src={supabase.storage.from("club-assets").getPublicUrl(post.cover_image_path).data.publicUrl}
                        alt={post.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </div>
                  )}
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant="secondary" className="text-xs">
                        {getCategoryLabel(post.category)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(post.created_at), "dd.MM.yyyy", { locale: de })}
                      </span>
                    </div>
                    <h3 className="font-display text-lg font-semibold text-foreground mb-2 line-clamp-2">
                      {post.title}
                    </h3>
                    <p className="text-muted-foreground text-sm line-clamp-2">
                      {post.content.replace(/<[^>]*>/g, '').substring(0, 120)}...
                    </p>
                  </div>
                </motion.article>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="py-12 bg-forest-dark border-t border-gold/10">
        <div className="container mx-auto px-6 text-center">
          <Link to={`/verein/${club.slug}`} className="inline-flex items-center gap-2 text-cream/60 hover:text-gold transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Zurück zu {club.name}
          </Link>
          <div className="mt-6 text-cream/40 text-sm">
            Powered by <span className="text-gold">SchützenHub</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PublicCompanyProfile;
