import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import PortalLayout from "@/components/portal/PortalLayout";
import { useAuth } from "@/lib/auth";
import { supabase, getStorageUrl } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  Calendar,
  ClipboardList,
  Newspaper,
  Award,
  Download,
  FileText,
  Image,
  MessageSquare,
  UserPlus,
  UserMinus,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Building2,
  ArrowLeft,
  FileDown,
  BarChart3,
} from "lucide-react";

interface YearlyStats {
  members: {
    total: number;
    active: number;
    newEntries: number;
    exits: number;
    byCompany: { name: string; count: number }[];
  };
  events: {
    total: number;
    public: number;
    internal: number;
    companyOnly: number;
  };
  workShifts: {
    totalShifts: number;
    requiredSlots: number;
    completedAssignments: number;
    noShows: number;
    totalHours: number;
  };
  content: {
    posts: number;
    comments: number;
    documents: number;
    galleryImages: number;
  };
  awards: {
    given: number;
    pending: number;
    rejected: number;
    byType: { name: string; count: number }[];
  };
}

interface ClubInfo {
  name: string;
  logo_path: string | null;
}

const YearlyReports = () => {
  const navigate = useNavigate();
  const { member, hasPermission, isAdmin } = useAuth();
  const { toast } = useToast();
  
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<YearlyStats | null>(null);
  const [clubInfo, setClubInfo] = useState<ClubInfo | null>(null);
  const [clubLogoUrl, setClubLogoUrl] = useState<string | null>(null);

  // Available years (current year back to 5 years ago)
  const availableYears = useMemo(() => {
    const years = [];
    for (let y = currentYear; y >= currentYear - 5; y--) {
      years.push(y);
    }
    return years;
  }, [currentYear]);

  // Check permissions
  const hasAccess = isAdmin || hasPermission("club.admin.full");

  useEffect(() => {
    if (member && hasAccess) {
      fetchClubInfo();
      fetchStats();
    }
  }, [member, hasAccess, selectedYear]);

  const fetchClubInfo = async () => {
    if (!member) return;
    
    const { data: club } = await supabase
      .from("clubs")
      .select("name, logo_path")
      .eq("id", member.club_id)
      .single();
    
    if (club) {
      setClubInfo(club);
      if (club.logo_path) {
        const { data: urlData } = { data: { publicUrl: getStorageUrl("club-assets", club.logo_path) || "" } };
        setClubLogoUrl(urlData?.publicUrl || null);
      }
    }
  };

  const fetchStats = async () => {
    if (!member) return;
    setLoading(true);

    const yearStart = `${selectedYear}-01-01`;
    const yearEnd = `${selectedYear}-12-31`;
    const yearStartTs = `${selectedYear}-01-01T00:00:00`;
    const yearEndTs = `${selectedYear}-12-31T23:59:59`;

    try {
      // Fetch member stats
      const { count: totalMembers } = await supabase
        .from("members")
        .select("*", { count: "exact", head: true })
        .eq("club_id", member.club_id);

      const { count: activeMembers } = await supabase
        .from("members")
        .select("*", { count: "exact", head: true })
        .eq("club_id", member.club_id)
        .eq("status", "active");

      // New entries this year (members created in selected year)
      const { count: newEntries } = await supabase
        .from("members")
        .select("*", { count: "exact", head: true })
        .eq("club_id", member.club_id)
        .gte("created_at", yearStartTs)
        .lte("created_at", yearEndTs);

      // Members by company
      const { data: companiesData } = await supabase
        .from("companies")
        .select("id, name")
        .eq("club_id", member.club_id);

      const membersByCompany: { name: string; count: number }[] = [];
      if (companiesData) {
        for (const company of companiesData) {
          const { count } = await supabase
            .from("member_company_memberships")
            .select("*", { count: "exact", head: true })
            .eq("company_id", company.id)
            .is("valid_to", null);
          membersByCompany.push({ name: company.name, count: count || 0 });
        }
      }

      // Events stats
      const { count: totalEvents } = await supabase
        .from("events")
        .select("*", { count: "exact", head: true })
        .eq("club_id", member.club_id)
        .gte("start_at", yearStartTs)
        .lte("start_at", yearEndTs);

      const { count: publicEvents } = await supabase
        .from("events")
        .select("*", { count: "exact", head: true })
        .eq("club_id", member.club_id)
        .eq("audience", "public")
        .eq("publication_status", "approved")
        .gte("start_at", yearStartTs)
        .lte("start_at", yearEndTs);

      const { count: internalEvents } = await supabase
        .from("events")
        .select("*", { count: "exact", head: true })
        .eq("club_id", member.club_id)
        .eq("audience", "club_internal")
        .gte("start_at", yearStartTs)
        .lte("start_at", yearEndTs);

      const { count: companyOnlyEvents } = await supabase
        .from("events")
        .select("*", { count: "exact", head: true })
        .eq("club_id", member.club_id)
        .eq("audience", "company_only")
        .gte("start_at", yearStartTs)
        .lte("start_at", yearEndTs);

      // Work shifts stats
      const { data: workShifts } = await supabase
        .from("work_shifts")
        .select("id, required_slots, start_at, end_at")
        .eq("club_id", member.club_id)
        .gte("start_at", yearStartTs)
        .lte("start_at", yearEndTs);

      const totalShifts = workShifts?.length || 0;
      const requiredSlots = workShifts?.reduce((sum, s) => sum + (s.required_slots || 0), 0) || 0;

      // Work shift assignments
      const { data: assignments } = await supabase
        .from("work_shift_assignments")
        .select("id, status, hours_override, work_shift_id")
        .eq("club_id", member.club_id);

      // Filter assignments for shifts in this year
      const shiftIds = workShifts?.map(s => s.id) || [];
      const yearAssignments = assignments?.filter(a => shiftIds.includes(a.work_shift_id)) || [];
      
      const completedAssignments = yearAssignments.filter(a => a.status === "completed").length;
      const noShows = yearAssignments.filter(a => a.status === "no_show").length;

      // Calculate total hours
      let totalHours = 0;
      if (workShifts && assignments) {
        const shiftMap = new Map(workShifts.map(s => [s.id, s]));
        for (const a of yearAssignments.filter(a => a.status === "completed")) {
          const shift = shiftMap.get(a.work_shift_id);
          if (shift) {
            if (a.hours_override) {
              totalHours += a.hours_override;
            } else {
              const start = new Date(shift.start_at);
              const end = new Date(shift.end_at);
              totalHours += (end.getTime() - start.getTime()) / (1000 * 60 * 60);
            }
          }
        }
      }

      // Content stats
      const { count: postsCount } = await supabase
        .from("posts")
        .select("*", { count: "exact", head: true })
        .eq("club_id", member.club_id)
        .eq("publication_status", "approved")
        .gte("created_at", yearStartTs)
        .lte("created_at", yearEndTs);

      const { count: commentsCount } = await supabase
        .from("post_comments")
        .select("*", { count: "exact", head: true })
        .eq("club_id", member.club_id)
        .gte("created_at", yearStartTs)
        .lte("created_at", yearEndTs);

      const { count: documentsCount } = await supabase
        .from("documents")
        .select("*", { count: "exact", head: true })
        .eq("club_id", member.club_id)
        .gte("created_at", yearStartTs)
        .lte("created_at", yearEndTs);

      const { count: galleryCount } = await supabase
        .from("gallery_images")
        .select("*", { count: "exact", head: true })
        .eq("club_id", member.club_id)
        .gte("created_at", yearStartTs)
        .lte("created_at", yearEndTs);

      // Awards stats
      const { count: awardGiven } = await supabase
        .from("member_awards")
        .select("*", { count: "exact", head: true })
        .eq("club_id", member.club_id)
        .eq("status", "approved")
        .gte("awarded_at", yearStart)
        .lte("awarded_at", yearEnd);

      const { count: awardPending } = await supabase
        .from("member_awards")
        .select("*", { count: "exact", head: true })
        .eq("club_id", member.club_id)
        .eq("status", "pending");

      const { count: awardRejected } = await supabase
        .from("member_awards")
        .select("*", { count: "exact", head: true })
        .eq("club_id", member.club_id)
        .eq("status", "rejected")
        .gte("created_at", yearStartTs)
        .lte("created_at", yearEndTs);

      // Awards by type
      const { data: awardsByType } = await supabase
        .from("member_awards")
        .select("award_type")
        .eq("club_id", member.club_id)
        .eq("status", "approved")
        .gte("awarded_at", yearStart)
        .lte("awarded_at", yearEnd);

      const awardTypeCounts = new Map<string, number>();
      awardsByType?.forEach(a => {
        const type = a.award_type || "Sonstige";
        awardTypeCounts.set(type, (awardTypeCounts.get(type) || 0) + 1);
      });

      setStats({
        members: {
          total: totalMembers || 0,
          active: activeMembers || 0,
          newEntries: newEntries || 0,
          exits: 0, // Would need exit date tracking
          byCompany: membersByCompany.sort((a, b) => b.count - a.count),
        },
        events: {
          total: totalEvents || 0,
          public: publicEvents || 0,
          internal: internalEvents || 0,
          companyOnly: companyOnlyEvents || 0,
        },
        workShifts: {
          totalShifts,
          requiredSlots,
          completedAssignments,
          noShows,
          totalHours: Math.round(totalHours * 10) / 10,
        },
        content: {
          posts: postsCount || 0,
          comments: commentsCount || 0,
          documents: documentsCount || 0,
          galleryImages: galleryCount || 0,
        },
        awards: {
          given: awardGiven || 0,
          pending: awardPending || 0,
          rejected: awardRejected || 0,
          byType: Array.from(awardTypeCounts.entries())
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count),
        },
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
      toast({ title: "Fehler beim Laden der Statistiken", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Export functions
  const exportMembersCSV = () => {
    if (!stats) return;
    
    const headers = ["Kategorie", "Anzahl"];
    const rows = [
      ["Mitglieder gesamt", stats.members.total.toString()],
      ["Aktive Mitglieder", stats.members.active.toString()],
      ["Neue Eintritte " + selectedYear, stats.members.newEntries.toString()],
      ["", ""],
      ["Kompanie", "Mitglieder"],
      ...stats.members.byCompany.map(c => [c.name, c.count.toString()]),
    ];

    downloadCSV(headers, rows, `mitglieder-${selectedYear}.csv`);
  };

  const exportEventsCSV = () => {
    if (!stats) return;
    
    const headers = ["Kategorie", "Anzahl"];
    const rows = [
      ["Veranstaltungen gesamt", stats.events.total.toString()],
      ["Öffentliche Events", stats.events.public.toString()],
      ["Vereinsinterne Events", stats.events.internal.toString()],
      ["Kompanie-Events", stats.events.companyOnly.toString()],
    ];

    downloadCSV(headers, rows, `termine-${selectedYear}.csv`);
  };

  const exportWorkShiftsCSV = () => {
    if (!stats) return;
    
    const headers = ["Kategorie", "Wert"];
    const rows = [
      ["Arbeitsdienst-Schichten", stats.workShifts.totalShifts.toString()],
      ["Benötigte Helfer (Slots)", stats.workShifts.requiredSlots.toString()],
      ["Geleistete Einsätze", stats.workShifts.completedAssignments.toString()],
      ["No-Shows", stats.workShifts.noShows.toString()],
      ["Geleistete Stunden", stats.workShifts.totalHours.toString()],
    ];

    downloadCSV(headers, rows, `arbeitsdienste-${selectedYear}.csv`);
  };

  const downloadCSV = (headers: string[], rows: string[][], filename: string) => {
    const csvContent = [
      headers.join(";"),
      ...rows.map(row => row.join(";")),
    ].join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();

    toast({ title: "CSV exportiert" });
  };

  const exportPDF = () => {
    if (!stats || !clubInfo) return;

    // Create a printable HTML document
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Jahresbericht ${selectedYear} - ${clubInfo.name}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
          h1 { color: #1a1a1a; border-bottom: 2px solid #333; padding-bottom: 10px; }
          h2 { color: #333; margin-top: 30px; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
          .header { display: flex; align-items: center; gap: 20px; margin-bottom: 30px; }
          .logo { width: 60px; height: 60px; object-fit: contain; }
          .stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin: 15px 0; }
          .stat-item { background: #f5f5f5; padding: 15px; border-radius: 8px; }
          .stat-value { font-size: 24px; font-weight: bold; color: #333; }
          .stat-label { color: #666; font-size: 14px; }
          table { width: 100%; border-collapse: collapse; margin: 15px 0; }
          th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #ddd; }
          th { background: #f5f5f5; font-weight: 600; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; text-align: center; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <div class="header">
          ${clubLogoUrl ? `<img src="${clubLogoUrl}" class="logo" alt="Logo">` : ""}
          <div>
            <h1 style="margin: 0; border: none; padding: 0;">Jahresbericht ${selectedYear}</h1>
            <p style="margin: 5px 0; color: #666;">${clubInfo.name}</p>
          </div>
        </div>

        <h2>Mitglieder</h2>
        <div class="stats-grid">
          <div class="stat-item"><div class="stat-value">${stats.members.total}</div><div class="stat-label">Mitglieder gesamt</div></div>
          <div class="stat-item"><div class="stat-value">${stats.members.active}</div><div class="stat-label">Aktive Mitglieder</div></div>
          <div class="stat-item"><div class="stat-value">${stats.members.newEntries}</div><div class="stat-label">Neue Eintritte</div></div>
        </div>
        ${stats.members.byCompany.length > 0 ? `
        <table>
          <thead><tr><th>Kompanie</th><th>Mitglieder</th></tr></thead>
          <tbody>${stats.members.byCompany.map(c => `<tr><td>${c.name}</td><td>${c.count}</td></tr>`).join("")}</tbody>
        </table>` : ""}

        <h2>Termine & Veranstaltungen</h2>
        <div class="stats-grid">
          <div class="stat-item"><div class="stat-value">${stats.events.total}</div><div class="stat-label">Veranstaltungen gesamt</div></div>
          <div class="stat-item"><div class="stat-value">${stats.events.public}</div><div class="stat-label">Öffentliche Events</div></div>
          <div class="stat-item"><div class="stat-value">${stats.events.internal}</div><div class="stat-label">Vereinsinterne Events</div></div>
          <div class="stat-item"><div class="stat-value">${stats.events.companyOnly}</div><div class="stat-label">Kompanie-Events</div></div>
        </div>

        <h2>Arbeitsdienste</h2>
        <div class="stats-grid">
          <div class="stat-item"><div class="stat-value">${stats.workShifts.totalShifts}</div><div class="stat-label">Schichten</div></div>
          <div class="stat-item"><div class="stat-value">${stats.workShifts.requiredSlots}</div><div class="stat-label">Benötigte Helfer</div></div>
          <div class="stat-item"><div class="stat-value">${stats.workShifts.completedAssignments}</div><div class="stat-label">Geleistete Einsätze</div></div>
          <div class="stat-item"><div class="stat-value">${stats.workShifts.totalHours}h</div><div class="stat-label">Geleistete Stunden</div></div>
        </div>

        <h2>Inhalte & Aktivität</h2>
        <div class="stats-grid">
          <div class="stat-item"><div class="stat-value">${stats.content.posts}</div><div class="stat-label">Veröffentlichte Beiträge</div></div>
          <div class="stat-item"><div class="stat-value">${stats.content.comments}</div><div class="stat-label">Kommentare</div></div>
          <div class="stat-item"><div class="stat-value">${stats.content.documents}</div><div class="stat-label">Dokumente</div></div>
          <div class="stat-item"><div class="stat-value">${stats.content.galleryImages}</div><div class="stat-label">Galerie-Bilder</div></div>
        </div>

        <h2>Auszeichnungen</h2>
        <div class="stats-grid">
          <div class="stat-item"><div class="stat-value">${stats.awards.given}</div><div class="stat-label">Vergebene Auszeichnungen</div></div>
          <div class="stat-item"><div class="stat-value">${stats.awards.pending}</div><div class="stat-label">Offene Anträge</div></div>
        </div>
        ${stats.awards.byType.length > 0 ? `
        <table>
          <thead><tr><th>Auszeichnungstyp</th><th>Anzahl</th></tr></thead>
          <tbody>${stats.awards.byType.map(t => `<tr><td>${t.name}</td><td>${t.count}</td></tr>`).join("")}</tbody>
        </table>` : ""}

        <div class="footer">
          <p>Erstellt am ${new Date().toLocaleDateString("de-DE")} • ${clubInfo.name} • Jahresbericht ${selectedYear}</p>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    }

    toast({ title: "PDF wird erstellt" });
  };

  if (!hasAccess) {
    return (
      <PortalLayout>
        <div className="text-center py-12">
          <BarChart3 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Keine Berechtigung für Jahresauswertungen</p>
        </div>
      </PortalLayout>
    );
  }

  const StatCard = ({ 
    title, 
    value, 
    icon: Icon, 
    description 
  }: { 
    title: string; 
    value: number | string; 
    icon: React.ElementType; 
    description?: string;
  }) => (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
          </div>
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="w-5 h-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <PortalLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/portal/admin")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Zurück
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <BarChart3 className="h-6 w-6" />
                Jahresübersicht
              </h1>
              <p className="text-muted-foreground">Auswertungen und Berichte</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Select
              value={selectedYear.toString()}
              onValueChange={(v) => setSelectedYear(parseInt(v))}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button onClick={exportPDF} className="gap-2">
              <FileDown className="h-4 w-4" />
              <span className="hidden sm:inline">Jahresbericht PDF</span>
              <span className="sm:hidden">PDF</span>
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="grid gap-6">
            {[1, 2, 3, 4, 5].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-40" />
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map((j) => (
                      <Skeleton key={j} className="h-20" />
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : stats ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Members Section */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Mitglieder
                  </CardTitle>
                  <CardDescription>Mitgliederstatistik {selectedYear}</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={exportMembersCSV}>
                  <Download className="h-4 w-4 mr-2" />
                  CSV
                </Button>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard title="Gesamt" value={stats.members.total} icon={Users} />
                  <StatCard title="Aktiv" value={stats.members.active} icon={CheckCircle2} />
                  <StatCard title="Neue Eintritte" value={stats.members.newEntries} icon={UserPlus} />
                  <StatCard title="Austritte" value={stats.members.exits} icon={UserMinus} />
                </div>
                {stats.members.byCompany.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-sm font-medium mb-3 flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Mitglieder pro Kompanie
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {stats.members.byCompany.map((c) => (
                        <div key={c.name} className="bg-muted/50 rounded-lg px-3 py-2">
                          <p className="text-sm font-medium truncate">{c.name}</p>
                          <p className="text-lg font-bold">{c.count}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Events Section */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Termine & Veranstaltungen
                  </CardTitle>
                  <CardDescription>Übersicht aller Events in {selectedYear}</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={exportEventsCSV}>
                  <Download className="h-4 w-4 mr-2" />
                  CSV
                </Button>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard title="Gesamt" value={stats.events.total} icon={Calendar} />
                  <StatCard title="Öffentlich" value={stats.events.public} icon={TrendingUp} />
                  <StatCard title="Vereinsintern" value={stats.events.internal} icon={Users} />
                  <StatCard title="Kompanie-Events" value={stats.events.companyOnly} icon={Building2} />
                </div>
              </CardContent>
            </Card>

            {/* Work Shifts Section */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <ClipboardList className="h-5 w-5" />
                    Arbeitsdienste
                  </CardTitle>
                  <CardDescription>Helfereinsätze und Stunden in {selectedYear}</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={exportWorkShiftsCSV}>
                  <Download className="h-4 w-4 mr-2" />
                  CSV
                </Button>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <StatCard title="Schichten" value={stats.workShifts.totalShifts} icon={ClipboardList} />
                  <StatCard title="Benötigte Helfer" value={stats.workShifts.requiredSlots} icon={Users} />
                  <StatCard title="Geleistete Einsätze" value={stats.workShifts.completedAssignments} icon={CheckCircle2} />
                  <StatCard title="No-Shows" value={stats.workShifts.noShows} icon={XCircle} />
                  <StatCard title="Stunden gesamt" value={`${stats.workShifts.totalHours}h`} icon={TrendingUp} />
                </div>
              </CardContent>
            </Card>

            {/* Content Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Newspaper className="h-5 w-5" />
                  Inhalte & Aktivität
                </CardTitle>
                <CardDescription>Beiträge, Kommentare und Uploads in {selectedYear}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard title="Beiträge" value={stats.content.posts} icon={Newspaper} />
                  <StatCard title="Kommentare" value={stats.content.comments} icon={MessageSquare} />
                  <StatCard title="Dokumente" value={stats.content.documents} icon={FileText} />
                  <StatCard title="Galerie-Bilder" value={stats.content.galleryImages} icon={Image} />
                </div>
              </CardContent>
            </Card>

            {/* Awards Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  Auszeichnungen
                </CardTitle>
                <CardDescription>Vergebene Auszeichnungen und Anträge in {selectedYear}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <StatCard title="Vergeben" value={stats.awards.given} icon={Award} />
                  <StatCard title="Offene Anträge" value={stats.awards.pending} icon={ClipboardList} />
                  <StatCard title="Abgelehnt" value={stats.awards.rejected} icon={XCircle} />
                </div>
                {stats.awards.byType.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-sm font-medium mb-3">Beliebteste Auszeichnungstypen</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {stats.awards.byType.slice(0, 6).map((t) => (
                        <div key={t.name} className="bg-muted/50 rounded-lg px-3 py-2">
                          <p className="text-sm font-medium truncate">{t.name}</p>
                          <p className="text-lg font-bold">{t.count}×</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ) : null}
      </div>
    </PortalLayout>
  );
};

export default YearlyReports;
