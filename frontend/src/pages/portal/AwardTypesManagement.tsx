import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiJson } from "@/integrations/api/client";
import { useAuth } from "@/lib/auth";
import PortalLayout from "@/components/portal/PortalLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, Award, Medal, Trophy, Star, Crown,
  Shield, Gem, Heart, Loader2, Building2, ScrollText, Sparkles, Lock
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AwardType {
  id: string;
  club_id: string;
  name: string;
  description: string | null;
  icon: string;
  badge_color: string;
  scope_type: string;
  scope_id: string | null;
  is_active: boolean;
  is_bhds_standard: boolean;
  category: string;
  requirements: string | null;
  special_notes: string | null;
  sort_order: number;
}

interface Company {
  id: string;
  name: string;
}

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

const CATEGORY_OPTIONS = [
  { value: "custom", label: "Vereinsintern" },
  { value: "orden", label: "Orden" },
  { value: "ehrenzeichen", label: "Ehrenzeichen" },
  { value: "vereinsauszeichnung", label: "Vereinsauszeichnung" },
];

const CATEGORY_COLORS: Record<string, string> = {
  orden: "bg-blue-500/10 text-blue-700 border-blue-200",
  ehrenzeichen: "bg-purple-500/10 text-purple-700 border-purple-200",
  vereinsauszeichnung: "bg-amber-500/10 text-amber-700 border-amber-200",
  custom: "bg-muted text-muted-foreground",
};

const CATEGORY_LABELS: Record<string, string> = {
  orden: "Orden",
  ehrenzeichen: "Ehrenzeichen",
  vereinsauszeichnung: "Vereinsauszeichnung",
  custom: "Vereinsintern",
};

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
  category: string;
}

export default function AwardTypesManagement() {
  const { member, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const clubId = member?.club_id;

  const [activeTab, setActiveTab] = useState<"bhds" | "club" | "company">("bhds");
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
    category: "custom",
  });

  const { data: awardTypes, isLoading: typesLoading } = useQuery<AwardType[]>({
    queryKey: ["award-types", clubId],
    queryFn: () => apiJson<AwardType[]>("/api/award-types"),
    enabled: !!clubId && isAdmin,
  });

  const { data: companies } = useQuery<Company[]>({
    queryKey: ["companies", clubId],
    queryFn: () => apiJson<Company[]>("/api/companies"),
    enabled: !!clubId,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: AwardTypeFormData) => {
      const payload = {
        name: data.name.trim(),
        description: data.description.trim() || null,
        icon: data.icon,
        badge_color: data.badge_color,
        scope_type: data.scope_type,
        scope_id: data.scope_type === "company" ? data.scope_id : null,
        is_active: data.is_active,
        category: data.category,
      };

      if (editingType) {
        return apiJson(`/api/award-types/${editingType.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        return apiJson("/api/award-types", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["award-types"] });
      toast.success(editingType ? "Auszeichnungstyp aktualisiert" : "Auszeichnungstyp erstellt");
      closeDialog();
    },
    onError: () => toast.error("Fehler beim Speichern"),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) =>
      apiJson(`/api/award-types/${id}`, {
        method: "PUT",
        body: JSON.stringify({ is_active }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["award-types"] });
      toast.success("Status aktualisiert");
    },
    onError: () => toast.error("Fehler beim Aktualisieren"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiJson(`/api/award-types/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["award-types"] });
      toast.success("Auszeichnungstyp gelöscht");
      setDeleteDialogOpen(false);
      setTypeToDelete(null);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Fehler beim Löschen";
      toast.error(msg);
    },
  });

  const openNewDialog = (scopeType: "club" | "company") => {
    setEditingType(null);
    setFormData({ name: "", description: "", icon: "medal", badge_color: "gold", scope_type: scopeType, scope_id: null, is_active: true, category: "custom" });
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
      is_active: awardType.is_active ?? true,
      category: awardType.category || "custom",
    });
    setDialogOpen(true);
  };

  const closeDialog = () => { setDialogOpen(false); setEditingType(null); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) { toast.error("Name ist erforderlich"); return; }
    if (formData.scope_type === "company" && !formData.scope_id) { toast.error("Bitte wählen Sie eine Kompanie"); return; }
    saveMutation.mutate(formData);
  };

  const bhdsTypes = awardTypes?.filter(t => t.is_bhds_standard) || [];
  const clubTypes = awardTypes?.filter(t => !t.is_bhds_standard && t.scope_type === "club") || [];
  const companyTypes = awardTypes?.filter(t => !t.is_bhds_standard && t.scope_type === "company") || [];

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
            BHDS-Standardauszeichnungen und vereinsinterne Auszeichnungstypen
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList>
            <TabsTrigger value="bhds" className="gap-2">
              <Lock className="w-4 h-4" />
              BHDS-Standard
              {bhdsTypes.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">{bhdsTypes.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="club" className="gap-2">
              <Award className="w-4 h-4" />
              Vereinsebene
            </TabsTrigger>
            <TabsTrigger value="company" className="gap-2">
              <Building2 className="w-4 h-4" />
              Kompanieebene
            </TabsTrigger>
          </TabsList>

          {/* BHDS-Standard-Auszeichnungen */}
          <TabsContent value="bhds" className="mt-6">
            <div className="mb-4 p-3 rounded-lg bg-muted/30 border text-sm text-muted-foreground flex items-start gap-2">
              <Lock className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                BHDS-Standardauszeichnungen sind vordefiniert und können nicht gelöscht oder umbenannt werden.
                Sie können jedoch einzeln <strong>deaktiviert</strong> werden, um sie im Verein auszublenden.
              </span>
            </div>

            {typesLoading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
              </div>
            ) : bhdsTypes.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Lock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    BHDS-Auszeichnungen wurden noch nicht eingespielt.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {bhdsTypes.map(at => (
                  <BhdsAwardTypeCard
                    key={at.id}
                    awardType={at}
                    onToggle={(id, is_active) => toggleActiveMutation.mutate({ id, is_active })}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Vereins-Auszeichnungen */}
          <TabsContent value="club" className="mt-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Vereinsinterne Auszeichnungen</h2>
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
                  <p className="text-muted-foreground">Noch keine eigenen Auszeichnungstypen definiert</p>
                  <Button className="mt-4" onClick={() => openNewDialog("club")}>
                    <Plus className="w-4 h-4 mr-2" />
                    Ersten Typ erstellen
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {clubTypes.map(at => (
                  <AwardTypeCard
                    key={at.id}
                    awardType={at}
                    onEdit={() => openEditDialog(at)}
                    onDelete={() => { setTypeToDelete(at); setDeleteDialogOpen(true); }}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Kompanie-Auszeichnungen */}
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
                  <p className="text-muted-foreground">Noch keine Kompanie-Auszeichnungstypen definiert</p>
                  <Button className="mt-4" onClick={() => openNewDialog("company")}>
                    <Plus className="w-4 h-4 mr-2" />
                    Ersten Typ erstellen
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {companies?.map(company => {
                  const types = companyTypes.filter(t => t.scope_id === company.id);
                  if (!types.length) return null;
                  return (
                    <div key={company.id}>
                      <h3 className="font-medium mb-3 flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                        {company.name}
                      </h3>
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {types.map(at => (
                          <AwardTypeCard
                            key={at.id}
                            awardType={at}
                            onEdit={() => openEditDialog(at)}
                            onDelete={() => { setTypeToDelete(at); setDeleteDialogOpen(true); }}
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
            <DialogTitle>{editingType ? "Auszeichnungstyp bearbeiten" : "Neuer Auszeichnungstyp"}</DialogTitle>
            <DialogDescription>
              {formData.scope_type === "club"
                ? "Gilt für den gesamten Verein"
                : "Gilt nur für eine bestimmte Kompanie"}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {formData.scope_type === "company" && (
              <div className="space-y-2">
                <Label>Kompanie *</Label>
                <Select
                  value={formData.scope_id || ""}
                  onValueChange={v => setFormData(p => ({ ...p, scope_id: v }))}
                >
                  <SelectTrigger><SelectValue placeholder="Kompanie wählen…" /></SelectTrigger>
                  <SelectContent>
                    {companies?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                placeholder="z. B. Silberne Ehrennadel"
              />
            </div>

            <div className="space-y-2">
              <Label>Kategorie</Label>
              <Select
                value={formData.category}
                onValueChange={v => setFormData(p => ({ ...p, category: v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="desc">Beschreibung</Label>
              <Textarea
                id="desc"
                value={formData.description}
                onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                placeholder="Optionale Beschreibung…"
                rows={2}
              />
            </div>

            <div className="flex items-start gap-3 rounded-lg border bg-muted/20 p-3">
              <Checkbox
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={c => setFormData(p => ({ ...p, is_active: c === true }))}
              />
              <div>
                <Label htmlFor="is_active" className="cursor-pointer text-sm font-medium">Aktiv</Label>
                <p className="text-xs text-muted-foreground">Nur aktive Typen können verliehen werden.</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Symbol</Label>
              <div className="grid grid-cols-5 gap-2">
                {ICONS.map(icon => {
                  const Icon = icon.icon;
                  const sel = formData.icon === icon.value;
                  return (
                    <button key={icon.value} type="button"
                      onClick={() => setFormData(p => ({ ...p, icon: icon.value }))}
                      className={cn("flex flex-col items-center justify-center p-2 rounded-lg border-2 transition-all",
                        sel ? `border-primary ${icon.bgColor}` : "border-transparent bg-muted/50 hover:bg-muted"
                      )} title={icon.label}>
                      <Icon className={cn("w-5 h-5", icon.color)} />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Farbe</Label>
              <div className="flex gap-2 flex-wrap">
                {BADGE_COLORS.map(c => (
                  <button key={c.value} type="button"
                    onClick={() => setFormData(p => ({ ...p, badge_color: c.value }))}
                    className={cn("w-8 h-8 rounded-full border-2 transition-all", c.className,
                      formData.badge_color === c.value ? "border-foreground scale-110" : "border-transparent hover:scale-105"
                    )} title={c.label} />
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={closeDialog}>Abbrechen</Button>
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
              Möchten Sie „{typeToDelete?.name}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
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

function BhdsAwardTypeCard({
  awardType,
  onToggle,
}: {
  awardType: AwardType;
  onToggle: (id: string, is_active: boolean) => void;
}) {
  const iconConfig = getIconConfig(awardType.icon);
  const Icon = iconConfig.icon;

  const categoryColor = CATEGORY_COLORS[awardType.category] || CATEGORY_COLORS.custom;
  const categoryLabel = CATEGORY_LABELS[awardType.category] || awardType.category;

  return (
    <Card className={cn(!awardType.is_active && "opacity-60")}>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start gap-3">
          <div className={cn("p-2.5 rounded-full shrink-0", iconConfig.bgColor)}>
            <Icon className={cn("w-5 h-5", iconConfig.color)} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-1.5">
              <h3 className="font-semibold text-sm leading-snug flex-1">{awardType.name}</h3>
              <Lock className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
            </div>
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <Badge variant="outline" className={cn("text-xs", categoryColor)}>
                {categoryLabel}
              </Badge>
              {!awardType.is_active && (
                <Badge variant="secondary" className="text-xs">Deaktiviert</Badge>
              )}
            </div>
            {awardType.requirements && (
              <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
                {awardType.requirements}
              </p>
            )}
            {awardType.special_notes && (
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 line-clamp-2">
                {awardType.special_notes}
              </p>
            )}
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToggle(awardType.id, !awardType.is_active)}
            className="text-xs h-7"
          >
            {awardType.is_active ? "Deaktivieren" : "Aktivieren"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AwardTypeCard({
  awardType,
  onEdit,
  onDelete,
}: {
  awardType: AwardType;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const iconConfig = getIconConfig(awardType.icon);
  const Icon = iconConfig.icon;
  const categoryColor = CATEGORY_COLORS[awardType.category] || CATEGORY_COLORS.custom;
  const categoryLabel = CATEGORY_LABELS[awardType.category] || awardType.category;

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-start gap-3">
          <div className={cn("p-2.5 rounded-full shrink-0", iconConfig.bgColor)}>
            <Icon className={cn("w-5 h-5", iconConfig.color)} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm truncate">{awardType.name}</h3>
              {!awardType.is_active && (
                <Badge variant="secondary" className="text-xs shrink-0">Inaktiv</Badge>
              )}
            </div>
            <Badge variant="outline" className={cn("text-xs mt-1", categoryColor)}>
              {categoryLabel}
            </Badge>
            {awardType.description && (
              <p className="text-xs text-muted-foreground line-clamp-2 mt-1.5">{awardType.description}</p>
            )}
          </div>
          <div className="flex gap-1 shrink-0">
            <Button variant="ghost" size="icon" onClick={onEdit} className="h-8 w-8">
              <Pencil className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onDelete} className="h-8 w-8">
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
