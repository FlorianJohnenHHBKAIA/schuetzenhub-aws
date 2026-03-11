import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import PortalLayout from "@/components/portal/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, 
  Pencil, 
  Trash2, 
  Award, 
  Medal, 
  Trophy, 
  Star, 
  Crown, 
  Shield, 
  Gem, 
  Heart,
  Loader2,
  Building2,
  ScrollText,
  Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";

type AwardType = Tables<"award_types">;

const ICONS = [
  { value: "medal", label: "Medaille", icon: Medal, color: "text-amber-500", bgColor: "bg-amber-500/10" },
  { value: "order", label: "Orden", icon: Star, color: "text-blue-500", bgColor: "bg-blue-500/10" },
  { value: "honor", label: "Ehrung", icon: Sparkles, color: "text-purple-500", bgColor: "bg-purple-500/10" },
  { value: "certificate", label: "Urkunde", icon: ScrollText, color: "text-green-500", bgColor: "bg-green-500/10" },
  { value: "crown", label: "Königswürde", icon: Crown, color: "text-yellow-500", bgColor: "bg-yellow-500/10" },
  { value: "trophy", label: "Pokal", icon: Trophy, color: "text-orange-500", bgColor: "bg-orange-500/10" },
  { value: "shield", label: "Schild", icon: Shield, color: "text-slate-500", bgColor: "bg-slate-500/10" },
  { value: "gem", label: "Edelstein", icon: Gem, color: "text-emerald-500", bgColor: "bg-emerald-500/10" },
  { value: "heart", label: "Verdienst", icon: Heart, color: "text-red-500", bgColor: "bg-red-500/10" },
  { value: "other", label: "Sonstiges", icon: Award, color: "text-accent", bgColor: "bg-accent/10" },
];

const BADGE_COLORS = [
  { value: "gold", label: "Gold", className: "bg-amber-500" },
  { value: "silver", label: "Silber", className: "bg-slate-400" },
  { value: "bronze", label: "Bronze", className: "bg-orange-700" },
  { value: "blue", label: "Blau", className: "bg-blue-500" },
  { value: "green", label: "Grün", className: "bg-emerald-500" },
  { value: "purple", label: "Lila", className: "bg-purple-500" },
  { value: "red", label: "Rot", className: "bg-red-500" },
];

export const getIconConfig = (iconName: string) => {
  return ICONS.find(i => i.value === iconName) || ICONS[ICONS.length - 1];
};

interface AwardTypeFormData {
  name: string;
  description: string;
  icon: string;
  badge_color: string;
  scope_type: "club" | "company";
  scope_id: string | null;
  is_active: boolean;
}

export default function AwardTypesManagement() {
  const { member, isAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const clubId = member?.club_id;

  const [activeTab, setActiveTab] = useState<"club" | "company">("club");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<AwardType | null>(null);
  const [typeToDelete, setTypeToDelete] = useState<AwardType | null>(null);
  const [formData, setFormData] = useState<AwardTypeFormData>({
    name: "",
    description: "",
    icon: "medal",
    badge_color: "gold",
    scope_type: "club",
    scope_id: null,
    is_active: true,
  });

  // Fetch award types
  const { data: awardTypes, isLoading: typesLoading } = useQuery({
    queryKey: ["award-types", clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase
        .from("award_types")
        .select("*")
        .eq("club_id", clubId)
        .order("name");
      if (error) throw error;
      return data as AwardType[];
    },
    enabled: !!clubId && isAdmin,
  });

  // Fetch companies for company-level awards
  const { data: companies } = useQuery({
    queryKey: ["companies", clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase
        .from("companies")
        .select("id, name")
        .eq("club_id", clubId)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!clubId,
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: AwardTypeFormData) => {
      if (!clubId) throw new Error("Club ID missing");

      const payload = {
        club_id: clubId,
        name: data.name.trim(),
        description: data.description.trim() || null,
        icon: data.icon,
        badge_color: data.badge_color,
        scope_type: data.scope_type,
        scope_id: data.scope_type === "company" ? data.scope_id : null,
        is_active: data.is_active,
      };

      if (editingType) {
        const { error } = await supabase
          .from("award_types")
          .update(payload)
          .eq("id", editingType.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("award_types")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["award-types"] });
      toast({ title: editingType ? "Auszeichnungstyp aktualisiert" : "Auszeichnungstyp erstellt" });
      closeDialog();
    },
    onError: (error) => {
      console.error("Error saving award type:", error);
      toast({ title: "Fehler beim Speichern", variant: "destructive" });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("award_types")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["award-types"] });
      toast({ title: "Auszeichnungstyp gelöscht" });
      setDeleteDialogOpen(false);
      setTypeToDelete(null);
    },
    onError: (error) => {
      console.error("Error deleting award type:", error);
      toast({ title: "Fehler beim Löschen", variant: "destructive" });
    },
  });

  const openNewDialog = (scopeType: "club" | "company") => {
    setEditingType(null);
    setFormData({
      name: "",
      description: "",
      icon: "medal",
      badge_color: "gold",
      scope_type: scopeType,
      scope_id: null,
      is_active: true,
    });
    setDialogOpen(true);
  };

  const openEditDialog = (awardType: AwardType) => {
    setEditingType(awardType);
    setFormData({
      name: awardType.name,
      description: awardType.description || "",
      icon: awardType.icon,
      badge_color: awardType.badge_color,
      scope_type: awardType.scope_type as "club" | "company",
      scope_id: awardType.scope_id,
      is_active: awardType.is_active,
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingType(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast({ title: "Name ist erforderlich", variant: "destructive" });
      return;
    }
    if (formData.scope_type === "company" && !formData.scope_id) {
      toast({ title: "Bitte wählen Sie eine Kompanie", variant: "destructive" });
      return;
    }
    saveMutation.mutate(formData);
  };

  const clubTypes = awardTypes?.filter(t => t.scope_type === "club") || [];
  const companyTypes = awardTypes?.filter(t => t.scope_type === "company") || [];

  if (!isAdmin) {
    return (
      <PortalLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Keine Berechtigung für diese Seite.</p>
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Auszeichnungstypen verwalten</h1>
          <p className="text-muted-foreground">
            Definieren Sie Auszeichnungstypen für den Verein und die Kompanien
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "club" | "company")}>
          <TabsList>
            <TabsTrigger value="club" className="gap-2">
              <Award className="w-4 h-4" />
              Vereinsebene
            </TabsTrigger>
            <TabsTrigger value="company" className="gap-2">
              <Building2 className="w-4 h-4" />
              Kompanieebene
            </TabsTrigger>
          </TabsList>

          <TabsContent value="club" className="mt-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Vereins-Auszeichnungen</h2>
              <Button onClick={() => openNewDialog("club")}>
                <Plus className="w-4 h-4 mr-2" />
                Neuer Typ
              </Button>
            </div>

            {typesLoading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
              </div>
            ) : clubTypes.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Award className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    Noch keine Auszeichnungstypen auf Vereinsebene definiert
                  </p>
                  <Button className="mt-4" onClick={() => openNewDialog("club")}>
                    <Plus className="w-4 h-4 mr-2" />
                    Ersten Typ erstellen
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {clubTypes.map(awardType => (
                  <AwardTypeCard
                    key={awardType.id}
                    awardType={awardType}
                    onEdit={() => openEditDialog(awardType)}
                    onDelete={() => {
                      setTypeToDelete(awardType);
                      setDeleteDialogOpen(true);
                    }}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="company" className="mt-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Kompanie-Auszeichnungen</h2>
              <Button onClick={() => openNewDialog("company")}>
                <Plus className="w-4 h-4 mr-2" />
                Neuer Typ
              </Button>
            </div>

            {typesLoading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
              </div>
            ) : companyTypes.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    Noch keine Auszeichnungstypen auf Kompanieebene definiert
                  </p>
                  <Button className="mt-4" onClick={() => openNewDialog("company")}>
                    <Plus className="w-4 h-4 mr-2" />
                    Ersten Typ erstellen
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {companies?.map(company => {
                  const companyAwardTypes = companyTypes.filter(t => t.scope_id === company.id);
                  if (companyAwardTypes.length === 0) return null;
                  return (
                    <div key={company.id}>
                      <h3 className="font-medium mb-3 flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                        {company.name}
                      </h3>
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {companyAwardTypes.map(awardType => (
                          <AwardTypeCard
                            key={awardType.id}
                            awardType={awardType}
                            onEdit={() => openEditDialog(awardType)}
                            onDelete={() => {
                              setTypeToDelete(awardType);
                              setDeleteDialogOpen(true);
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingType ? "Auszeichnungstyp bearbeiten" : "Neuer Auszeichnungstyp"}
            </DialogTitle>
            <DialogDescription>
              {formData.scope_type === "club" 
                ? "Dieser Typ gilt für den gesamten Verein"
                : "Dieser Typ gilt nur für eine bestimmte Kompanie"}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {formData.scope_type === "company" && (
              <div className="space-y-2">
                <Label>Kompanie *</Label>
                <Select 
                  value={formData.scope_id || ""} 
                  onValueChange={(v) => setFormData(prev => ({ ...prev, scope_id: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Kompanie wählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {companies?.map(company => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="z.B. Schützenkönig, Silbernes Verdienstkreuz"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Beschreibung</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Optionale Beschreibung..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Symbol</Label>
              <div className="grid grid-cols-5 gap-2">
                {ICONS.map((icon) => {
                  const Icon = icon.icon;
                  const isSelected = formData.icon === icon.value;
                  return (
                    <button
                      key={icon.value}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, icon: icon.value }))}
                      className={cn(
                        "flex flex-col items-center justify-center p-2 rounded-lg border-2 transition-all",
                        isSelected
                          ? `border-primary ${icon.bgColor}`
                          : "border-transparent bg-muted/50 hover:bg-muted"
                      )}
                      title={icon.label}
                    >
                      <Icon className={cn("w-5 h-5", icon.color)} />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Farbe</Label>
              <div className="flex gap-2 flex-wrap">
                {BADGE_COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, badge_color: color.value }))}
                    className={cn(
                      "w-8 h-8 rounded-full border-2 transition-all",
                      color.className,
                      formData.badge_color === color.value
                        ? "border-foreground scale-110"
                        : "border-transparent hover:scale-105"
                    )}
                    title={color.label}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="is_active">Aktiv</Label>
                <p className="text-sm text-muted-foreground">
                  Deaktivierte Typen können nicht beantragt werden
                </p>
              </div>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={closeDialog}>
                Abbrechen
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingType ? "Speichern" : "Erstellen"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Auszeichnungstyp löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie den Auszeichnungstyp "{typeToDelete?.name}" wirklich löschen? 
              Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => typeToDelete && deleteMutation.mutate(typeToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PortalLayout>
  );
}

// Card component for displaying an award type
function AwardTypeCard({ 
  awardType, 
  onEdit, 
  onDelete 
}: { 
  awardType: AwardType; 
  onEdit: () => void; 
  onDelete: () => void;
}) {
  const iconConfig = getIconConfig(awardType.icon);
  const Icon = iconConfig.icon;

  return (
    <Card className={cn(!awardType.is_active && "opacity-60")}>
      <CardContent className="pt-6">
        <div className="flex items-start gap-3">
          <div className={cn("p-3 rounded-full", iconConfig.bgColor)}>
            <Icon className={cn("w-5 h-5", iconConfig.color)} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold truncate">{awardType.name}</h3>
              {!awardType.is_active && (
                <Badge variant="secondary" className="text-xs">Inaktiv</Badge>
              )}
            </div>
            {awardType.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                {awardType.description}
              </p>
            )}
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={onEdit}>
              <Pencil className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onDelete}>
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
