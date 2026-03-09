import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, Reorder } from "framer-motion";
import {
  ArrowLeft, Plus, GripVertical, Trash2, FileText, Image,
  Calendar, Award, Users, MessageSquare, Loader2, Save, FileDown, Lock,
  Megaphone
} from "lucide-react";
import PortalLayout from "@/components/portal/PortalLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import MagazineContentPicker from "@/components/magazine/MagazineContentPicker";
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

  // Dialogs
  const [isAddSectionOpen, setIsAddSectionOpen] = useState(false);
  const [isAddContentOpen, setIsAddContentOpen] = useState(false);
  const [isDeleteSectionOpen, setIsDeleteSectionOpen] = useState(false);
  const [newSectionType, setNewSectionType] = useState("custom");
  const [newSectionTitle, setNewSectionTitle] = useState("");

  const canManage = hasPermission("club.magazine.manage");
  const isEditable = magazine?.status === "draft" && canManage;

  useEffect(() => {
    if (id) fetchMagazineData();
  }, [id]);

  const fetchMagazineData = async () => {
    setIsLoading(true);

    // Fetch magazine
    const { data: magData, error: magError } = await supabase
      .from("magazines")
      .select("*")
      .eq("id", id)
      .single();

    if (magError || !magData) {
      toast({ title: "Fehler", description: "Schützenheft nicht gefunden", variant: "destructive" });
      navigate("/portal/magazine");
      return;
    }

    setMagazine(magData);

    // Fetch sections
    const { data: sectionsData } = await supabase
      .from("magazine_sections")
      .select("*")
      .eq("magazine_id", id)
      .order("order_index");

    const secs = sectionsData || [];
    setSections(secs);

    // Fetch items for all sections
    if (secs.length > 0) {
      const { data: itemsData } = await supabase
        .from("magazine_items")
        .select("*")
        .in("section_id", secs.map((s) => s.id))
        .order("order_index");

      setItems(itemsData || []);
    }

    // Select first section by default
    if (secs.length > 0 && !selectedSection) {
      setSelectedSection(secs[0]);
    }

    setIsLoading(false);
  };

  const handleAddSection = async () => {
    if (!newSectionTitle.trim() || !id) return;
    setIsSaving(true);

    const maxOrder = Math.max(...sections.map((s) => s.order_index), -1);

    const { data, error } = await supabase
      .from("magazine_sections")
      .insert({
        magazine_id: id,
        type: newSectionType as "greeting" | "report" | "company_reports" | "events" | "honors" | "custom",
        title: newSectionTitle.trim(),
        order_index: maxOrder + 1,
      })
      .select()
      .single();

    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    } else {
      setSections([...sections, data]);
      setSelectedSection(data);
      setIsAddSectionOpen(false);
      setNewSectionTitle("");
      setNewSectionType("custom");
      toast({ title: "Kapitel hinzugefügt" });
    }

    setIsSaving(false);
  };

  const handleDeleteSection = async () => {
    if (!selectedSection) return;

    const { error } = await supabase
      .from("magazine_sections")
      .delete()
      .eq("id", selectedSection.id);

    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    } else {
      const newSections = sections.filter((s) => s.id !== selectedSection.id);
      setSections(newSections);
      setSelectedSection(newSections[0] || null);
      setItems(items.filter((i) => i.section_id !== selectedSection.id));
      toast({ title: "Kapitel gelöscht" });
    }

    setIsDeleteSectionOpen(false);
  };

  const handleReorderSections = async (newOrder: Section[]) => {
    setSections(newOrder);

    // Update order in database
    for (let i = 0; i < newOrder.length; i++) {
      await supabase
        .from("magazine_sections")
        .update({ order_index: i })
        .eq("id", newOrder[i].id);
    }
  };

  const handleAddContent = async (contentType: string, contentId: string | null, customText?: string, companyId?: string) => {
    if (!selectedSection) return;

    const sectionItems = items.filter((i) => i.section_id === selectedSection.id);
    const maxOrder = Math.max(...sectionItems.map((i) => i.order_index), -1);

    const { data, error } = await supabase
      .from("magazine_items")
      .insert({
        section_id: selectedSection.id,
        content_type: contentType as "post" | "report" | "event" | "custom_text" | "image",
        content_id: contentId,
        custom_text: customText || null,
        company_id: companyId || null,
        order_index: maxOrder + 1,
      })
      .select()
      .single();

    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    } else {
      setItems([...items, data]);
      setIsAddContentOpen(false);
      toast({ title: "Inhalt hinzugefügt" });
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    const { error } = await supabase
      .from("magazine_items")
      .delete()
      .eq("id", itemId);

    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    } else {
      setItems(items.filter((i) => i.id !== itemId));
    }
  };

  const handleReorderItems = async (sectionId: string, newOrder: MagazineItem[]) => {
    const otherItems = items.filter((i) => i.section_id !== sectionId);
    setItems([...otherItems, ...newOrder]);

    for (let i = 0; i < newOrder.length; i++) {
      await supabase
        .from("magazine_items")
        .update({ order_index: i })
        .eq("id", newOrder[i].id);
    }
  };

  const handleUpdateItemText = async (itemId: string, text: string) => {
    const { error } = await supabase
      .from("magazine_items")
      .update({ custom_text: text })
      .eq("id", itemId);

    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    } else {
      setItems(items.map((i) => (i.id === itemId ? { ...i, custom_text: text } : i)));
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
        <p className="text-center py-12 text-muted-foreground">Schützenheft nicht gefunden</p>
      </PortalLayout>
    );
  }

  const sectionItems = selectedSection
    ? items.filter((i) => i.section_id === selectedSection.id)
    : [];

  return (
    <PortalLayout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
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
                  {magazine.status === "finalized" ? (
                    <>
                      <Lock className="w-3 h-3 mr-1" />
                      Finalisiert
                    </>
                  ) : (
                    "Entwurf"
                  )}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate(`/portal/magazine/${id}/ads`)}>
              <Megaphone className="w-4 h-4 mr-2" />
              Anzeigen
            </Button>
            <Button variant="outline" onClick={() => navigate(`/portal/magazine/${id}/pdf`)}>
              <FileDown className="w-4 h-4 mr-2" />
              PDF erzeugen
            </Button>
          </div>
        </motion.div>

        {/* Two Column Layout */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Sections */}
          <div className="lg:col-span-1">
            <div className="bg-card rounded-xl border p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium">Kapitel</h3>
                {isEditable && (
                  <Button size="sm" variant="outline" onClick={() => setIsAddSectionOpen(true)}>
                    <Plus className="w-4 h-4 mr-1" />
                    Hinzufügen
                  </Button>
                )}
              </div>

              {sections.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Noch keine Kapitel. Fügen Sie das erste Kapitel hinzu.
                </p>
              ) : (
                <Reorder.Group
                  axis="y"
                  values={sections}
                  onReorder={isEditable ? handleReorderSections : () => {}}
                  className="space-y-2"
                >
                  {sections.map((section) => {
                    const typeInfo = SECTION_TYPES.find((t) => t.value === section.type);
                    const Icon = typeInfo?.icon || FileText;
                    const itemCount = items.filter((i) => i.section_id === section.id).length;

                    return (
                      <Reorder.Item
                        key={section.id}
                        value={section}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedSection?.id === section.id
                            ? "bg-primary/10 border-primary"
                            : "bg-background hover:bg-muted/50"
                        }`}
                        onClick={() => setSelectedSection(section)}
                      >
                        {isEditable && (
                          <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
                        )}
                        <Icon className="w-4 h-4 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{section.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {typeInfo?.label} • {itemCount} Inhalte
                          </p>
                        </div>
                      </Reorder.Item>
                    );
                  })}
                </Reorder.Group>
              )}
            </div>
          </div>

          {/* Right Column - Content */}
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
                    <div className="flex gap-2">
                      {isEditable && (
                        <>
                          <Button size="sm" onClick={() => setIsAddContentOpen(true)}>
                            <Plus className="w-4 h-4 mr-1" />
                            Inhalt
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive"
                            onClick={() => setIsDeleteSectionOpen(true)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
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
                  <p>Wählen Sie ein Kapitel aus der linken Liste</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Add Section Dialog */}
        <Dialog open={isAddSectionOpen} onOpenChange={setIsAddSectionOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Kapitel hinzufügen</DialogTitle>
              <DialogDescription>
                Fügen Sie ein neues Kapitel zum Schützenheft hinzu
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Kapitel-Typ</Label>
                <Select value={newSectionType} onValueChange={setNewSectionType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SECTION_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <type.icon className="w-4 h-4" />
                          {type.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Titel</Label>
                <Input
                  placeholder="z.B. Grußwort des Hauptmanns"
                  value={newSectionTitle}
                  onChange={(e) => setNewSectionTitle(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddSectionOpen(false)}>
                Abbrechen
              </Button>
              <Button onClick={handleAddSection} disabled={!newSectionTitle.trim() || isSaving}>
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Hinzufügen"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Content Dialog */}
        <MagazineContentPicker
          open={isAddContentOpen}
          onOpenChange={setIsAddContentOpen}
          sectionType={selectedSection?.type || "custom"}
          clubId={magazine.club_id}
          onSelect={handleAddContent}
        />

        {/* Delete Section Confirmation */}
        <AlertDialog open={isDeleteSectionOpen} onOpenChange={setIsDeleteSectionOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Kapitel löschen?</AlertDialogTitle>
              <AlertDialogDescription>
                Das Kapitel „{selectedSection?.title}" und alle Inhalte werden gelöscht.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteSection}
                className="bg-destructive text-destructive-foreground"
              >
                Löschen
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PortalLayout>
  );
};

export default MagazineEditor;
