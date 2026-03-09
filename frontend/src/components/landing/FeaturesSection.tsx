import { motion } from "framer-motion";
import { 
  Globe, 
  Lock, 
  Calendar, 
  Users, 
  FileText, 
  Wrench,
  Building2,
  Shield,
  MessageSquare
} from "lucide-react";

const features = [
  {
    icon: Globe,
    title: "Öffentliche Homepage",
    description: "Professionelle Vereins-Website mit News, Terminen und Vorstandsübersicht – automatisch gepflegt.",
  },
  {
    icon: Lock,
    title: "Mitgliederportal",
    description: "Geschützter Bereich für interne Kommunikation, Dokumente und Vereinsorganisation.",
  },
  {
    icon: Building2,
    title: "Kompanie-Verwaltung",
    description: "Strukturierte Organisation mit Hauptverein und Kompanien – inklusive eigener Ämter und Rechte.",
  },
  {
    icon: Calendar,
    title: "Event-Management",
    description: "Termine mit Freigabe-Workflow: von Kompanie-intern bis öffentlich mit Genehmigungsprozess.",
  },
  {
    icon: Wrench,
    title: "Arbeitsdienste",
    description: "Schichten planen, Mitglieder eintragen, Stunden erfassen – alles an Events gekoppelt.",
  },
  {
    icon: Users,
    title: "Rollen & Ämter",
    description: "Feingranulares Rechtesystem mit kontextbezogenen Berechtigungen und Delegationen.",
  },
  {
    icon: FileText,
    title: "Dokumente & Protokolle",
    description: "Zentrale Dokumentenverwaltung mit Scoping nach Verein oder Kompanie.",
  },
  {
    icon: MessageSquare,
    title: "Kommunikation",
    description: "Interne Aushänge, vereinsweite News und event-bezogene Kommunikation.",
  },
  {
    icon: Shield,
    title: "DSGVO-konform",
    description: "Datenschutz von Anfang an: sichere Datenverarbeitung und transparente Prozesse.",
  },
];

const FeaturesSection = () => {
  return (
    <section className="py-32 bg-cream-dark relative overflow-hidden">
      {/* Elegant background pattern */}
      <div className="absolute inset-0 opacity-[0.02]">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />
      </div>

      {/* Top decorative border */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
      
      <div className="container mx-auto px-6 relative">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-20"
        >
          <motion.div
            initial={{ scale: 0 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-forest/10 mb-6"
          >
            <Shield className="w-8 h-8 text-forest" />
          </motion.div>
          
          <h2 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-6">
            Alles für Ihren Verein
          </h2>
          
          <div className="w-24 h-1 bg-gradient-to-r from-gold to-gold-dark mx-auto mb-6" />
          
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Von der öffentlichen Präsenz bis zur internen Organisation – 
            eine würdige Plattform für alle Anforderungen moderner Schützenvereine.
          </p>
        </motion.div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.08 }}
              className="group relative"
            >
              <div className="h-full p-8 rounded-2xl bg-background border border-border hover:border-gold/30 hover:shadow-xl hover:shadow-gold/5 transition-all duration-500">
                {/* Icon with elegant styling */}
                <div className="relative mb-6">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-forest to-forest-light flex items-center justify-center shadow-lg group-hover:shadow-forest/20 transition-shadow">
                    <feature.icon className="w-7 h-7 text-gold" />
                  </div>
                  {/* Decorative corner */}
                  <div className="absolute -top-2 -right-2 w-6 h-6 border-t border-r border-gold/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                
                <h3 className="font-display text-xl font-semibold text-foreground mb-3">
                  {feature.title}
                </h3>
                
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Bottom decorative border */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
    </section>
  );
};

export default FeaturesSection;
