import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import PortalLayout from "@/components/portal/PortalLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import {
  FileText,
  Upload,
  Download,
  Trash2,
  Edit,
  Search,
  Building2,
  Shield,
  MoreVertical,
  Loader2,
  Plus,
  Send,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  History,
  Lock,
} from "lucide-react";

interface Protocol {
  document_id: string;
  meeting_date: string;
  committee: string;
  meeting_title: string | null;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  submitted_at: string | null;
  approved_at: string | null;
  approved_by_member_id: string | null;
  rejection_reason: string | null;
  document: {
    id: string;
    club_id: string;
    scope_type: 'club' | 'company';
    scope_id: string;
    title: string;
    description: string | null;
    file_path: string;
    file_name: string;
    file_size: number | null;
    visibility: 'internal' | 'restricted';
    version: number;
    is_current_version: boolean;
    parent_document_id: string | null;
    created_at: string;
    uploader?: {
      first_name: string;
      last_name: string;
    } | null;
  };
  approver?: {
    first_name: string;
    last_name: string;
  } | null;
}

interface Company {
  id: string;
  name: string;
}

const DEFAULT_COMMITTEES = [
  'Vorstand',
  'Generalversammlung',
  'Kompanieversammlung',
  'Festausschuss',
  'Schießausschuss',
  'Jugendausschuss',
];

interface ProtocolsProps {
  embedded?: boolean;
}

const Protocols = ({ embedded = false }: ProtocolsProps) => {
  const { user, member, isAdmin } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [userCompanyId, setUserCompanyId] = useState<string | null>(null);

  // Filters
  const [activeTab, setActiveTab] = useState<'club' | 'company'>('club');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Permissions
  const [canManageClubDocs, setCanManageClubDocs] = useState(false);
  const [canApproveClubProtocols, setCanApproveClubProtocols] = useState(false);
  const [companyDocPermissions, setCompanyDocPermissions] = useState<string[]>([]);
  const [companyApprovePermissions, setCompanyApprovePermissions] = useState<string[]>([]);

  // Dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedProtocol, setSelectedProtocol] = useState<Protocol | null>(null);
  const [versionsDialogOpen, setVersionsDialogOpen] = useState(false);
  const [versions, setVersions] = useState<any[]>([]);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  // Form state
  const [formMeetingDate, setFormMeetingDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [formCommittee, setFormCommittee] = useState('Vorstand');
  const [formCustomCommittee, setFormCustomCommittee] = useState('');
  const [formMeetingTitle, setFormMeetingTitle] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formScopeType, setFormScopeType] = useState<'club' | 'company'>('club');
  const [formScopeId, setFormScopeId] = useState('');
  const [formVisibility, setFormVisibility] = useState<'internal' | 'restricted'>('internal');
  const [formFile, setFormFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (user && member) {
      fetchData();
      checkPermissions();
    }
  }, [user, member]);

  const checkPermissions = async () => {
    if (!user || !member) return;

    const { data: permData } = await supabase.rpc('get_user_permissions', {
      _user_id: user.id,
      _club_id: member.club_id
    });

    const permissions = permData || [];
    const hasFullAdmin = permissions.some((p: any) => p.permission_key === 'club.admin.full');
    const hasClubDocs = permissions.some((p: any) => p.permission_key === 'club.documents.manage');
    const hasClubApprove = permissions.some((p: any) => p.permission_key === 'club.protocols.approve');
    
    setCanManageClubDocs(hasFullAdmin || hasClubDocs || isAdmin);
    setCanApproveClubProtocols(hasFullAdmin || hasClubApprove || isAdmin);

    const companyDocPerms = permissions
      .filter((p: any) => p.permission_key === 'company.documents.manage' && p.scope_type === 'company')
      .map((p: any) => p.scope_id);
    setCompanyDocPermissions(companyDocPerms);

    const companyApprovePerms = permissions
      .filter((p: any) => p.permission_key === 'company.protocols.approve' && p.scope_type === 'company')
      .map((p: any) => p.scope_id);
    setCompanyApprovePermissions(companyApprovePerms);
  };

  const fetchData = async () => {
    if (!member) return;
    setLoading(true);

    try {
      const { data: companiesData } = await supabase
        .from('companies')
        .select('id, name')
        .eq('club_id', member.club_id)
        .order('name');
      setCompanies(companiesData || []);

      const { data: membershipData } = await supabase
        .from('member_company_memberships')
        .select('company_id')
        .eq('member_id', member.id)
        .is('valid_to', null)
        .maybeSingle();
      
      if (membershipData) {
        setUserCompanyId(membershipData.company_id);
        setFormScopeId(membershipData.company_id);
      }

      const { data: protocolsData, error } = await supabase
        .from('protocols')
        .select(`
          *,
          document:documents!document_id(
            *,
            uploader:members!uploaded_by_member_id(first_name, last_name)
          ),
          approver:members!approved_by_member_id(first_name, last_name)
        `)
        .eq('document.club_id', member.club_id)
        .eq('document.is_current_version', true)
        .order('meeting_date', { ascending: false });

      if (error) {
        console.error('Error fetching protocols:', error);
      } else {
        // Filter out protocols where document is null (RLS filtered)
        const validProtocols = (protocolsData || []).filter((p: any) => p.document !== null);
        setProtocols(validProtocols);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!member || !formFile || !formTitle.trim()) return;
    setUploading(true);

    try {
      const committee = formCommittee === 'custom' ? formCustomCommittee : formCommittee;
      const scopeId = formScopeType === 'club' ? member.club_id : formScopeId;
      const documentId = crypto.randomUUID();
      const filePath = `${member.club_id}/${formScopeType}/${scopeId}/documents/${documentId}/${formFile.name}`;

      // Upload file
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, formFile);

      if (uploadError) throw uploadError;

      // Create document record
      const { error: docError } = await supabase
        .from('documents')
        .insert({
          id: documentId,
          club_id: member.club_id,
          scope_type: formScopeType,
          scope_id: scopeId,
          folder: 'Protokolle',
          type: 'protocol',
          title: formTitle.trim(),
          description: formDescription.trim() || null,
          file_path: filePath,
          file_name: formFile.name,
          mime_type: formFile.type || null,
          file_size: formFile.size,
          uploaded_by_member_id: member.id,
          visibility: formVisibility,
        });

      if (docError) {
        await supabase.storage.from('documents').remove([filePath]);
        throw docError;
      }

      // Create protocol record
      const { error: protoError } = await supabase
        .from('protocols')
        .insert({
          document_id: documentId,
          meeting_date: formMeetingDate,
          committee: committee,
          meeting_title: formMeetingTitle.trim() || null,
          status: 'draft',
        });

      if (protoError) throw protoError;

      toast({ title: 'Protokoll erstellt' });
      setCreateDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error('Error creating protocol:', error);
      toast({ 
        title: 'Fehler beim Erstellen', 
        description: error.message,
        variant: 'destructive' 
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (protocol: Protocol) => {
    try {
      const { error } = await supabase
        .from('protocols')
        .update({
          status: 'submitted',
          submitted_at: new Date().toISOString(),
        })
        .eq('document_id', protocol.document_id);

      if (error) throw error;
      toast({ title: 'Protokoll eingereicht' });
      fetchData();
    } catch (error: any) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    }
  };

  const handleApprove = async (protocol: Protocol) => {
    if (!member) return;
    try {
      const { error } = await supabase
        .from('protocols')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by_member_id: member.id,
          rejection_reason: null,
        })
        .eq('document_id', protocol.document_id);

      if (error) throw error;
      toast({ title: 'Protokoll freigegeben' });
      setDetailDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    }
  };

  const handleReject = async () => {
    if (!selectedProtocol || !rejectionReason.trim()) return;
    try {
      const { error } = await supabase
        .from('protocols')
        .update({
          status: 'rejected',
          rejection_reason: rejectionReason.trim(),
        })
        .eq('document_id', selectedProtocol.document_id);

      if (error) throw error;
      toast({ title: 'Protokoll abgelehnt' });
      setRejectDialogOpen(false);
      setDetailDialogOpen(false);
      setRejectionReason('');
      fetchData();
    } catch (error: any) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (protocol: Protocol) => {
    if (!confirm(`Protokoll "${protocol.document.title}" wirklich löschen?`)) return;

    try {
      await supabase.storage.from('documents').remove([protocol.document.file_path]);
      const { error } = await supabase.from('documents').delete().eq('id', protocol.document.id);
      if (error) throw error;
      toast({ title: 'Protokoll gelöscht' });
      fetchData();
    } catch (error: any) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    }
  };

  const handleDownload = async (filePath: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage.from('documents').download(filePath);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast({ title: 'Fehler beim Download', description: error.message, variant: 'destructive' });
    }
  };

  const fetchVersions = async (protocol: Protocol) => {
    const parentId = protocol.document.parent_document_id || protocol.document.id;
    const { data } = await supabase
      .from('documents')
      .select('*, uploader:members!uploaded_by_member_id(first_name, last_name)')
      .or(`id.eq.${parentId},parent_document_id.eq.${parentId}`)
      .order('version', { ascending: false });
    setVersions(data || []);
    setVersionsDialogOpen(true);
  };

  const resetForm = () => {
    setFormMeetingDate(format(new Date(), 'yyyy-MM-dd'));
    setFormCommittee('Vorstand');
    setFormCustomCommittee('');
    setFormMeetingTitle('');
    setFormTitle('');
    setFormDescription('');
    setFormScopeType('club');
    setFormVisibility('internal');
    setFormFile(null);
  };

  const openCreateDialog = () => {
    resetForm();
    if (canManageClubDocs) {
      setFormScopeType('club');
    } else if (companyDocPermissions.length > 0) {
      setFormScopeType('company');
      setFormScopeId(companyDocPermissions[0]);
    }
    setCreateDialogOpen(true);
  };

  const canManageProtocol = (protocol: Protocol): boolean => {
    if (protocol.document.scope_type === 'club') {
      return canManageClubDocs;
    } else {
      return companyDocPermissions.includes(protocol.document.scope_id);
    }
  };

  const canApproveProtocol = (protocol: Protocol): boolean => {
    if (protocol.document.scope_type === 'club') {
      return canApproveClubProtocols;
    } else {
      return companyApprovePermissions.includes(protocol.document.scope_id);
    }
  };

  const getCompanyName = (companyId: string): string => {
    return companies.find(c => c.id === companyId)?.name || 'Unbekannt';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="secondary" className="gap-1"><Clock className="w-3 h-3" />Entwurf</Badge>;
      case 'submitted':
        return <Badge variant="outline" className="gap-1 border-yellow-500 text-yellow-600"><Send className="w-3 h-3" />Eingereicht</Badge>;
      case 'approved':
        return <Badge variant="default" className="gap-1 bg-green-600"><CheckCircle className="w-3 h-3" />Freigegeben</Badge>;
      case 'rejected':
        return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" />Abgelehnt</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const filteredProtocols = useMemo(() => {
    return protocols.filter(p => {
      if (activeTab === 'club' && p.document.scope_type !== 'club') return false;
      if (activeTab === 'company') {
        if (p.document.scope_type !== 'company') return false;
        if (p.document.scope_id !== userCompanyId && !companyDocPermissions.includes(p.document.scope_id)) return false;
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!p.document.title.toLowerCase().includes(q) && 
            !p.committee.toLowerCase().includes(q) &&
            !(p.meeting_title?.toLowerCase().includes(q))) {
          return false;
        }
      }
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      return true;
    });
  }, [protocols, activeTab, searchQuery, statusFilter, userCompanyId, companyDocPermissions]);

  const canCreate = canManageClubDocs || companyDocPermissions.length > 0;

  const content = (
    <div className={embedded ? "space-y-6" : "max-w-6xl mx-auto space-y-6"}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-between items-start"
        >
          <div>
            <h1 className="font-display text-3xl font-bold flex items-center gap-3">
              <FileText className="w-8 h-8" />
              Protokolle
            </h1>
            <p className="text-muted-foreground mt-1">
              Sitzungsprotokolle mit Freigabe-Workflow
            </p>
          </div>
          {canCreate && (
            <Button onClick={openCreateDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Protokoll erstellen
            </Button>
          )}
        </motion.div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'club' | 'company')}>
          <TabsList>
            <TabsTrigger value="club" className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Hauptverein
            </TabsTrigger>
            {userCompanyId && (
              <TabsTrigger value="company" className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Meine Kompanie
              </TabsTrigger>
            )}
          </TabsList>

          {/* Filters */}
          <Card className="mt-4">
            <CardContent className="py-4">
              <div className="flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-48">
                  <Label className="text-xs">Suche</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Titel, Gremium..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle</SelectItem>
                      <SelectItem value="draft">Entwurf</SelectItem>
                      <SelectItem value="submitted">Eingereicht</SelectItem>
                      <SelectItem value="approved">Freigegeben</SelectItem>
                      <SelectItem value="rejected">Abgelehnt</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <TabsContent value="club" className="mt-4">
            <ProtocolTable
              protocols={filteredProtocols}
              loading={loading}
              onView={(p) => { setSelectedProtocol(p); setDetailDialogOpen(true); }}
              onDownload={(p) => handleDownload(p.document.file_path, p.document.file_name)}
              onDelete={handleDelete}
              canManage={canManageProtocol}
              getStatusBadge={getStatusBadge}
            />
          </TabsContent>

          <TabsContent value="company" className="mt-4">
            <ProtocolTable
              protocols={filteredProtocols}
              loading={loading}
              onView={(p) => { setSelectedProtocol(p); setDetailDialogOpen(true); }}
              onDownload={(p) => handleDownload(p.document.file_path, p.document.file_name)}
              onDelete={handleDelete}
              canManage={canManageProtocol}
              getStatusBadge={getStatusBadge}
            />
          </TabsContent>
      </Tabs>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Protokoll erstellen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            {/* Scope */}
            <div>
              <Label>Bereich</Label>
              <Select value={formScopeType} onValueChange={(v) => setFormScopeType(v as 'club' | 'company')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {canManageClubDocs && <SelectItem value="club">Hauptverein</SelectItem>}
                  {companyDocPermissions.map(compId => (
                    <SelectItem key={compId} value="company">{getCompanyName(compId)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Meeting Date */}
            <div>
              <Label>Sitzungsdatum *</Label>
              <Input
                type="date"
                value={formMeetingDate}
                onChange={(e) => setFormMeetingDate(e.target.value)}
              />
            </div>

            {/* Committee */}
            <div>
              <Label>Gremium *</Label>
              <Select value={formCommittee} onValueChange={setFormCommittee}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEFAULT_COMMITTEES.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                  <SelectItem value="custom">Anderes...</SelectItem>
                </SelectContent>
              </Select>
              {formCommittee === 'custom' && (
                <Input
                  className="mt-2"
                  value={formCustomCommittee}
                  onChange={(e) => setFormCustomCommittee(e.target.value)}
                  placeholder="Gremiumsname"
                />
              )}
            </div>

            {/* Meeting Title */}
            <div>
              <Label>Sitzungstitel</Label>
              <Input
                value={formMeetingTitle}
                onChange={(e) => setFormMeetingTitle(e.target.value)}
                placeholder="z.B. Jahreshauptversammlung 2026"
              />
            </div>

            {/* Document Title */}
            <div>
              <Label>Dokumenttitel *</Label>
              <Input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="z.B. Protokoll Vorstandssitzung 11.01.2026"
              />
            </div>

            {/* Description */}
            <div>
              <Label>Beschreibung</Label>
              <Textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={2}
              />
            </div>

            {/* Visibility */}
            <div>
              <Label>Sichtbarkeit</Label>
              <Select value={formVisibility} onValueChange={(v) => setFormVisibility(v as 'internal' | 'restricted')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal">Intern (alle im Bereich)</SelectItem>
                  <SelectItem value="restricted">Eingeschränkt (nur Berechtigte)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* File */}
            <div>
              <Label>Datei *</Label>
              <Input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) => setFormFile(e.target.files?.[0] || null)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={handleCreate} disabled={uploading || !formTitle.trim() || !formFile}>
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Erstellen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Protokoll-Details</DialogTitle>
          </DialogHeader>
          {selectedProtocol && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                {getStatusBadge(selectedProtocol.status)}
                {selectedProtocol.document.visibility === 'restricted' && (
                  <Badge variant="outline" className="gap-1"><Lock className="w-3 h-3" />Eingeschränkt</Badge>
                )}
                {selectedProtocol.document.version > 1 && (
                  <Badge variant="outline">v{selectedProtocol.document.version}</Badge>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Gremium</p>
                  <p className="font-medium">{selectedProtocol.committee}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Sitzungsdatum</p>
                  <p className="font-medium">{format(new Date(selectedProtocol.meeting_date), 'dd.MM.yyyy', { locale: de })}</p>
                </div>
                {selectedProtocol.meeting_title && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Sitzungstitel</p>
                    <p className="font-medium">{selectedProtocol.meeting_title}</p>
                  </div>
                )}
                <div className="col-span-2">
                  <p className="text-muted-foreground">Dokumenttitel</p>
                  <p className="font-medium">{selectedProtocol.document.title}</p>
                </div>
                {selectedProtocol.document.description && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Beschreibung</p>
                    <p>{selectedProtocol.document.description}</p>
                  </div>
                )}
                {selectedProtocol.status === 'rejected' && selectedProtocol.rejection_reason && (
                  <div className="col-span-2 p-3 bg-destructive/10 rounded-lg">
                    <p className="text-destructive font-medium">Ablehnungsgrund:</p>
                    <p className="text-sm">{selectedProtocol.rejection_reason}</p>
                  </div>
                )}
                {selectedProtocol.approver && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Freigegeben von</p>
                    <p>{selectedProtocol.approver.first_name} {selectedProtocol.approver.last_name} am {format(new Date(selectedProtocol.approved_at!), 'dd.MM.yyyy HH:mm', { locale: de })}</p>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => handleDownload(selectedProtocol.document.file_path, selectedProtocol.document.file_name)}>
                  <Download className="w-4 h-4 mr-2" />Download
                </Button>
                <Button variant="outline" onClick={() => fetchVersions(selectedProtocol)}>
                  <History className="w-4 h-4 mr-2" />Versionen
                </Button>

                {/* Action buttons based on status and permissions */}
                {selectedProtocol.status === 'draft' && canManageProtocol(selectedProtocol) && (
                  <Button onClick={() => handleSubmit(selectedProtocol)}>
                    <Send className="w-4 h-4 mr-2" />Einreichen
                  </Button>
                )}

                {selectedProtocol.status === 'submitted' && canApproveProtocol(selectedProtocol) && (
                  <>
                    <Button onClick={() => handleApprove(selectedProtocol)} className="bg-green-600 hover:bg-green-700">
                      <CheckCircle className="w-4 h-4 mr-2" />Freigeben
                    </Button>
                    <Button variant="destructive" onClick={() => { setRejectDialogOpen(true); }}>
                      <XCircle className="w-4 h-4 mr-2" />Ablehnen
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Versions Dialog */}
      <Dialog open={versionsDialogOpen} onOpenChange={setVersionsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Versionen</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {versions.map((v) => (
              <div key={v.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">Version {v.version} {v.is_current_version && <Badge className="ml-2">Aktuell</Badge>}</p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(v.created_at), 'dd.MM.yyyy HH:mm', { locale: de })}
                    {v.uploader && ` - ${v.uploader.first_name} ${v.uploader.last_name}`}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleDownload(v.file_path, v.file_name)}>
                  <Download className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Protokoll ablehnen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Ablehnungsgrund *</Label>
              <Textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Bitte geben Sie einen Grund an..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Abbrechen</Button>
            <Button variant="destructive" onClick={handleReject} disabled={!rejectionReason.trim()}>
              Ablehnen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  if (embedded) {
    return content;
  }

  return <PortalLayout>{content}</PortalLayout>;
};

// Protocol Table Component
interface ProtocolTableProps {
  protocols: Protocol[];
  loading: boolean;
  onView: (protocol: Protocol) => void;
  onDownload: (protocol: Protocol) => void;
  onDelete: (protocol: Protocol) => void;
  canManage: (protocol: Protocol) => boolean;
  getStatusBadge: (status: string) => React.ReactNode;
}

const ProtocolTable = ({
  protocols,
  loading,
  onView,
  onDownload,
  onDelete,
  canManage,
  getStatusBadge,
}: ProtocolTableProps) => {
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (protocols.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Keine Protokolle gefunden</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Datum</TableHead>
            <TableHead>Gremium</TableHead>
            <TableHead>Titel</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {protocols.map((p) => (
            <TableRow key={p.document_id} className="cursor-pointer hover:bg-muted/50" onClick={() => onView(p)}>
              <TableCell>{format(new Date(p.meeting_date), 'dd.MM.yyyy', { locale: de })}</TableCell>
              <TableCell>{p.committee}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <span>{p.document.title}</span>
                  {p.document.visibility === 'restricted' && <Lock className="w-3 h-3 text-muted-foreground" />}
                </div>
              </TableCell>
              <TableCell>{getStatusBadge(p.status)}</TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onView(p)}>
                      <Eye className="w-4 h-4 mr-2" />Details
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onDownload(p)}>
                      <Download className="w-4 h-4 mr-2" />Download
                    </DropdownMenuItem>
                    {canManage(p) && (
                      <DropdownMenuItem onClick={() => onDelete(p)} className="text-destructive">
                        <Trash2 className="w-4 h-4 mr-2" />Löschen
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
};

export default Protocols;
