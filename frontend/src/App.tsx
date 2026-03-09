import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider } from "@/lib/auth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Setup from "./pages/Setup";
import Install from "./pages/Install";
import PublicEvents from "./pages/PublicEvents";
import PublicNews from "./pages/PublicNews";
import PublicClubProfile from "./pages/PublicClubProfile";
import PublicCompanyProfile from "./pages/PublicCompanyProfile";
import PublicEventDetail from "./pages/PublicEventDetail";
import PublicPostDetail from "./pages/PublicPostDetail";
import PublicGallery from "./pages/PublicGallery";
import PublicJoinUs from "./pages/PublicJoinUs";
import Dashboard from "./pages/portal/Dashboard";
import AdminHome from "./pages/portal/AdminHome";
import Members from "./pages/portal/Members";
import Companies from "./pages/portal/Companies";
import CompanyProfile from "./pages/portal/CompanyProfile";
import MemberProfile from "./pages/portal/MemberProfile";
import Profile from "./pages/portal/Profile";
import Assignments from "./pages/portal/Assignments";
import Roles from "./pages/portal/Roles";
import Appointments from "./pages/portal/Appointments";
import RolePermissions from "./pages/portal/RolePermissions";
import Delegations from "./pages/portal/Delegations";
import Events from "./pages/portal/Events";
import EventOrganize from "./pages/portal/EventOrganize";
import EventApprovals from "./pages/portal/EventApprovals";
import WorkShifts from "./pages/portal/WorkShifts";
import WorkShiftsReport from "./pages/portal/WorkShiftsReport";
import YearlyReports from "./pages/portal/YearlyReports";
import WorkShiftsOverview from "./pages/portal/WorkShiftsOverview";
import Awards from "./pages/portal/Awards";
import MyAwards from "./pages/portal/MyAwards";
import AwardTypesManagement from "./pages/portal/AwardTypesManagement";
import AwardRulesManagement from "./pages/portal/AwardRulesManagement";
import AwardRequests from "./pages/portal/AwardRequests";
import Documents from "./pages/portal/Documents";
import Posts from "./pages/portal/Posts";
import PostDetail from "./pages/portal/PostDetail";
import PostApprovals from "./pages/portal/PostApprovals";
import Settings from "./pages/portal/Settings";
import NotificationSettings from "./pages/portal/NotificationSettings";
import ClubProfile from "./pages/portal/ClubProfile";
import Gallery from "./pages/portal/Gallery";
import PrivateArchive from "./pages/portal/PrivateArchive";
import SharedGallery from "./pages/portal/SharedGallery";
import PhotoManagement from "./pages/portal/PhotoManagement";
import Magazines from "./pages/portal/Magazines";
import MagazineEditor from "./pages/portal/MagazineEditor";
import MagazinePDF from "./pages/portal/MagazinePDF";
import MagazineSponsors from "./pages/portal/MagazineSponsors";
import MagazineAds from "./pages/portal/MagazineAds";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/setup" element={<Setup />} />
            <Route path="/install" element={<Install />} />
            <Route path="/termine" element={<PublicEvents />} />
            <Route path="/aktuelles" element={<PublicNews />} />
            <Route path="/verein/:slug" element={<PublicClubProfile />} />
            <Route path="/verein/:slug/kompanie/:companyId" element={<PublicCompanyProfile />} />
            <Route path="/verein/:slug/termin/:eventId" element={<PublicEventDetail />} />
            <Route path="/verein/:slug/beitrag/:postId" element={<PublicPostDetail />} />
            <Route path="/verein/:slug/termine" element={<PublicEvents />} />
            <Route path="/verein/:slug/aktuelles" element={<PublicNews />} />
            <Route path="/verein/:slug/galerie" element={<PublicGallery />} />
            <Route path="/verein/:slug/mitmachen" element={<PublicJoinUs />} />
            <Route path="/portal" element={<Dashboard />} />
            <Route path="/portal/admin" element={<AdminHome />} />
            <Route path="/portal/profile" element={<Profile />} />
            <Route path="/portal/club-profile" element={<ClubProfile />} />
            <Route path="/portal/gallery" element={<Gallery />} />
            <Route path="/portal/my-archive" element={<PrivateArchive />} />
            <Route path="/portal/shared-gallery" element={<SharedGallery />} />
            <Route path="/portal/photo-management" element={<PhotoManagement />} />
            <Route path="/portal/members" element={<Members />} />
            <Route path="/portal/member/:id" element={<MemberProfile />} />
            <Route path="/portal/companies" element={<Companies />} />
            <Route path="/portal/company/:id" element={<CompanyProfile />} />
            <Route path="/portal/assignments" element={<Assignments />} />
            <Route path="/portal/roles" element={<Roles />} />
            <Route path="/portal/appointments" element={<Appointments />} />
            <Route path="/portal/permissions" element={<RolePermissions />} />
            <Route path="/portal/delegations" element={<Delegations />} />
            <Route path="/portal/events" element={<Events />} />
            <Route path="/portal/events/:id/organize" element={<EventOrganize />} />
            <Route path="/portal/event-approvals" element={<EventApprovals />} />
            <Route path="/portal/workshifts" element={<WorkShifts />} />
            <Route path="/portal/workshifts/report" element={<WorkShiftsReport />} />
            <Route path="/portal/workshifts/overview" element={<WorkShiftsOverview />} />
            <Route path="/portal/reports/yearly" element={<YearlyReports />} />
            <Route path="/portal/awards" element={<Awards />} />
            <Route path="/portal/my-awards" element={<MyAwards />} />
            <Route path="/portal/awards/types" element={<AwardTypesManagement />} />
            <Route path="/portal/awards/rules" element={<AwardRulesManagement />} />
            <Route path="/portal/awards/requests" element={<AwardRequests />} />
            <Route path="/portal/documents" element={<Documents />} />
            <Route path="/portal/protocols" element={<Navigate to="/portal/documents?section=protocols" replace />} />
            <Route path="/portal/posts" element={<Posts />} />
            <Route path="/portal/posts/:id" element={<PostDetail />} />
            <Route path="/portal/post-approvals" element={<PostApprovals />} />
            <Route path="/portal/settings" element={<Settings />} />
            <Route path="/portal/notifications" element={<NotificationSettings />} />
            <Route path="/portal/magazine" element={<Magazines />} />
            <Route path="/portal/magazine/sponsors" element={<MagazineSponsors />} />
            <Route path="/portal/magazine/:id" element={<MagazineEditor />} />
            <Route path="/portal/magazine/:id/ads" element={<MagazineAds />} />
            <Route path="/portal/magazine/:id/pdf" element={<MagazinePDF />} />
            <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
