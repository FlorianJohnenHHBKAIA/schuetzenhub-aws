import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { apiJson, supabase, getStorageUrl } from "@/integrations/api/client";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Cake, Loader2 } from "lucide-react";

interface RawMember {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  birthday: string | null;
  status: string;
  company_ids: string[] | null;
}

interface RawCompany {
  id: string;
  name: string;
}

interface BirthdayEntry {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  birthday: string;
  companyName: string | null;
  nextBd: Date;
  diffDays: number;
  age: number;
}

const getNextBirthday = (birthday: string): Date => {
  const bd = new Date(birthday);
  const today = new Date();
  const todayNormalized = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const next = new Date(today.getFullYear(), bd.getMonth(), bd.getDate());
  if (next < todayNormalized) next.setFullYear(today.getFullYear() + 1);
  return next;
};

const getAvatarUrl = (avatar_url: string | null): string | undefined => {
  if (!avatar_url) return undefined;
  if (avatar_url.startsWith("/") || avatar_url.startsWith("http")) return avatar_url;
  return getStorageUrl("avatars", avatar_url) || undefined;
};

interface Props {
  clubId: string;
}

const AdminBirthdaysSection = ({ clubId }: Props) => {
  const [entries, setEntries] = useState<BirthdayEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!clubId) return;
    fetchBirthdays();
  }, [clubId]);

  const fetchBirthdays = async () => {
    setIsLoading(true);
    try {
      const [membersRaw, companiesRes] = await Promise.all([
        apiJson<RawMember[]>("/api/members"),
        supabase.from("companies").select("id, name"),
      ]);

      const companyMap: Record<string, string> = {};
      const companies = (companiesRes.data as RawCompany[]) || [];
      companies.forEach((c) => { companyMap[c.id] = c.name; });

      const today = new Date();
      const todayMs = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

      const upcoming: BirthdayEntry[] = (membersRaw || [])
        .filter(m => m.birthday && m.status !== "resigned" && m.status !== "prospect")
        .map(m => {
          const nextBd = getNextBirthday(m.birthday!);
          const diffDays = Math.round((nextBd.getTime() - todayMs) / 86400000);
          const age = nextBd.getFullYear() - new Date(m.birthday!).getFullYear();
          const companyId = m.company_ids?.[0] ?? null;
          return {
            id: m.id,
            first_name: m.first_name,
            last_name: m.last_name,
            avatar_url: m.avatar_url,
            birthday: m.birthday!,
            companyName: companyId ? (companyMap[companyId] ?? null) : null,
            nextBd,
            diffDays,
            age,
          };
        })
        .filter(m => m.diffDays >= 0 && m.diffDays <= 30)
        .sort((a, b) => a.nextBd.getTime() - b.nextBd.getTime())
        .slice(0, 10);

      setEntries(upcoming);
    } catch (error) {
      console.error("Error fetching admin birthdays:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const BirthdayCard = ({ entry, highlight }: { entry: BirthdayEntry; highlight?: boolean }) => (
    <Link to={`/portal/member/${entry.id}`}>
      <div
        className={`p-3 rounded-xl border flex items-center gap-3 hover:shadow-sm transition-shadow ${
          highlight
            ? "border-amber-400 bg-amber-50/30 dark:bg-amber-950/20"
            : "bg-card border-border"
        }`}
      >
        <Avatar className="w-10 h-10 shrink-0">
          <AvatarImage src={getAvatarUrl(entry.avatar_url)} alt={entry.first_name} className="object-cover" />
          <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
            {entry.first_name[0]}{entry.last_name[0]}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{entry.first_name} {entry.last_name}</p>
          {entry.companyName && (
            <p className="text-xs text-muted-foreground truncate">{entry.companyName}</p>
          )}
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {highlight ? (
              <span className="text-xs font-medium text-amber-600 flex items-center gap-1">
                <Cake className="w-3 h-3" /> Heute · {entry.age} Jahre
              </span>
            ) : (
              <>
                <span className="text-xs text-muted-foreground">
                  {format(entry.nextBd, "dd. MMM", { locale: de })}
                </span>
                <span className="text-xs text-muted-foreground">{entry.age} Jahre</span>
              </>
            )}
          </div>
        </div>
      </div>
    </Link>
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="p-6 bg-card rounded-xl border text-center">
        <Cake className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
        <p className="text-muted-foreground text-sm">
          Im Verein stehen in den nächsten 30 Tagen keine Geburtstage an.
        </p>
      </div>
    );
  }

  const todayEntries = entries.filter(m => m.diffDays === 0);
  const thisWeekEntries = entries.filter(m => m.diffDays >= 1 && m.diffDays <= 6);
  const laterEntries = entries.filter(m => m.diffDays >= 7);

  return (
    <div className="space-y-4">
      {todayEntries.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-2">Heute</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {todayEntries.map(e => <BirthdayCard key={e.id} entry={e} highlight />)}
          </div>
        </div>
      )}
      {thisWeekEntries.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Diese Woche</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {thisWeekEntries.map(e => <BirthdayCard key={e.id} entry={e} />)}
          </div>
        </div>
      )}
      {laterEntries.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Nächste 30 Tage</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {laterEntries.map(e => <BirthdayCard key={e.id} entry={e} />)}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminBirthdaysSection;
