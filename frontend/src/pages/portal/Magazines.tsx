import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { 
  Plus, Book, Calendar, Edit, FileDown, Lock, 
  MoreHorizontal, Trash2, Loader2 
} from "lucide-react";
import PortalLayout from "@/components/portal/PortalLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Magazine {
  id: string;
  title: string;
  year: number;
  status: "draft" | "finalized";
  created_at: string;
  created_by_member_id: string | null;
  creator?: {
    first_name: string;
    last_name: string;
  };
  section_count?: number;
}

const Magazines = () => {
  const { member, hasPermission } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [magazines, setMagazines] = useState<Magazine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedMagazine, setSelectedMagazine] = useState<Magazine | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newYear, setNewYear] = useState(new Date().getFullYear());
  const [isSaving, setIsSaving] = useState(false);

  const canManage = hasPermission("club.magazine.manage");

  useEffect(() => {
    if (member?.club_id) fetchMagazines();
  }, [member?.club_id]);

  const fetchMagazines = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("magazines")
      .select(`
        *,
        creator:members!magazines_created_by_member_id_fkey(first_name, last_name),
        magazine_sections(id)
      `)
      .eq("club_id", member!.club_id)
      .order("year", { ascending: false });

    if (!error && data) {
      setMagazines(
        data.map((m: any) => ({
          ...m,
          section_count: m.magazine_sections?.length || 0,
        }))
      );
    }
    setIsLoading(false);
  };

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    setIsSaving(true);

    const { data, error } = await supabase
      .from("magazines")
      .insert({
        club_id: member!.club_id,
        title: newTitle.trim(),
        year: newYear,
        created_by_member_id: member!.id,
      })
      .select()
      .single();

    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Schützenheft erstellt" });
      setIsCreateOpen(false);
      setNewTitle("");
      navigate(`/portal/magazine/${data.id}`);
    }
    setIsSaving(false);
  };

  const handleDelete = async () => {
    if (!selectedMagazine) return;

    const { error } = await supabase
      .from("magazines")
      .delete()
      .eq("id", selectedMagazine.id);

    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Schützenheft gelöscht" });
      fetchMagazines();
    }
    setIsDeleteOpen(false);
    setSelectedMagazine(null);
  };

  const handleFinalize = async (magazine: Magazine) => {
    const { error } = await supabase
      .from("magazines")
      .update({ status: "finalized" })
      .eq("id", magazine.id);

    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Schützenheft finalisiert" });
      fetchMagazines();
    }
  };

  if (!canManage) {
    return (
      <PortalLayout>
        <p className="text-center py-12 text-muted-foreground">
          Keine Berechtigung für Schützenhefte
        </p>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8"
        >
          <div>
            <h1 className="font-display text-3xl font-bold">Schützenhefte</h1>
            <p className="text-muted-foreground">Festbücher und Jahreshefte verwalten</p>
          </div>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Neues Heft
          </Button>
        </motion.div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : magazines.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16 bg-card rounded-xl border"
          >
            <Book className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">Noch keine Schützenhefte</h3>
            <p className="text-muted-foreground mb-6">
              Erstellen Sie Ihr erstes Schützenheft für den Verein
            </p>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Erstes Heft erstellen
            </Button>
          </motion.div>
        ) : (
          <div className="grid gap-4">
            {magazines.map((magazine, index) => (
              <motion.div
                key={magazine.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-card rounded-xl border p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Book className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-medium text-lg">{magazine.title}</h3>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {magazine.year}
                        </span>
                        <span>{magazine.section_count} Kapitel</span>
                        {magazine.creator && (
                          <span>
                            von {magazine.creator.first_name} {magazine.creator.last_name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge
                      variant={magazine.status === "finalized" ? "default" : "secondary"}
                      className={magazine.status === "finalized" ? "bg-green-600" : ""}
                    >
                      {magazine.status === "finalized" ? (
                        <>
                          <Lock className="w-3 h-3 mr-1" />
                          Finalisiert
                        </>
                      ) : (
                        "Entwurf"
                      )}
                    </Badge>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/portal/magazine/${magazine.id}`)}>
                          <Edit className="w-4 h-4 mr-2" />
                          {magazine.status === "finalized" ? "Ansehen" : "Bearbeiten"}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate(`/portal/magazine/${magazine.id}/pdf`)}>
                          <FileDown className="w-4 h-4 mr-2" />
                          PDF erzeugen
                        </DropdownMenuItem>
                        {magazine.status === "draft" && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleFinalize(magazine)}>
                              <Lock className="w-4 h-4 mr-2" />
                              Finalisieren
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => {
                                setSelectedMagazine(magazine);
                                setIsDeleteOpen(true);
                              }}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Löschen
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Create Dialog */}
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Neues Schützenheft</DialogTitle>
              <DialogDescription>
                Erstellen Sie ein neues Schützenheft für Ihren Verein
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Titel</Label>
                <Input
                  id="title"
                  placeholder="z.B. Schützenheft 2025"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="year">Jahr</Label>
                <Input
                  id="year"
                  type="number"
                  min={2000}
                  max={2100}
                  value={newYear}
                  onChange={(e) => setNewYear(parseInt(e.target.value))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Abbrechen
              </Button>
              <Button onClick={handleCreate} disabled={!newTitle.trim() || isSaving}>
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Erstellen"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Schützenheft löschen?</AlertDialogTitle>
              <AlertDialogDescription>
                Das Schützenheft „{selectedMagazine?.title}" wird unwiderruflich gelöscht.
                Alle Kapitel und Inhalte gehen verloren.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                Löschen
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PortalLayout>
  );
};

export default Magazines;
