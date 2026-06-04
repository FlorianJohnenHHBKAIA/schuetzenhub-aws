import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import PortalLayout from "@/components/portal/PortalLayout";
import { useAuth } from "@/lib/auth";
import { useUIMode } from "@/hooks/useUIMode";
import { useWorkShiftStats } from "@/hooks/useWorkShiftStats";
import { supabase, apiJson } from "@/integrations/api/client";

import CompanyHero from "@/components/portal/dashboard/CompanyHero";
import UpcomingEventsSection from "@/components/portal/dashboard/UpcomingEventsSection";
import CompanyUpdatesSection from "@/components/portal/dashboard/CompanyUpdatesSection";
import EngagementSection from "@/components/portal/dashboard/EngagementSection";
import PersonalSection from "@/components/portal/dashboard/PersonalSection";
import CompanyBirthdaysSection from "@/components/portal/CompanyBirthdaysSection";

interface CompanyInfo {
  id: string;
  name: string;
  logo_url: string | null;
}

interface Event {
  id: string;
  title: string;
  start_at: string;
  location: string | null;
  owner_type: string;
  owner_id: string;
  audience: string;
}

interface Post {
  id: string;
  title: string;
  created_at: string;
  cover_image_path: string | null;
  category: string;
  content: string | null;
  audience: string;
  owner_type: string;
  owner_id: string;
}

interface PostStats {
  commentCount: number;
  attendingCount: number;
  helpingCount: number;
  readCount: number;
}

interface WorkShift {
  id: string;
  title: string;
  start_at: string;
  open_slots: number;
}

interface LatestAward {
  id: string;
  title: string;
  awarded_at: string;
  award_type: string;
}

interface RawMembership {
  company_id: string;
}

interface RawShift {
  id: string;
  title: string;
  start_at: string;
  required_slots: number | null;
  work_shift_assignments: Array<{ id: string; status: string }>;
}

interface ParticipantCount {
  event_id: string;
  attending_count: number;
  declined_count: number;
  member_count: number;
}


const Dashboard = () => {
  const { member, isLoading: authLoading } = useAuth();
  const { isAdminMode, isLoaded: uiModeLoaded } = useUIMode();
  
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  const [companyEvents, setCompanyEvents] = useState<Event[]>([]);
  const [clubEvents, setClubEvents] = useState<Event[]>([]);
  const [latestPost, setLatestPost] = useState<Post | null>(null);
  const [latestPostStats, setLatestPostStats] = useState<PostStats | null>(null);
  const [upcomingShifts, setUpcomingShifts] = useState<WorkShift[]>([]);
  const [latestAward, setLatestAward] = useState<LatestAward | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [pendingAwardRequests, setPendingAwardRequests] = useState(0);
  const [participantCounts, setParticipantCounts] = useState<Record<string, ParticipantCount>>({});
  const [isLoading, setIsLoading] = useState(true);

  const currentYear = new Date().getFullYear();
  const { stats: workStats, loading: workStatsLoading } = useWorkShiftStats(member?.id || null, currentYear);

  useEffect(() => {
    if (member?.club_id && member?.id && !isAdminMode) {
      fetchDashboardData();
    }
  }, [member?.club_id, member?.id, isAdminMode]);

  const fetchDashboardData = async () => {
    if (!member?.club_id || !member?.id) return;
    setIsLoading(true);

    try {
      const now = new Date().toISOString();

      const { data: membership } = await supabase
        .from("member_company_memberships")
        .select("company_id")
        .eq("member_id", member.id)
        .is("valid_to", null)
        .order("valid_from", { ascending: false })
        .limit(1)
        .maybeSingle();

      let companyId: string | null = null;
      const rawMembership = membership as RawMembership | null;
      
      if (rawMembership?.company_id) {
        companyId = rawMembership.company_id;
        const { data: company } = await supabase
          .from("companies")
          .select("id, name, logo_url")
          .eq("id", rawMembership.company_id)
          .single();
        
        if (company) {
          setCompanyInfo(company as CompanyInfo);
        }
      }

      const companyEventsQuery = companyId
        ? supabase
            .from("events")
            .select("id, title, start_at, location, owner_type, owner_id, audience")
            .eq("club_id", member.club_id)
            .eq("owner_type", "company")
            .eq("owner_id", companyId)
            .in("publication_status", ["approved", "submitted"])
            .gte("start_at", now)
            .order("start_at", { ascending: true })
            .limit(5)
        : Promise.resolve({ data: null as null });

      const clubEventsQuery = supabase
        .from("events")
        .select("id, title, start_at, location, owner_type, owner_id, audience")
        .eq("club_id", member.club_id)
        .eq("owner_type", "club")
        .in("publication_status", ["approved"])
        .in("audience", ["public", "club_internal"])
        .gte("start_at", now)
        .order("start_at", { ascending: true })
        .limit(5);

      const postQuery = supabase
        .from("posts")
        .select("id, title, created_at, cover_image_path, category, content, audience, owner_type, owner_id")
        .eq("club_id", member.club_id)
        .eq("publication_status", "approved")
        .order("created_at", { ascending: false })
        .limit(10);

      const shiftsQuery = companyId
        ? supabase
            .from("work_shifts")
            .select(`id, title, start_at, required_slots, work_shift_assignments(id, status)`)
            .eq("club_id", member.club_id)
            .eq("owner_type", "company")
            .eq("owner_id", companyId)
            .gte("start_at", now)
            .order("start_at", { ascending: true })
            .limit(5)
        : supabase
            .from("work_shifts")
            .select(`id, title, start_at, required_slots, work_shift_assignments(id, status)`)
            .eq("club_id", member.club_id)
            .gte("start_at", now)
            .order("start_at", { ascending: true })
            .limit(5);

      const awardQuery = supabase
        .from("member_awards")
        .select("id, title, awarded_at, award_type")
        .eq("member_id", member.id)
        .eq("status", "approved")
        .order("awarded_at", { ascending: false })
        .limit(1);

      const notificationsQuery = supabase
        .from("notifications")
        .select("id", { count: "exact" })
        .eq("recipient_member_id", member.id)
        .eq("is_read", false);

      const pendingAwardsQuery = supabase
        .from("member_awards")
        .select("id", { count: "exact" })
        .eq("member_id", member.id)
        .eq("status", "pending");

      const [
        companyEventsRes,
        clubEventsRes,
        postRes,
        shiftsRes,
        awardRes,
        notificationsRes,
        pendingAwardsRes,
      ] = await Promise.all([
        companyEventsQuery,
        clubEventsQuery,
        postQuery,
        shiftsQuery,
        awardQuery,
        notificationsQuery,
        pendingAwardsQuery,
      ]);

      const companyEventsData = (companyEventsRes.data as Event[]) || [];
      setCompanyEvents(companyEventsData);

      const companyEventIds = new Set(companyEventsData.map((e) => e.id));
      const allClubEvents = (clubEventsRes.data as Event[]) || [];
      setClubEvents(allClubEvents.filter((e) => !companyEventIds.has(e.id)));

      const allEventIds = [
        ...companyEventsData.map(e => e.id),
        ...allClubEvents.map(e => e.id),
      ];
      if (allEventIds.length > 0) {
        apiJson<ParticipantCount[]>(`/api/events/participant-counts?ids=${allEventIds.join(",")}`)
          .then(data => setParticipantCounts(Object.fromEntries(data.map(c => [c.event_id, c]))))
          .catch(() => {});
      }

      const postData = (postRes.data as Post[]) || [];
      const post = postData.find(p =>
        p.audience !== "company_only" || (companyId && p.owner_id === companyId)
      ) || null;
      // visible_until client-seitig prüfen (wenn DB-Spalte vorhanden)
      const validPost = post && (!(post as any).visible_until || new Date((post as any).visible_until) >= new Date())
        ? post : null;
      setLatestPost(validPost);

      if (validPost) {
        const [commentsRes, reactionsRes] = await Promise.all([
          supabase.from("post_comments").select("id").eq("post_id", validPost.id),
          supabase.from("post_reactions").select("reaction").eq("post_id", validPost.id),
        ]);
        const reactions = (reactionsRes.data || []) as Array<{ reaction: string }>;
        setLatestPostStats({
          commentCount:   commentsRes.data?.length || 0,
          attendingCount: reactions.filter(r => r.reaction === 'attending').length,
          helpingCount:   reactions.filter(r => r.reaction === 'helping').length,
          readCount:      reactions.filter(r => r.reaction === 'read').length,
        });
      }

      const rawShifts = (shiftsRes.data as RawShift[]) || [];
      const shiftsWithOpenSlots: WorkShift[] = rawShifts
        .map((shift) => {
          const filledSlots = shift.work_shift_assignments?.filter(
            (a) => a.status === "signed_up" || a.status === "completed"
          ).length || 0;
          const openSlots = (shift.required_slots || 0) - filledSlots;
          return {
            id: shift.id,
            title: shift.title,
            start_at: shift.start_at,
            open_slots: Math.max(0, openSlots),
          };
        })
        .filter((shift) => shift.open_slots > 0)
        .slice(0, 3);
      setUpcomingShifts(shiftsWithOpenSlots);

      const awardData = (awardRes.data as LatestAward[]) || [];
      setLatestAward(awardData[0] || null);

      setUnreadNotifications((notificationsRes as { count?: number }).count || 0);
      setPendingAwardRequests((pendingAwardsRes as { count?: number }).count || 0);

    } catch (error: unknown) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!authLoading && uiModeLoaded && isAdminMode) {
    return <Navigate to="/portal/admin" replace />;
  }

  return (
    <PortalLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        <CompanyHero
          companyId={companyInfo?.id || null}
          companyName={companyInfo?.name || null}
          companyLogoUrl={companyInfo?.logo_url || null}
          memberFirstName={member?.first_name || ""}
        />

        <UpcomingEventsSection
          companyEvents={companyEvents}
          clubEvents={clubEvents}
          isLoading={isLoading}
          companyName={companyInfo?.name || null}
          participantCounts={participantCounts}
        />
        <CompanyUpdatesSection
          latestPost={latestPost}
          latestPostStats={latestPostStats}
          upcomingShifts={upcomingShifts}
          isLoading={isLoading}
          companyName={companyInfo?.name || null}
        />

        <EngagementSection
          latestAward={latestAward}
          workStats={workStats}
          workStatsLoading={workStatsLoading}
          currentYear={currentYear}
        />

        <PersonalSection
          openShifts={workStats.upcomingShifts}
          unreadNotifications={unreadNotifications}
          pendingAwardRequests={pendingAwardRequests}
        />

        <CompanyBirthdaysSection
          companyId={companyInfo?.id || ""}
          isMember={!!companyInfo?.id}
          limit={5}
        />
      </div>
    </PortalLayout>
  );
};

export default Dashboard;