import { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiJson, getStorageUrl } from "@/integrations/api/client";
import { CheckCircle2, XCircle, Users, ChevronDown, Loader2 } from "lucide-react";

interface Participant {
  member_id: string;
  status: 'attending' | 'declined';
  member?: { first_name: string; last_name: string; avatar_url: string | null } | null;
}

interface EventParticipantsSectionProps {
  eventId: string;
  clubId: string;
  memberId: string;
  audience: string;
  ownerType: string;
  ownerId: string;
  memberCompanyId?: string;
  memberStatus?: string;
  canViewLists: boolean;
}

const getAvatarUrl = (avatar_url: string | null): string | undefined => {
  if (!avatar_url) return undefined;
  if (avatar_url.startsWith("/") || avatar_url.startsWith("http")) return avatar_url;
  return getStorageUrl("avatars", avatar_url) || undefined;
};

const EventParticipantsSection = ({
  eventId,
  memberId,
  audience,
  ownerId,
  memberCompanyId,
  memberStatus,
  canViewLists,
}: EventParticipantsSectionProps) => {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [myStatus, setMyStatus] = useState<'attending' | 'declined' | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [submittingStatus, setSubmittingStatus] = useState<'attending' | 'declined' | null>(null);
  const [activeList, setActiveList] = useState<string | null>(null);

  const canRsvp = memberStatus !== 'prospect' && audience !== 'public' && (
    audience === 'club_internal' ||
    (audience === 'company_only' && memberCompanyId === ownerId)
  );

  useEffect(() => {
    fetchParticipants();
  }, [eventId]);

  const fetchParticipants = async () => {
    setIsLoading(true);
    try {
      const data = await apiJson<Participant[]>(`/api/events/${eventId}/participants`);
      const list = data || [];
      setParticipants(list);
      const mine = list.find(p => p.member_id === memberId);
      setMyStatus(mine?.status || null);
    } catch (err) {
      console.error("Teilnehmer laden fehlgeschlagen:", err);
      setParticipants([]);
      setMyStatus(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRsvp = async (newStatus: 'attending' | 'declined') => {
    if (submittingStatus) return;
    setSubmittingStatus(newStatus);
    try {
      if (myStatus === newStatus) {
        await apiJson(`/api/events/${eventId}/participants`, { method: "DELETE" });
        setMyStatus(null);
      } else {
        await apiJson(`/api/events/${eventId}/participants`, {
          method: "POST",
          body: JSON.stringify({ status: newStatus }),
        });
        setMyStatus(newStatus);
      }
      await fetchParticipants();
    } catch (err) {
      console.error("RSVP Fehler:", err);
    } finally {
      setSubmittingStatus(null);
    }
  };

  const attendingList = participants.filter(p => p.status === 'attending');
  const declinedList = participants.filter(p => p.status === 'declined');

  const MemberList = ({ list }: { list: Participant[] }) => (
    <div className="mt-2 space-y-1">
      {list.map(p => (
        <div key={p.member_id} className="flex items-center gap-2 text-sm">
          <Avatar className="w-6 h-6">
            <AvatarImage src={getAvatarUrl(p.member?.avatar_url || null)} />
            <AvatarFallback className="text-xs bg-primary/10 text-primary">
              {p.member?.first_name?.[0]}{p.member?.last_name?.[0]}
            </AvatarFallback>
          </Avatar>
          <span>{p.member?.first_name} {p.member?.last_name}</span>
        </div>
      ))}
    </div>
  );

  if (audience === 'public') return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="w-5 h-5" />
          Teilnahme
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {canRsvp && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant={myStatus === 'attending' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleRsvp('attending')}
              disabled={!!submittingStatus}
              className={`gap-2 ${myStatus === 'attending' ? 'bg-green-600 hover:bg-green-700 text-white' : ''}`}
            >
              {submittingStatus === 'attending' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {myStatus === 'attending' ? 'Zugesagt' : 'Ich komme'}
            </Button>
            <Button
              variant={myStatus === 'declined' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleRsvp('declined')}
              disabled={!!submittingStatus}
              className={`gap-2 ${myStatus === 'declined' ? 'bg-destructive hover:bg-destructive/90 text-white' : ''}`}
            >
              {submittingStatus === 'declined' ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
              {myStatus === 'declined' ? 'Abgesagt' : 'Ich kann nicht'}
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Lade Rückmeldungen…
          </div>
        ) : (
          <div className="flex flex-wrap gap-4 text-sm">
            <button
              onClick={() => canViewLists ? setActiveList(activeList === 'attending' ? null : 'attending') : undefined}
              className={`flex items-center gap-1.5 ${attendingList.length > 0 && canViewLists ? 'cursor-pointer hover:text-foreground' : 'cursor-default'} text-muted-foreground`}
            >
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <span className="font-medium text-foreground">{attendingList.length}</span>
              Zusagen
              {canViewLists && attendingList.length > 0 && (
                <ChevronDown className={`w-3 h-3 transition-transform ${activeList === 'attending' ? 'rotate-180' : ''}`} />
              )}
            </button>
            <button
              onClick={() => canViewLists ? setActiveList(activeList === 'declined' ? null : 'declined') : undefined}
              className={`flex items-center gap-1.5 ${declinedList.length > 0 && canViewLists ? 'cursor-pointer hover:text-foreground' : 'cursor-default'} text-muted-foreground`}
            >
              <XCircle className="w-4 h-4 text-destructive" />
              <span className="font-medium text-foreground">{declinedList.length}</span>
              Absagen
              {canViewLists && declinedList.length > 0 && (
                <ChevronDown className={`w-3 h-3 transition-transform ${activeList === 'declined' ? 'rotate-180' : ''}`} />
              )}
            </button>
          </div>
        )}

        {canViewLists && activeList === 'attending' && attendingList.length > 0 && (
          <div className="border-t pt-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Zusagen ({attendingList.length})
            </p>
            <MemberList list={attendingList} />
          </div>
        )}

        {canViewLists && activeList === 'declined' && declinedList.length > 0 && (
          <div className="border-t pt-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Absagen ({declinedList.length})
            </p>
            <MemberList list={declinedList} />
          </div>
        )}

        {participants.length === 0 && !isLoading && (
          <p className="text-sm text-muted-foreground">Noch keine Rückmeldungen.</p>
        )}
      </CardContent>
    </Card>
  );
};

export default EventParticipantsSection;
