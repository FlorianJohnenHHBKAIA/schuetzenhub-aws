import { useState, useEffect, useMemo } from "react";
import { useSearchParams, Link } from "react-router-dom";
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
import { supabase, getStorageUrl } from "@/integrations/api/client";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { createNotificationsForMembers } from "@/hooks/useNotifications";
import PostDetailDialog from "@/components/portal/PostDetailDialog";
import PostPublicPreview from "@/components/portal/PostPublicPreview";
import EventContextBanner from "@/components/portal/EventContextBanner";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import {
  Megaphone,
  Plus,
  Edit,
  Trash2,
  Send,
  Clock,
  CheckCircle,
  XCircle,
  Shield,
  Building2,
  Globe,
  Users,
  AlertTriangle,
  Info,
  Calendar,
  Bell,
  Loader2,
  Search,
  Image as ImageIcon,
  ThumbsUp,
  MessageSquare,
  ArrowLeft,
  CalendarDays,
} from "lucide-react";

interface Post {
  id: string;
  club_id: string;
  owner_type: 'club' | 'company';
  owner_id: string;
  title: string;
  content: string;
  cover_image_path: string | null;
  category: 'announcement' | 'info' | 'event' | 'warning' | 'other';
  audience: 'company_only' | 'club_internal' | 'public';
  publication_status: 'draft' | 'submitted' | 'approved' | 'rejected';
  submitted_at: string | null;
  approved_at: string | null;
  approved_by_member_id: string | null;
  rejection_reason: string | null;
  created_by_member_id: string | null;
  created_at: string;
  event_id: string | null;
  creator?: { first_name: string; last_name: string } | null;
  approver?: { first_name: string; last_name: string } | null;
}

interface Company {
  id: string;
  name: string;
}

interface Event {
  id: string;
  title: string;
  start_at: string;
}

interface RawPermission {
  permission_key: string;
  scope_type?: string;
  scope_id?: string;
}

interface RawMembership {
  company_id: string;
}

interface RawClub {
  slug: string;
}

const CATEGORIES = [
  { value: 'announcement', label: 'Ankündigung', icon: Bell },
  { value: 'info', label: 'Information', icon: Info },
  { value: 'event', label: 'Veranstaltung', icon: Calendar },
  { value: 'warning', label: 'Wichtig', icon: AlertTriangle },
  { value: 'other', label: 'Sonstiges', icon: Megaphone },
];

const Posts = () => {
  const { user, member, isAdmin } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const linkedEventId = searchParams.get('event');
  const viewPostId = searchParams.get('view');

  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<Post[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [userCompanyId, setUserCompanyId] = useState<string | null>(null);
  const [linkedEvent, setLinkedEvent] = useState<Event | null>(null);
  const [clubSlug, setClubSlug] = useState<string>("");
  const [formCoverPreviewUrl, setFormCoverPreviewUrl] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'club' | 'company'>('club');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [canManageClubPosts, setCanManageClubPosts] = useState(false);
  const [companyPostPermissions, setCompanyPostPermissions] = useState<string[]>([]);
  const [companySubmitPermissions, setCompanySubmitPermissions] = useState<string[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formCategory, setFormCategory] = useState<string>('info');
  const [formAudience, setFormAudience] = useState<string>('club_internal');
  const [formOwnerType, setFormOwnerType] = useState<'club' | 'company'>('club');
  const [formOwnerId, setFormOwnerId] = useState('');
  const [formEventId, setFormEventId] = useState<string | null>(null);
  const [formCoverImage, setFormCoverImage] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchLinkedEvent = async () => {
      if (!linkedEventId || !member) return;
      const { data } = await supabase.from('events').select('id, title, start_at').eq('id', linkedEventId).single();
      if (data) { setLinkedEvent(data as Event); setFormEventId((data as Event).id); }
    };
    fetchLinkedEvent();
  }, [linkedEventId, member]);

  useEffect(() => {
    const loadViewPost = async () => {
      if (!viewPostId || !member) return;
      const { data } = await supabase
        .from('posts')
        .select(`*, creator:members!created_by_member_id(first_name, last_name), approver:members!approved_by_member_id(first_name, last_name)`)
        .eq('id', viewPostId)
        .single();
      if (data) { setSelectedPost(data as Post); setDetailDialogOpen(true); }
    };
    loadViewPost();
  }, [viewPostId, member]);

  useEffect(() => {
    if (user && member) { fetchData(); checkPermissions(); }
  }, [user, member]);

  const checkPermissions = async () => {
    if (!user || !member) return;

    const { data: permData } = await supabase.rpc('get_user_permissions', {
      _user_id: user.id,
      _club_id: member.club_id
    });

    const permissions = (permData as RawPermission[]) || [];
    const hasFullAdmin = permissions.some((p) => p.permission_key === 'club.admin.full');
    const hasClubPosts = permissions.some((p) => p.permission_key === 'club.posts.manage');
    setCanManageClubPosts(hasFullAdmin || hasClubPosts || isAdmin);

    const companyPostPerms = permissions
      .filter((p) => p.permission_key === 'company.posts.manage' && p.scope_type === 'company')
      .map((p) => p.scope_id)
      .filter((id): id is string => id !== undefined);
    setCompanyPostPermissions(companyPostPerms);

    const companySubmitPerms = permissions
      .filter((p) => p.permission_key === 'company.posts.submit_publication' && p.scope_type === 'company')
      .map((p) => p.scope_id)
      .filter((id): id is string => id !== undefined);
    setCompanySubmitPermissions(companySubmitPerms);
  };

  const fetchData = async () => {
    if (!member) return;
    setLoading(true);

    try {
      const { data: clubData } = await supabase.from("clubs").select("slug").eq("id", member.club_id).single();
      setClubSlug((clubData as RawClub | null)?.slug || "");

      const { data: companiesData } = await supabase.from('companies').select('id, name').eq('club_id', member.club_id).order('name');
      setCompanies((companiesData as Company[]) || []);

      const { data: membershipData } = await supabase
        .from('member_company_memberships').select('company_id').eq('member_id', member.id).is('valid_to', null).maybeSingle();
      if (membershipData) {
        const raw = membershipData as RawMembership;
        setUserCompanyId(raw.company_id);
        setFormOwnerId(raw.company_id);
      }

      const { data: postsData, error } = await supabase
        .from('posts')
        .select(`*, creator:members!created_by_member_id(first_name, last_name), approver:members!approved_by_member_id(first_name, last_name)`)
        .eq('club_id', member.club_id)
        .order('created_at', { ascending: false });

      if (error) { console.error('Error fetching posts:', error); }
      else { setPosts((postsData as Post[]) || []); }
    } catch (error: unknown) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (asDraft = true) => {
    if (!member || !formTitle.trim() || !formContent.trim()) return;
    setSaving(true);

    try {
      let coverPath = editingPost?.cover_image_path || null;

      if (formCoverImage) {
        const fileExt = formCoverImage.name.split('.').pop();
        const fileName = `${member.club_id}/${crypto.randomUUID()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('post-images').upload(fileName, formCoverImage);
        if (uploadError) throw uploadError;
        coverPath = fileName;
      }

      const ownerId = formOwnerType === 'club' ? member.club_id : formOwnerId;
      const audienceTyped = formAudience as 'company_only' | 'club_internal' | 'public';
      const categoryTyped = formCategory as 'announcement' | 'info' | 'event' | 'warning' | 'other';
      const statusTyped = (asDraft ? 'draft' : 'submitted') as 'draft' | 'submitted' | 'approved' | 'rejected';

      if (editingPost) {
        const { error } = await supabase.from('posts').update({
          title: formTitle.trim(), content: formContent.trim(), cover_image_path: coverPath,
          category: categoryTyped, audience: audienceTyped, publication_status: statusTyped,
          submitted_at: asDraft ? null : new Date().toISOString(),
        }).eq('id', editingPost.id);
        if (error) throw error;
        toast({ title: 'Beitrag aktualisiert' });
      } else {
        const { error } = await supabase.from('posts').insert({
          club_id: member.club_id, owner_type: formOwnerType, owner_id: ownerId,
          title: formTitle.trim(), content: formContent.trim(), cover_image_path: coverPath,
          category: categoryTyped, audience: audienceTyped, publication_status: statusTyped,
          submitted_at: asDraft ? null : new Date().toISOString(),
          created_by_member_id: member.id, event_id: formEventId,
        });
        if (error) throw error;
        toast({ title: asDraft ? 'Entwurf gespeichert' : 'Beitrag eingereicht' });
      }

      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: unknown) {
      toast({ title: 'Fehler', description: error instanceof Error ? error.message : undefined, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (post: Post) => {
    try {
      const { error } = await supabase.from('posts').update({ publication_status: 'submitted', submitted_at: new Date().toISOString() }).eq('id', post.id);
      if (error) throw error;
      toast({ title: 'Beitrag eingereicht' });
      fetchData();
    } catch (error: unknown) {
      toast({ title: 'Fehler', description: error instanceof Error ? error.message : undefined, variant: 'destructive' });
    }
  };

  const handleDelete = async (post: Post) => {
    if (!confirm(`Beitrag "${post.title}" wirklich löschen?`)) return;
    try {
      if (post.cover_image_path) await supabase.storage.from('post-images').remove([post.cover_image_path]);
      const { error } = await supabase.from('posts').delete().eq('id', post.id);
      if (error) throw error;
      toast({ title: 'Beitrag gelöscht' });
      fetchData();
    } catch (error: unknown) {
      toast({ title: 'Fehler', description: error instanceof Error ? error.message : undefined, variant: 'destructive' });
    }
  };

  const resetForm = () => {
    setFormTitle(''); setFormContent(''); setFormCategory('info'); setFormAudience('club_internal');
    setFormOwnerType('club'); setFormCoverImage(null); setEditingPost(null);
  };

  const openCreateDialog = () => {
    resetForm();
    if (canManageClubPosts) { setFormOwnerType('club'); }
    else if (companyPostPermissions.length > 0) { setFormOwnerType('company'); setFormOwnerId(companyPostPermissions[0]); }
    setDialogOpen(true);
  };

  const openEditDialog = (post: Post) => {
    setEditingPost(post); setFormTitle(post.title); setFormContent(post.content);
    setFormCategory(post.category); setFormAudience(post.audience);
    setFormOwnerType(post.owner_type); setFormOwnerId(post.owner_id);
    setDialogOpen(true);
  };

  const canManagePost = (post: Post): boolean =>
    post.owner_type === 'club' ? canManageClubPosts : companyPostPermissions.includes(post.owner_id);

  const canSubmitPost = (post: Post): boolean =>
    post.owner_type === 'club' ? canManageClubPosts : companySubmitPermissions.includes(post.owner_id) || companyPostPermissions.includes(post.owner_id);

  const getCompanyName = (companyId: string): string =>
    companies.find(c => c.id === companyId)?.name || 'Unbekannt';

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft': return <Badge variant="secondary" className="gap-1"><Clock className="w-3 h-3" />Entwurf</Badge>;
      case 'submitted': return <Badge variant="outline" className="gap-1 border-yellow-500 text-yellow-600"><Send className="w-3 h-3" />Eingereicht</Badge>;
      case 'approved': return <Badge variant="default" className="gap-1 bg-green-600"><CheckCircle className="w-3 h-3" />Freigegeben</Badge>;
      case 'rejected': return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" />Abgelehnt</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getAudienceBadge = (audience: string) => {
    switch (audience) {
      case 'company_only': return <Badge variant="outline" className="gap-1"><Building2 className="w-3 h-3" />Kompanie</Badge>;
      case 'club_internal': return <Badge variant="outline" className="gap-1"><Users className="w-3 h-3" />Verein</Badge>;
      case 'public': return <Badge variant="outline" className="gap-1"><Globe className="w-3 h-3" />Öffentlich</Badge>;
      default: return <Badge variant="outline">{audience}</Badge>;
    }
  };

  const getCategoryIcon = (category: string) => {
    const cat = CATEGORIES.find(c => c.value === category);
    return cat ? <cat.icon className="w-4 h-4" /> : <Megaphone className="w-4 h-4" />;
  };

  const filteredPosts = useMemo(() => {
    return posts.filter(p => {
      if (activeTab === 'club' && p.owner_type !== 'club') return false;
      if (activeTab === 'company') {
        if (p.owner_type !== 'company') return false;
        if (p.owner_id !== userCompanyId && !companyPostPermissions.includes(p.owner_id)) return false;
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!p.title.toLowerCase().includes(q) && !p.content.toLowerCase().includes(q)) return false;
      }
      if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
      if (statusFilter !== 'all' && p.publication_status !== statusFilter) return false;
      return true;
    });
  }, [posts, activeTab, searchQuery, categoryFilter, statusFilter, userCompanyId, companyPostPermissions]);

  const canCreate = canManageClubPosts || companyPostPermissions.length > 0;

  return (
    <PortalLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <EventContextBanner />

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex justify-between items-start">
          <div>
            <h1 className="font-display text-3xl font-bold flex items-center gap-3"><Megaphone className="w-8 h-8" />Aushang</h1>
            <p className="text-muted-foreground mt-1">Mitteilungen und Ankündigungen</p>
          </div>
          {canCreate && <Button onClick={openCreateDialog}><Plus className="w-4 h-4 mr-2" />Beitrag erstellen</Button>}
        </motion.div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'club' | 'company')}>
          <TabsList>
            <TabsTrigger value="club" className="flex items-center gap-2"><Shield className="w-4 h-4" />Verein</TabsTrigger>
            {userCompanyId && <TabsTrigger value="company" className="flex items-center gap-2"><Building2 className="w-4 h-4" />Meine Kompanie</TabsTrigger>}
          </TabsList>

          <Card className="mt-4">
            <CardContent className="py-4">
              <div className="flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-48">
                  <Label className="text-xs">Suche</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input placeholder="Titel oder Inhalt..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Kategorie</Label>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle</SelectItem>
                      {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
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
            <PostGrid posts={filteredPosts} loading={loading} onView={(p) => { setSelectedPost(p); setDetailDialogOpen(true); }} onEdit={openEditDialog} onDelete={handleDelete} onSubmit={handleSubmit} canManage={canManagePost} canSubmit={canSubmitPost} getStatusBadge={getStatusBadge} getAudienceBadge={getAudienceBadge} getCategoryIcon={getCategoryIcon} getCompanyName={getCompanyName} />
          </TabsContent>
          <TabsContent value="company" className="mt-4">
            <PostGrid posts={filteredPosts} loading={loading} onView={(p) => { setSelectedPost(p); setDetailDialogOpen(true); }} onEdit={openEditDialog} onDelete={handleDelete} onSubmit={handleSubmit} canManage={canManagePost} canSubmit={canSubmitPost} getStatusBadge={getStatusBadge} getAudienceBadge={getAudienceBadge} getCategoryIcon={getCategoryIcon} getCompanyName={getCompanyName} />
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className={`${formAudience === 'public' ? 'sm:max-w-3xl' : 'max-w-2xl'} max-h-[90vh] flex flex-col`}>
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>{editingPost ? 'Beitrag bearbeiten' : 'Beitrag erstellen'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 overflow-y-auto flex-1 pr-2">
            <div>
              <Label>Bereich</Label>
              <Select value={formOwnerType} onValueChange={(v) => setFormOwnerType(v as 'club' | 'company')} disabled={!!editingPost}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {canManageClubPosts && <SelectItem value="club">Hauptverein</SelectItem>}
                  {companyPostPermissions.map(compId => <SelectItem key={compId} value="company">{getCompanyName(compId)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Titel *</Label><Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="Beitragstitel" /></div>
            <div><Label>Inhalt *</Label><Textarea value={formContent} onChange={(e) => setFormContent(e.target.value)} placeholder="Beitragsinhalt..." rows={8} /></div>
            <div>
              <Label>Kategorie</Label>
              <Select value={formCategory} onValueChange={setFormCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Sichtbarkeit</Label>
              <Select value={formAudience} onValueChange={setFormAudience}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {formOwnerType === 'company' && <SelectItem value="company_only">Nur Kompanie</SelectItem>}
                  <SelectItem value="club_internal">Verein intern</SelectItem>
                  <SelectItem value="public">Öffentlich (nach Freigabe)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Titelbild (optional)</Label>
              <Input type="file" accept="image/*" onChange={(e) => { const file = e.target.files?.[0] || null; setFormCoverImage(file); setFormCoverPreviewUrl(file ? URL.createObjectURL(file) : null); }} />
            </div>
            {formAudience === 'public' && (
              <PostPublicPreview title={formTitle} content={formContent} category={formCategory} coverImageUrl={formCoverPreviewUrl || (editingPost?.cover_image_path ? getStorageUrl("post-images", editingPost.cover_image_path) || "" : null)} postId={editingPost?.id} clubSlug={clubSlug} createdAt={editingPost?.created_at} />
            )}
          </div>
          <DialogFooter className="flex-shrink-0 pt-4 border-t flex-wrap gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
            <Button variant="secondary" onClick={() => handleSave(true)} disabled={saving || !formTitle.trim() || !formContent.trim()}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Als Entwurf speichern'}
            </Button>
            {formAudience === 'public' && (
              <Button onClick={() => handleSave(false)} disabled={saving || !formTitle.trim() || !formContent.trim()}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Zur Freigabe einreichen'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PostDetailDialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen} post={selectedPost} />
    </PortalLayout>
  );
};

interface PostGridProps {
  posts: Post[];
  loading: boolean;
  onView: (post: Post) => void;
  onEdit: (post: Post) => void;
  onDelete: (post: Post) => void;
  onSubmit: (post: Post) => void;
  canManage: (post: Post) => boolean;
  canSubmit: (post: Post) => boolean;
  getStatusBadge: (status: string) => React.ReactNode;
  getAudienceBadge: (audience: string) => React.ReactNode;
  getCategoryIcon: (category: string) => React.ReactNode;
  getCompanyName: (companyId: string) => string;
}

const PostGrid = ({ posts, loading, onView, onEdit, onDelete, onSubmit, canManage, canSubmit, getStatusBadge, getAudienceBadge, getCategoryIcon, getCompanyName }: PostGridProps) => {
  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  if (posts.length === 0) return <Card><CardContent className="py-12 text-center"><Megaphone className="w-12 h-12 mx-auto mb-4 text-muted-foreground" /><p className="text-muted-foreground">Keine Beiträge gefunden</p></CardContent></Card>;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {posts.map((post) => (
        <Card key={post.id} className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer" onClick={() => onView(post)}>
          {post.cover_image_path && (
            <div className="h-32 bg-muted">
              <img src={`${getStorageUrl("post-images", post.cover_image_path) || ""}`} alt={post.title} className="w-full h-full object-cover" />
            </div>
          )}
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-1 mb-2">{getStatusBadge(post.publication_status)}{getAudienceBadge(post.audience)}</div>
            <div className="flex items-start gap-2 mb-2">{getCategoryIcon(post.category)}<h3 className="font-semibold line-clamp-2">{post.title}</h3></div>
            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{post.content}</p>
            <div className="text-xs text-muted-foreground">{format(new Date(post.created_at), 'dd.MM.yyyy', { locale: de })}</div>
            {canManage(post) && (
              <div className="flex gap-2 mt-3 pt-3 border-t" onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="sm" onClick={() => onEdit(post)}><Edit className="w-4 h-4" /></Button>
                {post.publication_status === 'draft' && canSubmit(post) && post.audience === 'public' && (
                  <Button variant="ghost" size="sm" onClick={() => onSubmit(post)}><Send className="w-4 h-4" /></Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => onDelete(post)} className="text-destructive"><Trash2 className="w-4 h-4" /></Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default Posts;