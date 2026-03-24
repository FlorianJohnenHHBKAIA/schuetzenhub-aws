import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/api/client";
import { useAuth } from "@/lib/auth";
import PortalLayout from "@/components/portal/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { 
  Sparkles, 
  Plus, 
  Settings2, 
  Clock, 
  Calendar,
  Trash2,
  Zap,
} from "lucide-react";

type TriggerType = "work_shifts_completed" | "membership_duration";

interface AwardRule {
  id: string;
  club_id: string;
  award_type_id: string;
  trigger_type: TriggerType;
  threshold: number;
  active: boolean;
  created_at: string;
  award_types?: {
    id: string;
    name: string;
    icon: string;
    badge_color: string;
  };
}

interface AwardType {
  id: string;
  name: string;
  icon: string;
  badge_color: string;
  is_active: boolean;
}

const triggerLabels: Record<TriggerType, { label: string; description: string; icon: typeof Clock }> = {
  work_shifts_completed: {
    label: "Arbeitsdienste",
    description: "Anzahl abgeschlossener Einsätze",
    icon: Clock,
  },
  membership_duration: {
    label: "Mitgliedsjahre",
    description: "Jahre der Vereinszugehörigkeit",
    icon: Calendar,
  },
};

export default function AwardRulesManagement() {
  const { member } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AwardRule | null>(null);
  const [formData, setFormData] = useState({
    award_type_id: "",
    trigger_type: "work_shifts_completed" as TriggerType,
    threshold: 5,
  });

  const clubId = member?.club_id;

  const { data: rules, isLoading } = useQuery({
    queryKey: ["award-rules", clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase
        .from("award_rules")
        .select(`
          *,
          award_types (id, name, icon, badge_color)
        `)
        .eq("club_id", clubId)
        .order("trigger_type", { ascending: true })
        .order("threshold", { ascending: true });
      
      if (error) throw error;
      return data as AwardRule[];
    },
    enabled: !!clubId,
  });

  const { data: awardTypes } = useQuery({
    queryKey: ["award-types-active", clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase
        .from("award_types")
        .select("id, name, icon, badge_color, is_active")
        .eq("club_id", clubId)
        .eq("is_active", true)
        .order("name");
      
      if (error) throw error;
      return data as AwardType[];
    },
    enabled: !!clubId,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData & { id?: string }) => {
      if (data.id) {
        const { error } = await supabase
          .from("award_rules")
          .update({
            award_type_id: data.award_type_id,
            trigger_type: data.trigger_type,
            threshold: data.threshold,
          })
          .eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("award_rules")
          .insert({
            club_id: clubId,
            award_type_id: data.award_type_id,
            trigger_type: data.trigger_type,
            threshold: data.threshold,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["award-rules"] });
      setIsDialogOpen(false);
      setEditingRule(null);
      toast({
        title: editingRule ? "Regel aktualisiert" : "Regel erstellt",
        description: "Die automatische Vergabe-Regel wurde gespeichert.",
      });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "";
      toast({
        title: "Fehler",
        description: message.includes("unique")
          ? "Diese Kombination existiert bereits."
          : "Die Regel konnte nicht gespeichert werden.",
        variant: "destructive",
      });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from("award_rules")
        .update({ active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["award-rules"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("award_rules")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["award-rules"] });
      toast({ title: "Regel gelöscht" });
    },
  });

  const openCreateDialog = () => {
    setEditingRule(null);
    setFormData({
      award_type_id: awardTypes?.[0]?.id || "",
      trigger_type: "work_shifts_completed",
      threshold: 5,
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (rule: AwardRule) => {
    setEditingRule(rule);
    setFormData({
      award_type_id: rule.award_type_id,
      trigger_type: rule.trigger_type,
      threshold: rule.threshold,
    });
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (!formData.award_type_id) {
      toast({ title: "Bitte wähle eine Auszeichnung", variant: "destructive" });
      return;
    }
    saveMutation.mutate({
      ...formData,
      id: editingRule?.id,
    });
  };

  const rulesByTrigger = rules?.reduce((acc, rule) => {
    if (!acc[rule.trigger_type]) acc[rule.trigger_type] = [];
    acc[rule.trigger_type].push(rule);
    return acc;
  }, {} as Record<TriggerType, AwardRule[]>) || {};

  return (
    <PortalLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl font-bold flex items-center gap-3">
                <Zap className="w-8 h-8 text-primary" />
                Automatische Auszeichnungen
              </h1>
              <p className="text-muted-foreground mt-1">
                Regeln für die automatische Vergabe von Ehrungen
              </p>
            </div>
            <Button onClick={openCreateDialog} disabled={!awardTypes?.length}>
              <Plus className="w-4 h-4 mr-2" />
              Neue Regel
            </Button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <div className="flex gap-4">
                <Sparkles className="w-6 h-6 text-primary shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <p className="font-medium">Automatische Anerkennung</p>
                  <p className="text-sm text-muted-foreground">
                    Definiere Meilensteine, bei deren Erreichen Mitglieder automatisch 
                    eine Auszeichnung erhalten. So wird Engagement gewürdigt – ohne Aufwand.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
          </div>
        ) : !rules?.length ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Settings2 className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="font-semibold text-lg mb-2">Noch keine Regeln</h3>
              <p className="text-muted-foreground mb-6">
                Erstelle deine erste automatische Vergabe-Regel.
              </p>
              <Button onClick={openCreateDialog} disabled={!awardTypes?.length}>
                <Plus className="w-4 h-4 mr-2" />
                Regel erstellen
              </Button>
              {!awardTypes?.length && (
                <p className="text-sm text-muted-foreground mt-4">
                  Erstelle zuerst einen Auszeichnungstyp unter "Auszeichnungstypen".
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {(Object.keys(triggerLabels) as TriggerType[]).map(triggerType => {
              const triggerRules = rulesByTrigger[triggerType] || [];
              if (triggerRules.length === 0) return null;
              
              const config = triggerLabels[triggerType];
              const TriggerIcon = config.icon;

              return (
                <motion.div
                  key={triggerType}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <TriggerIcon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h2 className="font-display text-lg font-semibold">{config.label}</h2>
                      <p className="text-sm text-muted-foreground">{config.description}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {triggerRules.map(rule => (
                      <Card key={rule.id} className={!rule.active ? "opacity-60" : ""}>
                        <CardContent className="py-4">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-4 flex-1 min-w-0">
                              <div className="text-center">
                                <p className="text-2xl font-bold text-primary">{rule.threshold}</p>
                                <p className="text-xs text-muted-foreground">
                                  {triggerType === "work_shifts_completed" ? "Einsätze" : "Jahre"}
                                </p>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">
                                  {rule.award_types?.name || "Unbekannt"}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  Automatische Vergabe bei Erreichen
                                </p>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-3">
                              <Switch
                                checked={rule.active}
                                onCheckedChange={(active) => 
                                  toggleMutation.mutate({ id: rule.id, active })
                                }
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditDialog(rule)}
                              >
                                <Settings2 className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteMutation.mutate(rule.id)}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingRule ? "Regel bearbeiten" : "Neue automatische Regel"}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Auszeichnung</Label>
              <Select
                value={formData.award_type_id}
                onValueChange={(v) => setFormData(prev => ({ ...prev, award_type_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Auszeichnung wählen" />
                </SelectTrigger>
                <SelectContent>
                  {awardTypes?.map(type => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Auslöser</Label>
              <Select
                value={formData.trigger_type}
                onValueChange={(v) => setFormData(prev => ({ 
                  ...prev, 
                  trigger_type: v as TriggerType,
                  threshold: v === "membership_duration" ? 5 : 10,
                }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="work_shifts_completed">
                    Arbeitsdienste abgeschlossen
                  </SelectItem>
                  <SelectItem value="membership_duration">
                    Mitgliedsjahre erreicht
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>
                Schwellwert ({formData.trigger_type === "work_shifts_completed" ? "Einsätze" : "Jahre"})
              </Label>
              <Input
                type="number"
                min={1}
                value={formData.threshold}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  threshold: parseInt(e.target.value) || 1 
                }))}
              />
              <p className="text-xs text-muted-foreground">
                Die Auszeichnung wird bei Erreichen dieses Wertes automatisch vergeben.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {editingRule ? "Speichern" : "Erstellen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}