import { useEffect, useState } from "react";
import { Reorder } from "framer-motion";
import { GripVertical, Trash2, FileText, Calendar, MessageSquare, Users, Edit, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiJson } from "@/integrations/api/client";

interface MagazineItem {
  id: string;
  section_id: string;
  content_type: string;
  content_id: string | null;
  custom_text: string | null;
  company_id: string | null;
  order_index: number;
}

interface ContentDetails {
  title: string;
  subtitle: string;
  content?: string;
}

interface MagazineSectionContentProps {
  items: MagazineItem[];
  isEditable: boolean;
  onDelete: (itemId: string) => void;
  onReorder: (newOrder: MagazineItem[]) => void;
  onUpdateText: (itemId: string, text: string) => void;
  clubId: string;
}

const MagazineSectionContent = ({
  items,
  isEditable,
  onDelete,
  onReorder,
  onUpdateText,
  clubId,
}: MagazineSectionContentProps) => {
  const [contentDetails, setContentDetails] = useState<Record<string, ContentDetails>>({});
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  useEffect(() => {
    fetchContentDetails();
  }, [items]);

  const fetchContentDetails = async () => {
    const details: Record<string, ContentDetails> = {};

    type Post = { id: string; title: string; content: string | null };
    type Event = { id: string; title: string; description: string | null; start_at: string };
    type Company = { id: string; name: string; description: string | null };

    const postIds = items.filter((i) => i.content_type === "post" && i.content_id).map((i) => i.content_id!);
    if (postIds.length > 0) {
      try {
        const posts = await apiJson<Post[]>(`/api/posts?ids=${postIds.join(",")}`);
        posts?.forEach((post) => {
          details[post.id] = { title: post.title, subtitle: "Beitrag", content: post.content ?? undefined };
        });
      } catch (e) { /* ignore */ }
    }

    const eventIds = items.filter((i) => i.content_type === "event" && i.content_id).map((i) => i.content_id!);
    if (eventIds.length > 0) {
      try {
        const events = await apiJson<Event[]>(`/api/events?ids=${eventIds.join(",")}`);
        events?.forEach((event) => {
          details[event.id] = {
            title: event.title,
            subtitle: new Date(event.start_at).toLocaleDateString("de-DE"),
            content: event.description ?? undefined,
          };
        });
      } catch (e) { /* ignore */ }
    }

    const companyIds = items.filter((i) => i.company_id).map((i) => i.company_id!);
    if (companyIds.length > 0) {
      try {
        const companies = await apiJson<Company[]>("/api/companies");
        companies?.filter((c) => companyIds.includes(c.id)).forEach((company) => {
          details[company.id] = { title: company.name, subtitle: "Kompaniebericht", content: company.description ?? undefined };
        });
      } catch (e) { /* ignore */ }
    }

    setContentDetails(details);
  };

  const getItemIcon = (contentType: string) => {
    switch (contentType) {
      case "post": return FileText;
      case "event": return Calendar;
      case "custom_text": return MessageSquare;
      case "report": return Users;
      default: return FileText;
    }
  };

  const getItemInfo = (item: MagazineItem): ContentDetails => {
    if (item.content_type === "custom_text") {
      return {
        title: "Freier Text",
        subtitle: item.custom_text?.substring(0, 50) + (item.custom_text && item.custom_text.length > 50 ? "..." : "") || "Klicke auf Bearbeiten um Text einzugeben",
        content: item.custom_text || undefined,
      };
    }
    if (item.company_id && contentDetails[item.company_id]) return contentDetails[item.company_id];
    if (item.content_id && contentDetails[item.content_id]) return contentDetails[item.content_id];
    return { title: "Laden...", subtitle: "" };
  };

  const handleStartEdit = (item: MagazineItem) => {
    setEditingItemId(item.id);
    setEditText(item.custom_text || "");
  };

  const handleSaveEdit = (itemId: string) => {
    onUpdateText(itemId, editText);
    setEditingItemId(null);
    setEditText("");
  };

  const handleCancelEdit = () => {
    setEditingItemId(null);
    setEditText("");
  };

  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
        <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>Noch keine Inhalte</p>
        <p className="text-sm">Klicke oben auf "Text" um einen freien Text hinzuzufuegen</p>
      </div>
    );
  }

  return (
    <Reorder.Group axis="y" values={items} onReorder={isEditable ? onReorder : () => {}} className="space-y-3">
      {items.map((item) => {
        const Icon = getItemIcon(item.content_type);
        const info = getItemInfo(item);
        const isEditing = editingItemId === item.id;

        return (
          <Reorder.Item key={item.id} value={item} className="bg-background border rounded-lg p-4">
            <div className="flex items-start gap-3">
              {isEditable && <GripVertical className="w-4 h-4 mt-1 text-muted-foreground cursor-grab flex-shrink-0" />}
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium">{info.title}</p>
                <p className="text-sm text-muted-foreground">{info.subtitle}</p>

                {isEditing ? (
                  <div className="mt-3 space-y-2">
                    <Textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={6}
                      className="resize-none"
                      placeholder="Text hier eingeben..."
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleSaveEdit(item.id)}>
                        <Check className="w-4 h-4 mr-1" />Speichern
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                        <X className="w-4 h-4 mr-1" />Abbrechen
                      </Button>
                    </div>
                  </div>
                ) : (
                  info.content && (
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-3 whitespace-pre-wrap">
                      {info.content}
                    </p>
                  )
                )}
              </div>

              {isEditable && !isEditing && (
                <div className="flex gap-1 flex-shrink-0">
                  {item.content_type === "custom_text" && (
                    <Button size="icon" variant="ghost" onClick={() => handleStartEdit(item)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => onDelete(item.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </Reorder.Item>
        );
      })}
    </Reorder.Group>
  );
};

export default MagazineSectionContent;