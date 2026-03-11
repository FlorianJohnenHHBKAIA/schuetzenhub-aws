import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import { 
  Users, 
  Shield, 
  Heart, 
  Calendar, 
  Trophy,
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  CheckCircle2,
  Sparkles,
  HandHeart,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase, getStorageUrl } from "@/integrations/supabase/client";

interface ClubData {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  location_city: string | null;
  tagline: string | null;
  description: string | null;
  logo_path: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  join_cta_text: string | null;
  join_cta_url: string | null;
}

const benefits = [
  {
    icon: Users,
    title: "Gemeinschaft erleben",
    description: "Werde Teil einer aktiven Gemeinschaft mit regelmäßigen Treffen und Veranstaltungen."
  },
  {
    icon: Trophy,
    title: "Sport & Wettbewerb",
    description: "Nimm an Schießwettbewerben teil und verbessere deine Fähigkeiten."
  },
  {
    icon: Heart,
    title: "Tradition pflegen",
    description: "Bewahre jahrhundertealtes Brauchtum und gib es an die nächste Generation weiter."
  },
  {
    icon: Calendar,
    title: "Feste feiern",
    description: "Erlebe unvergessliche Schützenfeste und gesellige Zusammenkünfte."
  }
];

const expectations = [
  "Aktive Teilnahme am Vereinsleben",
  "Respekt gegenüber Tradition und Kameraden",
  "Bereitschaft zur ehrenamtlichen Mitarbeit",
  "Einhaltung der Vereinssatzung"
];

const whatYouGet = [
  "Zugang zu allen Vereinsveranstaltungen",
  "Nutzung der Vereinsanlagen",
  "Mitgestaltung des Vereinslebens",
  "Kameradschaft und Freundschaft",
  "Förderung von Nachwuchsmitgliedern"
];

const PublicJoinUs = () => {
  const { slug } = useParams<{ slug: string }>();
  const [club, setClub] = useState<ClubData | null>(null);
  const [memberCount, setMemberCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (slug) fetchClubData();
  }, [slug]);

  const fetchClubData = async () => {
    if (!slug) return;
    
    try {
      const { data: clubData, error } = await supabase
        .from("clubs")
        .select("*")
        .eq("slug", slug)
        .single();

      if (error) throw error;
      setClub(clubData);

      if (clubData.logo_path) {
        const urlData = { publicUrl: getStorageUrl("club-assets", clubData.logo_path) || "" };
        setLogoUrl(urlData.publicUrl);
      }

      // Get member count
      const { count } = await supabase
        .from("members")
        .select("*", { count: "exact", head: true })
        .eq("club_id", clubData.id)
        .in("status", ["active", "passive"]);

      setMemberCount(count || 0);
    } catch (error) {
      console.error("Error fetching club data:", error);
    } finally {
      setIsLoading(false);
    }
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
        <Button variant="hero" asChild>
          <Link to="/">Zur Startseite</Link>
        </Button>
      </div>
    );
  }

  const locationString = club.location_city || club.city;

  return (
    <div className="min-h-screen bg-forest-dark">
      <Helmet>
        <title>Mitmachen bei {club.name} – Werde Teil unserer Gemeinschaft</title>
        <meta name="description" content={`Werde Mitglied bei ${club.name}${locationString ? ` in ${locationString}` : ''}. Erlebe Tradition, Kameradschaft und unvergessliche Momente.`} />
        <meta property="og:title" content={`Mitmachen bei ${club.name}`} />
        <meta property="og:description" content={`Werde Teil unserer Gemeinschaft. ${club.tagline || ''}`} />
        <meta property="og:type" content="website" />
      </Helmet>

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-forest-dark/90 backdrop-blur-md border-b border-gold/10">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <Link 
            to={`/verein/${club.slug}`}
            className="flex items-center gap-3 text-cream hover:text-gold transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <div className="flex items-center gap-2">
              {logoUrl ? (
                <img src={logoUrl} alt={club.name} className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <Shield className="w-8 h-8 text-gold" />
              )}
              <span className="font-medium hidden sm:inline">{club.name}</span>
            </div>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative pt-32 pb-24 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.15 }}
            transition={{ duration: 2 }}
            className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-gold blur-[150px]"
          />
        </div>

        <div className="container mx-auto px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-3xl mx-auto text-center"
          >
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-gold to-gold-dark mb-6 shadow-xl shadow-gold/20">
              <Sparkles className="w-10 h-10 text-forest-dark" />
            </div>
            
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-cream mb-6">
              Werde Teil unserer <span className="text-gold">Gemeinschaft</span>
            </h1>
            
            <p className="text-xl text-cream/70 mb-8 max-w-2xl mx-auto">
              {club.tagline || `Bei ${club.name} erwartet dich eine lebendige Gemeinschaft mit Tradition, Kameradschaft und unvergesslichen Momenten.`}
            </p>

            {memberCount > 0 && (
              <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-white/5 border border-white/10 mb-8">
                <Users className="w-5 h-5 text-gold" />
                <span className="text-cream">
                  Bereits <span className="font-bold text-gold">{memberCount}</span> Mitglieder
                </span>
              </div>
            )}
          </motion.div>
        </div>
      </section>

      {/* Benefits Grid */}
      <section className="py-20 bg-gradient-to-b from-forest-dark via-forest to-forest-dark">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="font-display text-3xl md:text-4xl font-bold text-cream mb-4">
              Warum Mitglied werden?
            </h2>
            <div className="w-24 h-1 bg-gradient-to-r from-gold to-gold-dark mx-auto" />
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {benefits.map((benefit, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6 text-center hover:border-gold/30 hover:bg-white/10 transition-all"
              >
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gold/20 mb-4">
                  <benefit.icon className="w-7 h-7 text-gold" />
                </div>
                <h3 className="font-display text-lg font-semibold text-cream mb-2">
                  {benefit.title}
                </h3>
                <p className="text-cream/60 text-sm leading-relaxed">
                  {benefit.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* What We Expect & What You Get */}
      <section className="py-20 bg-cream-dark">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 max-w-5xl mx-auto">
            {/* What You Get */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-full bg-forest/10 flex items-center justify-center">
                  <HandHeart className="w-6 h-6 text-forest" />
                </div>
                <h3 className="font-display text-2xl font-bold text-foreground">
                  Das bekommst du
                </h3>
              </div>
              <ul className="space-y-4">
                {whatYouGet.map((item, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-forest flex-shrink-0 mt-0.5" />
                    <span className="text-foreground/80">{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* What We Expect */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-full bg-gold/10 flex items-center justify-center">
                  <Target className="w-6 h-6 text-gold-dark" />
                </div>
                <h3 className="font-display text-2xl font-bold text-foreground">
                  Das erwarten wir
                </h3>
              </div>
              <ul className="space-y-4">
                {expectations.map((item, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-gold-dark flex-shrink-0 mt-0.5" />
                    <span className="text-foreground/80">{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Contact CTA */}
      <section className="py-24 bg-gradient-to-b from-forest to-forest-dark relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 0.1 }}
            viewport={{ once: true }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-gold blur-[150px]"
          />
        </div>

        <div className="container mx-auto px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-2xl mx-auto text-center"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gold/20 mb-6">
              <Mail className="w-8 h-8 text-gold" />
            </div>

            <h2 className="font-display text-3xl md:text-4xl font-bold text-cream mb-4">
              Interesse geweckt?
            </h2>
            
            <p className="text-cream/70 text-lg mb-8">
              Kontaktiere uns unverbindlich – wir freuen uns, dich kennenzulernen!
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              {club.contact_email && (
                <a
                  href={`mailto:${club.contact_email}?subject=Mitgliedschaft bei ${club.name}`}
                  className="flex items-center justify-center gap-3 px-6 py-4 bg-gold hover:bg-gold-light text-forest-dark font-semibold rounded-xl transition-colors"
                >
                  <Mail className="w-5 h-5" />
                  E-Mail schreiben
                </a>
              )}
              {club.contact_phone && (
                <a
                  href={`tel:${club.contact_phone}`}
                  className="flex items-center justify-center gap-3 px-6 py-4 bg-white/10 hover:bg-white/20 text-cream border border-white/20 rounded-xl transition-colors"
                >
                  <Phone className="w-5 h-5" />
                  {club.contact_phone}
                </a>
              )}
            </div>

            {club.join_cta_url && (
              <Button variant="heroOutline" size="xl" className="group" asChild>
                <a href={club.join_cta_url} target="_blank" rel="noopener noreferrer">
                  {club.join_cta_text || "Mitglied werden"}
                </a>
              </Button>
            )}

            {locationString && (
              <div className="mt-8 inline-flex items-center gap-2 text-cream/60">
                <MapPin className="w-4 h-4" />
                <span>{locationString}</span>
              </div>
            )}
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 bg-forest-dark border-t border-gold/10">
        <div className="container mx-auto px-6 text-center">
          <Link 
            to={`/verein/${club.slug}`} 
            className="inline-flex items-center gap-2 text-cream/60 hover:text-gold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Zurück zu {club.name}
          </Link>
        </div>
      </footer>
    </div>
  );
};

export default PublicJoinUs;
