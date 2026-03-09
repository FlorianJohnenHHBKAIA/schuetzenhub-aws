import { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import PortalLayout from "@/components/portal/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Calendar, Users, Clock, Plus, ChevronRight, ArrowLeft, BarChart3, CheckCircle2, XCircle, AlertTriangle, CheckCheck, Settings } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import EventContextBanner from "@/components/portal/EventContextBanner";

interface Event {
  id: string;
  title: string;
  start_at: string;
  end_at: string | null;
  owner_type: 'club' | 'company';
  owner_id: string;
  club_id: string;
}

interface WorkShift {
  id: string;
  event_id: string;
  title: string;
  start_at: string;
  end_at: string;
  required_slots: number;
  owner_type: 'club' | 'company';
  owner_id: string;
  club_id: string;
}

interface WorkShiftAssignment {
  id: string;
  work_shift_id: string;
  member_id: string;
  status: 'signed_up' | 'cancelled' | 'completed' | 'no_show';
  hours_override?: number | null;
  member?: {
    id: string;
    first_name: string;
    last_name: string;
  };
}

interface Company {
  id: string;
  name: string;
}

interface EventWithShiftCount extends Event {
  shiftCount: number;
  openSlots: number;
  totalSlots: number;
}

const WorkShifts = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<EventWithShiftCount[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [shifts, setShifts] = useState<WorkShift[]>([]);
  const [assignments, setAssignments] = useState<WorkShiftAssignment[]>([]);
  const [currentMemberId, setCurrentMemberId] = useState<string | null>(null);
  const [clubId, setClubId] = useState<string | null>(null);
  
  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<WorkShift | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formStartAt, setFormStartAt] = useState("");
  const [formEndAt, setFormEndAt] = useState("");
  const [formRequiredSlots, setFormRequiredSlots] = useState(1);
  const [formOwnerType, setFormOwnerType] = useState<'club' | 'company'>('club');
  const [formOwnerId, setFormOwnerId] = useState("");
  
  // Permissions
  const [canManageClubShifts, setCanManageClubShifts] = useState(false);
  const [companyPermissions, setCompanyPermissions] = useState<string[]>([]);

  // Handle URL parameter for direct event access
  const eventIdFromUrl = searchParams.get('event');

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Get current member
      const { data: memberData } = await supabase
        .from('members')
        .select('id, club_id')
        .eq('user_id', user.id)
        .single();

      if (!memberData) {
        setLoading(false);
        return;
      }

      setCurrentMemberId(memberData.id);
      setClubId(memberData.club_id);

      // Fetch companies
      const { data: companiesData } = await supabase
        .from('companies')
        .select('id, name')
        .eq('club_id', memberData.club_id);
      setCompanies(companiesData || []);

      // Check permissions
      const { data: permData } = await supabase.rpc('get_user_permissions', {
        _user_id: user.id,
        _club_id: memberData.club_id
      });

      const permissions = permData || [];
      const hasClubAdmin = permissions.some((p: any) => p.permission_key === 'club.admin.full');
      const hasClubEvents = permissions.some((p: any) => p.permission_key === 'club.events.manage');
      setCanManageClubShifts(hasClubAdmin || hasClubEvents);

      const companyPerms = permissions
        .filter((p: any) => p.permission_key === 'company.workshifts.manage' && p.scope_type === 'company')
        .map((p: any) => p.scope_id);
      setCompanyPermissions(companyPerms);

      // Fetch events with shift counts
      const { data: eventsData } = await supabase
        .from('events')
        .select('id, title, start_at, end_at, owner_type, owner_id, club_id')
        .eq('club_id', memberData.club_id)
        .gte('start_at', new Date().toISOString())
        .order('start_at', { ascending: true });

      if (eventsData) {
        // Fetch all shifts for these events
        const eventIds = eventsData.map(e => e.id);
        const { data: shiftsData } = await supabase
          .from('work_shifts')
          .select('id, event_id, required_slots')
          .in('event_id', eventIds);

        // Fetch all assignments for these shifts
        const shiftIds = (shiftsData || []).map(s => s.id);
        const { data: assignmentsData } = await supabase
          .from('work_shift_assignments')
          .select('work_shift_id, status')
          .in('work_shift_id', shiftIds)
          .eq('status', 'signed_up');

        // Calculate counts
        const eventsWithCounts = eventsData.map(event => {
          const eventShifts = (shiftsData || []).filter(s => s.event_id === event.id);
          const totalSlots = eventShifts.reduce((sum, s) => sum + s.required_slots, 0);
          const filledSlots = eventShifts.reduce((sum, s) => {
            const shiftAssignments = (assignmentsData || []).filter(a => a.work_shift_id === s.id);
            return sum + shiftAssignments.length;
          }, 0);
          
          return {
            ...event,
            shiftCount: eventShifts.length,
            totalSlots,
            openSlots: totalSlots - filledSlots
          } as EventWithShiftCount;
        });

        setEvents(eventsWithCounts);

        // Auto-select event from URL parameter
        if (eventIdFromUrl) {
          const eventFromUrl = eventsWithCounts.find(e => e.id === eventIdFromUrl);
          if (eventFromUrl) {
            fetchEventShifts(eventFromUrl);
          }
          setSearchParams({});
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEventShifts = async (event: Event) => {
    setSelectedEvent(event);
    
    const { data: shiftsData } = await supabase
      .from('work_shifts')
      .select('*')
      .eq('event_id', event.id)
      .order('start_at', { ascending: true });

    setShifts(shiftsData || []);

    if (shiftsData && shiftsData.length > 0) {
      const shiftIds = shiftsData.map(s => s.id);
      const { data: assignmentsData } = await supabase
        .from('work_shift_assignments')
        .select(`
          id,
          work_shift_id,
          member_id,
          status,
          hours_override,
          member:members(id, first_name, last_name)
        `)
        .in('work_shift_id', shiftIds);

      setAssignments((assignmentsData || []).map(a => ({
        ...a,
        member: Array.isArray(a.member) ? a.member[0] : a.member
      })));
    } else {
      setAssignments([]);
    }
  };

  const canManageShift = (shift: WorkShift) => {
    if (shift.owner_type === 'club') {
      return canManageClubShifts;
    } else {
      return companyPermissions.includes(shift.owner_id);
    }
  };

  const canCreateShiftForEvent = (event: Event) => {
    if (event.owner_type === 'club') {
      return canManageClubShifts;
    } else {
      return companyPermissions.includes(event.owner_id);
    }
  };

  const openNewShiftDialog = () => {
    if (!selectedEvent) return;
    
    setEditingShift(null);
    setFormTitle("");
    setFormStartAt(selectedEvent.start_at.slice(0, 16));
    setFormEndAt(selectedEvent.end_at?.slice(0, 16) || selectedEvent.start_at.slice(0, 16));
    setFormRequiredSlots(1);
    setFormOwnerType(selectedEvent.owner_type);
    setFormOwnerId(selectedEvent.owner_id);
    setDialogOpen(true);
  };

  const openEditShiftDialog = (shift: WorkShift) => {
    setEditingShift(shift);
    setFormTitle(shift.title);
    setFormStartAt(shift.start_at.slice(0, 16));
    setFormEndAt(shift.end_at.slice(0, 16));
    setFormRequiredSlots(shift.required_slots);
    setFormOwnerType(shift.owner_type);
    setFormOwnerId(shift.owner_id);
    setDialogOpen(true);
  };

  const handleSaveShift = async () => {
    if (!selectedEvent || !clubId || !currentMemberId) return;

    const shiftData = {
      club_id: clubId,
      event_id: selectedEvent.id,
      title: formTitle,
      start_at: new Date(formStartAt).toISOString(),
      end_at: new Date(formEndAt).toISOString(),
      required_slots: formRequiredSlots,
      owner_type: formOwnerType,
      owner_id: formOwnerId
    };

    let error;
    if (editingShift) {
      const { error: updateError } = await supabase
        .from('work_shifts')
        .update(shiftData)
        .eq('id', editingShift.id);
      error = updateError;
    } else {
      const { error: insertError } = await supabase
        .from('work_shifts')
        .insert({
          ...shiftData,
          created_by_member_id: currentMemberId
        });
      error = insertError;
    }

    if (error) {
      toast({
        title: "Fehler",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: editingShift ? "Schicht aktualisiert" : "Schicht erstellt",
        description: `Die Schicht "${formTitle}" wurde ${editingShift ? 'aktualisiert' : 'erstellt'}.`
      });
      setDialogOpen(false);
      fetchEventShifts(selectedEvent);
      fetchData();
    }
  };

  const handleDeleteShift = async (shift: WorkShift) => {
    if (!confirm(`Schicht "${shift.title}" wirklich löschen?`)) return;

    const { error } = await supabase
      .from('work_shifts')
      .delete()
      .eq('id', shift.id);

    if (error) {
      toast({
        title: "Fehler",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Schicht gelöscht",
        description: `Die Schicht "${shift.title}" wurde gelöscht.`
      });
      if (selectedEvent) {
        fetchEventShifts(selectedEvent);
      }
      fetchData();
    }
  };

  const handleSignUp = async (shift: WorkShift) => {
    if (!currentMemberId || !clubId) return;

    const { error } = await supabase
      .from('work_shift_assignments')
      .insert({
        club_id: clubId,
        work_shift_id: shift.id,
        member_id: currentMemberId,
        status: 'signed_up'
      });

    if (error) {
      toast({
        title: "Fehler",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Eingetragen",
        description: `Du bist jetzt für "${shift.title}" eingetragen.`
      });
      if (selectedEvent) {
        fetchEventShifts(selectedEvent);
      }
    }
  };

  const handleSignOut = async (shift: WorkShift) => {
    if (!currentMemberId) return;

    const assignment = assignments.find(
      a => a.work_shift_id === shift.id && a.member_id === currentMemberId && a.status === 'signed_up'
    );
    if (!assignment) return;

    const { error } = await supabase
      .from('work_shift_assignments')
      .update({ status: 'cancelled' })
      .eq('id', assignment.id);

    if (error) {
      toast({
        title: "Fehler",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Ausgetragen",
        description: `Du bist nicht mehr für "${shift.title}" eingetragen.`
      });
      if (selectedEvent) {
        fetchEventShifts(selectedEvent);
      }
    }
  };

  const getShiftAssignments = (shiftId: string) => {
    return assignments.filter(a => a.work_shift_id === shiftId && (a.status === 'signed_up' || a.status === 'completed'));
  };

  const isSignedUp = (shiftId: string) => {
    return assignments.some(
      a => a.work_shift_id === shiftId && a.member_id === currentMemberId && (a.status === 'signed_up' || a.status === 'completed')
    );
  };

  const handleSetStatus = async (assignmentId: string, status: 'completed' | 'no_show') => {
    const { error } = await supabase
      .from('work_shift_assignments')
      .update({ status })
      .eq('id', assignmentId);

    if (error) {
      toast({
        title: "Fehler",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: status === 'completed' ? "Als erledigt markiert" : "Als No-Show markiert"
      });
      if (selectedEvent) {
        fetchEventShifts(selectedEvent);
      }
    }
  };

  const handleMarkAllCompleted = async (shiftId: string) => {
    const shiftAssignments = assignments.filter(
      a => a.work_shift_id === shiftId && a.status === 'signed_up'
    );
    
    for (const a of shiftAssignments) {
      await supabase
        .from('work_shift_assignments')
        .update({ status: 'completed' })
        .eq('id', a.id);
    }
    
    toast({ title: `${shiftAssignments.length} Einsätze als erledigt markiert` });
    if (selectedEvent) {
      fetchEventShifts(selectedEvent);
    }
  };

  const getCompanyName = (companyId: string) => {
    return companies.find(c => c.id === companyId)?.name || 'Unbekannt';
  };

  if (loading) {
    return (
      <PortalLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </PortalLayout>
    );
  }

  // Detail view for selected event
  if (selectedEvent) {
    return (
      <PortalLayout>
        <div className="space-y-6">
          {/* Context banner for navigation from event */}
          <EventContextBanner />
          
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => setSelectedEvent(null)}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Zurück
              </Button>
              <div>
                <h1 className="text-2xl font-bold">{selectedEvent.title}</h1>
                <p className="text-muted-foreground">
                  {format(new Date(selectedEvent.start_at), "EEEE, d. MMMM yyyy", { locale: de })}
                </p>
              </div>
            </div>
            <Link to={`/portal/events/${selectedEvent.id}/organize`}>
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Event-Zentrale
              </Button>
            </Link>
          </div>

          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Schichten ({shifts.length})</h2>
            <div className="flex gap-2">
              {canCreateShiftForEvent(selectedEvent) && (
                <Button onClick={openNewShiftDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Schicht anlegen
                </Button>
              )}
            </div>
          </div>

          {shifts.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Noch keine Schichten für dieses Event angelegt.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {shifts.map(shift => {
                const shiftAssignments = getShiftAssignments(shift.id);
                const openSlots = shift.required_slots - shiftAssignments.length;
                const signedUp = isSignedUp(shift.id);
                const canManage = canManageShift(shift);

                return (
                  <Card key={shift.id}>
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg">{shift.title}</CardTitle>
                          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              {format(new Date(shift.start_at), "HH:mm")} - {format(new Date(shift.end_at), "HH:mm")}
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="h-4 w-4" />
                              {shiftAssignments.length}/{shift.required_slots}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {shift.owner_type === 'company' && (
                            <Badge variant="outline">{getCompanyName(shift.owner_id)}</Badge>
                          )}
                          {openSlots > 0 ? (
                            <Badge variant="secondary">{openSlots} Plätze frei</Badge>
                          ) : (
                            <Badge variant="default">Voll</Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {/* Participants list with status management */}
                        {shiftAssignments.length > 0 && (
                          <div>
                            <div className="flex justify-between items-center mb-2">
                              <p className="text-sm font-medium">Eingetragen:</p>
                              {canManage && shiftAssignments.some(a => a.status === 'signed_up') && (
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-7 text-xs"
                                  onClick={() => handleMarkAllCompleted(shift.id)}
                                >
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Alle erledigt
                                </Button>
                              )}
                            </div>
                            <div className="space-y-2">
                              {shiftAssignments.map(a => (
                                <div key={a.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm">
                                      {a.member?.first_name} {a.member?.last_name}
                                    </span>
                                    {a.status === 'completed' && (
                                      <Badge variant="default" className="text-xs">Erledigt</Badge>
                                    )}
                                    {a.status === 'no_show' && (
                                      <Badge variant="destructive" className="text-xs">No-Show</Badge>
                                    )}
                                  </div>
                                  {canManage && a.status === 'signed_up' && (
                                    <div className="flex gap-1">
                                      <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="h-7 px-2"
                                        onClick={() => handleSetStatus(a.id, 'completed')}
                                      >
                                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                                      </Button>
                                      <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="h-7 px-2"
                                        onClick={() => handleSetStatus(a.id, 'no_show')}
                                      >
                                        <XCircle className="h-4 w-4 text-destructive" />
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2 flex-wrap">
                          {signedUp ? (
                            <Button variant="outline" size="sm" onClick={() => handleSignOut(shift)}>
                              Austragen
                            </Button>
                          ) : openSlots > 0 ? (
                            <Button size="sm" onClick={() => handleSignUp(shift)}>
                              Eintragen
                            </Button>
                          ) : null}

                          {canManage && (
                            <>
                              <Button variant="outline" size="sm" onClick={() => openEditShiftDialog(shift)}>
                                Bearbeiten
                              </Button>
                              <Button variant="destructive" size="sm" onClick={() => handleDeleteShift(shift)}>
                                Löschen
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Create/Edit Shift Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingShift ? "Schicht bearbeiten" : "Neue Schicht"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Titel</Label>
                <Input
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="z.B. Auf-/Abbau, Thekendienst..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Start</Label>
                  <Input
                    type="datetime-local"
                    value={formStartAt}
                    onChange={(e) => setFormStartAt(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Ende</Label>
                  <Input
                    type="datetime-local"
                    value={formEndAt}
                    onChange={(e) => setFormEndAt(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label>Benötigte Helfer</Label>
                <Input
                  type="number"
                  min={1}
                  value={formRequiredSlots}
                  onChange={(e) => setFormRequiredSlots(parseInt(e.target.value) || 1)}
                />
              </div>
              {/* Owner selection - only show if user has multiple options */}
              {canManageClubShifts && companyPermissions.length > 0 && (
                <div>
                  <Label>Verantwortlich</Label>
                  <Select
                    value={`${formOwnerType}:${formOwnerId}`}
                    onValueChange={(val) => {
                      const [type, id] = val.split(':');
                      setFormOwnerType(type as 'club' | 'company');
                      setFormOwnerId(id);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={`club:${clubId}`}>Hauptverein</SelectItem>
                      {companyPermissions.map(compId => (
                        <SelectItem key={compId} value={`company:${compId}`}>
                          {getCompanyName(compId)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Abbrechen
              </Button>
              <Button onClick={handleSaveShift} disabled={!formTitle}>
                {editingShift ? "Speichern" : "Erstellen"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PortalLayout>
    );
  }

  // Events list view
  return (
    <PortalLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold">Arbeitsdienste</h1>
            <p className="text-muted-foreground">Schichten für anstehende Veranstaltungen</p>
          </div>
          {(canManageClubShifts || companyPermissions.length > 0) && (
            <Button variant="outline" onClick={() => navigate('/portal/workshifts/report')}>
              <BarChart3 className="h-4 w-4 mr-2" />
              Auswertung
            </Button>
          )}
        </div>

        {events.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Keine anstehenden Veranstaltungen.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {events.map(event => (
              <Card
                key={event.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => fetchEventShifts(event)}
              >
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col items-center justify-center w-14 h-14 bg-primary/10 rounded-lg">
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(event.start_at), "MMM", { locale: de })}
                        </span>
                        <span className="text-xl font-bold">
                          {format(new Date(event.start_at), "d")}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-semibold">{event.title}</h3>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(event.start_at), "EEEE", { locale: de })}
                          </span>
                          {event.shiftCount > 0 && (
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {event.shiftCount} Schichten
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {event.shiftCount > 0 ? (
                        event.openSlots > 0 ? (
                          <Badge variant="secondary">{event.openSlots} Plätze frei</Badge>
                        ) : (
                          <Badge variant="default">Alle besetzt</Badge>
                        )
                      ) : (
                        <Badge variant="outline">Keine Schichten</Badge>
                      )}
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PortalLayout>
  );
};

export default WorkShifts;
