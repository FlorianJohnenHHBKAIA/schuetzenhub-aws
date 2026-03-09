import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, FileDown, Loader2, Eye, Printer } from "lucide-react";
import PortalLayout from "@/components/portal/PortalLayout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";

interface Magazine {
  id: string;
  title: string;
  year: number;
  club_id: string;
  club?: {
    name: string;
    logo_path: string | null;
  };
}

interface Section {
  id: string;
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

interface ContentData {
  posts: Record<string, { title: string; content: string; cover_image_path?: string }>;
  events: Record<string, { title: string; description: string; start_at: string; location?: string }>;
  companies: Record<string, { name: string; description?: string }>;
}

const MagazinePDF = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { member } = useAuth();
  const { toast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);

  const [magazine, setMagazine] = useState<Magazine | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [items, setItems] = useState<MagazineItem[]>([]);
  const [contentData, setContentData] = useState<ContentData>({
    posts: {},
    events: {},
    companies: {},
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (id) fetchMagazineData();
  }, [id]);

  const fetchMagazineData = async () => {
    setIsLoading(true);

    // Fetch magazine with club info
    const { data: magData, error: magError } = await supabase
      .from("magazines")
      .select(`
        *,
        club:clubs(name, logo_path)
      `)
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

    // Fetch items
    if (secs.length > 0) {
      const { data: itemsData } = await supabase
        .from("magazine_items")
        .select("*")
        .in("section_id", secs.map((s) => s.id))
        .order("order_index");

      const allItems = itemsData || [];
      setItems(allItems);

      // Fetch content details
      await fetchContentDetails(allItems);
    }

    setIsLoading(false);
  };

  const fetchContentDetails = async (allItems: MagazineItem[]) => {
    const data: ContentData = { posts: {}, events: {}, companies: {} };

    // Fetch posts
    const postIds = allItems.filter((i) => i.content_type === "post" && i.content_id).map((i) => i.content_id!);
    if (postIds.length > 0) {
      const { data: posts } = await supabase
        .from("posts")
        .select("id, title, content, cover_image_path")
        .in("id", postIds);

      posts?.forEach((p) => {
        data.posts[p.id] = { title: p.title, content: p.content, cover_image_path: p.cover_image_path || undefined };
      });
    }

    // Fetch events
    const eventIds = allItems.filter((i) => i.content_type === "event" && i.content_id).map((i) => i.content_id!);
    if (eventIds.length > 0) {
      const { data: events } = await supabase
        .from("events")
        .select("id, title, description, start_at, location")
        .in("id", eventIds);

      events?.forEach((e) => {
        data.events[e.id] = {
          title: e.title,
          description: e.description || "",
          start_at: e.start_at,
          location: e.location || undefined,
        };
      });
    }

    // Fetch companies
    const companyIds = allItems.filter((i) => i.company_id).map((i) => i.company_id!);
    if (companyIds.length > 0) {
      const { data: companies } = await supabase
        .from("companies")
        .select("id, name, description")
        .in("id", companyIds);

      companies?.forEach((c) => {
        data.companies[c.id] = { name: c.name, description: c.description || undefined };
      });
    }

    setContentData(data);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    setIsGenerating(true);
    // Use browser print to PDF
    window.print();
    setIsGenerating(false);
    toast({ title: "PDF wird erstellt", description: "Wählen Sie 'Als PDF speichern' im Druckdialog" });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("de-DE", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const getStorageUrl = (path: string | null | undefined) => {
    if (!path) return null;
    return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/${path}`;
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

  return (
    <PortalLayout>
      {/* Controls - hidden in print */}
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
              <Printer className="w-4 h-4 mr-2" />
              Drucken
            </Button>
            <Button onClick={handleDownloadPDF} disabled={isGenerating}>
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <FileDown className="w-4 h-4 mr-2" />
              )}
              Als PDF speichern
            </Button>
          </div>
        </motion.div>
      </div>

      {/* PDF Content */}
      <div
        ref={printRef}
        className="max-w-4xl mx-auto bg-white text-black print:max-w-none print:mx-0"
      >
        {/* Cover Page */}
        <div className="min-h-[100vh] flex flex-col items-center justify-center text-center p-12 print:break-after-page">
          {magazine.club?.logo_path && (
            <img
              src={getStorageUrl(magazine.club.logo_path) || ""}
              alt="Vereinslogo"
              className="w-32 h-32 object-contain mb-8"
            />
          )}
          <h1 className="text-5xl font-bold mb-4">{magazine.title}</h1>
          <p className="text-2xl text-gray-600">{magazine.club?.name}</p>
          <p className="text-xl text-gray-500 mt-4">{magazine.year}</p>
        </div>

        {/* Table of Contents */}
        <div className="min-h-[100vh] p-12 print:break-after-page">
          <h2 className="text-3xl font-bold mb-8 pb-4 border-b-2">Inhaltsverzeichnis</h2>
          <div className="space-y-4">
            {sections.map((section, index) => (
              <div key={section.id} className="flex items-center justify-between text-lg">
                <span>{section.title}</span>
                <span className="text-gray-400">{index + 1}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Content Sections */}
        {sections.map((section) => {
          const sectionItems = items
            .filter((i) => i.section_id === section.id)
            .sort((a, b) => a.order_index - b.order_index);

          return (
            <div key={section.id} className="min-h-[50vh] p-12 print:break-after-page">
              <h2 className="text-3xl font-bold mb-8 pb-4 border-b-2">{section.title}</h2>

              <div className="space-y-8">
                {sectionItems.map((item) => {
                  // Custom text
                  if (item.content_type === "custom_text" && item.custom_text) {
                    return (
                      <div key={item.id} className="prose prose-lg max-w-none">
                        <p className="whitespace-pre-wrap leading-relaxed">{item.custom_text}</p>
                      </div>
                    );
                  }

                  // Post
                  if (item.content_type === "post" && item.content_id && contentData.posts[item.content_id]) {
                    const post = contentData.posts[item.content_id];
                    return (
                      <article key={item.id} className="mb-8">
                        <h3 className="text-2xl font-semibold mb-4">{post.title}</h3>
                        <div className="prose prose-lg max-w-none">
                          <p className="whitespace-pre-wrap leading-relaxed">{post.content}</p>
                        </div>
                      </article>
                    );
                  }

                  // Event
                  if (item.content_type === "event" && item.content_id && contentData.events[item.content_id]) {
                    const event = contentData.events[item.content_id];
                    return (
                      <article key={item.id} className="mb-8">
                        <h3 className="text-2xl font-semibold mb-2">{event.title}</h3>
                        <p className="text-gray-600 mb-4">
                          {formatDate(event.start_at)}
                          {event.location && ` • ${event.location}`}
                        </p>
                        {event.description && (
                          <div className="prose prose-lg max-w-none">
                            <p className="whitespace-pre-wrap leading-relaxed">{event.description}</p>
                          </div>
                        )}
                      </article>
                    );
                  }

                  // Company report
                  if (item.company_id && contentData.companies[item.company_id]) {
                    const company = contentData.companies[item.company_id];
                    return (
                      <article key={item.id} className="mb-8">
                        <h3 className="text-2xl font-semibold mb-4">{company.name}</h3>
                        {company.description && (
                          <div className="prose prose-lg max-w-none">
                            <p className="whitespace-pre-wrap leading-relaxed">{company.description}</p>
                          </div>
                        )}
                      </article>
                    );
                  }

                  return null;
                })}
              </div>
            </div>
          );
        })}

        {/* Footer Page */}
        <div className="min-h-[50vh] flex flex-col items-center justify-center text-center p-12">
          <p className="text-xl text-gray-600">{magazine.club?.name}</p>
          <p className="text-lg text-gray-500 mt-2">{magazine.year}</p>
          <p className="text-sm text-gray-400 mt-8">
            Erstellt mit dem Vereinsportal
          </p>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 2cm;
          }
          
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          .print\\:hidden {
            display: none !important;
          }
          
          .print\\:break-after-page {
            break-after: page;
          }
        }
      `}</style>
    </PortalLayout>
  );
};

export default MagazinePDF;
