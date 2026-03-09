import { Link } from "react-router-dom";
import { Shield, ArrowLeft, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface PublicHeaderProps {
  clubName: string;
  clubSlug: string;
  logoUrl: string | null;
  showBackLink?: boolean;
  backLinkLabel?: string;
  transparent?: boolean;
}

const PublicHeader = ({ 
  clubName, 
  clubSlug, 
  logoUrl, 
  showBackLink = true,
  backLinkLabel,
  transparent = false 
}: PublicHeaderProps) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { to: `/verein/${clubSlug}`, label: "Startseite" },
    { to: `/verein/${clubSlug}/termine`, label: "Termine" },
    { to: `/verein/${clubSlug}/aktuelles`, label: "Aktuelles" },
    { to: `/verein/${clubSlug}/galerie`, label: "Galerie" },
    { to: `/verein/${clubSlug}/mitmachen`, label: "Mitmachen" },
  ];

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-colors ${
      transparent ? "bg-transparent" : "bg-forest-dark/90 backdrop-blur-md border-b border-gold/10"
    }`}>
      <div className="container mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo & Back */}
        <Link 
          to={showBackLink ? `/verein/${clubSlug}` : `/verein/${clubSlug}`}
          className="flex items-center gap-3 text-cream hover:text-gold transition-colors"
        >
          {showBackLink && <ArrowLeft className="w-5 h-5" />}
          <div className="flex items-center gap-2">
            {logoUrl ? (
              <img src={logoUrl} alt={clubName} className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <Shield className="w-8 h-8 text-gold" />
            )}
            <span className="font-medium hidden sm:inline">{clubName}</span>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="text-cream/70 hover:text-gold text-sm font-medium transition-colors"
            >
              {link.label}
            </Link>
          ))}
          <Button variant="heroOutline" size="sm" asChild>
            <Link to="/auth">
              <Shield className="w-4 h-4 mr-2" />
              Portal
            </Link>
          </Button>
        </nav>

        {/* Mobile Menu Toggle */}
        <Button 
          variant="ghost" 
          size="icon" 
          className="md:hidden text-cream"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </Button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-forest-dark/95 backdrop-blur-md border-b border-gold/10 overflow-hidden"
          >
            <nav className="container mx-auto px-6 py-4 flex flex-col gap-2">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-cream/70 hover:text-gold py-2 text-sm font-medium transition-colors"
                >
                  {link.label}
                </Link>
              ))}
              <Button variant="hero" size="sm" className="mt-2" asChild>
                <Link to="/auth" onClick={() => setMobileMenuOpen(false)}>
                  <Shield className="w-4 h-4 mr-2" />
                  Zum Portal
                </Link>
              </Button>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

export default PublicHeader;
