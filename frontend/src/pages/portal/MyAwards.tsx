import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useWorkShiftStats } from "@/hooks/useWorkShiftStats";
import PortalLayout from "@/components/portal/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { 
  Award, 
  Clock, 
  CheckCircle, 
  Calendar, 
  Sparkles, 
  Plus,
  Medal,
  Trophy,
  Star,
  Crown,
  Heart,
  Shield,
  Gem,
  ScrollText,
  TrendingUp
} from "lucide-react";
import AwardRequestDialog from "@/components/portal/AwardRequestDialog";
import { getAwardTypeConfig } from "@/components/portal/AwardDialog";

interface MemberAward {
  id: string;
  title: string;
  description: string | null;
  awarded_at: string;
  award_type: string;
  status: string;
}

export default function MyAwards() {
  const { member } = useAuth();
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("auszeichnungen");

  const memberId = member?.id;
  const clubId = member?.club_id;

  // Fetch member's awards
  const { data: awards, isLoading: awardsLoading, refetch: refetchAwards } = useQuery({
    queryKey: ["my-awards", memberId],
    queryFn: async () => {
      if (!memberId) return [];
      const { data, error } = await supabase
        .from("member_awards")
        .select("*")
        .eq("member_id", memberId)
        .order("awarded_at", { ascending: false });
      
      if (error) throw error;
      return data as MemberAward[];
    },
    enabled: !!memberId,
  });

  // Work shift stats
  const { stats: workStats, loading: workStatsLoading } = useWorkShiftStats(memberId || null, selectedYear);

  // Filter approved awards
  const approvedAwards = awards?.filter(a => a.status === "approved") || [];
  const pendingAwards = awards?.filter(a => a.status === "pending") || [];

  // Group awards by year
  const awardsByYear = approvedAwards.reduce((acc, award) => {
    const year = new Date(award.awarded_at).getFullYear();
    if (!acc[year]) acc[year] = [];
    acc[year].push(award);
    return acc;
  }, {} as Record<number, MemberAward[]>);

  const sortedYears = Object.keys(awardsByYear).map(Number).sort((a, b) => b - a);

  // Available years for engagement filter
  const engagementYears = [...Array(5)].map((_, i) => new Date().getFullYear() - i);

  return (
    <PortalLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl font-bold flex items-center gap-3">
                <Sparkles className="w-8 h-8 text-primary" />
                Meine Auszeichnungen
              </h1>
              <p className="text-muted-foreground mt-1">
                Deine Ehrungen und dein Engagement für den Verein
              </p>
            </div>
            <Button onClick={() => setIsRequestDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Auszeichnung beantragen
            </Button>
          </div>
        </motion.div>

        {/* Quick Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <Award className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{approvedAwards.length}</p>
                  <p className="text-sm text-muted-foreground">Auszeichnungen</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{workStatsLoading ? "..." : workStats.totalHours}</p>
                  <p className="text-sm text-muted-foreground">Stunden {selectedYear}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{workStatsLoading ? "..." : workStats.completedShifts}</p>
                  <p className="text-sm text-muted-foreground">Einsätze</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {workStats.totalHours >= 10 ? (
            <Card className="border-green-500/50 bg-gradient-to-br from-green-500/10 to-green-500/5">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-green-600">Soll erfüllt!</p>
                    <p className="text-sm text-muted-foreground">≥ 10 Stunden</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{workStatsLoading ? "..." : workStats.upcomingShifts}</p>
                    <p className="text-sm text-muted-foreground">Geplante Einsätze</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="auszeichnungen" className="flex items-center gap-2">
                <Award className="w-4 h-4" />
                Auszeichnungen
              </TabsTrigger>
              <TabsTrigger value="engagement" className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Engagement
              </TabsTrigger>
              <TabsTrigger value="antraege" className="flex items-center gap-2">
                <ScrollText className="w-4 h-4" />
                Anträge
                {pendingAwards.length > 0 && (
                  <Badge variant="secondary" className="ml-1">{pendingAwards.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Auszeichnungen Tab */}
            <TabsContent value="auszeichnungen" className="space-y-6">
              {awardsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
                </div>
              ) : approvedAwards.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Award className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
                    <h3 className="font-semibold text-lg mb-2">Noch keine Auszeichnungen</h3>
                    <p className="text-muted-foreground mb-6">
                      Beantrage deine erste Auszeichnung und werde Teil der Vereinsgeschichte.
                    </p>
                    <Button onClick={() => setIsRequestDialogOpen(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Auszeichnung beantragen
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-8">
                  {sortedYears.map(year => (
                    <div key={year}>
                      <div className="flex items-center gap-3 mb-4">
                        <h2 className="font-display text-xl font-semibold">{year}</h2>
                        <Badge variant="secondary">
                          {awardsByYear[year].length} Ehrung{awardsByYear[year].length !== 1 ? "en" : ""}
                        </Badge>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        {awardsByYear[year].map(award => {
                          const typeConfig = getAwardTypeConfig(award.award_type);
                          const AwardIcon = typeConfig.icon;

                          return (
                            <Card key={award.id} className="hover:bg-accent/30 transition-colors">
                              <CardContent className="pt-6">
                                <div className="flex items-start gap-4">
                                  <div className={`p-3 rounded-full ${typeConfig.bgColor}`}>
                                    <AwardIcon className={`w-6 h-6 ${typeConfig.color}`} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold">{award.title}</h3>
                                    {award.description && (
                                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                                        {award.description}
                                      </p>
                                    )}
                                    <p className="text-xs text-muted-foreground mt-2">
                                      {format(new Date(award.awarded_at), "dd. MMMM yyyy", { locale: de })}
                                    </p>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Engagement Tab */}
            <TabsContent value="engagement" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Heart className="w-5 h-5 text-primary" />
                        Dein Engagement für den Verein
                      </CardTitle>
                      <CardDescription>
                        Jede Stunde zählt – danke für deinen Einsatz!
                      </CardDescription>
                    </div>
                    <Select 
                      value={selectedYear.toString()} 
                      onValueChange={(v) => setSelectedYear(parseInt(v))}
                    >
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {engagementYears.map(year => (
                          <SelectItem key={year} value={year.toString()}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                      <div className="flex items-center gap-3">
                        <Clock className="w-8 h-8 text-primary" />
                        <div>
                          <p className="text-3xl font-bold">{workStatsLoading ? "..." : workStats.totalHours}</p>
                          <p className="text-sm text-muted-foreground">Stunden geleistet</p>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-lg bg-green-500/5 border border-green-500/20">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-8 h-8 text-green-500" />
                        <div>
                          <p className="text-3xl font-bold">{workStatsLoading ? "..." : workStats.completedShifts}</p>
                          <p className="text-sm text-muted-foreground">Einsätze abgeschlossen</p>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-lg bg-blue-500/5 border border-blue-500/20">
                      <div className="flex items-center gap-3">
                        <Calendar className="w-8 h-8 text-blue-500" />
                        <div>
                          <p className="text-3xl font-bold">{workStatsLoading ? "..." : workStats.upcomingShifts}</p>
                          <p className="text-sm text-muted-foreground">Geplante Einsätze</p>
                        </div>
                      </div>
                    </div>

                    {workStats.totalHours >= 10 && (
                      <div className="p-4 rounded-lg bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/30">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                            <TrendingUp className="w-6 h-6 text-green-600" />
                          </div>
                          <div>
                            <p className="font-semibold text-green-600">Soll erfüllt!</p>
                            <p className="text-sm text-muted-foreground">Mindestens 10 Stunden</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-6 pt-6 border-t">
                    <Link to="/portal/workshifts">
                      <Button variant="outline" className="w-full sm:w-auto">
                        Alle Arbeitsdienste anzeigen
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Anträge Tab */}
            <TabsContent value="antraege" className="space-y-6">
              {pendingAwards.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <ScrollText className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
                    <h3 className="font-semibold text-lg mb-2">Keine offenen Anträge</h3>
                    <p className="text-muted-foreground mb-6">
                      Du hast aktuell keine laufenden Anträge.
                    </p>
                    <Button onClick={() => setIsRequestDialogOpen(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Auszeichnung beantragen
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {pendingAwards.map(award => {
                    const typeConfig = getAwardTypeConfig(award.award_type);
                    const AwardIcon = typeConfig.icon;

                    return (
                      <Card key={award.id} className="border-amber-500/30 bg-amber-500/5">
                        <CardContent className="pt-6">
                          <div className="flex items-start gap-4">
                            <div className={`p-3 rounded-full ${typeConfig.bgColor}`}>
                              <AwardIcon className={`w-6 h-6 ${typeConfig.color}`} />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold">{award.title}</h3>
                                <Badge variant="secondary" className="bg-amber-500/20 text-amber-700">
                                  In Prüfung
                                </Badge>
                              </div>
                              {award.description && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  {award.description}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground mt-2">
                                Beantragt am {format(new Date(award.awarded_at), "dd. MMMM yyyy", { locale: de })}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>

      {/* Award Request Dialog */}
      {member && clubId && (
        <AwardRequestDialog
          open={isRequestDialogOpen}
          onOpenChange={setIsRequestDialogOpen}
          memberId={member.id}
          clubId={clubId}
          onSuccess={refetchAwards}
        />
      )}
    </PortalLayout>
  );
}
