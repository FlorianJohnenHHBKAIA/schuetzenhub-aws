import { motion } from "framer-motion";
import { Building2, Users, Crown, Shield, ChevronDown } from "lucide-react";

const OrganizationSection = () => {
  return (
    <section className="py-32 bg-cream-dark relative overflow-hidden">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-[0.015]">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M20 20.5V18H0v-2h20v-2.5L25 18l-5 2.5z' fill='%23000' fill-opacity='1' fill-rule='evenodd'/%3E%3C/svg%3E")`,
        }} />
      </div>

      <div className="container mx-auto px-6 relative">
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
            <Building2 className="w-8 h-8 text-forest" />
          </motion.div>
          
          <h2 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-6">
            Ihr Verein, Ihre Struktur
          </h2>
          
          <div className="w-24 h-1 bg-gradient-to-r from-gold to-gold-dark mx-auto mb-6" />
          
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Hauptverein mit beliebig vielen Kompanien – jede Ebene mit eigenen Ämtern, 
            Rechten und Verantwortlichkeiten.
          </p>
        </motion.div>

        {/* Organization Diagram */}
        <div className="max-w-5xl mx-auto">
          {/* Hauptverein */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="relative mb-6"
          >
            <div className="p-8 rounded-3xl bg-gradient-to-r from-forest-dark via-forest to-forest-dark text-cream shadow-2xl border border-gold/20">
              <div className="flex flex-col md:flex-row items-center gap-6 mb-8">
                <div className="w-20 h-20 rounded-2xl bg-gold/20 flex items-center justify-center shadow-lg">
                  <Building2 className="w-10 h-10 text-gold" />
                </div>
                <div className="text-center md:text-left">
                  <h3 className="font-display text-3xl font-bold">Hauptverein / Regiment</h3>
                  <p className="text-cream/60 mt-1">Die oberste Vereinsebene mit Gesamtverantwortung</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {["Brudermeister", "Geschäftsführer", "Kassenwart", "Schriftführer"].map((role, i) => (
                  <div key={i} className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 border border-white/10">
                    <Crown className="w-5 h-5 text-gold flex-shrink-0" />
                    <span className="text-cream/90 font-medium">{role}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Connection Lines */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex justify-center mb-6"
          >
            <div className="flex flex-col items-center">
              <div className="w-px h-6 bg-gradient-to-b from-forest to-border" />
              <ChevronDown className="w-5 h-5 text-muted-foreground -mt-1" />
            </div>
          </motion.div>

          {/* Kompanien */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="grid md:grid-cols-3 gap-6"
          >
            {[
              { name: "1. Kompanie", subtitle: "Alte Garde" },
              { name: "2. Kompanie", subtitle: "Jungschützen" },
              { name: "3. Kompanie", subtitle: "Reservisten" },
            ].map((company, index) => (
              <div
                key={index}
                className="bg-card p-6 rounded-2xl border-2 border-border hover:border-gold/30 hover:shadow-lg transition-all duration-300 group"
              >
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Users className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-display text-xl font-semibold text-foreground">
                      {company.name}
                    </h4>
                    <p className="text-muted-foreground text-sm">{company.subtitle}</p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  {["Hauptmann", "Spieß", "Kassierer"].map((role, i) => (
                    <div key={i} className="flex items-center gap-3 text-muted-foreground">
                      <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                        <Shield className="w-3 h-3 text-primary" />
                      </div>
                      <span className="text-sm">{role}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </motion.div>

          {/* Info Note */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="mt-12 p-8 rounded-2xl bg-gradient-to-r from-gold/5 via-gold/10 to-gold/5 border border-gold/20"
          >
            <div className="flex flex-col md:flex-row gap-6 items-start">
              <div className="w-14 h-14 rounded-xl bg-gold/20 flex items-center justify-center flex-shrink-0">
                <Shield className="w-7 h-7 text-gold-dark" />
              </div>
              <div>
                <h4 className="font-display text-xl font-semibold text-foreground mb-2">
                  Flexible Ämter & Delegationen
                </h4>
                <p className="text-muted-foreground leading-relaxed">
                  Ämter und Berechtigungen sind vollständig konfigurierbar – nicht fest vorgegeben. 
                  Kompanie-Hauptleute können Zusatzrechte an Mitglieder delegieren, 
                  die nur innerhalb der eigenen Kompanie gelten. 
                  So bleibt die Verwaltung dort, wo sie hingehört.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default OrganizationSection;
