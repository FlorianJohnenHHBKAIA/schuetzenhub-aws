import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useQuery } from "@tanstack/react-query";
import { Search, MapPin, Calendar, Shield, ArrowRight, ChevronLeft, ChevronRight, Building2, CheckCircle } from "lucide-react";
import { apiJson } from "@/integrations/api/client";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PublicClub {
  id: string;
  name: string;
  slug: string;
  location_city: string | null;
  location_zip: string | null;
  city: string | null;
  state: string | null;
  description: string | null;
  founded_year: number | null;
  logo_url: string | null;
  claim_status: string;
  plan: string | null;
  created_at: string;
  updated_at: string;
}

interface ClubsResponse {
  items: PublicClub[];
  total: number;
  page: number;
  pages: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BUNDESLAENDER = [
  "Baden-Württemberg", "Bayern", "Berlin", "Brandenburg",
  "Bremen", "Hamburg", "Hessen", "Mecklenburg-Vorpommern",
  "Niedersachsen", "Nordrhein-Westfalen", "Rheinland-Pfalz",
  "Saarland", "Sachsen", "Sachsen-Anhalt", "Schleswig-Holstein",
  "Thüringen",
];

const SELECT_CLASS = "bg-forest-dark/80 border border-gold/20 text-cream text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-gold/50 appearance-none cursor-pointer";

// ─── ClubCard ────────────────────────────────────────────────────────────────

const ClubCard = ({ club }: { club: PublicClub }) => {
  const navigate = useNavigate();
  const locationParts = [club.location_zip, club.location_city || club.city].filter(Boolean);
  const locationStr = locationParts.length > 0
    ? `${locationParts.join(" ")}${club.state ? ` · ${club.state}` : ""}`
    : club.state || null;
  const isVerified = club.plan && club.plan !== "free";
  const isUnclaimed = club.claim_status === "unclaimed";

  return (
    <div
      onClick={() => navigate(`/verein/${club.slug}`)}
      className="bg-white/5 border border-gold/10 rounded-xl p-5 flex gap-4 cursor-pointer hover:border-gold/30 hover:bg-white/8 transition-all duration-200 group"
    >
      {/* Logo */}
      <div className="shrink-0">
        {club.logo_url ? (
          <img
            src={club.logo_url}
            alt={club.name}
            className="w-14 h-14 rounded-full object-cover border border-gold/20"
          />
        ) : (
          <div className="w-14 h-14 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center">
            <Shield className="w-7 h-7 text-gold/60" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1.5">
        <h3 className="font-semibold text-cream text-base leading-tight truncate group-hover:text-gold transition-colors">
          {club.name}
        </h3>

        {locationStr && (
          <p className="flex items-center gap-1.5 text-xs text-cream/60">
            <MapPin className="w-3 h-3 shrink-0" />
            <span className="truncate">{locationStr}</span>
          </p>
        )}

        {club.description && (
          <p className="text-sm text-cream/70 line-clamp-2 leading-relaxed">
            {club.description}
          </p>
        )}

        {club.founded_year && (
          <p className="flex items-center gap-1.5 text-xs text-cream/50">
            <Calendar className="w-3 h-3 shrink-0" />
            Gegründet {club.founded_year}
          </p>
        )}

        {/* Badges + CTA */}
        <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
          <div className="flex gap-1.5 flex-wrap">
            {isVerified && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/15 text-green-400 border border-green-500/20">
                <CheckCircle className="w-3 h-3" /> Verifiziert
              </span>
            )}
            {isUnclaimed && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-400 border border-amber-500/20">
                Nicht übernommen
              </span>
            )}
          </div>
          <span className="flex items-center gap-1 text-xs text-gold/70 group-hover:text-gold transition-colors shrink-0">
            Profil ansehen <ArrowRight className="w-3 h-3" />
          </span>
        </div>
      </div>
    </div>
  );
};

// ─── Skeleton ────────────────────────────────────────────────────────────────

const ClubCardSkeleton = () => (
  <div className="bg-white/5 border border-gold/10 rounded-xl p-5 flex gap-4">
    <div className="w-14 h-14 rounded-full bg-white/10 animate-pulse shrink-0" />
    <div className="flex-1 space-y-2">
      <div className="h-4 bg-white/10 rounded animate-pulse w-3/4" />
      <div className="h-3 bg-white/10 rounded animate-pulse w-1/3" />
      <div className="h-3 bg-white/10 rounded animate-pulse w-full" />
      <div className="h-3 bg-white/10 rounded animate-pulse w-2/3" />
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const PublicClubs = () => {
  const [search, setSearch]               = useState("");
  const [debouncedSearch, setDebounced]   = useState("");
  const [stateFilter, setStateFilter]     = useState("");
  const [cityFilter, setCityFilter]       = useState("");
  const [statusFilter, setStatusFilter]   = useState("");
  const [sort, setSort]                   = useState("name_asc");
  const [page, setPage]                   = useState(1);

  // Debounce search 300ms
  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  // Reset page on filter/sort change
  useEffect(() => { setPage(1); }, [stateFilter, cityFilter, statusFilter, sort]);

  const queryParams = new URLSearchParams({
    ...(debouncedSearch && { search: debouncedSearch }),
    ...(stateFilter && { state: stateFilter }),
    ...(cityFilter && { city: cityFilter }),
    ...(statusFilter && { status: statusFilter }),
    sort,
    page: String(page),
    limit: "24",
  });

  const { data, isLoading } = useQuery<ClubsResponse>({
    queryKey: ["public-clubs", debouncedSearch, stateFilter, cityFilter, statusFilter, sort, page],
    queryFn: () => apiJson<ClubsResponse>(`/api/public/clubs?${queryParams}`),
  });

  const clubs  = data?.items ?? [];
  const total  = data?.total ?? 0;
  const pages  = data?.pages ?? 1;

  const schemaOrg = page === 1 && clubs.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": "Schützenvereine in Deutschland",
    "itemListElement": clubs.map((club, i) => ({
      "@type": "ListItem",
      "position": i + 1,
      "item": {
        "@type": "SportsOrganization",
        "name": club.name,
        "url": `${typeof window !== "undefined" ? window.location.origin : ""}/verein/${club.slug}`,
        ...(club.logo_url && { "logo": club.logo_url }),
        ...((club.location_city || club.city) && {
          "address": {
            "@type": "PostalAddress",
            "addressLocality": club.location_city || club.city,
            ...(club.location_zip && { "postalCode": club.location_zip }),
            ...(club.state && { "addressRegion": club.state }),
            "addressCountry": "DE",
          }
        }),
      },
    })),
  } : null;

  return (
    <div className="min-h-screen bg-forest-dark flex flex-col">
      <Helmet>
        <title>Schützenvereine in Deutschland | SchützenHub</title>
        <meta name="description" content="Verzeichnis deutscher Schützenvereine mit Vereinsprofilen, Veranstaltungen und Kontaktdaten. Finden Sie Ihren Verein." />
        <meta property="og:title" content="Schützenvereine in Deutschland | SchützenHub" />
        <meta property="og:description" content="Das vollständige Verzeichnis deutscher Schützenvereine – mit Profilen, Terminen und Kontaktdaten." />
        <meta property="og:type" content="website" />
        <link rel="canonical" href={typeof window !== "undefined" ? `${window.location.origin}/vereine` : "/vereine"} />
        {schemaOrg && (
          <script type="application/ld+json">{JSON.stringify(schemaOrg)}</script>
        )}
      </Helmet>

      {/* ── Fixed Navigation ─────────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-forest-dark/95 backdrop-blur-md border-b border-gold/10">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 text-cream hover:text-gold transition-colors">
            <Shield className="w-7 h-7 text-gold" />
            <span className="font-display font-semibold text-base hidden sm:inline">SchützenHub</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/" className="text-sm text-cream/70 hover:text-cream transition-colors hidden sm:inline">
              Zur Startseite
            </Link>
            <Link
              to="/auth"
              className="text-sm px-4 py-1.5 rounded-lg border border-gold/30 text-gold hover:bg-gold/10 transition-colors"
            >
              Anmelden
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="pt-16 bg-forest-dark">
        <div className="container mx-auto px-6 pt-16 pb-12 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-gold/20 text-gold/80 text-xs font-medium mb-6">
            <Building2 className="w-3.5 h-3.5" />
            Vereinsregister
          </div>
          <h1 className="text-4xl sm:text-5xl font-display font-bold text-cream mb-4 leading-tight">
            Schützenvereine<br className="hidden sm:block" /> in Deutschland
          </h1>
          <p className="text-lg text-cream/70 mb-8 max-w-xl mx-auto">
            Finden Sie Schützenvereine, Veranstaltungen und Gemeinschaften in Ihrer Region.
          </p>
          {/* Hero Search */}
          <div className="max-w-xl mx-auto relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-cream/40 pointer-events-none" />
            <input
              type="search"
              placeholder="Vereinsname, Ort oder PLZ suchen…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/10 border border-gold/20 text-cream placeholder-cream/40 focus:outline-none focus:border-gold/50 focus:bg-white/15 text-sm transition-all"
            />
          </div>
        </div>
      </section>

      {/* ── Filter Bar ───────────────────────────────────────────────────── */}
      <div className="sticky top-16 z-40 bg-forest-dark/95 backdrop-blur border-b border-gold/10">
        <div className="container mx-auto px-6 py-3 flex flex-wrap items-center gap-3">
          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className={SELECT_CLASS}
          >
            <option value="">Alle Bundesländer</option>
            {BUNDESLAENDER.map((bl) => (
              <option key={bl} value={bl}>{bl}</option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Ort filtern…"
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            className="bg-forest-dark/80 border border-gold/20 text-cream placeholder-cream/40 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-gold/50 w-36"
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={SELECT_CLASS}
          >
            <option value="">Alle Status</option>
            <option value="managed">Verifiziert</option>
            <option value="unclaimed">Nicht übernommen</option>
          </select>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className={SELECT_CLASS}
          >
            <option value="name_asc">A–Z</option>
            <option value="created_desc">Neueste Vereine</option>
            <option value="updated_desc">Zuletzt aktualisiert</option>
          </select>

          <span className="ml-auto text-xs text-cream/40 whitespace-nowrap">
            {isLoading ? "Lädt…" : `${total.toLocaleString("de-DE")} Verein${total !== 1 ? "e" : ""}`}
          </span>
        </div>
      </div>

      {/* ── Grid ─────────────────────────────────────────────────────────── */}
      <main className="flex-1 container mx-auto px-6 py-8">
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 12 }).map((_, i) => <ClubCardSkeleton key={i} />)}
          </div>
        )}

        {!isLoading && clubs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-full bg-gold/10 flex items-center justify-center mb-4">
              <Shield className="w-8 h-8 text-gold/50" />
            </div>
            <p className="text-cream/70 font-medium">Keine Vereine gefunden</p>
            <p className="text-cream/40 text-sm mt-1">
              {debouncedSearch || stateFilter || cityFilter || statusFilter
                ? "Versuchen Sie andere Suchbegriffe oder Filter."
                : "Noch keine öffentlichen Vereine vorhanden."}
            </p>
            {(debouncedSearch || stateFilter || cityFilter || statusFilter) && (
              <button
                onClick={() => { setSearch(""); setStateFilter(""); setCityFilter(""); setStatusFilter(""); }}
                className="mt-4 text-sm text-gold hover:text-gold-light transition-colors"
              >
                Filter zurücksetzen
              </button>
            )}
          </div>
        )}

        {!isLoading && clubs.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {clubs.map((club) => (
              <ClubCard key={club.id} club={club} />
            ))}
          </div>
        )}

        {/* ── Pagination ─────────────────────────────────────────────────── */}
        {!isLoading && pages > 1 && (
          <div className="flex items-center justify-center gap-4 mt-10">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gold/20 text-cream/80 text-sm hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> Zurück
            </button>
            <span className="text-sm text-cream/50">
              Seite {page} von {pages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              disabled={page >= pages}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gold/20 text-cream/80 text-sm hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Weiter <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </main>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-gold/10 py-6">
        <div className="container mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-cream/40">
          <p>© {new Date().getFullYear()} SchützenHub – Das Vereinsmanagement für Schützenvereine</p>
          <div className="flex items-center gap-4">
            <Link to="/portal" className="hover:text-cream/70 transition-colors">Portal</Link>
            <Link to="/auth" className="hover:text-cream/70 transition-colors">Anmelden</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PublicClubs;
