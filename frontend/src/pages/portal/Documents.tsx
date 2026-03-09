import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import PortalLayout from "@/components/portal/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import EventContextBanner from "@/components/portal/EventContextBanner";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import {
  FileText,
  Upload,
  Download,
  Trash2,
  Edit,
  Search,
  Folder,
  Building2,
  Shield,
  MoreVertical,
  Loader2,
  FileIcon,
  FileSpreadsheet,
  FileImage,
  File,
  Plus,
  Lock,
  History,
  BookOpen,
} from "lucide-react";
import Protocols from "./Protocols";

interface Document {
  id: string;
  club_id: string;
  scope_type: 'club' | 'company';
  scope_id: string;
  folder: string;
  type: 'document' | 'protocol' | 'form' | 'other';
  title: string;
  description: string | null;
  file_path: string;
  file_name: string;
  mime_type: string | null;
  file_size: number | null;
  uploaded_by_member_id: string | null;
  created_at: string;
  visibility: 'internal' | 'restricted';
  version: number;
  is_current_version: boolean;
  parent_document_id: string | null;
  uploader?: {
    first_name: string;
    last_name: string;
  } | null;
}

interface Company {
  id: string;
  name: string;
}

const DEFAULT_FOLDERS = [
  'Allgemein',
  'Protokolle',
  'Formulare',
  'Einladungen',
  'Schützenfest',
  'Finanzen',
];

const DOCUMENT_TYPES = [
  { value: 'document', label: 'Dokument' },
  { value: 'protocol', label: 'Protokoll' },
  { value: 'form', label: 'Formular' },
  { value: 'other', label: 'Sonstiges' },
];

const Documents = () => {
  const { user, member, hasPermission, isAdmin } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  // Top-level section tab (documents vs protocols)
  const sectionTab = searchParams.get('section') || 'documents';
  const setSectionTab = (value: string) => {
    setSearchParams({ section: value });
  };

  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [userCompanyId, setUserCompanyId] = useState<string | null>(null);

  // Filters
  const [activeTab, setActiveTab] = useState<'club' | 'company'>('club');
  const [searchQuery, setSearchQuery] = useState('');
  const [folderFilter, setFolderFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Permissions
  const [canManageClubDocs, setCanManageClubDocs] = useState(false);
  const [canViewRestricted, setCanViewRestricted] = useState(false);
  const [companyDocPermissions, setCompanyDocPermissions] = useState<string[]>([]);

  // Dialog state
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<Document | null>(null);
  const [versionsDialogOpen, setVersionsDialogOpen] = useState(false);
  const [versions, setVersions] = useState<Document[]>([]);
  const [newVersionDialogOpen, setNewVersionDialogOpen] = useState(false);
  const [versionTargetDoc, setVersionTargetDoc] = useState<Document | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formFolder, setFormFolder] = useState('Allgemein');
  const [formCustomFolder, setFormCustomFolder] = useState('');
  const [formType, setFormType] = useState<'document' | 'protocol' | 'form' | 'other'>('document');
  const [formVisibility, setFormVisibility] = useState<'internal' | 'restricted'>('internal');
  const [formScopeType, setFormScopeType] = useState<'club' | 'company'>('club');
  const [formScopeId, setFormScopeId] = useState('');
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
    const hasRestrictedView = permissions.some((p: any) => p.permission_key === 'club.documents.restricted.view');
    
    setCanManageClubDocs(hasFullAdmin || hasClubDocs || isAdmin);
    setCanViewRestricted(hasFullAdmin || hasRestrictedView || isAdmin);

    const companyPerms = permissions
      .filter((p: any) => p.permission_key === 'company.documents.manage' && p.scope_type === 'company')
      .map((p: any) => p.scope_id);
    setCompanyDocPermissions(companyPerms);
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

      // Get user's company membership
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

      // Fetch documents - only current versions, exclude protocols
      const { data: docsData, error } = await supabase
        .from('documents')
        .select(`
          *,
          uploader:members!uploaded_by_member_id(first_name, last_name)
        `)
        .eq('club_id', member.club_id)
        .eq('is_current_version', true)
        .neq('type', 'protocol')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching documents:', error);
      } else {
        setDocuments(docsData || []);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchVersions = async (doc: Document) => {
    const parentId = doc.parent_document_id || doc.id;
    const { data } = await supabase
      .from('documents')
      .select('*, uploader:members!uploaded_by_member_id(first_name, last_name)')
      .or(`id.eq.${parentId},parent_document_id.eq.${parentId}`)
      .order('version', { ascending: false });
    setVersions((data || []) as Document[]);
    setVersionsDialogOpen(true);
  };

  const handleNewVersion = async () => {
    if (!member || !formFile || !versionTargetDoc) return;
    setUploading(true);

    try {
      const parentId = versionTargetDoc.parent_document_id || versionTargetDoc.id;
      
      // Get max version
      const { data: maxVersionData } = await supabase
        .from('documents')
        .select('version')
        .or(`id.eq.${parentId},parent_document_id.eq.${parentId}`)
        .order('version', { ascending: false })
        .limit(1)
        .single();
      
      const newVersion = (maxVersionData?.version || 1) + 1;
      const documentId = crypto.randomUUID();
      const filePath = `${member.club_id}/${versionTargetDoc.scope_type}/${versionTargetDoc.scope_id}/documents/${documentId}/${formFile.name}`;

      // Upload file
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, formFile);

      if (uploadError) throw uploadError;

      // Set old versions to not current
      await supabase
        .from('documents')
        .update({ is_current_version: false })
        .or(`id.eq.${parentId},parent_document_id.eq.${parentId}`);

      // Create new version record
      const { error: insertError } = await supabase
        .from('documents')
        .insert({
          id: documentId,
          club_id: versionTargetDoc.club_id,
          scope_type: versionTargetDoc.scope_type,
          scope_id: versionTargetDoc.scope_id,
          folder: versionTargetDoc.folder,
          type: versionTargetDoc.type,
          title: versionTargetDoc.title,
          description: versionTargetDoc.description,
          file_path: filePath,
          file_name: formFile.name,
          mime_type: formFile.type || null,
          file_size: formFile.size,
          uploaded_by_member_id: member.id,
          visibility: versionTargetDoc.visibility,
          version: newVersion,
          is_current_version: true,
          parent_document_id: parentId,
        });

      if (insertError) {
        await supabase.storage.from('documents').remove([filePath]);
        throw insertError;
      }

      toast({ title: `Version ${newVersion} hochgeladen` });
      setNewVersionDialogOpen(false);
      setVersionTargetDoc(null);
      setFormFile(null);
      fetchData();
    } catch (error: any) {
      console.error('Version upload error:', error);
      toast({ 
        title: 'Fehler beim Hochladen', 
        description: error.message,
        variant: 'destructive' 
      });
    } finally {
      setUploading(false);
    }
  };

  const handleUpload = async () => {
    if (!member || !formFile || !formTitle.trim()) return;
    setUploading(true);

    try {
      const folder = formFolder === 'custom' ? formCustomFolder : formFolder;
      const scopeId = formScopeType === 'club' ? member.club_id : formScopeId;
      
      // Generate document ID first
      const documentId = crypto.randomUUID();
      
      // Build storage path
      const filePath = `${member.club_id}/${formScopeType}/${scopeId}/documents/${documentId}/${formFile.name}`;

      // Upload file
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, formFile);

      if (uploadError) {
        throw uploadError;
      }

      // Create document record
      const { error: insertError } = await supabase
        .from('documents')
        .insert({
          id: documentId,
          club_id: member.club_id,
          scope_type: formScopeType,
          scope_id: scopeId,
          folder: folder || 'Allgemein',
          type: formType,
          title: formTitle.trim(),
          description: formDescription.trim() || null,
          file_path: filePath,
          file_name: formFile.name,
          mime_type: formFile.type || null,
          file_size: formFile.size,
          uploaded_by_member_id: member.id,
        });

      if (insertError) {
        // Cleanup uploaded file on error
        await supabase.storage.from('documents').remove([filePath]);
        throw insertError;
      }

      toast({ title: 'Dokument hochgeladen' });
      setUploadDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({ 
        title: 'Fehler beim Hochladen', 
        description: error.message,
        variant: 'destructive' 
      });
    } finally {
      setUploading(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingDocument || !formTitle.trim()) return;
    setUploading(true);

    try {
      const folder = formFolder === 'custom' ? formCustomFolder : formFolder;

      const { error } = await supabase
        .from('documents')
        .update({
          title: formTitle.trim(),
          description: formDescription.trim() || null,
          folder: folder || 'Allgemein',
          type: formType,
        })
        .eq('id', editingDocument.id);

      if (error) throw error;

      toast({ title: 'Dokument aktualisiert' });
      setEditDialogOpen(false);
      setEditingDocument(null);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast({ 
        title: 'Fehler beim Aktualisieren', 
        description: error.message,
        variant: 'destructive' 
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (doc: Document) => {
    if (!confirm(`Dokument "${doc.title}" wirklich löschen?`)) return;

    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([doc.file_path]);

      if (storageError) {
        console.warn('Storage delete error:', storageError);
      }

      // Delete record
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', doc.id);

      if (error) throw error;

      toast({ title: 'Dokument gelöscht' });
      fetchData();
    } catch (error: any) {
      toast({ 
        title: 'Fehler beim Löschen', 
        description: error.message,
        variant: 'destructive' 
      });
    }
  };

  const handleDownload = async (doc: Document) => {
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .download(doc.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.file_name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast({ 
        title: 'Fehler beim Download', 
        description: error.message,
        variant: 'destructive' 
      });
    }
  };

  const openEditDialog = (doc: Document) => {
    setEditingDocument(doc);
    setFormTitle(doc.title);
    setFormDescription(doc.description || '');
    setFormType(doc.type);
    
    if (DEFAULT_FOLDERS.includes(doc.folder)) {
      setFormFolder(doc.folder);
      setFormCustomFolder('');
    } else {
      setFormFolder('custom');
      setFormCustomFolder(doc.folder);
    }
    
    setEditDialogOpen(true);
  };

  const resetForm = () => {
    setFormTitle('');
    setFormDescription('');
    setFormFolder('Allgemein');
    setFormCustomFolder('');
    setFormType('document');
    setFormScopeType('club');
    setFormFile(null);
  };

  const openUploadDialog = () => {
    resetForm();
    // Set default scope based on permissions
    if (canManageClubDocs) {
      setFormScopeType('club');
    } else if (companyDocPermissions.length > 0) {
      setFormScopeType('company');
      setFormScopeId(companyDocPermissions[0]);
    }
    setUploadDialogOpen(true);
  };

  const canManageDocument = (doc: Document): boolean => {
    if (doc.scope_type === 'club') {
      return canManageClubDocs;
    } else {
      return companyDocPermissions.includes(doc.scope_id);
    }
  };

  const getCompanyName = (companyId: string): string => {
    return companies.find(c => c.id === companyId)?.name || 'Unbekannt';
  };

  const getFileIcon = (mimeType: string | null) => {
    if (!mimeType) return <File className="w-5 h-5" />;
    if (mimeType.includes('pdf')) return <FileText className="w-5 h-5 text-red-500" />;
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return <FileSpreadsheet className="w-5 h-5 text-green-500" />;
    if (mimeType.includes('image')) return <FileImage className="w-5 h-5 text-blue-500" />;
    if (mimeType.includes('word') || mimeType.includes('document')) return <FileText className="w-5 h-5 text-blue-600" />;
    return <File className="w-5 h-5" />;
  };

  const formatFileSize = (bytes: number | null): string => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Filter documents
  const filteredDocuments = useMemo(() => {
    return documents.filter(doc => {
      // Tab filter
      if (activeTab === 'club' && doc.scope_type !== 'club') return false;
      if (activeTab === 'company') {
        if (doc.scope_type !== 'company') return false;
        // Only show user's company documents
        if (doc.scope_id !== userCompanyId && !companyDocPermissions.includes(doc.scope_id)) return false;
      }

      // Search
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!doc.title.toLowerCase().includes(q) && !doc.file_name.toLowerCase().includes(q)) {
          return false;
        }
      }

      // Folder filter
      if (folderFilter !== 'all' && doc.folder !== folderFilter) return false;

      // Type filter
      if (typeFilter !== 'all' && doc.type !== typeFilter) return false;

      return true;
    });
  }, [documents, activeTab, searchQuery, folderFilter, typeFilter, userCompanyId, companyDocPermissions]);

  // Get unique folders from documents
  const allFolders = useMemo(() => {
    const folders = new Set(documents.map(d => d.folder));
    DEFAULT_FOLDERS.forEach(f => folders.add(f));
    return Array.from(folders).sort();
  }, [documents]);

  const canUpload = canManageClubDocs || companyDocPermissions.length > 0;

  return (
    <PortalLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Context banner for navigation from event */}
        <EventContextBanner />
        
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-between items-start"
        >
          <div>
            <h1 className="font-display text-3xl font-bold flex items-center gap-3">
              <FileText className="w-8 h-8" />
              Dokumente & Protokolle
            </h1>
            <p className="text-muted-foreground mt-1">
              Dateien, Dokumente und Sitzungsprotokolle
            </p>
          </div>
          {sectionTab === 'documents' && canUpload && (
            <Button onClick={openUploadDialog}>
              <Upload className="w-4 h-4 mr-2" />
              Hochladen
            </Button>
          )}
        </motion.div>

        {/* Section Tabs (Documents / Protocols) */}
        <Tabs value={sectionTab} onValueChange={setSectionTab}>
          <TabsList>
            <TabsTrigger value="documents" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Dokumente
            </TabsTrigger>
            <TabsTrigger value="protocols" className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              Protokolle
            </TabsTrigger>
          </TabsList>

          <TabsContent value="documents" className="mt-4 space-y-4">

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
                      placeholder="Titel oder Dateiname..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Ordner</Label>
                  <Select value={folderFilter} onValueChange={setFolderFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle Ordner</SelectItem>
                      {allFolders.map(f => (
                        <SelectItem key={f} value={f}>{f}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Typ</Label>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle Typen</SelectItem>
                      {DOCUMENT_TYPES.map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Document List */}
          <TabsContent value="club" className="mt-4">
            <DocumentTable
              documents={filteredDocuments}
              loading={loading}
              onDownload={handleDownload}
              onEdit={openEditDialog}
              onDelete={handleDelete}
              canManage={canManageDocument}
              getFileIcon={getFileIcon}
              formatFileSize={formatFileSize}
              getCompanyName={getCompanyName}
            />
          </TabsContent>

          <TabsContent value="company" className="mt-4">
            <DocumentTable
              documents={filteredDocuments}
              loading={loading}
              onDownload={handleDownload}
              onEdit={openEditDialog}
              onDelete={handleDelete}
              canManage={canManageDocument}
              getFileIcon={getFileIcon}
              formatFileSize={formatFileSize}
              getCompanyName={getCompanyName}
            />
          </TabsContent>
        </Tabs>
          </TabsContent>

          <TabsContent value="protocols" className="mt-4">
            <Protocols embedded />
          </TabsContent>
        </Tabs>
      </div>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Dokument hochladen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Scope Selection */}
            <div>
              <Label>Bereich</Label>
              <Select 
                value={formScopeType} 
                onValueChange={(v) => setFormScopeType(v as 'club' | 'company')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {canManageClubDocs && (
                    <SelectItem value="club">Hauptverein</SelectItem>
                  )}
                  {companyDocPermissions.map(compId => (
                    <SelectItem key={compId} value="company">
                      {getCompanyName(compId)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Company selection if multiple */}
            {formScopeType === 'company' && companyDocPermissions.length > 1 && (
              <div>
                <Label>Kompanie</Label>
                <Select value={formScopeId} onValueChange={setFormScopeId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {companyDocPermissions.map(compId => (
                      <SelectItem key={compId} value={compId}>
                        {getCompanyName(compId)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Title */}
            <div>
              <Label>Titel *</Label>
              <Input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Dokumenttitel"
              />
            </div>

            {/* Description */}
            <div>
              <Label>Beschreibung</Label>
              <Textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Optionale Beschreibung..."
                rows={2}
              />
            </div>

            {/* Folder */}
            <div>
              <Label>Ordner</Label>
              <Select value={formFolder} onValueChange={setFormFolder}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEFAULT_FOLDERS.map(f => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                  <SelectItem value="custom">Neuer Ordner...</SelectItem>
                </SelectContent>
              </Select>
              {formFolder === 'custom' && (
                <Input
                  className="mt-2"
                  value={formCustomFolder}
                  onChange={(e) => setFormCustomFolder(e.target.value)}
                  placeholder="Ordnername eingeben"
                />
              )}
            </div>

            {/* Type */}
            <div>
              <Label>Typ</Label>
              <Select value={formType} onValueChange={(v) => setFormType(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* File */}
            <div>
              <Label>Datei *</Label>
              <Input
                type="file"
                onChange={(e) => setFormFile(e.target.files?.[0] || null)}
                className="cursor-pointer"
              />
              {formFile && (
                <p className="text-xs text-muted-foreground mt-1">
                  {formFile.name} ({formatFileSize(formFile.size)})
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button 
              onClick={handleUpload} 
              disabled={uploading || !formTitle.trim() || !formFile}
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Hochladen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Dokument bearbeiten</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Titel *</Label>
              <Input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Dokumenttitel"
              />
            </div>

            <div>
              <Label>Beschreibung</Label>
              <Textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Optionale Beschreibung..."
                rows={2}
              />
            </div>

            <div>
              <Label>Ordner</Label>
              <Select value={formFolder} onValueChange={setFormFolder}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allFolders.map(f => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                  <SelectItem value="custom">Neuer Ordner...</SelectItem>
                </SelectContent>
              </Select>
              {formFolder === 'custom' && (
                <Input
                  className="mt-2"
                  value={formCustomFolder}
                  onChange={(e) => setFormCustomFolder(e.target.value)}
                  placeholder="Ordnername eingeben"
                />
              )}
            </div>

            <div>
              <Label>Typ</Label>
              <Select value={formType} onValueChange={(v) => setFormType(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button 
              onClick={handleUpdate} 
              disabled={uploading || !formTitle.trim()}
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Speichern'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
};

// Document Table Component
interface DocumentTableProps {
  documents: Document[];
  loading: boolean;
  onDownload: (doc: Document) => void;
  onEdit: (doc: Document) => void;
  onDelete: (doc: Document) => void;
  canManage: (doc: Document) => boolean;
  getFileIcon: (mimeType: string | null) => React.ReactNode;
  formatFileSize: (bytes: number | null) => string;
  getCompanyName: (companyId: string) => string;
}

const DocumentTable = ({
  documents,
  loading,
  onDownload,
  onEdit,
  onDelete,
  canManage,
  getFileIcon,
  formatFileSize,
  getCompanyName,
}: DocumentTableProps) => {
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Keine Dokumente gefunden</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12"></TableHead>
            <TableHead>Titel</TableHead>
            <TableHead>Ordner</TableHead>
            <TableHead>Typ</TableHead>
            <TableHead>Größe</TableHead>
            <TableHead>Hochgeladen</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.map((doc) => (
            <TableRow key={doc.id}>
              <TableCell>{getFileIcon(doc.mime_type)}</TableCell>
              <TableCell>
                <div>
                  <p className="font-medium">{doc.title}</p>
                  <p className="text-xs text-muted-foreground">{doc.file_name}</p>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="gap-1">
                  <Folder className="w-3 h-3" />
                  {doc.folder}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant="secondary">
                  {DOCUMENT_TYPES.find(t => t.value === doc.type)?.label || doc.type}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatFileSize(doc.file_size)}
              </TableCell>
              <TableCell>
                <div className="text-sm">
                  <p>{format(new Date(doc.created_at), 'dd.MM.yyyy', { locale: de })}</p>
                  {doc.uploader && (
                    <p className="text-xs text-muted-foreground">
                      {doc.uploader.first_name} {doc.uploader.last_name}
                    </p>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onDownload(doc)}>
                      <Download className="w-4 h-4 mr-2" />
                      Herunterladen
                    </DropdownMenuItem>
                    {canManage(doc) && (
                      <>
                        <DropdownMenuItem onClick={() => onEdit(doc)}>
                          <Edit className="w-4 h-4 mr-2" />
                          Bearbeiten
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => onDelete(doc)}
                          className="text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Löschen
                        </DropdownMenuItem>
                      </>
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

export default Documents;