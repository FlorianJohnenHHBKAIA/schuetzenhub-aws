import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight, Images } from "lucide-react";
import { Button } from "@/components/ui/button";

interface GalleryImage {
  id: string;
  title: string | null;
  description: string | null;
  image_path: string;
}

interface GallerySectionProps {
  images: GalleryImage[];
  supabaseUrl: string;
  /** If true, renders only the grid without section wrapper */
  gridOnly?: boolean;
}

const GallerySection = ({ images, supabaseUrl, gridOnly = false }: GallerySectionProps) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  if (images.length === 0) return null;

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

  const getImageUrl = (path: string) => 
    `${supabaseUrl}/storage/v1/object/public/gallery-images/${path}`;

  // Show max 6 images in the grid, with a "show more" overlay on the 6th
  const displayImages = images.slice(0, 6);
  const hasMore = images.length > 6;

  const renderGrid = () => (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-5xl mx-auto">
      {displayImages.map((image, index) => (
        <motion.div
          key={image.id}
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: index * 0.1 }}
          className={`relative aspect-square overflow-hidden rounded-xl cursor-pointer group ${
            index === 0 ? "md:col-span-2 md:row-span-2" : ""
          }`}
          onClick={() => openLightbox(index)}
        >
          <img
            src={getImageUrl(image.image_path)}
            alt={image.title || "Galeriebild"}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          
          {image.title && (
            <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
              <p className="text-cream font-medium text-sm">{image.title}</p>
            </div>
          )}

          {/* "Show more" overlay on the last visible image if there are more */}
          {hasMore && index === 5 && (
            <div className="absolute inset-0 bg-forest-dark/70 flex items-center justify-center">
              <span className="text-cream text-xl font-display font-bold">
                +{images.length - 6} mehr
              </span>
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );

  const renderLightbox = () => (
    <AnimatePresence>
      {selectedIndex !== null && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
          onClick={closeLightbox}
        >
          {/* Close button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 text-white hover:bg-white/10 z-10"
            onClick={closeLightbox}
          >
            <X className="w-6 h-6" />
          </Button>

          {/* Navigation buttons */}
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

          {/* Image */}
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
            
            {/* Caption */}
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

          {/* Image counter */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/60 text-sm">
            {selectedIndex + 1} / {images.length}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // If gridOnly mode, just return the grid without the section wrapper
  if (gridOnly) {
    return (
      <>
        {renderGrid()}
        {renderLightbox()}
      </>
    );
  }

  // Full section wrapper for standalone usage
  return (
    <>
      <section className="py-32 bg-forest-dark relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 0.05 }}
            viewport={{ once: true }}
            className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full bg-gold blur-[150px]"
          />
        </div>

        <div className="container mx-auto px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <motion.div
              initial={{ scale: 0 }}
              whileInView={{ scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gold/20 mb-6"
            >
              <Images className="w-8 h-8 text-gold" />
            </motion.div>

            <h2 className="font-display text-4xl md:text-5xl font-bold text-cream mb-6">
              Galerie
            </h2>
            
            <div className="w-24 h-1 bg-gradient-to-r from-gold to-gold-dark mx-auto" />
          </motion.div>

          {renderGrid()}
        </div>
      </section>

      {renderLightbox()}
    </>
  );
};

export default GallerySection;
