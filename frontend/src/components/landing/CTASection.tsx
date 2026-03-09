import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, MessageCircle, Shield } from "lucide-react";

const CTASection = () => {
  return (
    <section className="py-32 bg-gradient-to-b from-forest-dark via-forest to-forest-dark relative overflow-hidden">
      {/* Elegant decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 rounded-full bg-gold/5 blur-[120px]" />
        <div className="absolute bottom-1/4 left-1/4 w-80 h-80 rounded-full bg-gold/5 blur-[100px]" />
      </div>

      {/* Corner ornaments */}
      <div className="absolute top-12 left-12 w-24 h-24 border-l border-t border-gold/20" />
      <div className="absolute top-12 right-12 w-24 h-24 border-r border-t border-gold/20" />
      <div className="absolute bottom-12 left-12 w-24 h-24 border-l border-b border-gold/20" />
      <div className="absolute bottom-12 right-12 w-24 h-24 border-r border-b border-gold/20" />

      <div className="container mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-4xl mx-auto text-center"
        >
          {/* Emblem */}
          <motion.div
            initial={{ scale: 0 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gold/20 mb-8"
          >
            <Shield className="w-10 h-10 text-gold" />
          </motion.div>

          <h2 className="font-display text-4xl md:text-6xl font-bold text-cream mb-6 leading-tight">
            Bereit für die{" "}
            <span className="text-gradient-gold">digitale Zukunft</span>
            {" "}Ihres Vereins?
          </h2>
          
          <div className="w-24 h-1 bg-gradient-to-r from-gold to-gold-dark mx-auto mb-8" />
          
          <p className="text-cream/70 text-xl mb-12 max-w-2xl mx-auto leading-relaxed">
            Starten Sie noch heute mit Ihrer eigenen Vereinsplattform. 
            Kostenlose Einrichtung, professioneller Support, schnelle Umsetzung.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
            <Button variant="hero" size="xl" className="group min-w-[200px]" asChild>
              <Link to="/setup">
                Kostenlos starten
                <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
            <Button variant="glass" size="xl" className="min-w-[200px]">
              <MessageCircle className="w-5 h-5" />
              Beratung anfragen
            </Button>
          </div>

          {/* Trust indicators */}
          <div className="flex flex-wrap justify-center gap-8 text-cream/50 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-gold/60" />
              <span>Keine Kreditkarte erforderlich</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-gold/60" />
              <span>30 Tage kostenlos testen</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-gold/60" />
              <span>Jederzeit kündbar</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default CTASection;
