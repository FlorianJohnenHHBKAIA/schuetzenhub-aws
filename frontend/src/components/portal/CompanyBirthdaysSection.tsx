import { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase, getStorageUrl } from "@/integrations/api/client";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Cake, Loader2 } from "lucide-react";

interface BirthdayMember {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  birthday: string;
  title: string | null;
  nextBd: Date;
  diffDays: number;
  age: number;
}

interface RawMembership {
  member_id: string;
}

interface RawMember {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  birthday: string | null;
  title: string | null;
  status: string;
}

interface CompanyBirthdaysSectionProps {
  companyId: string;
  isMember: boolean;
}

const getNextBirthday = (birthday: string): Date => {
  const bd = new Date(birthday);
  const today = new Date();
  const todayNormalized = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const next = new Date(today.getFullYear(), bd.getMonth(), bd.getDate());
  if (next < todayNormalized) {
    next.setFullYear(today.getFullYear() + 1);
  }
  return next;
};

const getAvatarUrl = (avatar_url: string | null): string | undefined => {
  if (!avatar_url) return undefined;
  if (avatar_url.startsWith("/") || avatar_url.startsWith("http")) return avatar_url;
  return getStorageUrl("avatars", avatar_url) || undefined;
};

const CompanyBirthdaysSection = ({ companyId, isMember }: CompanyBirthdaysSectionProps) => {
  const [members, setMembers] = useState<BirthdayMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isMember || !companyId) return;
    fetchBirthdays();
  }, [companyId, isMember]);

  const fetchBirthdays = async () => {
    setIsLoading(true);
    try {
      const { data: membershipsData } = await supabase
        .from("member_company_memberships")
        .select("member_id")
        .eq("company_id", companyId)
        .is("valid_to", null);

      const memberships = (membershipsData as RawMembership[]) || [];
      if (memberships.length === 0) { setMembers([]); return; }

      const memberIds = memberships.map(m => m.member_id);
      const { data: membersData } = await supabase
        .from("members")
        .select("id, first_name, last_name, avatar_url, birthday, title, status")
        .in("id", memberIds)
        .not("birthday", "is", null)
        .neq("status", "resigned");

      const rawMembers = (membersData as RawMember[]) || [];
      const today = new Date();
      const todayMs = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

      const upcoming: BirthdayMember[] = rawMembers
        .filter(m => m.birthday)
        .map(m => {
          const nextBd = getNextBirthday(m.birthday!);
          const diffDays = Math.round((nextBd.getTime() - todayMs) / 86400000);
          const age = nextBd.getFullYear() - new Date(m.birthday!).getFullYear();
          return { ...m, birthday: m.birthday!, nextBd, diffDays, age };
        })
        .filter(m => m.diffDays >= 0 && m.diffDays <= 30)
        .sort((a, b) => a.nextBd.getTime() - b.nextBd.getTime());

      setMembers(upcoming);
    } catch (error) {
      console.error("Error fetching birthdays:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isMember) return null;

  const todayMembers = members.filter(m => m.diffDays === 0);
  const thisWeekMembers = members.filter(m => m.diffDays >= 1 && m.diffDays <= 6);
  const laterMembers = members.filter(m => m.diffDays >= 7);

  const BirthdayCard = ({ m, highlight }: { m: BirthdayMember; highlight?: boolean }) => (
    <div
      data-member-id={m.id}
      className={`p-3 rounded-xl border flex items-center gap-3 ${
        highlight
          ? "border-amber-400 bg-amber-50/30 dark:bg-amber-950/20"
          : "bg-card border-border"
      }`}
    >
      <Avatar className="w-10 h-10 shrink-0">
        <AvatarImage src={getAvatarUrl(m.avatar_url)} alt={m.first_name} className="object-cover" />
        <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
          {m.first_name[0]}{m.last_name[0]}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{m.first_name} {m.last_name}</p>
        {m.title && <p className="text-xs text-muted-foreground truncate">{m.title}</p>}
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {highlight ? (
            <span className="text-xs font-medium text-amber-600 flex items-center gap-1">
              <Cake className="w-3 h-3" /> Heute
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">
              {format(m.nextBd, "dd. MMM", { locale: de })}
            </span>
          )}
          <span className="text-xs text-muted-foreground">{m.age} Jahre</span>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <h2 className="font-display text-xl font-semibold mb-4 flex items-center gap-2">
        <Cake className="w-5 h-5 text-primary" />
        Geburtstage
      </h2>

      {isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : members.length === 0 ? (
        <div className="p-6 bg-card rounded-xl border text-center">
          <Cake className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm">
            In den nächsten 30 Tagen stehen keine Geburtstage an.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {todayMembers.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-2">Heute</p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {todayMembers.map(m => <BirthdayCard key={m.id} m={m} highlight />)}
              </div>
            </div>
          )}

          {thisWeekMembers.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Diese Woche</p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {thisWeekMembers.map(m => <BirthdayCard key={m.id} m={m} />)}
              </div>
            </div>
          )}

          {laterMembers.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Nächste 30 Tage</p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {laterMembers.map(m => <BirthdayCard key={m.id} m={m} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CompanyBirthdaysSection;
