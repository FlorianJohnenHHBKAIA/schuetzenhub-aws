import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import PortalLayout from "@/components/portal/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { 
  ArrowLeft, 
  Download, 
  Users, 
  Building2, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  BarChart3
} from "lucide-react";

interface MemberHours {
  member_id: string;
  member_first_name: string;
  member_last_name: string;
  company_id: string | null;
  company_name: string | null;
  sum_hours: number;
  completed_count: number;
}

interface CompanyStats {
  company_id: string;
  company_name: string;
  total_hours: number;
  total_completed: number;
  total_required_slots: number;
  total_filled_slots: number;
  open_slots: number;
}

interface Company {
  id: string;
  name: string;
}

interface MemberShiftDetail {
  id: string;
  shift_title: string;
  event_title: string;
  start_at: string;
  end_at: string;
  hours: number;
  status: string;
}

const WorkShiftsReport = () => {
  const navigate = useNavigate();
  const { user, member, hasPermission, isAdmin } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [memberHours, setMemberHours] = useState<MemberHours[]>([]);
  const [companyStats, setCompanyStats] = useState<CompanyStats[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  
  // Filters
  const currentYear = new Date().getFullYear();
  const [dateFrom, setDateFrom] = useState(`${currentYear}-01-01`);
  const [dateTo, setDateTo] = useState(`${currentYear}-12-31`);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("all");
  
  // Permissions
  const [hasClubLevelAccess, setHasClubLevelAccess] = useState(false);
  const [companyPermissions, setCompanyPermissions] = useState<string[]>([]);
  
  // Member detail dialog
  const [selectedMember, setSelectedMember] = useState<MemberHours | null>(null);
  const [memberDetails, setMemberDetails] = useState<MemberShiftDetail[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);

  useEffect(() => {
    if (user && member) {
      checkPermissions();
    }
  }, [user, member]);

  useEffect(() => {
    if (member && (hasClubLevelAccess || companyPermissions.length > 0)) {
      fetchData();
    }
  }, [member, hasClubLevelAccess, companyPermissions, dateFrom, dateTo, selectedCompanyId]);

  const checkPermissions = async () => {
    if (!user || !member) return;

    const { data: permData } = await supabase.rpc('get_user_permissions', {
      _user_id: user.id,
      _club_id: member.club_id
    });

    const permissions = permData || [];
    const hasFullAdmin = permissions.some((p: any) => p.permission_key === 'club.admin.full');
    const hasClubMembers = permissions.some((p: any) => p.permission_key === 'club.members.manage');
    const hasClubEvents = permissions.some((p: any) => p.permission_key === 'club.events.manage');
    
    setHasClubLevelAccess(hasFullAdmin || hasClubMembers || hasClubEvents || isAdmin);

    const companyPerms = permissions
      .filter((p: any) => p.permission_key === 'company.workshifts.manage' && p.scope_type === 'company')
      .map((p: any) => p.scope_id);
    setCompanyPermissions(companyPerms);

    // If no club-level access but has company permissions, set first company as filter
    if (!(hasFullAdmin || hasClubMembers || hasClubEvents || isAdmin) && companyPerms.length > 0) {
      setSelectedCompanyId(companyPerms[0]);
    }
  };

  const fetchData = async () => {
    if (!member) return;
    setLoading(true);

    try {
      // Fetch companies
      const { data: companiesData } = await supabase
        .from('companies')
        .select('id, name')
        .eq('club_id', member.club_id)
        .order('name');
      setCompanies(companiesData || []);

      // Determine company filter
      const companyFilter = selectedCompanyId === "all" ? null : selectedCompanyId;

      // Fetch member hours
      const { data: hoursData, error: hoursError } = await supabase.rpc('get_work_hours', {
        _club_id: member.club_id,
        _date_from: dateFrom,
        _date_to: dateTo,
        _company_id: companyFilter
      });

      if (hoursError) {
        console.error('Error fetching hours:', hoursError);
      } else {
        // Filter by company permissions if no club-level access
        let filteredHours = hoursData || [];
        if (!hasClubLevelAccess && companyPermissions.length > 0) {
          filteredHours = filteredHours.filter((h: MemberHours) => 
            companyPermissions.includes(h.company_id || '')
          );
        }
        setMemberHours(filteredHours);
      }

      // Fetch company stats (only for club-level access)
      if (hasClubLevelAccess) {
        const { data: statsData, error: statsError } = await supabase.rpc('get_company_work_stats', {
          _club_id: member.club_id,
          _date_from: dateFrom,
          _date_to: dateTo
        });

        if (statsError) {
          console.error('Error fetching company stats:', statsError);
        } else {
          setCompanyStats(statsData || []);
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMemberDetails = async (memberData: MemberHours) => {
    if (!member) return;
    setSelectedMember(memberData);
    setDetailsLoading(true);

    try {
      const { data, error } = await supabase
        .from('work_shift_assignments')
        .select(`
          id,
          status,
          hours_override,
          work_shift:work_shifts(
            id,
            title,
            start_at,
            end_at,
            event:events(title)
          )
        `)
        .eq('member_id', memberData.member_id)
        .eq('status', 'completed')
        .gte('created_at', `${dateFrom}T00:00:00`)
        .lte('created_at', `${dateTo}T23:59:59`);

      if (error) {
        console.error('Error fetching member details:', error);
        return;
      }

      const details: MemberShiftDetail[] = (data || []).map((a: any) => {
        const shift = a.work_shift;
        const startAt = new Date(shift.start_at);
        const endAt = new Date(shift.end_at);
        const hours = a.hours_override ?? (endAt.getTime() - startAt.getTime()) / (1000 * 60 * 60);

        return {
          id: a.id,
          shift_title: shift.title,
          event_title: shift.event?.title || 'Unbekannt',
          start_at: shift.start_at,
          end_at: shift.end_at,
          hours: hours,
          status: a.status
        };
      });

      setMemberDetails(details);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setDetailsLoading(false);
    }
  };

  const exportCSV = () => {
    if (memberHours.length === 0) {
      toast({ title: "Keine Daten zum Exportieren", variant: "destructive" });
      return;
    }

    const headers = ['Vorname', 'Nachname', 'Kompanie', 'Stunden', 'Einsätze', 'Von', 'Bis'];
    const rows = memberHours.map(m => [
      m.member_first_name,
      m.member_last_name,
      m.company_name || '-',
      m.sum_hours.toFixed(2),
      m.completed_count.toString(),
      dateFrom,
      dateTo
    ]);

    const csvContent = [
      headers.join(';'),
      ...rows.map(row => row.join(';'))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `arbeitsdienst-auswertung_${dateFrom}_${dateTo}.csv`;
    link.click();

    toast({ title: "CSV exportiert" });
  };

  const totalHours = useMemo(() => 
    memberHours.reduce((sum, m) => sum + Number(m.sum_hours), 0), 
    [memberHours]
  );

  const totalCompleted = useMemo(() => 
    memberHours.reduce((sum, m) => sum + Number(m.completed_count), 0), 
    [memberHours]
  );

  if (!hasClubLevelAccess && companyPermissions.length === 0) {
    return (
      <PortalLayout>
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Keine Berechtigung für die Auswertung</p>
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/portal/workshifts')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Zurück
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <BarChart3 className="h-6 w-6" />
                Arbeitsdienst-Auswertung
              </h1>
              <p className="text-muted-foreground">Stunden und Einsätze im Überblick</p>
            </div>
          </div>
          {hasClubLevelAccess && (
            <Button variant="outline" onClick={exportCSV}>
              <Download className="h-4 w-4 mr-2" />
              CSV Export
            </Button>
          )}
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <Label className="text-xs">Von</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-40"
                />
              </div>
              <div>
                <Label className="text-xs">Bis</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-40"
                />
              </div>
              {hasClubLevelAccess && (
                <div>
                  <Label className="text-xs">Kompanie</Label>
                  <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle Kompanien</SelectItem>
                      {companies.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Stats Summary */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{memberHours.length}</p>
                  <p className="text-sm text-muted-foreground">Aktive Helfer</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalHours.toFixed(1)}</p>
                  <p className="text-sm text-muted-foreground">Stunden gesamt</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalCompleted}</p>
                  <p className="text-sm text-muted-foreground">Einsätze</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs defaultValue="members" className="space-y-4">
            <TabsList>
              <TabsTrigger value="members" className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Mitglieder
              </TabsTrigger>
              {hasClubLevelAccess && (
                <TabsTrigger value="companies" className="flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Kompanien
                </TabsTrigger>
              )}
            </TabsList>

            {/* Members Tab */}
            <TabsContent value="members">
              <Card>
                <CardHeader>
                  <CardTitle>Mitgliederübersicht</CardTitle>
                </CardHeader>
                <CardContent>
                  {memberHours.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">
                      Keine abgeschlossenen Arbeitsdienste im Zeitraum
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Mitglied</TableHead>
                          <TableHead>Kompanie</TableHead>
                          <TableHead className="text-right">Stunden</TableHead>
                          <TableHead className="text-right">Einsätze</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {memberHours.map((m) => (
                          <TableRow 
                            key={m.member_id} 
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => fetchMemberDetails(m)}
                          >
                            <TableCell className="font-medium">
                              {m.member_first_name} {m.member_last_name}
                            </TableCell>
                            <TableCell>
                              {m.company_name ? (
                                <Badge variant="outline">{m.company_name}</Badge>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {Number(m.sum_hours).toFixed(1)} h
                            </TableCell>
                            <TableCell className="text-right">
                              {m.completed_count}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm">
                                Details
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Companies Tab */}
            {hasClubLevelAccess && (
              <TabsContent value="companies">
                <Card>
                  <CardHeader>
                    <CardTitle>Kompanieübersicht</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {companyStats.length === 0 ? (
                      <p className="text-center py-8 text-muted-foreground">
                        Keine Kompanie-Daten verfügbar
                      </p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Kompanie</TableHead>
                            <TableHead className="text-right">Stunden</TableHead>
                            <TableHead className="text-right">Einsätze</TableHead>
                            <TableHead className="text-right">Plätze besetzt</TableHead>
                            <TableHead className="text-right">Offen</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {companyStats.map((c) => (
                            <TableRow key={c.company_id}>
                              <TableCell className="font-medium">{c.company_name}</TableCell>
                              <TableCell className="text-right font-mono">
                                {Number(c.total_hours).toFixed(1)} h
                              </TableCell>
                              <TableCell className="text-right">{c.total_completed}</TableCell>
                              <TableCell className="text-right">
                                {c.total_filled_slots}/{c.total_required_slots}
                              </TableCell>
                              <TableCell className="text-right">
                                {Number(c.open_slots) > 0 ? (
                                  <Badge variant="secondary">{c.open_slots} offen</Badge>
                                ) : (
                                  <Badge variant="default">Alle besetzt</Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </Tabs>
        )}
      </div>

      {/* Member Detail Dialog */}
      <Dialog open={!!selectedMember} onOpenChange={() => setSelectedMember(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Einsätze von {selectedMember?.member_first_name} {selectedMember?.member_last_name}
            </DialogTitle>
          </DialogHeader>
          {detailsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : memberDetails.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">Keine Einsätze gefunden</p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {memberDetails.map((d) => (
                <div key={d.id} className="p-3 border rounded-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">{d.shift_title}</p>
                      <p className="text-sm text-muted-foreground">{d.event_title}</p>
                    </div>
                    <Badge variant="outline">{d.hours.toFixed(1)} h</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {format(new Date(d.start_at), "dd.MM.yyyy HH:mm", { locale: de })} - 
                    {format(new Date(d.end_at), "HH:mm", { locale: de })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
};

export default WorkShiftsReport;