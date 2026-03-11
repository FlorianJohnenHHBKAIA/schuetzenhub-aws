import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, FileDown, Loader2, Printer } from "lucide-react";
import PortalLayout from "@/components/portal/PortalLayout";
import { Button } from "@/components/ui/button";
import { apiJson, getStorageUrl as getUrl } from "@/integrations/api/client";
import { useToast } from "@/hooks/use-toast";

interface Magazine {
  id: string;
  title: string;
  year: number;
  club_id: string;
  club_name?: string;
  club_logo?: string;
}

interface Section {
  id: string;
  type: string;
  title: string;
  sort_order: number;
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

interface Club {
  name: string;
  logo_path: string | null;
}

interface PostData { id: string; title: string; content: string; }
interface EventData { id: string; title: string; description: string; start_at: string; location?: string; }
interface CompanyData { id: string; name: string; description?: string; }

interface ContentData {
  posts: Record<string, { title: string; content: string }>;
  events: Record<string, { title: string; description: string; start_at: string; location?: string }>;
  companies: Record<string, { name: string; description?: string }>;
}

const MagazinePDF = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);

  const [magazine, setMagazine] = useState<Magazine | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [items, setItems] = useState<MagazineItem[]>([]);
  const [contentData, setContentData] = useState<ContentData>({ posts: {}, events: {}, companies: {} });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (id) fetchMagazineData();
  }, [id]);

  const fetchMagazineData = async () => {
    setIsLoading(true);
    try {
      // Magazine laden
      const mag = await apiJson<Magazine>(`/api/magazines/${id}`);

      // Club-Info laden
      const club = await apiJson<Club>("/api/clubs/me").catch(() => null);
      setMagazine({
        ...mag,
        club_name: club?.name,
        club_logo: club?.logo_path ? getUrl("club-assets", club.logo_path) : undefined,
      });

      // Sections + Items laden
      const { sections: secs, items: its } = await apiJson<{ sections: Section[]; items: MagazineItem[] }>(
        `/api/magazines/${id}/sections`
      );
      setSections(secs || []);
      setItems(its || []);

      // Content-Details laden
      if (its?.length > 0) {
        await fetchContentDetails(its);
      }
    } catch (e) {
      toast({ title: "Fehler", description: "Schuetzenheft nicht gefunden", variant: "destructive" });
      navigate("/portal/magazine");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchContentDetails = async (allItems: MagazineItem[]) => {
    const data: ContentData = { posts: {}, events: {}, companies: {} };

    const postIds = allItems.filter((i) => i.content_type === "post" && i.content_id).map((i) => i.content_id!);
    if (postIds.length > 0) {
      try {
        const posts = await apiJson<PostData[]>(`/api/posts?ids=${postIds.join(",")}`);
        posts?.forEach((p: PostData) => { data.posts[p.id] = { title: p.title, content: p.content }; });
      } catch {
        // ignorieren
      }
    }

    const eventIds = allItems.filter((i) => i.content_type === "event" && i.content_id).map((i) => i.content_id!);
    if (eventIds.length > 0) {
      try {
        const events = await apiJson<EventData[]>(`/api/events?ids=${eventIds.join(",")}`);
        events?.forEach((e: EventData) => {
          data.events[e.id] = { title: e.title, description: e.description || "", start_at: e.start_at, location: e.location };
        });
      } catch {
        // ignorieren
      }
    }

    const companyIds = allItems.filter((i) => i.company_id).map((i) => i.company_id!);
    if (companyIds.length > 0) {
      try {
        const companies = await apiJson<CompanyData[]>("/api/companies");
        companies?.filter((c: CompanyData) => companyIds.includes(c.id)).forEach((c: CompanyData) => {
          data.companies[c.id] = { name: c.name, description: c.description };
        });
      } catch {
        // ignorieren
      }
    }

    setContentData(data);
  };

  const handlePrint = () => window.print();

  const handleDownloadPDF = () => {
    toast({ title: "PDF wird erstellt", description: "Waehlen Sie 'Als PDF speichern' im Druckdialog" });
    setTimeout(() => window.print(), 300);
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

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

  return (
    <PortalLayout>
      {/* Steuerleiste – wird beim Drucken ausgeblendet */}
      <div className="max-w-4xl mx-auto mb-6 print:hidden">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(`/portal/magazine/${id}`)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-display text-2xl font-bold">PDF-Vorschau</h1>
              <p className="text-muted-foreground">{magazine.title}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-2" />Drucken
            </Button>
            <Button onClick={handleDownloadPDF}>
              <FileDown className="w-4 h-4 mr-2" />Als PDF speichern
            </Button>
          </div>
        </motion.div>
      </div>

      {/* PDF-Inhalt */}
      <div ref={printRef} className="max-w-4xl mx-auto bg-white text-black shadow-lg print:max-w-none print:shadow-none print:mx-0">

        {/* Deckblatt */}
        <div className="min-h-screen flex flex-col items-center justify-center text-center p-16 print:break-after-page border-b">
          {magazine.club_logo && (
            <img src={magazine.club_logo} alt="Vereinslogo" className="w-32 h-32 object-contain mb-8" />
          )}
          <h1 className="text-5xl font-bold mb-6">{magazine.title}</h1>
          {magazine.club_name && <p className="text-2xl text-gray-600 mb-2">{magazine.club_name}</p>}
          <p className="text-xl text-gray-500">{magazine.year}</p>
        </div>

        {/* Inhaltsverzeichnis */}
        {sections.length > 0 && (
          <div className="p-12 print:break-after-page border-b">
            <h2 className="text-3xl font-bold mb-8 pb-4 border-b-2">Inhaltsverzeichnis</h2>
            <div className="space-y-3">
              {sections.map((section, index) => (
                <div key={section.id} className="flex items-center justify-between text-lg border-b border-dotted border-gray-300 pb-2">
                  <span>{section.title}</span>
                  <span className="text-gray-400 text-sm">Seite {index + 2}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Kapitel */}
        {sections.map((section) => {
          const sectionItems = items
            .filter((i) => i.section_id === section.id)
            .sort((a, b) => a.order_index - b.order_index);

          return (
            <div key={section.id} className="p-12 print:break-after-page border-b">
              <h2 className="text-3xl font-bold mb-8 pb-4 border-b-2 border-gray-800">{section.title}</h2>

              {sectionItems.length === 0 ? (
                <p className="text-gray-400 italic">Kein Inhalt in diesem Kapitel.</p>
              ) : (
                <div className="space-y-8">
                  {sectionItems.map((item) => {
                    if (item.content_type === "custom_text" && item.custom_text) {
                      return (
                        <div key={item.id} className="leading-relaxed text-lg">
                          <p className="whitespace-pre-wrap">{item.custom_text}</p>
                        </div>
                      );
                    }
                    if (item.content_type === "post" && item.content_id && contentData.posts[item.content_id]) {
                      const post = contentData.posts[item.content_id];
                      return (
                        <article key={item.id}>
                          <h3 className="text-2xl font-semibold mb-3">{post.title}</h3>
                          <p className="whitespace-pre-wrap leading-relaxed text-lg">{post.content}</p>
                        </article>
                      );
                    }
                    if (item.content_type === "event" && item.content_id && contentData.events[item.content_id]) {
                      const event = contentData.events[item.content_id];
                      return (
                        <article key={item.id}>
                          <h3 className="text-2xl font-semibold mb-2">{event.title}</h3>
                          <p className="text-gray-500 mb-3 italic">
                            {formatDate(event.start_at)}{event.location && ` • ${event.location}`}
                          </p>
                          {event.description && <p className="whitespace-pre-wrap leading-relaxed text-lg">{event.description}</p>}
                        </article>
                      );
                    }
                    if (item.company_id && contentData.companies[item.company_id]) {
                      const company = contentData.companies[item.company_id];
                      return (
                        <article key={item.id}>
                          <h3 className="text-2xl font-semibold mb-3">{company.name}</h3>
                          {company.description && <p className="whitespace-pre-wrap leading-relaxed text-lg">{company.description}</p>}
                        </article>
                      );
                    }
                    return null;
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Schlussseite */}
        <div className="min-h-64 flex flex-col items-center justify-center text-center p-12">
          {magazine.club_name && <p className="text-xl text-gray-600">{magazine.club_name}</p>}
          <p className="text-lg text-gray-500 mt-2">{magazine.year}</p>
          <p className="text-sm text-gray-400 mt-6">Erstellt mit SchutzenHub</p>
        </div>
      </div>

      {/* Druckstile */}
      <style>{`
        @media print {
          @page { size: A4; margin: 2cm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print\\:hidden { display: none !important; }
          .print\\:break-after-page { break-after: page; }
          .print\\:shadow-none { box-shadow: none !important; }
          .print\\:mx-0 { margin-left: 0 !important; margin-right: 0 !important; }
          .print\\:max-w-none { max-width: none !important; }
        }
      `}</style>
    </PortalLayout>
  );
};

export default MagazinePDF;