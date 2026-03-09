import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Menu, X, Shield } from "lucide-react";

const navLinks = [
  { label: "Funktionen", href: "#features" },
  { label: "Aufbau", href: "#organization" },
  { label: "Preise", href: "#pricing" },
  { label: "Kontakt", href: "#contact" },
];

const Header = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5 }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          isScrolled
            ? "bg-background/95 backdrop-blur-md border-b border-border shadow-sm"
            : "bg-transparent"
        }`}
      >
        <div className="container mx-auto px-6">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <a href="/" className="flex items-center gap-3 group">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 ${
                isScrolled 
                  ? "bg-gradient-to-br from-forest to-forest-light shadow-md" 
                  : "bg-gradient-to-br from-gold to-gold-dark shadow-lg shadow-gold/20"
              }`}>
                <Shield className={`w-5 h-5 ${isScrolled ? "text-gold" : "text-forest-dark"}`} />
              </div>
              <span className={`font-display text-xl font-bold transition-colors ${
                isScrolled ? "text-foreground" : "text-cream"
              }`}>
                SchützenHub
              </span>
            </a>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-10">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className={`text-sm font-medium transition-all hover:opacity-100 ${
                    isScrolled 
                      ? "text-foreground/70 hover:text-foreground" 
                      : "text-cream/80 hover:text-cream"
                  }`}
                >
                  {link.label}
                </a>
              ))}
            </nav>

            {/* Desktop CTA */}
            <div className="hidden md:flex items-center gap-4">
              <Button 
                variant={isScrolled ? "ghost" : "glass"} 
                size="sm"
                asChild
              >
                <Link to="/auth">Anmelden</Link>
              </Button>
              <Button 
                variant={isScrolled ? "default" : "hero"} 
                size="sm"
                asChild
              >
                <Link to="/setup">Kostenlos starten</Link>
              </Button>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className={`md:hidden p-2 rounded-lg transition-colors ${
                isScrolled ? "text-foreground" : "text-cream"
              }`}
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </motion.header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-x-0 top-20 z-40 md:hidden bg-background border-b border-border shadow-lg"
          >
            <nav className="container mx-auto px-6 py-8 flex flex-col gap-4">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-foreground font-medium py-3 hover:text-primary transition-colors border-b border-border/50 last:border-0"
                >
                  {link.label}
                </a>
              ))}
              <div className="flex flex-col gap-3 pt-6">
                <Button variant="outline" className="w-full" asChild>
                  <Link to="/auth">Anmelden</Link>
                </Button>
                <Button variant="default" className="w-full" asChild>
                  <Link to="/setup">Kostenlos starten</Link>
                </Button>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Header;
