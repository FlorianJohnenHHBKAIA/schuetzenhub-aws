import { useEffect, useState } from "react";
import { FileText, Image, Calendar, MessageSquare, Loader2, Check, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";

interface MagazineContentPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectionType: string;
  clubId: string;
  onSelect: (contentType: string, contentId: string | null, customText?: string, companyId?: string) => void;
}

interface Post {
  id: string;
  title: string;
  created_at: string;
  category: string;
}

interface Event {
  id: string;
  title: string;
  start_at: string;
  category: string;
}

interface Company {
  id: string;
  name: string;
}

const MagazineContentPicker = ({
  open,
  onOpenChange,
  sectionType,
  clubId,
  onSelect,
}: MagazineContentPickerProps) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [customText, setCustomText] = useState("");
  const [activeTab, setActiveTab] = useState("posts");

  useEffect(() => {
    if (open) {
      fetchContent();
      // Set default tab based on section type
      if (sectionType === "greeting" || sectionType === "custom") {
        setActiveTab("text");
      } else if (sectionType === "events") {
        setActiveTab("events");
      } else if (sectionType === "company_reports") {
        setActiveTab("companies");
      } else {
        setActiveTab("posts");
      }
    }
  }, [open, sectionType]);

  const fetchContent = async () => {
    setIsLoading(true);

    // Fetch approved posts
    const { data: postsData } = await supabase
      .from("posts")
      .select("id, title, created_at, category")
      .eq("club_id", clubId)
      .eq("publication_status", "approved")
      .order("created_at", { ascending: false })
      .limit(50);

    setPosts(postsData || []);

    // Fetch approved events
    const { data: eventsData } = await supabase
      .from("events")
      .select("id, title, start_at, category")
      .eq("club_id", clubId)
      .eq("publication_status", "approved")
      .order("start_at", { ascending: false })
      .limit(50);

    setEvents(eventsData || []);

    // Fetch companies
    const { data: companiesData } = await supabase
      .from("companies")
      .select("id, name")
      .eq("club_id", clubId)
      .order("name");

    setCompanies(companiesData || []);

    setIsLoading(false);
  };

  const handleSelect = () => {
    if (activeTab === "text" && customText.trim()) {
      onSelect("custom_text", null, customText);
      setCustomText("");
    } else if (activeTab === "posts" && selectedId) {
      onSelect("post", selectedId);
    } else if (activeTab === "events" && selectedId) {
      onSelect("event", selectedId);
    } else if (activeTab === "companies" && selectedId) {
      onSelect("report", null, undefined, selectedId);
    }
    setSelectedId(null);
    onOpenChange(false);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Inhalt hinzufügen</DialogTitle>
          <DialogDescription>
            Wählen Sie einen bestehenden Inhalt oder erstellen Sie einen freien Text
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full">
            <TabsTrigger value="posts" className="flex-1">
              <FileText className="w-4 h-4 mr-1" />
              Beiträge
            </TabsTrigger>
            <TabsTrigger value="events" className="flex-1">
              <Calendar className="w-4 h-4 mr-1" />
              Events
            </TabsTrigger>
            <TabsTrigger value="companies" className="flex-1">
              <Users className="w-4 h-4 mr-1" />
              Kompanien
            </TabsTrigger>
            <TabsTrigger value="text" className="flex-1">
              <MessageSquare className="w-4 h-4 mr-1" />
              Freier Text
            </TabsTrigger>
          </TabsList>

          <div className="mt-4">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <TabsContent value="posts" className="mt-0">
                  <ScrollArea className="h-[300px]">
                    {posts.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">
                        Keine veröffentlichten Beiträge vorhanden
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {posts.map((post) => (
                          <button
                            key={post.id}
                            onClick={() => setSelectedId(post.id)}
                            className={`w-full text-left p-3 rounded-lg border transition-colors ${
                              selectedId === post.id
                                ? "bg-primary/10 border-primary"
                                : "hover:bg-muted/50"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{post.title}</span>
                              {selectedId === post.id && (
                                <Check className="w-4 h-4 text-primary" />
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {formatDate(post.created_at)} • {post.category}
                            </p>
                          </button>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="events" className="mt-0">
                  <ScrollArea className="h-[300px]">
                    {events.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">
                        Keine veröffentlichten Veranstaltungen vorhanden
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {events.map((event) => (
                          <button
                            key={event.id}
                            onClick={() => setSelectedId(event.id)}
                            className={`w-full text-left p-3 rounded-lg border transition-colors ${
                              selectedId === event.id
                                ? "bg-primary/10 border-primary"
                                : "hover:bg-muted/50"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{event.title}</span>
                              {selectedId === event.id && (
                                <Check className="w-4 h-4 text-primary" />
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {formatDate(event.start_at)} • {event.category}
                            </p>
                          </button>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="companies" className="mt-0">
                  <ScrollArea className="h-[300px]">
                    {companies.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">
                        Keine Kompanien vorhanden
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {companies.map((company) => (
                          <button
                            key={company.id}
                            onClick={() => setSelectedId(company.id)}
                            className={`w-full text-left p-3 rounded-lg border transition-colors ${
                              selectedId === company.id
                                ? "bg-primary/10 border-primary"
                                : "hover:bg-muted/50"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{company.name}</span>
                              {selectedId === company.id && (
                                <Check className="w-4 h-4 text-primary" />
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Kompaniebericht einfügen
                            </p>
                          </button>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="text" className="mt-0">
                  <div className="space-y-2">
                    <Label>Freier Text (z.B. Grußwort)</Label>
                    <Textarea
                      placeholder="Geben Sie hier Ihren Text ein..."
                      value={customText}
                      onChange={(e) => setCustomText(e.target.value)}
                      rows={10}
                      className="resize-none"
                    />
                  </div>
                </TabsContent>
              </>
            )}
          </div>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button
            onClick={handleSelect}
            disabled={
              (activeTab === "text" && !customText.trim()) ||
              (activeTab !== "text" && !selectedId)
            }
          >
            Hinzufügen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MagazineContentPicker;
