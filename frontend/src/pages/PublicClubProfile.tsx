import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import { 
  Calendar, 
  MapPin, 
  Mail, 
  Phone, 
  Globe, 
  Users, 
  ArrowRight,
  Shield,
  Newspaper,
  Building2,
  ChevronDown,
  Crown,
  Heart,
  Handshake,
  Award,
  Images,
  Menu,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShareButtons } from "@/components/ui/share-buttons";
import { supabase, getStorageUrl } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import heroBg from "@/assets/hero-bg.jpg";
import GallerySection from "@/components/landing/GallerySection";
import PublicFooter from "@/components/public/PublicFooter";

interface ClubData {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  location_city: string | null;
  location_zip: string | null;
  tagline: string | null;
  description: string | null;
  logo_path: string | null;
  hero_image_path: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website_url: string | null;
  join_cta_text: string | null;
  join_cta_url: string | null;
  imprint_text: string | null;
  privacy_text: string | null;
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

interface Company {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
}

interface GalleryImage {
  id: string;
  title: string | null;
  description: string | null;
  image_path: string;
}

const communityValues = [
  {
    icon: Handshake,
    title: "Kameradschaft",
    description: "Zusammenhalt und gegenseitige Unterstützung stehen im Mittelpunkt unserer Gemeinschaft."
  },
  {
    icon: Crown,
    title: "Tradition",
    description: "Wir pflegen jahrhundertealte Bräuche und geben sie an kommende Generationen weiter."
  },
  {
    icon: Heart,
    title: "Engagement",
    description: "Ehrenamtliches Engagement und aktive Teilnahme prägen das Vereinsleben."
  },
  {
    icon: Award,
    title: "Ehrungen",
    description: "Wir würdigen langjährige Mitgliedschaft und besondere Verdienste."
  }
];

const PublicClubProfile = () => {
  const { slug } = useParams<{ slug: string }>();
  const [club, setClub] = useState<ClubData | null>(null);
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [posts, setPosts] = useState<PublicPost[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
  const [memberCount, setMemberCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [heroUrl, setHeroUrl] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [headerSolid, setHeaderSolid] = useState(false);

  useEffect(() => {
    if (slug) {
      fetchClubData();
    }
  }, [slug]);

  // Header background on scroll
  useEffect(() => {
    const handleScroll = () => {
      setHeaderSolid(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const fetchClubData = async () => {
    if (!slug) return;
    
    try {
      const { data: clubData, error: clubError } = await supabase
        .from("clubs")
        .select("*")
        .eq("slug", slug)
        .single();

      if (clubError) throw clubError;
      const club = clubData as ClubData;
      setClub(club);

      if (club.logo_path) {
        setLogoUrl(getStorageUrl("club-assets", club.logo_path) || "");
      }
      if (club.hero_image_path) {
        setHeroUrl(getStorageUrl("club-assets", club.hero_image_path) || "");
      }

      const { data: eventsData } = await supabase
        .from("events")
        .select("id, title, start_at, end_at, location, category, description")
        .eq("club_id", club.id)
        .eq("audience", "public")
        .eq("publication_status", "approved")
        .gte("start_at", new Date().toISOString())
        .order("start_at", { ascending: true })
        .limit(5);

      setEvents((eventsData as PublicEvent[]) || []);

      const { data: postsData } = await supabase
        .from("posts")
        .select("id, title, content, created_at, category, cover_image_path")
        .eq("club_id", club.id)
        .eq("audience", "public")
        .eq("publication_status", "approved")
        .order("created_at", { ascending: false })
        .limit(3);

      setPosts((postsData as PublicPost[]) || []);

      const { data: companiesData } = await supabase
        .from("companies")
        .select("id, name, description, logo_url")
        .eq("club_id", club.id)
        .order("name");

      setCompanies((companiesData as Company[]) || []);

      const { data: galleryData } = await supabase
        .from("gallery_images")
        .select("id, title, description, image_path")
        .eq("club_id", club.id)
        .eq("is_visible", true)
        .order("sort_order", { ascending: true })
        .limit(6);

      setGalleryImages((galleryData as GalleryImage[]) || []);

      // Get member count
      const { count } = await supabase
        .from("members")
        .select("*", { count: "exact" })
        .eq("club_id", club.id)
        .in("status", ["active", "passive"]);

      setMemberCount((count as number) || 0);

    } catch (error) {
      console.error("Error fetching club data:", error);
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

  if (!club) {
    return (
      <div className="min-h-screen bg-forest-dark flex flex-col items-center justify-center">
        <Shield className="w-16 h-16 text-gold mb-4" />
        <h1 className="text-2xl font-bold text-cream mb-2">Verein nicht gefunden</h1>
        <p className="text-cream/60 mb-4">Der gesuchte Verein existiert nicht.</p>
        <Button variant="hero" asChild>
          <Link to="/">Zur Startseite</Link>
        </Button>
      </div>
    );
  }

  const locationString = [club.location_zip, club.location_city || club.city].filter(Boolean).join(" ");
  const backgroundImage = heroUrl || heroBg;
  const metaDescription = club.description 
    ? club.description.substring(0, 155) + "..." 
    : `${club.name}${locationString ? ` in ${locationString}` : ""} – Tradition, Kameradschaft und Gemeinschaft.`;

  const navLinks = [
    { to: `/verein/${slug}`, label: "Start", section: "hero" },
    { to: `/verein/${slug}/termine`, label: "Termine" },
    { to: `/verein/${slug}/aktuelles`, label: "Aktuelles" },
    { to: `/verein/${slug}/galerie`, label: "Galerie" },
    { to: `/verein/${slug}/mitmachen`, label: "Mitmachen" },
  ];

  return (
    <div className="min-h-screen bg-forest-dark">
      {/* SEO Meta Tags */}
      <Helmet>
        <title>{club.name}{locationString ? ` – ${locationString}` : ""}</title>
        <meta name="description" content={metaDescription} />
        <meta property="og:title" content={club.name} />
        <meta property="og:description" content={metaDescription} />
        <meta property="og:type" content="website" />
        {heroUrl && <meta property="og:image" content={heroUrl} />}
        {logoUrl && !heroUrl && <meta property="og:image" content={logoUrl} />}
        <meta property="og:url" content={`${window.location.origin}/verein/${slug}`} />
        <meta name="twitter:card" content="summary_large_image" />
        <link rel="canonical" href={`${window.location.origin}/verein/${slug}`} />
      </Helmet>

      {/* Header */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        headerSolid ? "bg-forest-dark/95 backdrop-blur-md border-b border-gold/10" : "bg-transparent"
      }`}>
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <Link to={`/verein/${slug}`} className="flex items-center gap-3 text-cream hover:text-gold transition-colors">
            <div className="flex items-center gap-2">
              {logoUrl ? (
                <img src={logoUrl} alt={club.name} className="w-9 h-9 rounded-full object-cover border border-gold/30" />
              ) : (
                <Shield className="w-8 h-8 text-gold" />
              )}
              <span className="font-display font-semibold hidden sm:inline">{club.name}</span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-6">
            {navLinks.slice(1).map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="text-cream/70 hover:text-gold text-sm font-medium transition-colors"
              >
                {link.label}
              </Link>
            ))}
            <Button variant="hero" size="sm" asChild>
              <Link to={`/verein/${slug}/mitmachen`}>
                <Users className="w-4 h-4 mr-2" />
                Mitmachen
              </Link>
            </Button>
          </nav>

          {/* Mobile Menu Toggle */}
          <Button 
            variant="ghost" 
            size="icon" 
            className="md:hidden text-cream"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </Button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-forest-dark/95 backdrop-blur-md border-b border-gold/10"
          >
            <nav className="container mx-auto px-6 py-4 flex flex-col gap-2">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-cream/70 hover:text-gold py-2 text-sm font-medium transition-colors"
                >
                  {link.label}
                </Link>
              ))}
              <Button variant="hero" size="sm" className="mt-2" asChild>
                <Link to="/auth" onClick={() => setMobileMenuOpen(false)}>
                  <Shield className="w-4 h-4 mr-2" />
                  Mitgliederportal
                </Link>
              </Button>
            </nav>
          </motion.div>
        )}
      </header>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${backgroundImage})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-forest-dark/95 via-forest-dark/75 to-forest-dark" />
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-gold/5 to-transparent" />
        </div>

        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-32 h-32 border-l-2 border-t-2 border-gold/20" />
          <div className="absolute top-20 right-10 w-32 h-32 border-r-2 border-t-2 border-gold/20" />
          <div className="absolute bottom-20 left-10 w-32 h-32 border-l-2 border-b-2 border-gold/20" />
          <div className="absolute bottom-20 right-10 w-32 h-32 border-r-2 border-b-2 border-gold/20" />
          
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.15 }}
            transition={{ duration: 3, ease: "easeOut" }}
            className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-gold blur-[150px]"
          />
        </div>

        <div className="relative z-10 container mx-auto px-6 py-20">
          <div className="max-w-5xl mx-auto text-center">
            {/* Logo */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8 }}
              className="mb-8"
            >
              <div className="inline-flex flex-col items-center">
                <div className="w-28 h-28 rounded-full bg-gradient-to-br from-gold to-gold-dark flex items-center justify-center mb-4 shadow-xl shadow-gold/20 overflow-hidden">
                  {logoUrl ? (
                    <img src={logoUrl} alt={club.name} className="w-full h-full object-contain" />
                  ) : (
                    <Shield className="w-14 h-14 text-forest-dark" />
                  )}
                </div>
                <div className="h-8 w-px bg-gradient-to-b from-gold to-transparent" />
              </div>
            </motion.div>

            {/* Location */}
            {locationString && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="mb-6"
              >
                <span className="inline-flex items-center gap-2 px-6 py-2 text-gold text-sm font-medium tracking-[0.2em] uppercase">
                  <MapPin className="w-4 h-4" />
                  {locationString}
                </span>
              </motion.div>
            )}

            {/* Club Name */}
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="font-display text-4xl md:text-6xl lg:text-7xl font-bold text-cream mb-6 leading-[1.1]"
            >
              {club.name}
            </motion.h1>

            {/* Tagline */}
            {club.tagline && (
              <motion.p
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.4 }}
                className="text-xl md:text-2xl text-cream/70 mb-12 max-w-3xl mx-auto font-body leading-relaxed"
              >
                {club.tagline}
              </motion.p>
            )}

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.5 }}
              className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16"
            >
              <Button variant="hero" size="xl" className="group min-w-[200px]" asChild>
                <Link to={`/verein/${slug}/mitmachen`}>
                  <Users className="w-5 h-5 mr-2" />
                  Mitmachen
                  <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button variant="heroOutline" size="xl" className="min-w-[200px]" asChild>
                <Link to={`/verein/${slug}/termine`}>
                  <Calendar className="w-4 h-4 mr-2" />
                  Termine
                </Link>
              </Button>
            </motion.div>

            {/* Quick Stats */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.7 }}
              className="grid grid-cols-2 md:grid-cols-4 max-w-3xl mx-auto"
            >
              {[
                { icon: Users, value: memberCount > 0 ? memberCount.toString() : "-", label: "Mitglieder" },
                { icon: Building2, value: companies.length.toString(), label: "Kompanien" },
                { icon: Calendar, value: events.length.toString(), label: "Termine" },
                { icon: Newspaper, value: posts.length.toString(), label: "Beiträge" },
              ].map((stat, index) => (
                <div key={index} className="relative px-4 py-4">
                  {index > 0 && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-px h-12 bg-gradient-to-b from-transparent via-gold/30 to-transparent hidden md:block" />
                  )}
                  <div className="flex flex-col items-center">
                    <stat.icon className="w-5 h-5 text-gold mb-2" />
                    <span className="text-2xl md:text-3xl font-display font-bold text-cream">
                      {stat.value}
                    </span>
                    <span className="text-cream/50 text-sm">{stat.label}</span>
                  </div>
                </div>
              ))}
            </motion.div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 0.5 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        >
          <span className="text-cream/40 text-xs uppercase tracking-widest">Entdecken</span>
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            <ChevronDown className="w-5 h-5 text-gold/60" />
          </motion.div>
        </motion.div>
      </section>

      {/* About Section */}
      {club.description && (
        <section id="about" className="py-24 md:py-32 bg-gradient-to-b from-forest-dark via-forest to-forest-dark relative overflow-hidden">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full bg-gold/5 blur-[100px]" />
          </div>

          <div className="container mx-auto px-6 relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-16"
            >
              <motion.div
                initial={{ scale: 0 }}
                whileInView={{ scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gold/20 mb-6"
              >
                <Users className="w-8 h-8 text-gold" />
              </motion.div>

              <h2 className="font-display text-3xl md:text-5xl font-bold text-cream mb-6">
                Über uns
              </h2>
              
              <div className="w-24 h-1 bg-gradient-to-r from-gold to-gold-dark mx-auto mb-8" />
              
              <p className="text-cream/80 text-lg max-w-3xl mx-auto whitespace-pre-wrap leading-relaxed">
                {club.description}
              </p>
            </motion.div>

            {/* Values */}
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
              {communityValues.map((value, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="group"
                >
                  <div className="h-full p-6 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 hover:border-gold/30 hover:bg-white/10 transition-all duration-300 text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gold/20 mb-4 group-hover:bg-gold/30 transition-colors">
                      <value.icon className="w-6 h-6 text-gold" />
                    </div>
                    <h3 className="font-display text-lg font-semibold text-cream mb-2">
                      {value.title}
                    </h3>
                    <p className="text-cream/60 text-sm leading-relaxed">
                      {value.description}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Companies Section */}
      {companies.length > 0 && (
        <section className="py-24 md:py-32 bg-cream-dark relative overflow-hidden">
          <div className="container mx-auto px-6 relative">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-16"
            >
              <motion.div
                initial={{ scale: 0 }}
                whileInView={{ scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-forest/10 mb-6"
              >
                <Building2 className="w-8 h-8 text-forest" />
              </motion.div>
              
              <h2 className="font-display text-3xl md:text-5xl font-bold text-foreground mb-6">
                Unsere Kompanien
              </h2>
              
              <div className="w-24 h-1 bg-gradient-to-r from-gold to-gold-dark mx-auto mb-6" />
              
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                Unser Verein gliedert sich in {companies.length} Kompanie{companies.length > 1 ? "n" : ""}.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {companies.map((company, index) => {
                const companyLogoUrl = company.logo_url 
                  ? (company.logo_url.startsWith('http') 
                      ? company.logo_url 
                      : (getStorageUrl("company-assets", company.logo_url) || ""))
                  : null;
                
                return (
                  <motion.div
                    key={company.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                  >
                    <Link 
                      to={`/verein/${slug}/kompanie/${company.id}`}
                      className="block bg-card p-6 rounded-2xl border-2 border-border hover:border-gold/30 hover:shadow-lg transition-all duration-300 group h-full"
                    >
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors overflow-hidden flex-shrink-0">
                          {companyLogoUrl ? (
                            <img src={companyLogoUrl} alt={company.name} className="w-full h-full object-cover" />
                          ) : (
                            <Building2 className="w-7 h-7 text-primary" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-display text-xl font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                            {company.name}
                          </h4>
                          <span className="text-xs text-muted-foreground flex items-center gap-1 group-hover:text-primary/70 transition-colors">
                            Profil ansehen
                            <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                          </span>
                        </div>
                      </div>
                      {company.description && (
                        <p className="text-muted-foreground text-sm leading-relaxed line-clamp-3">
                          {company.description}
                        </p>
                      )}
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Events Section */}
      {events.length > 0 && (
        <section id="events" className="py-24 md:py-32 bg-gradient-to-b from-forest-dark to-forest relative overflow-hidden">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-20 right-20 w-80 h-80 rounded-full bg-gold/5 blur-[100px]" />
          </div>

          <div className="container mx-auto px-6 relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-16"
            >
              <motion.div
                initial={{ scale: 0 }}
                whileInView={{ scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gold/20 mb-6"
              >
                <Calendar className="w-8 h-8 text-gold" />
              </motion.div>

              <h2 className="font-display text-3xl md:text-5xl font-bold text-cream mb-6">
                Nächste Termine
              </h2>
              
              <div className="w-24 h-1 bg-gradient-to-r from-gold to-gold-dark mx-auto" />
            </motion.div>

            <div className="max-w-4xl mx-auto space-y-4">
              {events.map((event, index) => {
                const startDate = new Date(event.start_at);
                const endDate = event.end_at ? new Date(event.end_at) : null;
                const shareUrl = `/verein/${slug}/termin/${event.id}`;
                const shareDescription = event.description 
                  ? event.description.substring(0, 100) 
                  : `${format(startDate, "d. MMMM yyyy", { locale: de })} ${event.location ? `in ${event.location}` : ""}`;

                return (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:border-gold/30 hover:bg-white/10 transition-all duration-300"
                  >
                    <Link to={shareUrl} className="flex gap-6 group">
                      <div className="flex-shrink-0 w-20 h-20 bg-gold/20 rounded-xl flex flex-col items-center justify-center group-hover:bg-gold/30 transition-colors">
                        <span className="text-sm text-gold font-medium uppercase">
                          {format(startDate, "MMM", { locale: de })}
                        </span>
                        <span className="text-3xl font-bold text-cream">
                          {format(startDate, "d")}
                        </span>
                      </div>

                      <div className="flex-grow min-w-0">
                        <h3 className="font-display text-xl font-semibold text-cream mb-2 group-hover:text-gold transition-colors">
                          {event.title}
                        </h3>
                        <div className="flex flex-wrap items-center gap-3 text-cream/60 mb-2">
                          <span className="text-sm font-medium">
                            {format(startDate, "HH:mm", { locale: de })} Uhr
                            {endDate && ` – ${format(endDate, "HH:mm", { locale: de })} Uhr`}
                          </span>
                          {event.location && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1 text-sm">
                                <MapPin className="w-4 h-4" />
                                {event.location}
                              </span>
                            </>
                          )}
                        </div>
                        {event.description && (
                          <p className="text-cream/50 text-sm line-clamp-2">{event.description}</p>
                        )}
                        <Badge className="mt-3 bg-gold/20 text-gold border-gold/30 hover:bg-gold/30">
                          {getCategoryLabel(event.category)}
                        </Badge>
                      </div>
                    </Link>
                    
                    <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
                      <span className="text-cream/50 text-sm">Termin teilen:</span>
                      <ShareButtons 
                        url={shareUrl} 
                        title={event.title} 
                        description={shareDescription}
                        variant="compact"
                        className="text-cream/80 hover:text-gold"
                      />
                    </div>
                  </motion.div>
                );
              })}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="text-center mt-12"
            >
              <Button variant="heroOutline" size="lg" asChild>
                <Link to={`/verein/${slug}/termine`}>
                  Alle Termine anzeigen
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </motion.div>
          </div>
        </section>
      )}

      {/* News Section */}
      {posts.length > 0 && (
        <section id="news" className="py-24 md:py-32 bg-cream-dark relative overflow-hidden">
          <div className="container mx-auto px-6 relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
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

              <h2 className="font-display text-3xl md:text-5xl font-bold text-foreground mb-6">
                Aktuelles
              </h2>
              
              <div className="w-24 h-1 bg-gradient-to-r from-gold to-gold-dark mx-auto" />
            </motion.div>

            <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {posts.map((post, index) => {
                const shareUrl = `/verein/${slug}/beitrag/${post.id}`;
                const shareDescription = post.content
                  ? post.content?.replace(/<[^>]*>/g, "").substring(0, 100) ?? ""
                  : "";

                return (
                  <motion.div
                    key={post.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    className="bg-card rounded-2xl overflow-hidden border-2 border-border hover:border-gold/30 hover:shadow-lg transition-all duration-300 group"
                  >
                    <Link to={shareUrl} className="block">
                      {post.cover_image_path && (
                        <div className="h-48 bg-muted overflow-hidden">
                          <img
                            src={`${getStorageUrl("post-images", post.cover_image_path) || ""}`}
                            alt={post.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        </div>
                      )}
                      <div className="p-6 pb-0">
                        <Badge variant="outline" className="text-xs mb-3 border-gold/30 text-gold-dark">
                          {getCategoryLabel(post.category)}
                        </Badge>
                        <h3 className="font-display text-lg font-semibold text-foreground mb-2 line-clamp-2 group-hover:text-gold-dark transition-colors">
                          {post.title}
                        </h3>
                        <p className="text-muted-foreground text-sm line-clamp-3 mb-4">
                          {post.content?.replace(/<[^>]*>/g, "").substring(0, 120) ?? ""}...
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(post.created_at), "dd. MMMM yyyy", { locale: de })}
                        </p>
                      </div>
                    </Link>
                    
                    <div className="px-6 py-4 border-t border-border flex items-center justify-between">
                      <span className="text-muted-foreground text-sm">Teilen:</span>
                      <ShareButtons 
                        url={shareUrl} 
                        title={post.title} 
                        description={shareDescription}
                        variant="compact"
                      />
                    </div>
                  </motion.div>
                );
              })}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="text-center mt-12"
            >
              <Button variant="outline" size="lg" asChild>
                <Link to={`/verein/${slug}/aktuelles`}>
                  Alle Beiträge anzeigen
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </motion.div>
          </div>
        </section>
      )}

      {/* Gallery Section */}
      {galleryImages.length > 0 && (
        <section className="py-24 md:py-32 bg-forest-dark relative overflow-hidden">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 0.05 }}
              viewport={{ once: true }}
              className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full bg-gold blur-[150px]"
            />
          </div>

          <div className="container mx-auto px-6 relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-16"
            >
              <motion.div
                initial={{ scale: 0 }}
                whileInView={{ scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gold/20 mb-6"
              >
                <Images className="w-8 h-8 text-gold" />
              </motion.div>

              <h2 className="font-display text-3xl md:text-5xl font-bold text-cream mb-6">
                Galerie
              </h2>
              
              <div className="w-24 h-1 bg-gradient-to-r from-gold to-gold-dark mx-auto" />
            </motion.div>

            <GallerySection 
              images={galleryImages} 
              
              gridOnly
            />

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="text-center mt-12"
            >
              <Button variant="heroOutline" size="lg" asChild>
                <Link to={`/verein/${slug}/galerie`}>
                  Alle Bilder ansehen
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </motion.div>
          </div>
        </section>
      )}

      {/* Join CTA Section */}
      <section className="py-24 md:py-32 bg-gradient-to-b from-forest to-forest-dark relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.1 }}
            transition={{ duration: 3 }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-gold blur-[200px]"
          />
        </div>

        <div className="absolute top-12 left-12 w-24 h-24 border-l border-t border-gold/20" />
        <div className="absolute top-12 right-12 w-24 h-24 border-r border-t border-gold/20" />
        <div className="absolute bottom-12 left-12 w-24 h-24 border-l border-b border-gold/20" />
        <div className="absolute bottom-12 right-12 w-24 h-24 border-r border-b border-gold/20" />

        <div className="container mx-auto px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="max-w-3xl mx-auto text-center"
          >
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-gold to-gold-dark mb-8 shadow-xl shadow-gold/20 overflow-hidden">
              {logoUrl ? (
                <img src={logoUrl} alt={club.name} className="w-full h-full object-contain" />
              ) : (
                <Shield className="w-10 h-10 text-forest-dark" />
              )}
            </div>

            <h2 className="font-display text-3xl md:text-5xl font-bold text-cream mb-6">
              Werde Teil unserer Gemeinschaft
            </h2>

            <p className="text-cream/70 text-lg mb-10 max-w-2xl mx-auto">
              Haben Sie Fragen zu unserem Verein oder möchten Sie Teil unserer Gemeinschaft werden?
              Wir freuen uns auf Sie!
            </p>

            <div className="flex flex-wrap justify-center gap-4 mb-12">
              {club.contact_email && (
                <a
                  href={`mailto:${club.contact_email}`}
                  className="flex items-center gap-3 px-6 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-cream hover:border-gold/30 hover:bg-white/10 transition-all"
                >
                  <Mail className="w-5 h-5 text-gold" />
                  <span>{club.contact_email}</span>
                </a>
              )}
              {club.contact_phone && (
                <a
                  href={`tel:${club.contact_phone}`}
                  className="flex items-center gap-3 px-6 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-cream hover:border-gold/30 hover:bg-white/10 transition-all"
                >
                  <Phone className="w-5 h-5 text-gold" />
                  <span>{club.contact_phone}</span>
                </a>
              )}
              {club.website_url && (
                <a
                  href={club.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-6 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-cream hover:border-gold/30 hover:bg-white/10 transition-all"
                >
                  <Globe className="w-5 h-5 text-gold" />
                  <span>Website besuchen</span>
                </a>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button variant="hero" size="xl" className="group" asChild>
                <Link to={`/verein/${slug}/mitmachen`}>
                  <Users className="w-5 h-5 mr-2" />
                  Mitmachen
                  <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button variant="heroOutline" size="xl" asChild>
                <Link to="/auth">
                  <Shield className="w-4 h-4 mr-2" />
                  Zum Mitgliederportal
                </Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <PublicFooter
        clubName={club.name}
        clubSlug={club.slug}
        logoUrl={logoUrl}
        contactEmail={club.contact_email}
        contactPhone={club.contact_phone}
        websiteUrl={club.website_url}
        locationCity={club.location_city || club.city}
        imprintText={club.imprint_text}
        privacyText={club.privacy_text}
      />
    </div>
  );
};

export default PublicClubProfile;