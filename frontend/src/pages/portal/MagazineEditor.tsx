import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, Reorder } from "framer-motion";
import {
  ArrowLeft, Plus, GripVertical, Trash2, FileText, Image,
  Calendar, Award, Users, MessageSquare, Loader2, FileDown, Lock, Megaphone
} from "lucide-react";
import PortalLayout from "@/components/portal/PortalLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/lib/auth";
import { apiJson } from "@/integrations/api/client";
import { useToast } from "@/hooks/use-toast";
import MagazineSectionContent from "@/components/magazine/MagazineSectionContent";

interface Magazine {
  id: string;
  title: string;
  year: number;
  status: "draft" | "finalized";
  club_id: string;
}

interface Section {
  id: string;
  magazine_id: string;
  type: string;
  title: string;
  order_index: number;
}

interface MagazineItem {
  id: string;
  section_id: string;
  content_type: string;
  content_id: string | null;
  custom_text: string | null;
  company_id: string | null;
  order_index: number;
}

const SECTION_TYPES = [
  { value: "greeting", label: "Grußwort", icon: MessageSquare },
  { value: "report", label: "Bericht", icon: FileText },
  { value: "company_reports", label: "Kompanieberichte", icon: Users },
  { value: "events", label: "Veranstaltungen", icon: Calendar },
  { value: "honors", label: "Ehrungen", icon: Award },
  { value: "custom", label: "Freier Abschnitt", icon: FileText },
];

const MagazineEditor = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { member, hasPermission } = useAuth();
  const { toast } = useToast();

  const [magazine, setMagazine] = useState<Magazine | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [items, setItems] = useState<MagazineItem[]>([]);
  const [selectedSection, setSelectedSection] = useState<Section | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [isAddSectionOpen, setIsAddSectionOpen] = useState(false);
  const [isDeleteSectionOpen, setIsDeleteSectionOpen] = useState(false);
  const [newSectionType, setNewSectionType] = useState("custom");
  const [newSectionTitle, setNewSectionTitle] = useState("");

  const canManage = hasPermission("club.magazine.manage");
  const isEditable = magazine?.status === "draft" && canManage;

  const fetchMagazineData = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const mag = await apiJson<Magazine>(`/api/magazines/${id}`);
      setMagazine(mag);

      const { sections: secs, items: its } = await apiJson<{ sections: Section[]; items: MagazineItem[] }>(
        `/api/magazines/${id}/sections`
      );
      setSections(secs || []);
      setItems(its || []);
      if (secs?.length > 0) setSelectedSection(secs[0]);
    } catch (e) {
      toast({ title: "Fehler", description: "Schuetzenheft nicht gefunden", variant: "destructive" });
      navigate("/portal/magazine");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchMagazineData(); }, [fetchMagazineData]);

  const handleAddSection = async () => {
    if (!newSectionTitle.trim() || !id) return;
    setIsSaving(true);
    try {
      const maxOrder = Math.max(...sections.map((s) => s.order_index), -1);
      const data = await apiJson<Section>(`/api/magazines/${id}/sections`, {
        method: "POST",
        body: JSON.stringify({ title: newSectionTitle.trim(), type: newSectionType, order_index: maxOrder + 1 }),
      });
      setSections([...sections, data]);
      setSelectedSection(data);
      setIsAddSectionOpen(false);
      setNewSectionTitle("");
      setNewSectionType("custom");
      toast({ title: "Kapitel hinzugefuegt" });
    } catch (e) {
      toast({ title: "Fehler", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSection = async () => {
    if (!selectedSection) return;
    try {
      await apiJson(`/api/magazine-sections/${selectedSection.id}`, { method: "DELETE" });
      const newSections = sections.filter((s) => s.id !== selectedSection.id);
      setSections(newSections);
      setSelectedSection(newSections[0] || null);
      setItems(items.filter((i) => i.section_id !== selectedSection.id));
      toast({ title: "Kapitel geloescht" });
    } catch (e) {
      toast({ title: "Fehler", variant: "destructive" });
    } finally {
      setIsDeleteSectionOpen(false);
    }
  };

  const handleReorderSections = async (newOrder: Section[]) => {
    setSections(newOrder);
    await Promise.all(
      newOrder.map((s, i) => apiJson(`/api/magazine-sections/${s.id}`, {
        method: "PUT", body: JSON.stringify({ order_index: i }),
      }))
    );
  };

  const handleAddContent = async (contentType: string, contentId: string | null, customText?: string, companyId?: string) => {
    if (!selectedSection) return;
    try {
      const sectionItems = items.filter((i) => i.section_id === selectedSection.id);
      const maxOrder = Math.max(...sectionItems.map((i) => i.order_index), -1);
      const data = await apiJson<MagazineItem>("/api/magazine-items", {
        method: "POST",
        body: JSON.stringify({
          section_id: selectedSection.id,
          content_type: contentType,
          content_id: contentId,
          custom_text: customText || null,
          company_id: companyId || null,
          order_index: maxOrder + 1,
        }),
      });
      setItems([...items, data]);
      toast({ title: "Inhalt hinzugefuegt" });
    } catch (e) {
      toast({ title: "Fehler", variant: "destructive" });
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      await apiJson(`/api/magazine-items/${itemId}`, { method: "DELETE" });
      setItems(items.filter((i) => i.id !== itemId));
    } catch (e) {
      toast({ title: "Fehler", variant: "destructive" });
    }
  };

  const handleReorderItems = async (sectionId: string, newOrder: MagazineItem[]) => {
    const otherItems = items.filter((i) => i.section_id !== sectionId);
    setItems([...otherItems, ...newOrder]);
    await Promise.all(
      newOrder.map((item, i) => apiJson(`/api/magazine-items/${item.id}`, {
        method: "PUT", body: JSON.stringify({ order_index: i }),
      }))
    );
  };

  const handleUpdateItemText = async (itemId: string, text: string) => {
    try {
      await apiJson(`/api/magazine-items/${itemId}`, {
        method: "PUT", body: JSON.stringify({ custom_text: text }),
      });
      setItems(items.map((i) => (i.id === itemId ? { ...i, custom_text: text } : i)));
    } catch (e) {
      toast({ title: "Fehler", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <PortalLayout>
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </PortalLayout>
    );
  }

  if (!magazine) {
    return (
      <PortalLayout>
        <p className="text-center py-12 text-muted-foreground">Schuetzenheft nicht gefunden</p>
      </PortalLayout>
    );
  }

  const sectionItems = selectedSection ? items.filter((i) => i.section_id === selectedSection.id) : [];

  return (
    <PortalLayout>
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-6"
        >
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/portal/magazine")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-display text-2xl font-bold">{magazine.title}</h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>{magazine.year}</span>
                <Badge variant={magazine.status === "finalized" ? "default" : "secondary"}>
                  {magazine.status === "finalized" ? <><Lock className="w-3 h-3 mr-1" />Finalisiert</> : "Entwurf"}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate(`/portal/magazine/${id}/ads`)}>
              <Megaphone className="w-4 h-4 mr-2" />Anzeigen
            </Button>
            <Button variant="outline" onClick={() => navigate(`/portal/magazine/${id}/pdf`)}>
              <FileDown className="w-4 h-4 mr-2" />PDF erzeugen
            </Button>
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Sections */}
          <div className="lg:col-span-1">
            <div className="bg-card rounded-xl border p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium">Kapitel</h3>
                {isEditable && (
                  <Button size="sm" variant="outline" onClick={() => setIsAddSectionOpen(true)}>
                    <Plus className="w-4 h-4 mr-1" />Hinzufuegen
                  </Button>
                )}
              </div>
              {sections.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Noch keine Kapitel. Fuegen Sie das erste Kapitel hinzu.
                </p>
              ) : (
                <Reorder.Group axis="y" values={sections} onReorder={isEditable ? handleReorderSections : () => {}} className="space-y-2">
                  {sections.map((section) => {
                    const typeInfo = SECTION_TYPES.find((t) => t.value === section.type);
                    const Icon = typeInfo?.icon || FileText;
                    const itemCount = items.filter((i) => i.section_id === section.id).length;
                    return (
                      <Reorder.Item
                        key={section.id}
                        value={section}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedSection?.id === section.id ? "bg-primary/10 border-primary" : "bg-background hover:bg-muted/50"
                        }`}
                        onClick={() => setSelectedSection(section)}
                      >
                        {isEditable && <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />}
                        <Icon className="w-4 h-4 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{section.title}</p>
                          <p className="text-xs text-muted-foreground">{typeInfo?.label} • {itemCount} Inhalte</p>
                        </div>
                      </Reorder.Item>
                    );
                  })}
                </Reorder.Group>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="lg:col-span-2">
            <div className="bg-card rounded-xl border p-6">
              {selectedSection ? (
                <>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="font-medium text-lg">{selectedSection.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {SECTION_TYPES.find((t) => t.value === selectedSection.type)?.label}
                      </p>
                    </div>
                    {isEditable && (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleAddContent("custom_text", null, "")}>
                          <Plus className="w-4 h-4 mr-1" />Text
                        </Button>
                        <Button size="sm" variant="outline" className="text-destructive" onClick={() => setIsDeleteSectionOpen(true)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <MagazineSectionContent
                    items={sectionItems}
                    isEditable={isEditable}
                    onDelete={handleDeleteItem}
                    onReorder={(newOrder) => handleReorderItems(selectedSection.id, newOrder)}
                    onUpdateText={handleUpdateItemText}
                    clubId={magazine.club_id}
                  />
                </>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Waehlen Sie ein Kapitel aus der linken Liste</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Add Section Dialog */}
        <Dialog open={isAddSectionOpen} onOpenChange={setIsAddSectionOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Kapitel hinzufuegen</DialogTitle>
              <DialogDescription>Fuegen Sie ein neues Kapitel zum Schuetzenheft hinzu</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Kapitel-Typ</Label>
                <Select value={newSectionType} onValueChange={setNewSectionType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SECTION_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2"><type.icon className="w-4 h-4" />{type.label}</div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Titel</Label>
                <Input placeholder="z.B. Grußwort des Hauptmanns" value={newSectionTitle} onChange={(e) => setNewSectionTitle(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddSectionOpen(false)}>Abbrechen</Button>
              <Button onClick={handleAddSection} disabled={!newSectionTitle.trim() || isSaving}>
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Hinzufuegen"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Section */}
        <AlertDialog open={isDeleteSectionOpen} onOpenChange={setIsDeleteSectionOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Kapitel loeschen?</AlertDialogTitle>
              <AlertDialogDescription>
                Das Kapitel "{selectedSection?.title}" und alle Inhalte werden geloescht.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteSection} className="bg-destructive text-destructive-foreground">
                Loeschen
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PortalLayout>
  );
};

export default MagazineEditor;