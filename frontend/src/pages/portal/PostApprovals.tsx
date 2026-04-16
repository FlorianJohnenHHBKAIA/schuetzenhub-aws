import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import PortalLayout from "@/components/portal/PortalLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import { format } from "date-fns";
import { de } from "date-fns/locale";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Send,
  Globe,
  Users,
  Building2,
  Eye,
} from "lucide-react";

interface Post {
  id: string;
  club_id: string;
  owner_type: 'club' | 'company';
  owner_id: string;
  title: string;
  content: string;
  cover_image_path: string | null;
  category: string;
  audience: 'company_only' | 'club_internal' | 'public';
  publication_status: string;
  submitted_at: string | null;
  created_at: string;
  created_by_member_id: string | null;
  creator?: { first_name: string; last_name: string } | null;
  company?: { name: string } | null;
}

interface RawPost {
  id: string;
  club_id: string;
  owner_type: 'club' | 'company';
  owner_id: string;
  title: string;
  content: string;
  cover_image_path: string | null;
  category: string;
  audience: 'company_only' | 'club_internal' | 'public';
  publication_status: string;
  submitted_at: string | null;
  created_at: string;
  created_by_member_id: string | null;
  creator?: { first_name: string; last_name: string } | null;
}

interface RawClubMember {
  id: string;
}

interface RawCompanyMember {
  member_id: string;
}

interface RawCompany {
  name: string;
}

const PostApprovals = () => {
  const { user, member } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (user && member) fetchSubmittedPosts();
  }, [user, member]);

  const fetchSubmittedPosts = async () => {
    if (!member) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`*, creator:members!created_by_member_id(first_name, last_name)`)
        .eq('club_id', member.club_id)
        .eq('publication_status', 'submitted')
        .order('submitted_at', { ascending: true });

      if (error) {
        console.error('Error fetching posts:', error);
      } else {
        const rawPosts = (data as RawPost[]) || [];
        const postsWithCompanies = await Promise.all(rawPosts.map(async (post) => {
          if (post.owner_type === 'company') {
            const { data: companyData } = await supabase
              .from('companies')
              .select('name')
              .eq('id', post.owner_id)
              .single();
            return { ...post, company: (companyData as RawCompany | null) };
          }
          return post as Post;
        }));
        setPosts(postsWithCompanies);
      }
    } catch (error: unknown) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (post: Post) => {
    if (!member) return;
    setProcessing(true);

    try {
      const { error } = await supabase
        .from('posts')
        .update({
          publication_status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by_member_id: member.id,
          rejection_reason: null,
        })
        .eq('id', post.id);

      if (error) throw error;

      if (post.audience === 'club_internal') {
        const { data: clubMembers } = await supabase
          .from('members')
          .select('id')
          .eq('club_id', post.club_id)
          .in('status', ['active', 'passive']);

        if (clubMembers) {
          await createNotificationsForMembers(
            post.club_id,
            (clubMembers as RawClubMember[]).map(m => m.id),
            'new_post',
            post.id,
            post.created_by_member_id || undefined
          );
        }
      } else if (post.audience === 'company_only' && post.owner_type === 'company') {
        const { data: companyMembers } = await supabase
          .from('member_company_memberships')
          .select('member_id')
          .eq('company_id', post.owner_id)
          .is('valid_to', null);

        if (companyMembers) {
          await createNotificationsForMembers(
            post.club_id,
            (companyMembers as RawCompanyMember[]).map(m => m.member_id),
            'new_post',
            post.id,
            post.created_by_member_id || undefined
          );
        }
      }

      toast({ title: 'Beitrag freigegeben' });
      setDetailDialogOpen(false);
      fetchSubmittedPosts();
    } catch (error: unknown) {
      toast({ title: 'Fehler', description: error instanceof Error ? error.message : undefined, variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedPost || !rejectionReason.trim()) return;
    setProcessing(true);

    try {
      const { error } = await supabase
        .from('posts')
        .update({ publication_status: 'rejected', rejection_reason: rejectionReason.trim() })
        .eq('id', selectedPost.id);

      if (error) throw error;
      toast({ title: 'Beitrag abgelehnt' });
      setRejectDialogOpen(false);
      setDetailDialogOpen(false);
      setRejectionReason('');
      fetchSubmittedPosts();
    } catch (error: unknown) {
      toast({ title: 'Fehler', description: error instanceof Error ? error.message : undefined, variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  const getAudienceBadge = (audience: string) => {
    switch (audience) {
      case 'company_only':
        return <Badge variant="outline" className="gap-1"><Building2 className="w-3 h-3" />Kompanie</Badge>;
      case 'club_internal':
        return <Badge variant="outline" className="gap-1"><Users className="w-3 h-3" />Verein</Badge>;
      case 'public':
        return <Badge variant="outline" className="gap-1"><Globe className="w-3 h-3" />Öffentlich</Badge>;
      default:
        return <Badge variant="outline">{audience}</Badge>;
    }
  };

  return (
    <PortalLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display text-3xl font-bold flex items-center gap-3">
            <Send className="w-8 h-8" />Beitrags-Freigaben
          </h1>
          <p className="text-muted-foreground mt-1">Eingereichte Beiträge zur Freigabe</p>
        </motion.div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : posts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-green-500" />
              <p className="text-muted-foreground">Keine Beiträge zur Freigabe</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <Card key={post.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap gap-2 mb-2">
                        {getAudienceBadge(post.audience)}
                        {post.owner_type === 'company' && post.company && <Badge variant="secondary">{post.company.name}</Badge>}
                        {post.owner_type === 'club' && <Badge variant="secondary">Hauptverein</Badge>}
                      </div>
                      <h3 className="font-semibold text-lg">{post.title}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{post.content}</p>
                      <div className="text-xs text-muted-foreground mt-2">
                        {post.creator && <span>Eingereicht von {post.creator.first_name} {post.creator.last_name}</span>}
                        {post.submitted_at && <span> am {format(new Date(post.submitted_at), 'dd.MM.yyyy HH:mm', { locale: de })}</span>}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button variant="outline" size="sm" onClick={() => { setSelectedPost(post); setDetailDialogOpen(true); }}><Eye className="w-4 h-4" /></Button>
                      <Button variant="default" size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleApprove(post)} disabled={processing}><CheckCircle2 className="w-4 h-4" /></Button>
                      <Button variant="destructive" size="sm" onClick={() => { setSelectedPost(post); setRejectDialogOpen(true); }} disabled={processing}><XCircle className="w-4 h-4" /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Beitrag Vorschau</DialogTitle></DialogHeader>
          {selectedPost && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">{getAudienceBadge(selectedPost.audience)}</div>
              {selectedPost.cover_image_path && (
                <img src={`${getStorageUrl("post-images", selectedPost.cover_image_path) || ""}`} alt={selectedPost.title} className="w-full h-48 object-cover rounded-lg" />
              )}
              <h2 className="text-xl font-bold">{selectedPost.title}</h2>
              <div className="prose prose-sm max-w-none"><p className="whitespace-pre-wrap">{selectedPost.content}</p></div>
              <div className="text-sm text-muted-foreground">
                {selectedPost.creator && <p>Erstellt von {selectedPost.creator.first_name} {selectedPost.creator.last_name}</p>}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>Schließen</Button>
            <Button variant="destructive" onClick={() => setRejectDialogOpen(true)} disabled={processing}><XCircle className="w-4 h-4 mr-2" />Ablehnen</Button>
            <Button className="bg-green-600 hover:bg-green-700" onClick={() => selectedPost && handleApprove(selectedPost)} disabled={processing}>
              {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4 mr-2" />Freigeben</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Beitrag ablehnen</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Ablehnungsgrund *</Label>
              <Textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="Bitte geben Sie einen Grund an..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Abbrechen</Button>
            <Button variant="destructive" onClick={handleReject} disabled={!rejectionReason.trim() || processing}>
              {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Ablehnen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
};

export default PostApprovals;