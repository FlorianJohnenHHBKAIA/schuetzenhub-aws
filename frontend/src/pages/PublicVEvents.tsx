import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import {
  format, startOfMonth, endOfMonth, addDays, getDay, isSameDay,
} from "date-fns";
import { de } from "date-fns/locale";
import {
  Search, MapPin, Shield, ChevronLeft, ChevronRight,
  List, Calendar as CalendarIcon,
} from "lucide-react";
import { apiJson } from "@/integrations/api/client";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PublicEvent {
  id: string;
  title: string;
  description: string | null;
  event_type: string | null;
  location: string | null;
  location_name: string | null;
  location_zip: string | null;
  location_city: string | null;
  location_state: string | null;
  start_at: string;
  end_at: string | null;
  club_id: string;
  club_name: string;
  club_slug: string;
}

interface EventsResponse {
  items: PublicEvent[];
  total: number;
  page: number;
  pages: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BUNDESLAENDER = [
  "Baden-Württemberg","Bayern","Berlin","Brandenburg","Bremen",
  "Hamburg","Hessen","Mecklenburg-Vorpommern","Niedersachsen",
  "Nordrhein-Westfalen","Rheinland-Pfalz","Saarland","Sachsen",
  "Sachsen-Anhalt","Schleswig-Holstein","Thüringen",
];

const EVENT_TYPES = [
  "Schützenfest","Bezirksfest","Königsschießen","Jubiläum",
  "Generalversammlung","Vereinsabend","Umzug","Sonstiges",
];

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildCalendarGrid(month: Date): (Date | null)[] {
  const start = startOfMonth(month);
  const end = endOfMonth(month);
  const startWeekday = (getDay(start) + 6) % 7;
  const days: (Date | null)[] = Array(startWeekday).fill(null);
  for (let d = new Date(start); d <= end; d = addDays(d, 1)) days.push(new Date(d));
  while (days.length % 7 !== 0) days.push(null);
  return days;
}

function locationStr(ev: PublicEvent): string {
  const parts = [ev.location_city || ev.location, ev.location_state].filter(Boolean);
  return parts.join(", ") || "";
}

function EventTypeBadge({ type }: { type: string }) {
  const cls = EVENT_TYPE_COLORS[type] ?? EVENT_TYPE_COLORS["Sonstiges"];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {type}
    </span>
  );
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ─── Main Component ───────────────────────────────────────────────────────────

const PublicVEvents = () => {
  const navigate = useNavigate();
  const [view, setView] = useState<"list" | "calendar">("list");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [stateFilter, setStateFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const debouncedCity = useDebounce(cityFilter, 300);
  const [typeFilter, setTypeFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sort, setSort] = useState("start_asc");
  const [page, setPage] = useState(1);
  const [calMonth, setCalMonth] = useState(new Date());
  const [calDayFilter, setCalDayFilter] = useState<Date | null>(null);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [debouncedSearch, stateFilter, debouncedCity, typeFilter, fromDate, toDate, sort]);

  // ── List query ──
  const listParams = new URLSearchParams({
    ...(debouncedSearch && { search: debouncedSearch }),
    ...(stateFilter && { state: stateFilter }),
    ...(debouncedCity && { city: debouncedCity }),
    ...(typeFilter && { event_type: typeFilter }),
    ...(fromDate && { from: new Date(fromDate).toISOString() }),
    ...(toDate && { to: new Date(toDate + "T23:59:59").toISOString() }),
    sort,
    page: String(page),
    limit: "24",
  });

  const { data: listData, isLoading: listLoading } = useQuery<EventsResponse>({
    queryKey: ["public-events", debouncedSearch, stateFilter, debouncedCity, typeFilter, fromDate, toDate, sort, page],
    queryFn: () => apiJson<EventsResponse>(`/api/public/events?${listParams}`),
    enabled: view === "list",
  });

  // ── Calendar query ──
  const calFrom = startOfMonth(calMonth).toISOString();
  const calTo = endOfMonth(calMonth).toISOString();
  const calParams = new URLSearchParams({
    from: calFrom, to: calTo,
    ...(stateFilter && { state: stateFilter }),
    ...(typeFilter && { event_type: typeFilter }),
    limit: "200",
  });

  const { data: calData } = useQuery<EventsResponse>({
    queryKey: ["public-events-cal", format(calMonth, "yyyy-MM"), stateFilter, typeFilter],
    queryFn: () => apiJson<EventsResponse>(`/api/public/events?${calParams}`),
    enabled: view === "calendar",
  });

  const eventsByDay = (calData?.items ?? []).reduce((acc, ev) => {
    const key = format(new Date(ev.start_at), "yyyy-MM-dd");
    (acc[key] ??= []).push(ev);
    return acc;
  }, {} as Record<string, PublicEvent[]>);

  const calGrid = buildCalendarGrid(calMonth);

  const calDayEvents = calDayFilter
    ? (calData?.items ?? []).filter((ev) => isSameDay(new Date(ev.start_at), calDayFilter))
    : [];

  const hasActiveFilters = !!(stateFilter || cityFilter || typeFilter || fromDate || toDate);

  return (
    <div className="min-h-screen bg-forest-dark text-cream">
      <Helmet>
        <title>Veranstaltungskalender – SchützenHub</title>
        <meta name="description" content="Finden Sie Schützenfeste, Königsschießen und Vereinsveranstaltungen in Ihrer Nähe." />
      </Helmet>

      {/* ── Fixed Nav ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-forest-dark/95 backdrop-blur border-b border-gold/10 h-16 flex items-center px-6 gap-6">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <Shield className="w-6 h-6 text-gold" />
          <span className="font-bold text-cream hidden sm:block">SchützenHub</span>
        </Link>
        <div className="flex-1" />
        <Link to="/vereine" className="text-sm text-cream/70 hover:text-gold transition-colors hidden md:block">Vereine</Link>
        <Link to="/auth" className="text-sm bg-gold/10 hover:bg-gold/20 text-gold border border-gold/20 px-3 py-1.5 rounded-lg transition-colors">Anmelden</Link>
      </nav>

      {/* ── Hero ── */}
      <section className="pt-28 pb-12 px-6 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-cream mb-3">
          Schützenfeste & Veranstaltungen
        </h1>
        <p className="text-cream/60 text-lg max-w-xl mx-auto mb-8">
          Finden Sie Schützenfeste, Königsschießen und Vereinsveranstaltungen in ganz Deutschland.
        </p>
        <div className="relative max-w-xl mx-auto">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-cream/40" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Suche nach Titel, Verein, Ort…"
            className="w-full pl-12 pr-4 py-3.5 bg-white/5 border border-gold/20 rounded-xl text-cream placeholder:text-cream/40 focus:outline-none focus:border-gold/50 focus:ring-0"
          />
        </div>
      </section>

      {/* ── Tab Bar + Filter ── */}
      <div className="sticky top-16 z-40 bg-forest-dark/95 backdrop-blur border-b border-gold/10">
        <div className="max-w-7xl mx-auto px-6">
          {/* Tabs */}
          <div className="flex items-center justify-between py-3">
            <div className="flex gap-1 bg-white/5 rounded-lg p-1">
              <button
                onClick={() => setView("list")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === "list" ? "bg-gold/20 text-gold" : "text-cream/60 hover:text-cream"}`}
              >
                <List className="w-4 h-4" /> Liste
              </button>
              <button
                onClick={() => setView("calendar")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === "calendar" ? "bg-gold/20 text-gold" : "text-cream/60 hover:text-cream"}`}
              >
                <CalendarIcon className="w-4 h-4" /> Kalender
              </button>
            </div>
            {listData && view === "list" && (
              <span className="text-sm text-cream/50">{listData.total} Veranstaltungen</span>
            )}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2 pb-3">
            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              className="bg-white/5 border border-gold/15 text-cream text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-gold/40"
            >
              <option value="">Alle Bundesländer</option>
              {BUNDESLAENDER.map((bl) => <option key={bl} value={bl}>{bl}</option>)}
            </select>
            {view === "list" && (
              <input
                type="text"
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                placeholder="Ort…"
                className="bg-white/5 border border-gold/15 text-cream text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-gold/40 placeholder:text-cream/40 w-28"
              />
            )}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-white/5 border border-gold/15 text-cream text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-gold/40"
            >
              <option value="">Alle Typen</option>
              {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            {view === "list" && (
              <>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="bg-white/5 border border-gold/15 text-cream text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-gold/40"
                />
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="bg-white/5 border border-gold/15 text-cream text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-gold/40"
                />
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  className="bg-white/5 border border-gold/15 text-cream text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-gold/40"
                >
                  <option value="start_asc">Datum aufsteigend</option>
                  <option value="start_desc">Datum absteigend</option>
                  <option value="created_desc">Neueste zuerst</option>
                </select>
              </>
            )}
            {hasActiveFilters && (
              <button
                onClick={() => { setStateFilter(""); setCityFilter(""); setTypeFilter(""); setFromDate(""); setToDate(""); }}
                className="text-xs text-cream/50 hover:text-cream px-2 py-1.5 border border-white/10 rounded-lg"
              >
                Filter löschen ×
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <main className="max-w-7xl mx-auto px-6 py-8">

        {view === "list" && (
          <>
            {listLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="bg-white/5 border border-gold/10 rounded-xl p-5 h-40 animate-pulse" />
                ))}
              </div>
            ) : (listData?.items ?? []).length === 0 ? (
              <div className="text-center py-24">
                <CalendarIcon className="w-12 h-12 mx-auto text-cream/20 mb-4" />
                <p className="text-cream/50">Keine Veranstaltungen gefunden.</p>
                {hasActiveFilters && (
                  <button onClick={() => { setStateFilter(""); setCityFilter(""); setTypeFilter(""); setFromDate(""); setToDate(""); }} className="mt-3 text-gold text-sm hover:underline">
                    Filter zurücksetzen
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {(listData?.items ?? []).map((event) => {
                  const start = new Date(event.start_at);
                  const loc = locationStr(event);
                  return (
                    <Link
                      key={event.id}
                      to={`/veranstaltungen/${event.id}`}
                      className="group bg-white/5 border border-gold/10 hover:border-gold/30 rounded-xl p-5 flex gap-4 transition-colors"
                    >
                      <div className="shrink-0 w-14 text-center bg-gold/10 border border-gold/20 rounded-lg py-2 self-start">
                        <p className="text-xs text-gold/70 uppercase">{format(start, "MMM", { locale: de })}</p>
                        <p className="text-2xl font-bold text-cream leading-none">{format(start, "dd")}</p>
                        <p className="text-xs text-cream/50">{format(start, "yyyy")}</p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                          {event.event_type && <EventTypeBadge type={event.event_type} />}
                          <Link
                            to={`/verein/${event.club_slug}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs text-gold/70 hover:text-gold truncate"
                          >
                            {event.club_name}
                          </Link>
                        </div>
                        <p className="font-semibold text-cream group-hover:text-gold transition-colors leading-snug">
                          {event.title}
                        </p>
                        {loc && (
                          <p className="text-xs text-cream/50 flex items-center gap-1 mt-1">
                            <MapPin className="w-3 h-3 shrink-0" />{loc}
                          </p>
                        )}
                        {event.description && (
                          <p className="text-sm text-cream/60 line-clamp-2 mt-1.5">{event.description}</p>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            {(listData?.pages ?? 0) > 1 && (
              <div className="flex items-center justify-center gap-3 mt-10">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="flex items-center gap-1 px-4 py-2 rounded-lg bg-white/5 border border-gold/15 text-cream/70 hover:text-cream disabled:opacity-40 disabled:cursor-not-allowed text-sm"
                >
                  <ChevronLeft className="w-4 h-4" /> Zurück
                </button>
                <span className="text-sm text-cream/50">Seite {page} von {listData?.pages}</span>
                <button
                  disabled={page >= (listData?.pages ?? 1)}
                  onClick={() => setPage((p) => p + 1)}
                  className="flex items-center gap-1 px-4 py-2 rounded-lg bg-white/5 border border-gold/15 text-cream/70 hover:text-cream disabled:opacity-40 disabled:cursor-not-allowed text-sm"
                >
                  Weiter <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}

        {view === "calendar" && (
          <div className="space-y-6">
            {/* Month nav */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => { setCalMonth((m) => addDays(startOfMonth(m), -1)); setCalDayFilter(null); }}
                className="p-2 rounded-lg hover:bg-white/5 text-cream/70 hover:text-cream"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h2 className="text-lg font-semibold text-cream capitalize">
                {format(calMonth, "MMMM yyyy", { locale: de })}
              </h2>
              <button
                onClick={() => { setCalMonth((m) => addDays(endOfMonth(m), 1)); setCalDayFilter(null); }}
                className="p-2 rounded-lg hover:bg-white/5 text-cream/70 hover:text-cream"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Grid */}
            <div className="bg-white/5 border border-gold/10 rounded-xl overflow-hidden">
              <div className="grid grid-cols-7 border-b border-gold/10">
                {["Mo","Di","Mi","Do","Fr","Sa","So"].map((d) => (
                  <div key={d} className="py-2 text-center text-xs font-medium text-cream/50">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {calGrid.map((day, idx) => {
                  if (!day) return <div key={idx} className="min-h-[80px] border-r border-b border-gold/5 last:border-r-0" />;
                  const key = format(day, "yyyy-MM-dd");
                  const dayEvents = eventsByDay[key] ?? [];
                  const isToday = isSameDay(day, new Date());
                  const isSelected = calDayFilter ? isSameDay(day, calDayFilter) : false;
                  return (
                    <div
                      key={idx}
                      onClick={() => setCalDayFilter(isSelected ? null : day)}
                      className={`min-h-[80px] p-1.5 border-r border-b border-gold/5 last:border-r-0 cursor-pointer transition-colors ${
                        isSelected ? "bg-gold/10" : dayEvents.length ? "hover:bg-white/5" : ""
                      }`}
                    >
                      <p className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1 ${isToday ? "bg-gold text-forest-dark" : "text-cream/60"}`}>
                        {format(day, "d")}
                      </p>
                      {dayEvents.slice(0, 3).map((ev) => (
                        <div
                          key={ev.id}
                          onClick={(e) => { e.stopPropagation(); navigate(`/veranstaltungen/${ev.id}`); }}
                          className="text-xs px-1 py-0.5 rounded bg-gold/15 text-gold/90 truncate mb-0.5 hover:bg-gold/25 transition-colors"
                          title={ev.title}
                        >
                          {ev.title}
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <p className="text-xs text-cream/40">+{dayEvents.length - 3} weitere</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Day detail */}
            {calDayFilter && (
              <div>
                <h3 className="text-sm font-medium text-cream/70 mb-3">
                  {format(calDayFilter, "EEEE, d. MMMM yyyy", { locale: de })} — {calDayEvents.length} Veranstaltung{calDayEvents.length !== 1 ? "en" : ""}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {calDayEvents.map((event) => {
                    const start = new Date(event.start_at);
                    const loc = locationStr(event);
                    return (
                      <Link
                        key={event.id}
                        to={`/veranstaltungen/${event.id}`}
                        className="group bg-white/5 border border-gold/10 hover:border-gold/30 rounded-xl p-5 flex gap-4 transition-colors"
                      >
                        <div className="shrink-0">
                          {event.event_type && <EventTypeBadge type={event.event_type} />}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-cream group-hover:text-gold transition-colors">{event.title}</p>
                          <p className="text-xs text-cream/50 mt-0.5">{format(start, "HH:mm", { locale: de })} · {event.club_name}</p>
                          {loc && <p className="text-xs text-cream/40 flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" />{loc}</p>}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-gold/10 mt-16 py-8 px-6 text-center text-sm text-cream/40">
        <div className="flex items-center justify-center gap-6 mb-3">
          <Link to="/vereine" className="hover:text-cream transition-colors">Vereine</Link>
          <Link to="/portal" className="hover:text-cream transition-colors">Portal</Link>
          <Link to="/auth" className="hover:text-cream transition-colors">Anmelden</Link>
        </div>
        © {new Date().getFullYear()} SchützenHub
      </footer>
    </div>
  );
};

export default PublicVEvents;
