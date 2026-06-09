import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { ArrowLeft, MapPin, Calendar, Shield, Building2, Clock } from "lucide-react";
import { apiJson } from "@/integrations/api/client";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PublicEventDetail {
  id: string;
  title: string;
  description: string | null;
  event_type: string | null;
  location: string | null;
  location_name: string | null;
  location_street: string | null;
  location_zip: string | null;
  location_city: string | null;
  location_state: string | null;
  start_at: string;
  end_at: string | null;
  club_id: string;
  club_name: string;
  club_slug: string;
  logo_path: string | null;
  logo_url?: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const EVENT_TYPE_COLORS: Record<string, string> = {
  "Schützenfest":       "bg-amber-500/20 text-amber-300 border-amber-500/30",
  "Bezirksfest":        "bg-orange-500/20 text-orange-300 border-orange-500/30",
  "Königsschießen":     "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  "Jubiläum":           "bg-purple-500/20 text-purple-300 border-purple-500/30",
  "Generalversammlung": "bg-blue-500/20 text-blue-300 border-blue-500/30",
  "Vereinsabend":       "bg-teal-500/20 text-teal-300 border-teal-500/30",
  "Umzug":              "bg-green-500/20 text-green-300 border-green-500/30",
  "Sonstiges":          "bg-white/10 text-cream/60 border-white/10",
};

// ─── Component ────────────────────────────────────────────────────────────────

const PublicVEventDetail = () => {
  const { id } = useParams<{ id: string }>();

  const { data: event, isLoading, isError } = useQuery<PublicEventDetail>({
    queryKey: ["public-event-detail", id],
    queryFn: () => apiJson<PublicEventDetail>(`/api/public/events/${id}`),
    enabled: !!id,
  });

  const logoUrl = event?.logo_url || null;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-forest-dark flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
      </div>
    );
  }

  if (isError || !event) {
    return (
      <div className="min-h-screen bg-forest-dark flex flex-col items-center justify-center gap-4 text-cream">
        <Calendar className="w-12 h-12 text-cream/20" />
        <p className="text-cream/50">Veranstaltung nicht gefunden.</p>
        <Link to="/veranstaltungen" className="text-gold text-sm hover:underline">← Zurück zum Kalender</Link>
      </div>
    );
  }

  const start = new Date(event.start_at);
  const end = event.end_at ? new Date(event.end_at) : null;
  const typeCls = event.event_type
    ? (EVENT_TYPE_COLORS[event.event_type] ?? EVENT_TYPE_COLORS["Sonstiges"])
    : null;

  const addressLines = [
    event.location_name,
    event.location_street,
    [event.location_zip, event.location_city].filter(Boolean).join(" "),
    event.location_state,
    !event.location_name && !event.location_city && event.location,
  ].filter(Boolean);

  const schemaEvent = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    startDate: event.start_at,
    ...(event.end_at && { endDate: event.end_at }),
    description: event.description ?? undefined,
    organizer: { "@type": "Organization", name: event.club_name },
    location: {
      "@type": "Place",
      name: event.location_name || event.location || event.location_city || event.club_name,
      address: {
        "@type": "PostalAddress",
        streetAddress: event.location_street ?? undefined,
        addressLocality: event.location_city ?? undefined,
        postalCode: event.location_zip ?? undefined,
        addressRegion: event.location_state ?? undefined,
        addressCountry: "DE",
      },
    },
  };

  return (
    <div className="min-h-screen bg-forest-dark text-cream">
      <Helmet>
        <title>{event.title} – SchützenHub</title>
        <meta name="description" content={event.description ?? `${event.title} – ${event.club_name}`} />
        <script type="application/ld+json">{JSON.stringify(schemaEvent)}</script>
      </Helmet>

      {/* ── Fixed Nav ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-forest-dark/95 backdrop-blur border-b border-gold/10 h-16 flex items-center px-6 gap-4">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <Shield className="w-6 h-6 text-gold" />
          <span className="font-bold text-cream hidden sm:block">SchützenHub</span>
        </Link>
        <div className="flex-1" />
        <Link to="/veranstaltungen" className="flex items-center gap-1 text-sm text-cream/70 hover:text-gold transition-colors">
          <ArrowLeft className="w-4 h-4" /> Alle Veranstaltungen
        </Link>
      </nav>

      {/* ── Hero ── */}
      <section className="pt-24 pb-10 px-6 border-b border-gold/10">
        <div className="max-w-5xl mx-auto">
          {event.event_type && typeCls && (
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border mb-4 ${typeCls}`}>
              {event.event_type}
            </span>
          )}
          <h1 className="text-3xl sm:text-4xl font-bold text-cream mb-4 leading-tight">
            {event.title}
          </h1>
          <div className="flex flex-wrap items-center gap-5 text-sm text-cream/60">
            <Link to={`/verein/${event.club_slug}`} className="flex items-center gap-1.5 hover:text-gold transition-colors">
              <Building2 className="w-4 h-4" /> {event.club_name}
            </Link>
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              {format(start, "EEEE, d. MMMM yyyy", { locale: de })}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              {format(start, "HH:mm", { locale: de })}
              {end && ` – ${format(end, "HH:mm", { locale: de })}`} Uhr
            </span>
            {(event.location_city || event.location) && (
              <span className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4" />
                {event.location_city || event.location}
                {event.location_state && `, ${event.location_state}`}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* ── Body ── */}
      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Left col */}
          <div className="lg:col-span-2 space-y-6">

            {/* Beschreibung */}
            {event.description && (
              <div className="bg-white/5 border border-gold/10 rounded-xl p-6">
                <h2 className="font-semibold text-cream mb-3">Beschreibung</h2>
                <p className="text-cream/70 whitespace-pre-line leading-relaxed">{event.description}</p>
              </div>
            )}

            {/* Veranstaltungsort */}
            {addressLines.length > 0 && (
              <div className="bg-white/5 border border-gold/10 rounded-xl p-6">
                <h2 className="font-semibold text-cream mb-3 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-gold" /> Veranstaltungsort
                </h2>
                <address className="not-italic text-cream/70 space-y-0.5">
                  {addressLines.map((line, i) => <p key={i}>{line}</p>)}
                </address>
              </div>
            )}
          </div>

          {/* Right col */}
          <div className="space-y-5">

            {/* Date card */}
            <div className="bg-white/5 border border-gold/10 rounded-xl p-6 space-y-3">
              <h2 className="font-semibold text-cream text-sm">Datum & Uhrzeit</h2>
              <div className="flex items-start gap-3">
                <div className="w-12 text-center bg-gold/10 border border-gold/20 rounded-lg py-1.5 shrink-0">
                  <p className="text-xs text-gold/70 uppercase">{format(start, "MMM", { locale: de })}</p>
                  <p className="text-xl font-bold text-cream leading-none">{format(start, "dd")}</p>
                  <p className="text-xs text-cream/50">{format(start, "yyyy")}</p>
                </div>
                <div className="text-sm text-cream/70 space-y-0.5">
                  <p className="capitalize">{format(start, "EEEE", { locale: de })}</p>
                  <p>{format(start, "HH:mm", { locale: de })} Uhr</p>
                  {end && <p>bis {format(end, "HH:mm", { locale: de })} Uhr</p>}
                  {end && !isSameDay(start, end) && (
                    <p className="text-xs text-cream/50">bis {format(end, "d. MMM yyyy", { locale: de })}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Club card */}
            <div className="bg-white/5 border border-gold/10 rounded-xl p-6">
              <h2 className="font-semibold text-cream text-sm mb-3">Veranstalter</h2>
              <Link to={`/verein/${event.club_slug}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity group">
                {logoUrl ? (
                  <img src={logoUrl} alt={event.club_name} className="w-10 h-10 rounded-lg object-cover border border-gold/15" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-gold/10 border border-gold/15 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-gold/60" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-medium text-cream group-hover:text-gold transition-colors truncate">{event.club_name}</p>
                  <p className="text-xs text-gold/60">Vereinsprofil ansehen →</p>
                </div>
              </Link>
            </div>

          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-gold/10 mt-10 py-8 px-6 text-center text-sm text-cream/40">
        <div className="flex items-center justify-center gap-6 mb-3">
          <Link to="/veranstaltungen" className="hover:text-cream transition-colors">Veranstaltungskalender</Link>
          <Link to="/vereine" className="hover:text-cream transition-colors">Vereine</Link>
          <Link to="/auth" className="hover:text-cream transition-colors">Anmelden</Link>
        </div>
        © {new Date().getFullYear()} SchützenHub
      </footer>
    </div>
  );
};

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

export default PublicVEventDetail;
