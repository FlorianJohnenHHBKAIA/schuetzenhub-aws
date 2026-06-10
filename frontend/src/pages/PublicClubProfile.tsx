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
  Shield,
  Menu,
  X,
  ChevronRight,
  ExternalLink,
  CheckCircle,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import GallerySection from "@/components/landing/GallerySection";
import PublicFooter from "@/components/public/PublicFooter";
import ClubClaimDialog from "@/components/public/ClubClaimDialog";

// ─── Interfaces ───────────────────────────────────────────────────────────────

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
  claim_status: string | null;
  plan: string | null;
  founded_year: number | null;
  street: string | null;
  house_number: string | null;
  state: string | null;
}

interface PublicEvent {
  id: string;
  title: string;
  start_at: string;
  end_at: string | null;
  location: string | null;
  location_city: string | null;
  event_type: string | null;
  category: string;
  description: string | null;
}

interface GalleryImage {
  id: string;
  title: string | null;
  description: string | null;
  image_path: string;
}

interface RelatedClub {
  id: string;
  name: string;
  slug: string;
  location_city: string | null;
  logo_url: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function formatEventDate(dateStr: string) {
  return format(new Date(dateStr), "dd. MMMM yyyy", { locale: de });
}

function getEventTypeLabel(event: PublicEvent) {
  if (event.event_type) return event.event_type;
  const labels: Record<string, string> = {
    training: "Training", meeting: "Versammlung", fest: "Fest",
    work: "Arbeitsdienst", other: "Sonstiges",
  };
  return labels[event.category] ?? event.category;
}

// ─── Component ────────────────────────────────────────────────────────────────

const PublicClubProfile = () => {
  const { slug } = useParams<{ slug: string }>();

  // Core data
  const [club, setClub] = useState<ClubData | null>(null);
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
  const [relatedClubs, setRelatedClubs] = useState<RelatedClub[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isArchived, setIsArchived] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [heroUrl, setHeroUrl] = useState<string | null>(null);

  // Header / nav
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [headerSolid, setHeaderSolid] = useState(false);

  // Claim dialog
  const [showClaimDialog, setShowClaimDialog] = useState(false);

  // Interest form
  const [interestForm, setInterestForm] = useState({ name: "", email: "", message: "" });
  const [interestSubmitting, setInterestSubmitting] = useState(false);
  const [interestSuccess, setInterestSuccess] = useState(false);
  const [interestError, setInterestError] = useState("");

  // Contact dialog (unclaimed clubs)
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [contactForm, setContactForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [contactSuccess, setContactSuccess] = useState(false);
  const [contactError, setContactError] = useState("");

  // ── Data Fetching ────────────────────────────────────────────────────────

  useEffect(() => {
    if (slug) fetchAll();
  }, [slug]);

  useEffect(() => {
    const handler = () => setHeaderSolid(window.scrollY > 50);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  async function fetchAll() {
    if (!slug) return;
    try {
      // Club
      const clubRes = await fetch(`/api/clubs/by-slug/${slug}`);
      if (clubRes.status === 410) { setIsArchived(true); return; }
      if (!clubRes.ok) throw new Error("Club not found");
      const c = await clubRes.json() as ClubData & { logo_url?: string; hero_image_url?: string };
      setClub(c);
      if (c.logo_url)       setLogoUrl(c.logo_url);
      if (c.hero_image_url) setHeroUrl(c.hero_image_url);

      // Events via REST
      const evRes = await fetch(`/api/events/public/${slug}`);
      if (evRes.ok) {
        const evData: PublicEvent[] = await evRes.json();
        setEvents(evData.slice(0, 6));
      }

      // Gallery
      const galRes = await fetch(`/api/public/gallery/${slug}`);
      if (galRes.ok) {
        const galData: GalleryImage[] = await galRes.json();
        setGalleryImages(galData.slice(0, 8));
      }

      // Related clubs — same city first, fallback to state
      const cityParam = c.location_city || c.city;
      const stateParam = c.state;
      const relatedParam = cityParam
        ? `city=${encodeURIComponent(cityParam)}&limit=7`
        : stateParam
        ? `state=${encodeURIComponent(stateParam)}&limit=7`
        : null;
      if (relatedParam) {
        const relRes = await fetch(`/api/public/clubs?${relatedParam}`);
        if (relRes.ok) {
          const relData = await relRes.json();
          const items: RelatedClub[] = (relData.items ?? [])
            .filter((rc: RelatedClub) => rc.slug !== slug)
            .slice(0, 6);
          setRelatedClubs(items);
        }
      }
    } catch (err) {
      console.error("Error fetching club profile:", err);
    } finally {
      setIsLoading(false);
    }
  }

  // ── Claim handler ────────────────────────────────────────────────────────



  // ── Interest handler ─────────────────────────────────────────────────────

  async function handleInterestSubmit(e: React.FormEvent) {
    e.preventDefault();
    setInterestSubmitting(true);
    setInterestError("");
    try {
      const res = await fetch(`/api/public/clubs/${slug}/interest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...interestForm, request_type: "membership_interest" }),
      });
      if (res.ok) {
        setInterestSuccess(true);
      } else {
        const data = await res.json();
        setInterestError(data.error || "Ein Fehler ist aufgetreten.");
      }
    } catch {
      setInterestError("Verbindungsfehler. Bitte versuchen Sie es erneut.");
    } finally {
      setInterestSubmitting(false);
    }
  }

  async function handleContactSubmit(e: React.FormEvent) {
    e.preventDefault();
    setContactSubmitting(true);
    setContactError("");
    try {
      const res = await fetch(`/api/public/clubs/${slug}/interest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...contactForm, request_type: "club_contact" }),
      });
      if (res.ok) {
        setContactSuccess(true);
      } else {
        const data = await res.json();
        setContactError(data.error || "Ein Fehler ist aufgetreten.");
      }
    } catch {
      setContactError("Verbindungsfehler. Bitte versuchen Sie es erneut.");
    } finally {
      setContactSubmitting(false);
    }
  }

  // ── Loading / not found ───────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="min-h-screen bg-forest-dark flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold" />
      </div>
    );
  }

  if (isArchived) {
    return (
      <div className="min-h-screen bg-forest-dark flex flex-col items-center justify-center gap-4 px-4">
        <Shield className="w-16 h-16 text-gold" />
        <h1 className="text-2xl font-bold text-cream">Verein nicht verfügbar</h1>
        <p className="text-cream/60 text-center max-w-sm">
          Dieser Verein ist derzeit nicht öffentlich verfügbar.
        </p>
        <Button variant="hero" asChild><Link to="/">Zur Startseite</Link></Button>
      </div>
    );
  }

  if (!club) {
    return (
      <div className="min-h-screen bg-forest-dark flex flex-col items-center justify-center gap-4">
        <Shield className="w-16 h-16 text-gold" />
        <h1 className="text-2xl font-bold text-cream">Verein nicht gefunden</h1>
        <p className="text-cream/60">Der gesuchte Verein existiert nicht.</p>
        <Button variant="hero" asChild><Link to="/">Zur Startseite</Link></Button>
      </div>
    );
  }

  // ── Computed values ───────────────────────────────────────────────────────

  const cityDisplay = club.location_city || club.city;
  const locationString = [club.location_zip, cityDisplay].filter(Boolean).join(" ");
  const metaTitle = `${club.name} | SchützenHub`;
  const metaDescription = `Informationen, Veranstaltungen und Kontaktdaten der ${club.name}.`;
  const pageUrl = `${window.location.origin}/verein/${slug}`;
  const isVerified = club.plan && club.plan !== "free";
  const isUnclaimed = club.claim_status === "unclaimed";
  const hasAddress = !!(club.street || cityDisplay);
  const hasContact = !!(club.contact_email || club.contact_phone || club.website_url);

  const navLinks = [
    { to: `/verein/${slug}/termine`, label: "Termine" },
    { to: `/verein/${slug}/aktuelles`, label: "Aktuelles" },
    { to: `/verein/${slug}/galerie`, label: "Galerie" },
    { to: `/verein/${slug}/mitmachen`, label: "Mitmachen" },
  ];

  // Schema.org JSON-LD
  const schemaOrg: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "SportsClub",
    name: club.name,
    url: pageUrl,
  };
  if (club.founded_year) schemaOrg.foundingDate = String(club.founded_year);
  if (club.contact_email) schemaOrg.email = club.contact_email;
  if (club.contact_phone) schemaOrg.telephone = club.contact_phone;
  if (club.website_url) schemaOrg.sameAs = club.website_url;
  if (logoUrl) schemaOrg.logo = logoUrl;
  if (heroUrl) schemaOrg.image = heroUrl;
  const addressParts = {
    streetAddress: [club.street, club.house_number].filter(Boolean).join(" ") || undefined,
    addressLocality: cityDisplay || undefined,
    postalCode: club.location_zip || undefined,
    addressCountry: "DE",
  };
  if (addressParts.streetAddress || addressParts.addressLocality) {
    schemaOrg.address = { "@type": "PostalAddress", ...addressParts };
  }

  return (
    <div className="min-h-screen bg-forest-dark">
      {/* ── SEO ─────────────────────────────────────────────────────────── */}
      <Helmet>
        <title>{metaTitle}</title>
        <meta name="description" content={metaDescription} />
        <meta property="og:title" content={club.name} />
        <meta property="og:description" content={metaDescription} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={pageUrl} />
        {(heroUrl || logoUrl) && <meta property="og:image" content={(heroUrl || logoUrl)!} />}
        <meta name="twitter:card" content="summary_large_image" />
        <link rel="canonical" href={pageUrl} />
        <script type="application/ld+json">{JSON.stringify(schemaOrg)}</script>
      </Helmet>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        headerSolid ? "bg-forest-dark/95 backdrop-blur-md border-b border-gold/10" : "bg-transparent"
      }`}>
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <Link to={`/verein/${slug}`} className="flex items-center gap-2 text-cream hover:text-gold transition-colors">
            {logoUrl
              ? <img src={logoUrl} alt={club.name} className="w-9 h-9 rounded-full object-cover border border-gold/30" />
              : <Shield className="w-8 h-8 text-gold" />
            }
            <span className="font-semibold hidden sm:inline">{club.name}</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link key={link.to} to={link.to} className="text-cream/70 hover:text-gold text-sm font-medium transition-colors">
                {link.label}
              </Link>
            ))}
            <Button variant="hero" size="sm" asChild>
              <Link to={`/verein/${slug}/mitmachen`}>
                <Users className="w-4 h-4 mr-2" /> Mitmachen
              </Link>
            </Button>
          </nav>

          <Button variant="ghost" size="icon" className="md:hidden text-cream" onClick={() => setMobileMenuOpen((v) => !v)}>
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </Button>
        </div>

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
                  <Shield className="w-4 h-4 mr-2" /> Mitgliederportal
                </Link>
              </Button>
            </nav>
          </motion.div>
        )}
      </header>

      <main className="pt-16">
        {/* ── Breadcrumbs ─────────────────────────────────────────────── */}
        <div className="container mx-auto px-6 py-3">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/" className="text-cream/50 hover:text-gold text-xs transition-colors">Startseite</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="text-cream/30">
                <ChevronRight className="w-3 h-3" />
              </BreadcrumbSeparator>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/vereine" className="text-cream/50 hover:text-gold text-xs transition-colors">Vereinsregister</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="text-cream/30">
                <ChevronRight className="w-3 h-3" />
              </BreadcrumbSeparator>
              <BreadcrumbItem>
                <BreadcrumbPage className="text-cream/80 text-xs">{club.name}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        {/* ── 1. HERO ─────────────────────────────────────────────────── */}
        <section className="relative h-[420px] sm:h-[520px] overflow-hidden bg-forest-dark">
          {heroUrl && (
            <img
              src={heroUrl}
              alt={club.name}
              className="absolute inset-0 w-full h-full object-cover opacity-35"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-forest-dark via-forest-dark/60 to-transparent" />

          <div className="relative z-10 flex flex-col items-center justify-end h-full pb-12 px-4 text-center">
            {logoUrl && (
              <img
                src={logoUrl}
                alt={club.name}
                className="w-20 h-20 rounded-full border-2 border-gold/60 object-cover mb-4 shadow-xl"
              />
            )}

            <div className="flex flex-wrap items-center justify-center gap-2 mb-3">
              {isVerified && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-gold/20 text-gold text-xs rounded-full border border-gold/30">
                  <Shield className="w-3 h-3" /> Verifizierter Verein
                </span>
              )}
              {isUnclaimed && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-500/20 text-amber-300 text-xs rounded-full border border-amber-500/30">
                  Noch nicht übernommen
                </span>
              )}
            </div>

            <h1 className="text-3xl sm:text-4xl font-bold text-cream mb-2 leading-tight max-w-2xl">
              {club.name}
            </h1>

            {(cityDisplay || club.founded_year) && (
              <p className="text-cream/60 text-sm mb-6">
                {[
                  cityDisplay && <span key="city" className="flex items-center gap-1 inline-flex"><MapPin className="w-3.5 h-3.5" /> {cityDisplay}</span>,
                  club.founded_year && `Gegründet ${club.founded_year}`,
                ].filter(Boolean).reduce<React.ReactNode[]>((acc, el, i) => {
                  if (i > 0) acc.push(<span key={`sep-${i}`} className="mx-2">·</span>);
                  acc.push(el as React.ReactNode);
                  return acc;
                }, [])}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button
                variant="hero"
                onClick={() => scrollToId("events")}
              >
                <Calendar className="w-4 h-4 mr-2" /> Veranstaltungen
              </Button>
              <Button
                variant="outline"
                className="border-cream/30 text-cream hover:bg-cream/10"
                onClick={() => scrollToId("contact")}
              >
                <Mail className="w-4 h-4 mr-2" /> Verein kontaktieren
              </Button>
            </div>
          </div>
        </section>

        {/* ── 2. UPCOMING EVENTS ──────────────────────────────────────── */}
        <section id="events" className="py-14 px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl font-bold text-cream mb-2">Kommende Veranstaltungen</h2>
            <p className="text-cream/50 text-sm mb-8">Aktuelle Termine von {club.name}</p>

            {events.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-4 text-cream/40 border border-cream/10 rounded-2xl">
                <Calendar className="w-10 h-10 opacity-30" />
                <p className="text-sm">Keine kommenden Veranstaltungen geplant.</p>
                <Button variant="outline" className="border-cream/20 text-cream/70 hover:bg-cream/10 mt-2" asChild>
                  <Link to={`/veranstaltungen?club=${club.id}`}>Alle Veranstaltungen ansehen</Link>
                </Button>
              </div>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {events.map((event) => {
                    const eventDate = new Date(event.start_at);
                    const day = format(eventDate, "dd", { locale: de });
                    const month = format(eventDate, "MMM", { locale: de });
                    const locationLabel = event.location_city || event.location || null;

                    return (
                      <div
                        key={event.id}
                        className="bg-forest-dark/50 border border-cream/10 rounded-xl p-5 hover:border-gold/30 transition-colors group"
                      >
                        <div className="flex items-start gap-4">
                          <div className="shrink-0 flex flex-col items-center bg-gold/10 border border-gold/20 rounded-lg px-3 py-2 min-w-[56px]">
                            <span className="text-gold text-xs font-medium uppercase">{month}</span>
                            <span className="text-cream text-2xl font-bold leading-none">{day}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="inline-block text-xs px-2 py-0.5 bg-gold/10 text-gold/80 rounded-full mb-2">
                              {getEventTypeLabel(event)}
                            </span>
                            <h3 className="text-sm font-semibold text-cream leading-snug group-hover:text-gold transition-colors line-clamp-2">
                              {event.title}
                            </h3>
                            {locationLabel && (
                              <p className="text-xs text-cream/40 mt-1.5 flex items-center gap-1">
                                <MapPin className="w-3 h-3 shrink-0" />
                                {locationLabel}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="mt-4 pt-3 border-t border-cream/10">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs text-cream/60 hover:text-gold w-full justify-center"
                            asChild
                          >
                            <Link to={`/verein/${slug}/termin/${event.id}`}>
                              Veranstaltungsdetails <ChevronRight className="w-3.5 h-3.5 ml-1" />
                            </Link>
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-6 text-center">
                  <Button variant="outline" className="border-cream/20 text-cream/70 hover:bg-cream/10" asChild>
                    <Link to={`/veranstaltungen?club=${club.id}`}>Alle Veranstaltungen ansehen</Link>
                  </Button>
                </div>
              </>
            )}
          </div>
        </section>

        {/* ── 3. ABOUT ────────────────────────────────────────────────── */}
        {club.description && (
          <section className="py-14 px-4 bg-cream/5 border-y border-cream/10">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-2xl font-bold text-cream mb-6">Über den Verein</h2>
              <p className="text-cream/70 leading-relaxed whitespace-pre-line">{club.description}</p>
            </div>
          </section>
        )}

        {/* ── 4. GALLERY ──────────────────────────────────────────────── */}
        {galleryImages.length > 0 && (
          <section className="py-14 px-4">
            <div className="max-w-5xl mx-auto">
              <h2 className="text-2xl font-bold text-cream mb-2">Galerie</h2>
              <p className="text-cream/50 text-sm mb-8">Eindrücke aus dem Vereinsleben</p>
              <GallerySection images={galleryImages} gridOnly />
              {galleryImages.length >= 8 && (
                <div className="mt-6 text-center">
                  <Button variant="outline" className="border-cream/20 text-cream/70 hover:bg-cream/10" asChild>
                    <Link to={`/verein/${slug}/galerie`}>Alle Fotos ansehen</Link>
                  </Button>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── 5. CONTACT ──────────────────────────────────────────────── */}
        {hasContact && (
          <section id="contact" className="py-14 px-4 bg-cream/5 border-y border-cream/10">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-2xl font-bold text-cream mb-8">Kontakt</h2>
              <div className="space-y-4">
                {club.contact_email && (
                  <a
                    href={`mailto:${club.contact_email}`}
                    className="flex items-center gap-4 p-4 bg-forest-dark border border-cream/10 rounded-xl hover:border-gold/30 transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-gold/10 flex items-center justify-center shrink-0">
                      <Mail className="w-5 h-5 text-gold" />
                    </div>
                    <div>
                      <p className="text-xs text-cream/40 mb-0.5">E-Mail</p>
                      <p className="text-sm text-cream group-hover:text-gold transition-colors">{club.contact_email}</p>
                    </div>
                  </a>
                )}
                {club.contact_phone && (
                  <a
                    href={`tel:${club.contact_phone}`}
                    className="flex items-center gap-4 p-4 bg-forest-dark border border-cream/10 rounded-xl hover:border-gold/30 transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-gold/10 flex items-center justify-center shrink-0">
                      <Phone className="w-5 h-5 text-gold" />
                    </div>
                    <div>
                      <p className="text-xs text-cream/40 mb-0.5">Telefon</p>
                      <p className="text-sm text-cream group-hover:text-gold transition-colors">{club.contact_phone}</p>
                    </div>
                  </a>
                )}
                {club.website_url && (
                  <a
                    href={club.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-4 p-4 bg-forest-dark border border-cream/10 rounded-xl hover:border-gold/30 transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-gold/10 flex items-center justify-center shrink-0">
                      <Globe className="w-5 h-5 text-gold" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-cream/40 mb-0.5">Website</p>
                      <p className="text-sm text-cream group-hover:text-gold transition-colors truncate">
                        {club.website_url.replace(/^https?:\/\//, "")}
                      </p>
                    </div>
                    <ExternalLink className="w-4 h-4 text-cream/30 shrink-0" />
                  </a>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ── 6. LOCATION ─────────────────────────────────────────────── */}
        {hasAddress && (
          <section className="py-14 px-4">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-2xl font-bold text-cream mb-8">Standort</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="p-5 bg-forest-dark/50 border border-cream/10 rounded-xl">
                  <p className="text-xs text-cream/40 mb-3 uppercase tracking-wide">Adresse</p>
                  <address className="not-italic text-cream/80 text-sm leading-relaxed">
                    {[club.street, club.house_number].filter(Boolean).length > 0 && (
                      <p>{[club.street, club.house_number].filter(Boolean).join(" ")}</p>
                    )}
                    {[club.location_zip, cityDisplay].filter(Boolean).length > 0 && (
                      <p>{[club.location_zip, cityDisplay].filter(Boolean).join(" ")}</p>
                    )}
                    {club.state && <p className="text-cream/50 mt-1">{club.state}</p>}
                  </address>
                </div>
                <div className="flex flex-col items-center justify-center p-5 bg-forest-dark/50 border border-cream/10 rounded-xl text-cream/30">
                  <MapPin className="w-8 h-8 mb-2 opacity-30" />
                  <p className="text-xs text-center">Interaktive Karte folgt</p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── 7. MEMBERSHIP INTEREST ──────────────────────────────────── */}
        <section className="py-14 px-4 bg-cream/5 border-y border-cream/10">
          <div className="max-w-xl mx-auto">
            <h2 className="text-2xl font-bold text-cream mb-2">Interesse am Verein?</h2>
            <p className="text-cream/50 text-sm mb-8">
              Hinterlassen Sie Ihre Kontaktdaten — der Verein meldet sich bei Ihnen.
            </p>

            {isUnclaimed && (
              <div className="mb-6 space-y-3">
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-sm text-amber-200/80 leading-relaxed">
                  Dieses Vereinsprofil wird aktuell durch SchützenHub verwaltet. Ihre Anfrage wird an das SchützenHub-Team übermittelt.
                </div>
                <Button
                  variant="outline"
                  className="w-full border-cream/20 text-cream hover:bg-cream/10"
                  onClick={() => { setContactDialogOpen(true); setContactSuccess(false); setContactError(""); }}
                >
                  Verein kontaktieren
                </Button>
              </div>
            )}

            {interestSuccess ? (
              <div className="flex items-start gap-3 bg-green-500/10 border border-green-500/20 rounded-xl px-5 py-4">
                <CheckCircle className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
                <p className="text-sm text-green-300">
                  Vielen Dank für Ihr Interesse. Der Verein wird informiert.
                </p>
              </div>
            ) : (
              <form onSubmit={handleInterestSubmit} className="space-y-4">
                <div>
                  <Label className="text-cream/80 text-sm mb-1.5 block">Name *</Label>
                  <Input
                    value={interestForm.name}
                    onChange={(e) => setInterestForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Ihr Name"
                    required
                    className="bg-forest-dark border-cream/20 text-cream placeholder:text-cream/30 focus:border-gold/50"
                  />
                </div>
                <div>
                  <Label className="text-cream/80 text-sm mb-1.5 block">E-Mail *</Label>
                  <Input
                    type="email"
                    value={interestForm.email}
                    onChange={(e) => setInterestForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="ihre@email.de"
                    required
                    className="bg-forest-dark border-cream/20 text-cream placeholder:text-cream/30 focus:border-gold/50"
                  />
                </div>
                <div>
                  <Label className="text-cream/80 text-sm mb-1.5 block">Nachricht</Label>
                  <Textarea
                    value={interestForm.message}
                    onChange={(e) => setInterestForm((f) => ({ ...f, message: e.target.value }))}
                    placeholder="Ihre Nachricht (optional)…"
                    rows={3}
                    className="bg-forest-dark border-cream/20 text-cream placeholder:text-cream/30 focus:border-gold/50 resize-none"
                  />
                </div>
                {interestError && (
                  <div className="flex items-center gap-2 text-sm text-destructive">
                    <AlertCircle className="w-4 h-4 shrink-0" /> {interestError}
                  </div>
                )}
                <Button type="submit" variant="hero" disabled={interestSubmitting} className="w-full">
                  {interestSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Interesse bekunden"}
                </Button>
              </form>
            )}
          </div>
        </section>

        {/* ── 8. CLAIM CLUB ───────────────────────────────────────────── */}
        {isUnclaimed && (
          <section className="py-14 px-4">
            <div className="max-w-3xl mx-auto">
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-8 flex flex-col sm:flex-row sm:items-center gap-6">
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-amber-200 mb-2">Ist das Ihr Verein?</h2>
                  <p className="text-amber-200/70 text-sm leading-relaxed">
                    Übernehmen Sie die Verwaltung dieser Vereinsseite und verwalten Sie Veranstaltungen,
                    Mitglieder und Inhalte selbst.
                  </p>
                </div>
                <Button
                  className="shrink-0 bg-amber-500 hover:bg-amber-600 text-white border-0"
                  onClick={() => setShowClaimDialog(true)}
                >
                  Verein übernehmen
                </Button>
              </div>
            </div>
          </section>
        )}

        {/* ── 9. RELATED CLUBS ────────────────────────────────────────── */}
        {relatedClubs.length > 0 && (
          <section className="py-14 px-4 bg-cream/5 border-t border-cream/10">
            <div className="max-w-5xl mx-auto">
              <h2 className="text-2xl font-bold text-cream mb-2">Weitere Vereine in der Region</h2>
              <p className="text-cream/50 text-sm mb-8">
                {cityDisplay ? `Vereine in ${cityDisplay} und Umgebung` : "Vereine in der Nähe"}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                {relatedClubs.map((rc) => (
                  <Link
                    key={rc.id}
                    to={`/verein/${rc.slug}`}
                    className="flex flex-col items-center gap-2 p-4 bg-forest-dark border border-cream/10 rounded-xl hover:border-gold/30 hover:bg-cream/5 transition-colors text-center group"
                  >
                    {rc.logo_url ? (
                      <img
                        src={rc.logo_url}
                        alt={rc.name}
                        className="w-12 h-12 rounded-full object-cover border border-cream/10"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gold/10 flex items-center justify-center border border-gold/20">
                        <Shield className="w-5 h-5 text-gold/60" />
                      </div>
                    )}
                    <p className="text-xs font-medium text-cream/80 group-hover:text-gold transition-colors line-clamp-2 leading-tight">
                      {rc.name}
                    </p>
                    {rc.location_city && (
                      <p className="text-xs text-cream/40">{rc.location_city}</p>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── 10. SEO CONTENT ─────────────────────────────────────────── */}
        <section className="py-8 px-4 border-t border-cream/5">
          <div className="max-w-3xl mx-auto">
            <p className="text-xs text-cream/20 leading-relaxed">
              Die {club.name} ist ein Schützenverein{cityDisplay ? ` in ${cityDisplay}` : ""}
              {club.state ? ` und Teil der Schützentradition in ${club.state}` : ""}.
              {club.founded_year ? ` Der Verein wurde ${club.founded_year} gegründet.` : ""}
              {" "}Auf SchützenHub finden Sie aktuelle Informationen, Veranstaltungen und Kontaktdaten der {club.name}.
            </p>
          </div>
        </section>
      </main>

      <PublicFooter />

      {/* ── Claim Dialog ─────────────────────────────────────────────── */}
      <ClubClaimDialog
        clubSlug={slug}
        clubName={club?.name ?? ""}
        open={showClaimDialog}
        onOpenChange={setShowClaimDialog}
      />

      {/* ── Kontaktdialog (unclaimed) ──────────────────────────────────── */}
      <Dialog open={contactDialogOpen} onOpenChange={(o) => { if (!o) { setContactDialogOpen(false); setContactSuccess(false); setContactError(""); setContactForm({ name: "", email: "", phone: "", message: "" }); } }}>
        <DialogContent className="sm:max-w-md bg-forest-dark border-cream/10">
          <DialogHeader>
            <DialogTitle className="text-cream">Verein kontaktieren</DialogTitle>
          </DialogHeader>
          {contactSuccess ? (
            <div className="flex items-start gap-3 bg-green-500/10 border border-green-500/20 rounded-xl px-5 py-4">
              <CheckCircle className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
              <p className="text-sm text-green-300">
                Vielen Dank! Ihre Anfrage wurde erfolgreich übermittelt.
              </p>
            </div>
          ) : (
            <form onSubmit={handleContactSubmit} className="space-y-4">
              <div>
                <Label className="text-cream/80 text-sm mb-1.5 block">Name *</Label>
                <Input
                  value={contactForm.name}
                  onChange={(e) => setContactForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ihr Name"
                  required
                  className="bg-forest-dark border-cream/20 text-cream placeholder:text-cream/30 focus:border-gold/50"
                />
              </div>
              <div>
                <Label className="text-cream/80 text-sm mb-1.5 block">E-Mail *</Label>
                <Input
                  type="email"
                  value={contactForm.email}
                  onChange={(e) => setContactForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="ihre@email.de"
                  required
                  className="bg-forest-dark border-cream/20 text-cream placeholder:text-cream/30 focus:border-gold/50"
                />
              </div>
              <div>
                <Label className="text-cream/80 text-sm mb-1.5 block">Telefon (optional)</Label>
                <Input
                  type="tel"
                  value={contactForm.phone}
                  onChange={(e) => setContactForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="+49 123 456789"
                  className="bg-forest-dark border-cream/20 text-cream placeholder:text-cream/30 focus:border-gold/50"
                />
              </div>
              <div>
                <Label className="text-cream/80 text-sm mb-1.5 block">Nachricht</Label>
                <Textarea
                  value={contactForm.message}
                  onChange={(e) => setContactForm((f) => ({ ...f, message: e.target.value }))}
                  placeholder="Wie können wir Ihnen helfen?"
                  rows={3}
                  className="bg-forest-dark border-cream/20 text-cream placeholder:text-cream/30 focus:border-gold/50 resize-none"
                />
              </div>
              {contactError && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {contactError}
                </div>
              )}
              <DialogFooter>
                <Button type="button" variant="ghost" className="text-cream/60" onClick={() => setContactDialogOpen(false)}>
                  Abbrechen
                </Button>
                <Button type="submit" variant="hero" disabled={contactSubmitting}>
                  {contactSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Nachricht senden"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PublicClubProfile;
