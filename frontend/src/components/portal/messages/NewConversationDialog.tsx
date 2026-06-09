import { useState, useEffect } from "react";
import { Search, Users, User, Loader2, Building2, Globe, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { apiJson, getStorageUrl } from "@/integrations/api/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import type { CreateConversationParams, ConversationScope } from "@/lib/messageTypes";

interface MemberOption {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
}

interface CompanyOption {
  id: string;
  name: string;
}

interface NewConversationDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (params: CreateConversationParams) => Promise<{ id: string }>;
  onCreated: (conversationId: string) => void;
}

// ─── Scope-Auswahl-Buttons ────────────────────────────────────────────────────

const SCOPE_OPTIONS: {
  value: ConversationScope;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  activeClass: string;
}[] = [
  { value: "company", label: "Kompanie", icon: Building2, activeClass: "bg-blue-100 text-blue-700 border-blue-300" },
  { value: "club",    label: "Verein",   icon: Globe,      activeClass: "bg-green-100 text-green-700 border-green-300" },
  { value: "external",label: "Extern",   icon: ExternalLink,activeClass: "bg-amber-100 text-amber-700 border-amber-300" },
];

export function NewConversationDialog({
  open,
  onClose,
  onCreate,
  onCreated,
}: NewConversationDialogProps) {
  const { member } = useAuth();

  // Gemeinsam genutzte Daten
  const [members, setMembers]     = useState<MemberOption[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Direkt-Tab
  const [directSearch, setDirectSearch]     = useState("");
  const [selectedDirect, setSelectedDirect] = useState<string | null>(null);

  // Gruppe-Tab
  const [groupScope, setGroupScope]                   = useState<ConversationScope>("club");
  const [groupName, setGroupName]                     = useState("");
  const [groupSearch, setGroupSearch]                 = useState("");
  const [selectedCompanyId, setSelectedCompanyId]     = useState<string>("");
  const [companyMemberIds, setCompanyMemberIds]       = useState<string[]>([]);
  const [loadingCompanyMembers, setLoadingCompanyMembers] = useState(false);
  const [selectedGroup, setSelectedGroup]             = useState<string[]>([]);
  const [alleMitglieder, setAlleMitglieder]           = useState(false);

  // Daten laden wenn Dialog öffnet
  useEffect(() => {
    if (!open) return;
    Promise.all([
      apiJson<MemberOption[]>("/api/members"),
      apiJson<CompanyOption[]>("/api/companies"),
    ]).then(([mData, cData]) => {
      setMembers((mData || []).filter((m) => m.id !== member?.id));
      setCompanies(cData || []);
    }).catch(console.error);

    // Zustand zurücksetzen
    setDirectSearch("");
    setSelectedDirect(null);
    setGroupScope("club");
    setGroupName("");
    setGroupSearch("");
    setSelectedCompanyId("");
    setCompanyMemberIds([]);
    setSelectedGroup([]);
    setAlleMitglieder(false);
  }, [open, member?.id]);

  // Kompanie-Mitglieder laden wenn Kompanie gewählt
  useEffect(() => {
    if (!selectedCompanyId) { setCompanyMemberIds([]); return; }
    setLoadingCompanyMembers(true);
    apiJson<string[]>(`/api/messages/company-members/${selectedCompanyId}`)
      .then((ids) => setCompanyMemberIds(ids || []))
      .catch(console.error)
      .finally(() => setLoadingCompanyMembers(false));
    setSelectedGroup([]);
    setAlleMitglieder(false);
  }, [selectedCompanyId]);

  // Wenn Scope wechselt, auswahl zurücksetzen
  useEffect(() => {
    setSelectedGroup([]);
    setAlleMitglieder(false);
    setGroupSearch("");
    if (groupScope !== "company") setSelectedCompanyId("");
  }, [groupScope]);

  // ── Gefilterte Mitgliederlisten ──────────────────────────────────────────────
  const directFiltered = members.filter((m) => {
    const q = directSearch.toLowerCase();
    return m.first_name.toLowerCase().includes(q) || m.last_name.toLowerCase().includes(q);
  });

  const groupMemberPool =
    groupScope === "company" && selectedCompanyId
      ? members.filter((m) => companyMemberIds.includes(m.id))
      : members;

  const groupFiltered = groupMemberPool.filter((m) => {
    const q = groupSearch.toLowerCase();
    return m.first_name.toLowerCase().includes(q) || m.last_name.toLowerCase().includes(q);
  });

  const toggleGroupMember = (id: string) => {
    setSelectedGroup((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const getMemberAvatar = (m: MemberOption) => {
    if (!m.avatar_url) return undefined;
    if (m.avatar_url.startsWith("http") || m.avatar_url.startsWith("/")) return m.avatar_url;
    return getStorageUrl("avatars", m.avatar_url);
  };

  // ── Erstellen ────────────────────────────────────────────────────────────────
  const handleCreateDirect = async () => {
    if (!selectedDirect) return;
    setSubmitting(true);
    try {
      const result = await onCreate({ type: "direct", memberIds: [selectedDirect], scope: "club" });
      onCreated(result.id);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) return;
    if (groupScope === "company" && !selectedCompanyId) return;
    if (!alleMitglieder && selectedGroup.length < 1) return;

    setSubmitting(true);
    try {
      const result = await onCreate({
        type: "group",
        name: groupName.trim(),
        memberIds: alleMitglieder ? [] : selectedGroup,
        scope: groupScope,
        scope_id: groupScope === "company" ? selectedCompanyId : undefined,
        alle_mitglieder: alleMitglieder,
      });
      onCreated(result.id);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const canCreateGroup =
    !!groupName.trim() &&
    (groupScope !== "company" || !!selectedCompanyId) &&
    (alleMitglieder || selectedGroup.length >= 1) &&
    !submitting;

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Neue Nachricht</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="direct">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="direct" className="gap-2">
              <User className="h-4 w-4" />
              Direktnachricht
            </TabsTrigger>
            <TabsTrigger value="group" className="gap-2">
              <Users className="h-4 w-4" />
              Gruppe
            </TabsTrigger>
          </TabsList>

          {/* ─── Direktnachricht-Tab ─── */}
          <TabsContent value="direct" className="mt-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Mitglied suchen…"
                value={directSearch}
                onChange={(e) => setDirectSearch(e.target.value)}
              />
            </div>
            <div className="max-h-60 overflow-y-auto space-y-1 rounded-md border p-1">
              {directFiltered.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Keine Mitglieder gefunden</p>
              )}
              {directFiltered.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelectedDirect(m.id)}
                  className={cn(
                    "flex items-center gap-3 w-full rounded-md px-2 py-2 text-sm transition-colors hover:bg-accent",
                    selectedDirect === m.id && "bg-primary/10 text-primary font-medium"
                  )}
                >
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={getMemberAvatar(m)} />
                    <AvatarFallback className="text-xs">{m.first_name[0]}{m.last_name[0]}</AvatarFallback>
                  </Avatar>
                  {m.first_name} {m.last_name}
                </button>
              ))}
            </div>
            <Button className="w-full" disabled={!selectedDirect || submitting} onClick={handleCreateDirect}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Nachricht senden
            </Button>
          </TabsContent>

          {/* ─── Gruppe-Tab ─── */}
          <TabsContent value="group" className="mt-4 space-y-4">

            {/* Scope-Auswahl */}
            <div className="space-y-1.5">
              <Label>Kommunikationsebene</Label>
              <div className="grid grid-cols-3 gap-1.5">
                {SCOPE_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const isActive = groupScope === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setGroupScope(opt.value)}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-xs font-medium transition-colors",
                        isActive ? opt.activeClass : "border-border text-muted-foreground hover:bg-accent"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Kompanie-Auswahl (nur bei scope = company) */}
            {groupScope === "company" && (
              <div className="space-y-1.5">
                <Label>Kompanie</Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={selectedCompanyId}
                  onChange={(e) => setSelectedCompanyId(e.target.value)}
                >
                  <option value="">Kompanie auswählen…</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Gruppenname */}
            <div className="space-y-1.5">
              <Label>
                {groupScope === "external" ? "Name des externen Kontakts" : "Gruppenname"}
              </Label>
              <Input
                placeholder={
                  groupScope === "external"
                    ? "z. B. Musikkapelle Bergheim, Schausteller Müller…"
                    : "z. B. Vorstand, Festausschuss, Offiziere…"
                }
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
              />
            </div>

            {/* Alle-Checkbox (nur Kompanie + Verein) */}
            {groupScope !== "external" && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="alle-mitglieder"
                  checked={alleMitglieder}
                  onCheckedChange={(v) => {
                    setAlleMitglieder(!!v);
                    if (v) setSelectedGroup([]);
                  }}
                  disabled={groupScope === "company" && !selectedCompanyId}
                />
                <label htmlFor="alle-mitglieder" className="text-sm cursor-pointer select-none">
                  {groupScope === "company"
                    ? "Alle Kompaniemitglieder hinzufügen"
                    : "Alle Vereinsmitglieder hinzufügen"}
                </label>
              </div>
            )}

            {/* Mitglieder-Auswahl (nur wenn nicht alle) */}
            {!alleMitglieder && (groupScope !== "company" || selectedCompanyId) && (
              <>
                {/* Ausgewählte Chips */}
                {selectedGroup.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {selectedGroup.map((id) => {
                      const m = members.find((x) => x.id === id);
                      if (!m) return null;
                      return (
                        <Badge
                          key={id}
                          variant="secondary"
                          className="cursor-pointer"
                          onClick={() => toggleGroupMember(id)}
                        >
                          {m.first_name} {m.last_name} ×
                        </Badge>
                      );
                    })}
                  </div>
                )}

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Mitglieder suchen…"
                    value={groupSearch}
                    onChange={(e) => setGroupSearch(e.target.value)}
                  />
                </div>

                <div className="max-h-40 overflow-y-auto space-y-1 rounded-md border p-1">
                  {loadingCompanyMembers ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : groupFiltered.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Keine Mitglieder gefunden
                    </p>
                  ) : (
                    groupFiltered.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => toggleGroupMember(m.id)}
                        className={cn(
                          "flex items-center gap-3 w-full rounded-md px-2 py-2 text-sm transition-colors hover:bg-accent",
                          selectedGroup.includes(m.id) && "bg-primary/10 text-primary font-medium"
                        )}
                      >
                        <Avatar className="h-7 w-7">
                          <AvatarImage src={getMemberAvatar(m)} />
                          <AvatarFallback className="text-xs">{m.first_name[0]}{m.last_name[0]}</AvatarFallback>
                        </Avatar>
                        {m.first_name} {m.last_name}
                      </button>
                    ))
                  )}
                </div>
              </>
            )}

            <Button className="w-full" disabled={!canCreateGroup} onClick={handleCreateGroup}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Gruppe erstellen
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
