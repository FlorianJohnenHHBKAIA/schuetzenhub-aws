import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { Search, Shield, ChevronLeft, ChevronRight, BadgeCheck } from "lucide-react";
import { apiJson, getStorageUrl } from "@/integrations/api/client";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Provider {
  id: string;
  company_name: string;
  slug: string;
  provider_type: string;
  description: string | null;
  city: string | null;
  state: string | null;
  is_verified: boolean;
  logo_path: string | null;
  logo_url: string | null;
}

interface ProvidersResponse {
  items: Provider[];
  total: number;
  page: number;
  pages: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PROVIDER_TYPES = [
  "Schausteller", "Festzelt", "Getränkelieferant", "Catering", "Band", "DJ",
  "Musikverein", "Sicherheitsdienst", "Toilettenservice", "Veranstaltungstechnik",
  "Dekoration", "Sonstiges",
];

const BUNDESLAENDER = [
  "Baden-Württemberg","Bayern","Berlin","Brandenburg","Bremen",
  "Hamburg","Hessen","Mecklenburg-Vorpommern","Niedersachsen",
  "Nordrhein-Westfalen","Rheinland-Pfalz","Saarland","Sachsen",
  "Sachsen-Anhalt","Schleswig-Holstein","Thüringen",
];

const TYPE_COLORS: Record<string, string> = {
  "Schausteller":          "bg-amber-500/20 text-amber-300 border-amber-500/30",
  "Festzelt":              "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  "Getränkelieferant":     "bg-blue-500/20 text-blue-300 border-blue-500/30",
  "Catering":              "bg-green-500/20 text-green-300 border-green-500/30",
  "Band":                  "bg-purple-500/20 text-purple-300 border-purple-500/30",
  "DJ":                    "bg-pink-500/20 text-pink-300 border-pink-500/30",
  "Musikverein":           "bg-violet-500/20 text-violet-300 border-violet-500/30",
  "Sicherheitsdienst":     "bg-red-500/20 text-red-300 border-red-500/30",
  "Toilettenservice":      "bg-gray-500/20 text-gray-300 border-gray-500/30",
  "Veranstaltungstechnik": "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  "Dekoration":            "bg-rose-500/20 text-rose-300 border-rose-500/30",
  "Sonstiges":             "bg-white/10 text-cream/60 border-white/10",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function TypeBadge({ type }: { type: string }) {
  const cls = TYPE_COLORS[type] ?? TYPE_COLORS["Sonstiges"];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {type}
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

const PublicProviders = () => {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [typeFilter, setTypeFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [sort, setSort] = useState("name_asc");
  const [page, setPage] = useState(1);

  useEffect(() => { setPage(1); }, [debouncedSearch, typeFilter, stateFilter, sort]);

  const params = new URLSearchParams({
    ...(debouncedSearch && { search: debouncedSearch }),
    ...(typeFilter && { type: typeFilter }),
    ...(stateFilter && { state: stateFilter }),
    sort,
    page: String(page),
    limit: "24",
  });

  const { data, isLoading } = useQuery<ProvidersResponse>({
    queryKey: ["public-providers", debouncedSearch, typeFilter, stateFilter, sort, page],
    queryFn: () => apiJson<ProvidersResponse>(`/api/public/providers?${params}`),
  });

  const hasActiveFilters = !!(typeFilter || stateFilter);

  const schemaItemList = page === 1 && data?.items.length ? {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": "Schausteller und Dienstleister für Schützenfeste",
    "numberOfItems": data.total,
    "itemListElement": data.items.slice(0, 10).map((p, i) => ({
      "@type": "ListItem",
      "position": i + 1,
      "name": p.company_name,
      "url": `/anbieter/${p.slug}`,
    })),
  } : null;

  return (
    <div className="min-h-screen bg-forest-dark text-cream">
      <Helmet>
        <title>Schausteller und Dienstleister für Schützenfeste | SchützenHub</title>
        <meta name="description" content="Finden Sie Schausteller, Bands, Caterer, Getränkelieferanten und weitere Dienstleister für Ihr Schützenfest." />
        {schemaItemList && (
          <script type="application/ld+json">{JSON.stringify(schemaItemList)}</script>
        )}
      </Helmet>

      {/* ── Fixed Nav ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-forest-dark/95 backdrop-blur border-b border-gold/10 h-16 flex items-center px-6 gap-6">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <Shield className="w-6 h-6 text-gold" />
          <span className="font-bold text-cream hidden sm:block">SchützenHub</span>
        </Link>
        <div className="flex-1" />
        <Link to="/vereine" className="text-sm text-cream/70 hover:text-gold transition-colors hidden md:block">Vereine</Link>
        <Link to="/veranstaltungen" className="text-sm text-cream/70 hover:text-gold transition-colors hidden md:block">Veranstaltungen</Link>
        <Link to="/auth" className="text-sm bg-gold/10 hover:bg-gold/20 text-gold border border-gold/20 px-3 py-1.5 rounded-lg transition-colors">Anmelden</Link>
      </nav>

      {/* ── Hero ── */}
      <section className="pt-28 pb-12 px-6 text-center">
        <div className="inline-flex items-center gap-2 bg-gold/10 border border-gold/20 rounded-full px-3 py-1 text-xs text-gold/80 mb-5">
          <Shield className="w-3.5 h-3.5" /> Dienstleisterverzeichnis
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold text-cream mb-3">
          Schausteller & Dienstleister
        </h1>
        <p className="text-cream/60 text-lg max-w-xl mx-auto mb-8">
          Finden Sie Schausteller, Bands, Caterer und weitere Dienstleister für Ihr Schützenfest.
        </p>
        <div className="relative max-w-xl mx-auto">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-cream/40" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Suche nach Firmenname, Ort…"
            className="w-full pl-12 pr-4 py-3.5 bg-white/5 border border-gold/20 rounded-xl text-cream placeholder:text-cream/40 focus:outline-none focus:border-gold/50"
          />
        </div>
      </section>

      {/* ── Filter Bar ── */}
      <div className="sticky top-16 z-40 bg-forest-dark/95 backdrop-blur border-b border-gold/10">
        <div className="max-w-7xl mx-auto px-6 py-3 flex flex-wrap items-center gap-3">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-white/5 border border-gold/15 text-cream text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-gold/40"
          >
            <option value="">Alle Kategorien</option>
            {PROVIDER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className="bg-white/5 border border-gold/15 text-cream text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-gold/40"
          >
            <option value="">Alle Bundesländer</option>
            {BUNDESLAENDER.map((bl) => <option key={bl} value={bl}>{bl}</option>)}
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="bg-white/5 border border-gold/15 text-cream text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-gold/40"
          >
            <option value="name_asc">Name A–Z</option>
            <option value="created_desc">Neueste zuerst</option>
          </select>
          {hasActiveFilters && (
            <button
              onClick={() => { setTypeFilter(""); setStateFilter(""); }}
              className="text-xs text-cream/50 hover:text-cream px-2 py-1.5 border border-white/10 rounded-lg"
            >
              Filter löschen ×
            </button>
          )}
          <div className="ml-auto text-sm text-cream/50">
            {data ? `${data.total} Anbieter` : ""}
          </div>
        </div>
      </div>

      {/* ── Grid ── */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="bg-white/5 border border-gold/10 rounded-xl p-5 h-44 animate-pulse" />
            ))}
          </div>
        ) : (data?.items ?? []).length === 0 ? (
          <div className="text-center py-24">
            <Shield className="w-12 h-12 mx-auto text-cream/20 mb-4" />
            <p className="text-cream/50">Keine Anbieter gefunden.</p>
            {hasActiveFilters && (
              <button onClick={() => { setTypeFilter(""); setStateFilter(""); }} className="mt-3 text-gold text-sm hover:underline">
                Filter zurücksetzen
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(data?.items ?? []).map((provider) => {
              const logoUrl = provider.logo_url || (provider.logo_path ? getStorageUrl("provider-assets", provider.logo_path) : null);
              return (
                <Link
                  key={provider.id}
                  to={`/anbieter/${provider.slug}`}
                  className="group bg-white/5 border border-gold/10 hover:border-gold/30 rounded-xl p-5 flex gap-4 transition-colors"
                >
                  {/* Logo */}
                  <div className="shrink-0">
                    {logoUrl ? (
                      <img src={logoUrl} alt={provider.company_name} className="w-14 h-14 rounded-lg object-cover border border-gold/15" />
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-gold/10 border border-gold/15 flex items-center justify-center">
                        <Shield className="w-6 h-6 text-gold/40" />
                      </div>
                    )}
                  </div>
                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                      <TypeBadge type={provider.provider_type} />
                      {provider.is_verified && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gold/15 text-gold border border-gold/25">
                          <BadgeCheck className="w-3 h-3" /> Verifiziert
                        </span>
                      )}
                    </div>
                    <p className="font-semibold text-cream group-hover:text-gold transition-colors leading-snug truncate">
                      {provider.company_name}
                    </p>
                    {(provider.city || provider.state) && (
                      <p className="text-xs text-cream/50 mt-0.5 truncate">
                        {[provider.city, provider.state].filter(Boolean).join(", ")}
                      </p>
                    )}
                    {provider.description && (
                      <p className="text-sm text-cream/60 line-clamp-2 mt-1.5">{provider.description}</p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {(data?.pages ?? 0) > 1 && (
          <div className="flex items-center justify-center gap-3 mt-10">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="flex items-center gap-1 px-4 py-2 rounded-lg bg-white/5 border border-gold/15 text-cream/70 hover:text-cream disabled:opacity-40 disabled:cursor-not-allowed text-sm"
            >
              <ChevronLeft className="w-4 h-4" /> Zurück
            </button>
            <span className="text-sm text-cream/50">Seite {page} von {data?.pages}</span>
            <button
              disabled={page >= (data?.pages ?? 1)}
              onClick={() => setPage((p) => p + 1)}
              className="flex items-center gap-1 px-4 py-2 rounded-lg bg-white/5 border border-gold/15 text-cream/70 hover:text-cream disabled:opacity-40 disabled:cursor-not-allowed text-sm"
            >
              Weiter <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-gold/10 mt-16 py-8 px-6 text-center text-sm text-cream/40">
        <div className="flex items-center justify-center gap-6 mb-3">
          <Link to="/vereine" className="hover:text-cream transition-colors">Vereine</Link>
          <Link to="/veranstaltungen" className="hover:text-cream transition-colors">Veranstaltungen</Link>
          <Link to="/portal" className="hover:text-cream transition-colors">Portal</Link>
          <Link to="/auth" className="hover:text-cream transition-colors">Anmelden</Link>
        </div>
        © {new Date().getFullYear()} SchützenHub
      </footer>
    </div>
  );
};

export default PublicProviders;
