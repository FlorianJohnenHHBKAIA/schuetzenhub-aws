import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { supabase, getStorageUrl } from "@/integrations/api/client";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Shield, Loader2 } from "lucide-react";

interface LeadershipEntry {
  member_id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  member_since: string | null;
  memberTitle: string | null;
  roles: string[];
  primaryRole: string;
}

interface RawAppointment {
  member_id: string;
  title: string;
  valid_from: string | null;
}

interface RawMember {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  title: string | null;
  member_since: string | null;
}

interface CompanyLeadershipSectionProps {
  companyId: string;
  isMember: boolean;
}

const ROLE_ORDER = [
  'hauptmann', 'kompaniechef',
  'stellv. hauptmann', 'stellvertretender hauptmann', '1. stellv.',
  'spieß', 'hauptfeldwebel', 'feldwebel',
  'kassierer', 'schatzmeister',
  'schriftführer', 'protokollführer',
  'jugendwart', 'jugendleiter',
  'fahnenoffizier', 'fahnenjunker',
];

const getRoleRank = (roleName: string): number => {
  const lower = roleName.toLowerCase();
  const idx = ROLE_ORDER.findIndex(r => lower.includes(r));
  return idx === -1 ? 999 : idx;
};

const getAvatarUrl = (avatar_url: string | null): string | undefined => {
  if (!avatar_url) return undefined;
  if (avatar_url.startsWith("/") || avatar_url.startsWith("http")) return avatar_url;
  return getStorageUrl("avatars", avatar_url) || undefined;
};

const CompanyLeadershipSection = ({ companyId, isMember }: CompanyLeadershipSectionProps) => {
  const [entries, setEntries] = useState<LeadershipEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isMember || !companyId) return;
    fetchLeadership();
  }, [companyId, isMember]);

  const fetchLeadership = async () => {
    setIsLoading(true);
    try {
      const { data: apptsData } = await supabase
        .from("appointments")
        .select("member_id, title, valid_from")
        .eq("scope_type", "company")
        .eq("scope_id", companyId)
        .is("valid_to", null);

      const appts = (apptsData as RawAppointment[]) || [];
      if (appts.length === 0) { setEntries([]); return; }

      const memberIds = [...new Set(appts.map(a => a.member_id))];
      const { data: membersData } = await supabase
        .from("members")
        .select("id, first_name, last_name, avatar_url, title, member_since")
        .in("id", memberIds);

      const membersMap = new Map<string, RawMember>();
      ((membersData as RawMember[]) || []).forEach(m => membersMap.set(m.id, m));

      // Group appointments by member
      const grouped = new Map<string, string[]>();
      appts.forEach(a => {
        const existing = grouped.get(a.member_id) || [];
        existing.push(a.title);
        grouped.set(a.member_id, existing);
      });

      const result: LeadershipEntry[] = [];
      grouped.forEach((roles, member_id) => {
        const m = membersMap.get(member_id);
        if (!m) return;

        // Sort roles by rank within the entry
        const sortedRoles = [...roles].sort((a, b) => getRoleRank(a) - getRoleRank(b));
        result.push({
          member_id,
          first_name: m.first_name,
          last_name: m.last_name,
          avatar_url: m.avatar_url,
          member_since: m.member_since,
          memberTitle: m.title,
          roles: sortedRoles,
          primaryRole: sortedRoles[0],
        });
      });

      // Sort entries by primary role rank, then last name
      result.sort((a, b) => {
        const rankDiff = getRoleRank(a.primaryRole) - getRoleRank(b.primaryRole);
        if (rankDiff !== 0) return rankDiff;
        return a.last_name.localeCompare(b.last_name, 'de');
      });

      setEntries(result);
    } catch (error) {
      console.error("Error fetching leadership:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isMember) return null;

  return (
    <div>
      <h2 className="font-display text-xl font-semibold flex items-center gap-2">
        <Shield className="w-5 h-5 text-primary" />
        Kompanieführung
      </h2>
      <p className="text-muted-foreground text-sm mt-1 mb-4">
        Die Ansprechpartner deiner Kompanie
      </p>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : entries.length === 0 ? (
        <div className="p-6 bg-card rounded-xl border text-center">
          <Shield className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm">
            Für diese Kompanie wurden noch keine Ämter hinterlegt.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {entries.map(entry => (
            <Link
              key={entry.member_id}
              to={`/portal/member/${entry.member_id}`}
              data-member-id={entry.member_id}
              className="group p-4 bg-card rounded-xl border border-border hover:border-primary/20 hover:shadow-md transition-all flex flex-col items-center text-center"
            >
              <Avatar className="w-20 h-20">
                <AvatarImage src={getAvatarUrl(entry.avatar_url)} alt={entry.first_name} className="object-cover" />
                <AvatarFallback className="bg-primary/10 text-primary text-lg font-medium">
                  {entry.first_name[0]}{entry.last_name[0]}
                </AvatarFallback>
              </Avatar>

              <p className="font-bold mt-3 leading-tight">
                {entry.first_name} {entry.last_name}
              </p>

              <p className="text-primary font-medium text-sm mt-1">
                {entry.primaryRole}
              </p>

              {entry.roles.length > 1 && (
                <div className="flex flex-wrap gap-1 justify-center mt-1">
                  {entry.roles.slice(1).map(r => (
                    <Badge key={r} variant="outline" className="text-xs">
                      {r}
                    </Badge>
                  ))}
                </div>
              )}

              {entry.memberTitle && (
                <p className="text-xs text-muted-foreground mt-1">{entry.memberTitle}</p>
              )}

              {entry.member_since && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Mitglied seit {format(new Date(entry.member_since), 'yyyy', { locale: de })}
                </p>
              )}

              <span className="mt-3 text-xs text-muted-foreground group-hover:text-primary transition-colors w-full text-center block">
                Profil ansehen →
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default CompanyLeadershipSection;
