import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import PortalLayout from "@/components/portal/PortalLayout";
import { useAuth } from "@/lib/auth";
import { useUIMode } from "@/hooks/useUIMode";
import { useWorkShiftStats } from "@/hooks/useWorkShiftStats";
import { supabase } from "@/integrations/supabase/client";

// Dashboard components
import CompanyHero from "@/components/portal/dashboard/CompanyHero";
import UpcomingEventsSection from "@/components/portal/dashboard/UpcomingEventsSection";
import CompanyUpdatesSection from "@/components/portal/dashboard/CompanyUpdatesSection";
import EngagementSection from "@/components/portal/dashboard/EngagementSection";
import PersonalSection from "@/components/portal/dashboard/PersonalSection";

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

const Dashboard = () => {
  const { member, isLoading: authLoading } = useAuth();
  const { isAdminMode, isLoaded: uiModeLoaded } = useUIMode();
  
  // Company data
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  
  // Events
  const [companyEvents, setCompanyEvents] = useState<Event[]>([]);
  const [clubEvents, setClubEvents] = useState<Event[]>([]);
  
  // Updates
  const [latestPost, setLatestPost] = useState<Post | null>(null);
  const [upcomingShifts, setUpcomingShifts] = useState<WorkShift[]>([]);
  
  // Engagement
  const [latestAward, setLatestAward] = useState<LatestAward | null>(null);
  
  // Personal
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [pendingAwardRequests, setPendingAwardRequests] = useState(0);
  
  const [isLoading, setIsLoading] = useState(true);

  // Work shift stats for current year
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

      // 1. Fetch member's current company
      const { data: membership } = await supabase
        .from("member_company_memberships")
        .select("company_id")
        .eq("member_id", member.id)
        .is("valid_to", null)
        .order("valid_from", { ascending: false })
        .limit(1)
        .maybeSingle();

      let companyId: string | null = null;
      
      if (membership?.company_id) {
        companyId = membership.company_id;
        const { data: company } = await supabase
          .from("companies")
          .select("id, name, logo_url")
          .eq("id", membership.company_id)
          .single();
        
        if (company) {
          setCompanyInfo(company);
        }
      }

      // 2. Fetch events - company events first, then club events
      const eventPromises = [];
      
      // Company events (if member has a company)
      if (companyId) {
        eventPromises.push(
          supabase
            .from("events")
            .select("id, title, start_at, location, owner_type, owner_id, audience")
            .eq("club_id", member.club_id)
            .eq("owner_type", "company")
            .eq("owner_id", companyId)
            .in("publication_status", ["approved", "submitted"])
            .gte("start_at", now)
            .order("start_at", { ascending: true })
            .limit(5)
        );
      } else {
        eventPromises.push(Promise.resolve({ data: [] }));
      }
      
      // Club-wide events
      eventPromises.push(
        supabase
          .from("events")
          .select("id, title, start_at, location, owner_type, owner_id, audience")
          .eq("club_id", member.club_id)
          .eq("owner_type", "club")
          .in("publication_status", ["approved"])
          .in("audience", ["public", "club_internal"])
          .gte("start_at", now)
          .order("start_at", { ascending: true })
          .limit(5)
      );

      // 3. Fetch latest post (company or club)
      const postQuery = supabase
        .from("posts")
        .select("id, title, created_at, cover_image_path")
        .eq("club_id", member.club_id)
        .eq("publication_status", "approved")
        .order("created_at", { ascending: false })
        .limit(1);

      // 4. Fetch upcoming work shifts with open slots (company-specific if applicable)
      const shiftsQuery = companyId
        ? supabase
            .from("work_shifts")
            .select(`
              id, 
              title, 
              start_at, 
              required_slots,
              work_shift_assignments(id, status)
            `)
            .eq("club_id", member.club_id)
            .eq("owner_type", "company")
            .eq("owner_id", companyId)
            .gte("start_at", now)
            .order("start_at", { ascending: true })
            .limit(5)
        : supabase
            .from("work_shifts")
            .select(`
              id, 
              title, 
              start_at, 
              required_slots,
              work_shift_assignments(id, status)
            `)
            .eq("club_id", member.club_id)
            .gte("start_at", now)
            .order("start_at", { ascending: true })
            .limit(5);

      // 5. Fetch latest award
      const awardQuery = supabase
        .from("member_awards")
        .select("id, title, awarded_at, award_type")
        .eq("member_id", member.id)
        .eq("status", "approved")
        .order("awarded_at", { ascending: false })
        .limit(1);

      // 6. Fetch unread notifications
      const notificationsQuery = supabase
        .from("notifications")
        .select("id", { count: "exact" })
        .eq("recipient_member_id", member.id)
        .eq("is_read", false);

      // 7. Fetch pending award requests
      const pendingAwardsQuery = supabase
        .from("member_awards")
        .select("id", { count: "exact" })
        .eq("member_id", member.id)
        .eq("status", "pending");

      // Execute all queries in parallel
      const [
        companyEventsRes,
        clubEventsRes,
        postRes,
        shiftsRes,
        awardRes,
        notificationsRes,
        pendingAwardsRes,
      ] = await Promise.all([
        ...eventPromises,
        postQuery,
        shiftsQuery,
        awardQuery,
        notificationsQuery,
        pendingAwardsQuery,
      ]);

      // Process company events
      setCompanyEvents((companyEventsRes as any).data || []);
      
      // Process club events (filter out duplicates if company events overlap)
      const companyEventIds = new Set(((companyEventsRes as any).data || []).map((e: Event) => e.id));
      const filteredClubEvents = ((clubEventsRes as any).data || []).filter(
        (e: Event) => !companyEventIds.has(e.id)
      );
      setClubEvents(filteredClubEvents);

      // Process latest post
      setLatestPost((postRes as any).data?.[0] || null);

      // Process work shifts with open slots
      const shiftsWithOpenSlots = ((shiftsRes as any).data || [])
        .map((shift: any) => {
          const filledSlots = shift.work_shift_assignments?.filter(
            (a: any) => a.status === 'signed_up' || a.status === 'completed'
          ).length || 0;
          const openSlots = (shift.required_slots || 0) - filledSlots;
          return {
            id: shift.id,
            title: shift.title,
            start_at: shift.start_at,
            open_slots: Math.max(0, openSlots),
          };
        })
        .filter((shift: WorkShift) => shift.open_slots > 0)
        .slice(0, 3);
      setUpcomingShifts(shiftsWithOpenSlots);

      // Process latest award
      setLatestAward((awardRes as any).data?.[0] || null);

      // Process notifications count
      setUnreadNotifications((notificationsRes as any).count || 0);

      // Process pending awards count
      setPendingAwardRequests((pendingAwardsRes as any).count || 0);

    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Redirect admin mode users to the admin home
  if (!authLoading && uiModeLoaded && isAdminMode) {
    return <Navigate to="/portal/admin" replace />;
  }

  return (
    <PortalLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        {/* 1) Hero Section - Company Focus */}
        <CompanyHero
          companyId={companyInfo?.id || null}
          companyName={companyInfo?.name || null}
          companyLogoUrl={companyInfo?.logo_url || null}
          memberFirstName={member?.first_name || ""}
        />

        {/* 2) Upcoming Events - Company first, then Club */}
        <UpcomingEventsSection
          companyEvents={companyEvents}
          clubEvents={clubEvents}
          isLoading={isLoading}
          companyName={companyInfo?.name || null}
        />

        {/* 3) Company Updates - Latest post & work shifts */}
        <CompanyUpdatesSection
          latestPost={latestPost}
          upcomingShifts={upcomingShifts}
          isLoading={isLoading}
          companyName={companyInfo?.name || null}
        />

        {/* 4) Engagement & Recognition */}
        <EngagementSection
          latestAward={latestAward}
          workStats={workStats}
          workStatsLoading={workStatsLoading}
          currentYear={currentYear}
        />

        {/* 5) Personal Section */}
        <PersonalSection
          openShifts={workStats.upcomingShifts}
          unreadNotifications={unreadNotifications}
          pendingAwardRequests={pendingAwardRequests}
        />
      </div>
    </PortalLayout>
  );
};

export default Dashboard;
