import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Images, 
  Shield, 
  ArrowLeft,
  X,
  ChevronLeft,
  ChevronRight,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase, getStorageUrl } from "@/integrations/supabase/client";

interface ClubData {
  id: string;
  name: string;
  slug: string;
  logo_path: string | null;
  tagline: string | null;
}

interface GalleryImage {
  id: string;
  title: string | null;
  description: string | null;
  image_path: string;
  created_at: string;
}

const PublicGallery = () => {
  const { slug } = useParams<{ slug: string }>();
  const [club, setClub] = useState<ClubData | null>(null);
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (slug) fetchData();
  }, [slug]);

  const fetchData = async () => {
    if (!slug) return;
    
    try {
      const { data: clubData, error: clubError } = await supabase
        .from("clubs")
        .select("*")
        .eq("slug", slug)
        .single();

      if (clubError) throw clubError;
      const club = clubData as ClubData;
      setClub(club);

      if (club.logo_path) {
        setLogoUrl(getStorageUrl("club-assets", club.logo_path) || null);
      }

      // Fetch approved public gallery images
      const galleryRes = await fetch(`/api/public/gallery/${slug}`);
      const galleryData = galleryRes.ok ? await galleryRes.json() : [];
      setImages((galleryData as GalleryImage[]) || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getImageUrl = (path: string) => 
    `${getStorageUrl("gallery-images", path) || ""}`;

  const openLightbox = (index: number) => setSelectedIndex(index);
  const closeLightbox = () => setSelectedIndex(null);
  
  const goToPrevious = () => {
    if (selectedIndex !== null) {
      setSelectedIndex(selectedIndex === 0 ? images.length - 1 : selectedIndex - 1);
    }
  };
  
  const goToNext = () => {
    if (selectedIndex !== null) {
      setSelectedIndex(selectedIndex === images.length - 1 ? 0 : selectedIndex + 1);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-forest-dark flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold"></div>
      </div>
    );
  }

  if (!club) {
    return (
      <div className="min-h-screen bg-forest-dark flex flex-col items-center justify-center">
        <Shield className="w-16 h-16 text-gold mb-4" />
        <h1 className="text-2xl font-bold text-cream mb-2">Verein nicht gefunden</h1>
        <Button variant="hero" asChild>
          <Link to="/">Zur Startseite</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-forest-dark">
      <Helmet>
        <title>Galerie – {club.name}</title>
        <meta name="description" content={`Eindrücke und Bilder aus dem Vereinsleben bei ${club.name}. Entdecken Sie unsere Feste, Veranstaltungen und Traditionen.`} />
        <meta property="og:title" content={`Galerie – ${club.name}`} />
        <meta property="og:description" content="Eindrücke aus dem Vereinsleben" />
        <meta property="og:type" content="website" />
        {images[0] && (
          <meta property="og:image" content={getImageUrl(images[0].image_path)} />
        )}
      </Helmet>

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-forest-dark/90 backdrop-blur-md border-b border-gold/10">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <Link 
            to={`/verein/${club.slug}`}
            className="flex items-center gap-3 text-cream hover:text-gold transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <div className="flex items-center gap-2">
              {logoUrl ? (
                <img src={logoUrl} alt={club.name} className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <Shield className="w-8 h-8 text-gold" />
              )}
              <span className="font-medium hidden sm:inline">{club.name}</span>
            </div>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative pt-28 pb-16 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.1 }}
            transition={{ duration: 2 }}
            className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-gold blur-[120px]"
          />
        </div>

        <div className="container mx-auto px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-3xl mx-auto text-center"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gold/20 mb-6">
              <Images className="w-8 h-8 text-gold" />
            </div>
            
            <h1 className="font-display text-4xl md:text-5xl font-bold text-cream mb-4">
              Galerie
            </h1>
            
            <p className="text-cream/70 text-lg">
              Eindrücke aus dem Vereinsleben bei {club.name}
            </p>

            <div className="mt-6 text-cream/50 text-sm">
              {images.length} Bilder
            </div>
          </motion.div>
        </div>
      </section>

      {/* Gallery Grid */}
      <section className="pb-20">
        <div className="container mx-auto px-6">
          {images.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-20"
            >
              <Images className="w-16 h-16 text-cream/30 mx-auto mb-4" />
              <p className="text-cream/60">Noch keine Bilder veröffentlicht</p>
            </motion.div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {images.map((image, index) => (
                <motion.div
                  key={image.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: (index % 8) * 0.05 }}
                  className={`relative overflow-hidden rounded-xl cursor-pointer group ${
                    index === 0 ? "md:col-span-2 md:row-span-2" : ""
                  }`}
                  onClick={() => openLightbox(index)}
                >
                  <div className={`${index === 0 ? "aspect-square" : "aspect-square"}`}>
                    <img
                      src={getImageUrl(image.image_path)}
                      alt={image.title || "Galeriebild"}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      loading="lazy"
                    />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  
                  {image.title && (
                    <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                      <p className="text-cream font-medium text-sm line-clamp-2">{image.title}</p>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-gradient-to-t from-forest to-forest-dark">
        <div className="container mx-auto px-6 text-center">
          <p className="text-cream/70 mb-6">
            Mehr Einblicke gibt es im Vereinsleben
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="heroOutline" asChild>
              <Link to={`/verein/${slug}/mitmachen`}>
                Mitmachen
              </Link>
            </Button>
            <Button variant="ghost" className="text-cream/70 hover:text-cream" asChild>
              <Link to={`/verein/${slug}`}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Zurück zur Übersicht
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Lightbox */}
      <AnimatePresence>
        {selectedIndex !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
            onClick={closeLightbox}
          >
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 text-white hover:bg-white/10 z-10"
              onClick={closeLightbox}
            >
              <X className="w-6 h-6" />
            </Button>

            {images.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/10 z-10"
                  onClick={(e) => {
                    e.stopPropagation();
                    goToPrevious();
                  }}
                >
                  <ChevronLeft className="w-8 h-8" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/10 z-10"
                  onClick={(e) => {
                    e.stopPropagation();
                    goToNext();
                  }}
                >
                  <ChevronRight className="w-8 h-8" />
                </Button>
              </>
            )}

            <motion.div
              key={selectedIndex}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.2 }}
              className="max-w-[90vw] max-h-[85vh] relative"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={getImageUrl(images[selectedIndex].image_path)}
                alt={images[selectedIndex].title || "Galeriebild"}
                className="max-w-full max-h-[85vh] object-contain rounded-lg"
              />
              
              {(images[selectedIndex].title || images[selectedIndex].description) && (
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent rounded-b-lg">
                  {images[selectedIndex].title && (
                    <h3 className="text-white font-display font-semibold text-lg">
                      {images[selectedIndex].title}
                    </h3>
                  )}
                  {images[selectedIndex].description && (
                    <p className="text-white/80 text-sm mt-1">
                      {images[selectedIndex].description}
                    </p>
                  )}
                </div>
              )}
            </motion.div>

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/60 text-sm">
              {selectedIndex + 1} / {images.length}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PublicGallery;