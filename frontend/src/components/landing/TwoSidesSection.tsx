import { motion } from "framer-motion";
import { 
  Globe, 
  Lock, 
  CheckCircle2,
  ExternalLink,
  Users,
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";

const publicFeatures = [
  "Startseite mit aktuellen News",
  "Öffentlicher Terminkalender",
  "Vorstellung des Vorstands",
  "Mitglied werden Formular",
  "Kontakt & Anfahrt",
  "Impressum & Datenschutz",
];

const portalFeatures = [
  "Persönliches Dashboard",
  "Interne Termine & Events",
  "Arbeitsdienst-Verwaltung",
  "Dokumente & Protokolle",
  "Kompanie-Kommunikation",
  "Ämter & Delegationen",
];

const TwoSidesSection = () => {
  return (
    <section className="py-32 bg-background relative overflow-hidden">
      {/* Elegant connecting line */}
      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-border to-transparent hidden lg:block" />
      
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-20"
        >
          <span className="inline-block px-5 py-2 rounded-full border border-gold/30 text-gold-dark text-sm font-medium mb-6 tracking-wide">
            Zwei Welten, ein System
          </span>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-6">
            Öffentlich & Intern vereint
          </h2>
          <div className="w-24 h-1 bg-gradient-to-r from-gold to-gold-dark mx-auto mb-6" />
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Ihre Vereinsdomain für die Außenwelt, das Portal für Ihre Mitglieder – 
            nahtlos verbunden aus einer Quelle.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20">
          {/* Public Side */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="relative"
          >
            <div className="p-10 rounded-3xl bg-gradient-to-br from-forest via-forest to-forest-light text-cream shadow-2xl relative overflow-hidden">
              {/* Decorative corner */}
              <div className="absolute top-0 right-0 w-32 h-32 border-t-2 border-r-2 border-gold/20 rounded-tr-3xl" />
              <div className="absolute bottom-0 left-0 w-32 h-32 border-b-2 border-l-2 border-gold/10 rounded-bl-3xl" />
              
              <div className="flex items-center gap-4 mb-8">
                <div className="w-16 h-16 rounded-2xl bg-gold/20 flex items-center justify-center shadow-lg">
                  <Globe className="w-8 h-8 text-gold" />
                </div>
                <div>
                  <h3 className="font-display text-2xl font-bold">Öffentliche Homepage</h3>
                  <p className="text-cream/60 text-sm">www.ihr-verein.de</p>
                </div>
              </div>

              <p className="text-cream/80 mb-8 leading-relaxed text-lg">
                Eine würdige Vereinspräsenz, die automatisch mit Inhalten aus dem Portal gepflegt wird. 
                Immer aktuell, ohne doppelte Arbeit.
              </p>

              <ul className="space-y-4 mb-10">
                {publicFeatures.map((feature, index) => (
                  <li key={index} className="flex items-center gap-3 text-cream/90">
                    <div className="w-6 h-6 rounded-full bg-gold/20 flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="w-4 h-4 text-gold" />
                    </div>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Button variant="hero" size="lg" className="group">
                Demo-Homepage ansehen
                <ExternalLink className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Button>
            </div>
          </motion.div>

          {/* Portal Side */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="relative"
          >
            <div className="p-10 rounded-3xl bg-card border-2 border-border shadow-xl relative overflow-hidden">
              {/* Decorative corner */}
              <div className="absolute top-0 left-0 w-32 h-32 border-t-2 border-l-2 border-primary/20 rounded-tl-3xl" />
              <div className="absolute bottom-0 right-0 w-32 h-32 border-b-2 border-r-2 border-primary/10 rounded-br-3xl" />
              
              <div className="flex items-center gap-4 mb-8">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center shadow-lg">
                  <Lock className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h3 className="font-display text-2xl font-bold text-foreground">Mitgliederportal</h3>
                  <p className="text-muted-foreground text-sm">portal.ihr-verein.de</p>
                </div>
              </div>

              <p className="text-muted-foreground mb-8 leading-relaxed text-lg">
                Der geschützte Bereich für alle Mitglieder. Organisation, Kommunikation 
                und Verwaltung an einem Ort – rollenbasiert und sicher.
              </p>

              <ul className="space-y-4 mb-10">
                {portalFeatures.map((feature, index) => (
                  <li key={index} className="flex items-center gap-3 text-foreground">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                    </div>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Button variant="default" size="lg" className="group">
                <Users className="w-4 h-4" />
                Portal erkunden
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default TwoSidesSection;
