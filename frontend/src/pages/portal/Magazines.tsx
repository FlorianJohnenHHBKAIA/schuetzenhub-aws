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
import { apiJson } from "@/integrations/api/client";
import { useToast } from "@/hooks/use-toast";

interface Magazine {
  id: string;
  title: string;
  year: number;
  status: "draft" | "finalized";
  created_at: string;
  creator_first_name?: string;
  creator_last_name?: string;
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
    try {
      const data = await apiJson<Magazine[]>("/api/magazines");
      setMagazines(data || []);
    } catch (e) {
      console.error("Fehler beim Laden:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    setIsSaving(true);
    try {
      const data = await apiJson<Magazine>("/api/magazines", {
        method: "POST",
        body: JSON.stringify({ title: newTitle.trim(), year: newYear }),
      });
      toast({ title: "Schuetzenheft erstellt" });
      setIsCreateOpen(false);
      setNewTitle("");
      navigate(`/portal/magazine/${data.id}`);
    } catch (e) {
      toast({ title: "Fehler beim Erstellen", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedMagazine) return;
    try {
      await apiJson(`/api/magazines/${selectedMagazine.id}`, { method: "DELETE" });
      toast({ title: "Schuetzenheft geloescht" });
      fetchMagazines();
    } catch (e) {
      toast({ title: "Fehler beim Loeschen", variant: "destructive" });
    } finally {
      setIsDeleteOpen(false);
      setSelectedMagazine(null);
    }
  };

  const handleFinalize = async (magazine: Magazine) => {
    try {
      await apiJson(`/api/magazines/${magazine.id}`, {
        method: "PUT",
        body: JSON.stringify({ status: "finalized" }),
      });
      toast({ title: "Schuetzenheft finalisiert" });
      fetchMagazines();
    } catch (e) {
      toast({ title: "Fehler", variant: "destructive" });
    }
  };

  if (!canManage) {
    return (
      <PortalLayout>
        <p className="text-center py-12 text-muted-foreground">
          Keine Berechtigung fuer Schuetzenhefte
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
            <h1 className="font-display text-3xl font-bold">Schuetzenhefte</h1>
            <p className="text-muted-foreground">Festbuecher und Jahreshefte verwalten</p>
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
            <h3 className="text-lg font-medium mb-2">Noch keine Schuetzenhefte</h3>
            <p className="text-muted-foreground mb-6">
              Erstellen Sie Ihr erstes Schuetzenheft fuer den Verein
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
                        <span>{magazine.section_count || 0} Kapitel</span>
                        {magazine.creator_first_name && (
                          <span>von {magazine.creator_first_name} {magazine.creator_last_name}</span>
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
                        <><Lock className="w-3 h-3 mr-1" />Finalisiert</>
                      ) : "Entwurf"}
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
                              onClick={() => { setSelectedMagazine(magazine); setIsDeleteOpen(true); }}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Loeschen
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

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Neues Schuetzenheft</DialogTitle>
              <DialogDescription>Erstellen Sie ein neues Schuetzenheft fuer Ihren Verein</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Titel</Label>
                <Input
                  id="title"
                  placeholder="z.B. Schuetzenheft 2025"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
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
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Abbrechen</Button>
              <Button onClick={handleCreate} disabled={!newTitle.trim() || isSaving}>
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Erstellen"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Schuetzenheft loeschen?</AlertDialogTitle>
              <AlertDialogDescription>
                Das Schuetzenheft "{selectedMagazine?.title}" wird unwiderruflich geloescht.
                Alle Kapitel und Inhalte gehen verloren.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                Loeschen
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PortalLayout>
  );
};

export default Magazines;