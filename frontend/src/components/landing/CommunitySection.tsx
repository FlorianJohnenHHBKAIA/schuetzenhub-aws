import { motion } from "framer-motion";
import { Users, Heart, Award, Calendar, Handshake, Crown } from "lucide-react";

const values = [
  {
    icon: Handshake,
    title: "Kameradschaft",
    description: "Zusammenhalt und gegenseitige Unterstützung stehen im Mittelpunkt unserer Gemeinschaft."
  },
  {
    icon: Crown,
    title: "Tradition",
    description: "Wir pflegen jahrhundertealte Bräuche und geben sie an kommende Generationen weiter."
  },
  {
    icon: Heart,
    title: "Engagement",
    description: "Ehrenamtliches Engagement und aktive Teilnahme prägen das Vereinsleben."
  },
  {
    icon: Award,
    title: "Ehrungen",
    description: "Wir würdigen langjährige Mitgliedschaft und besondere Verdienste."
  }
];

const CommunitySection = () => {
  return (
    <section className="py-32 bg-gradient-to-b from-forest-dark via-forest to-forest-dark relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full bg-gold/5 blur-[100px]" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full bg-gold/5 blur-[100px]" />
      </div>

      {/* Corner ornaments */}
      <div className="absolute top-12 left-12 w-24 h-24 border-l border-t border-gold/20" />
      <div className="absolute top-12 right-12 w-24 h-24 border-r border-t border-gold/20" />
      <div className="absolute bottom-12 left-12 w-24 h-24 border-l border-b border-gold/20" />
      <div className="absolute bottom-12 right-12 w-24 h-24 border-r border-b border-gold/20" />

      <div className="container mx-auto px-6 relative z-10">
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
            className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gold/20 mb-6"
          >
            <Users className="w-8 h-8 text-gold" />
          </motion.div>

          <h2 className="font-display text-4xl md:text-5xl font-bold text-cream mb-6">
            Unsere Gemeinschaft
          </h2>
          
          <div className="w-24 h-1 bg-gradient-to-r from-gold to-gold-dark mx-auto mb-6" />
          
          <p className="text-cream/70 text-lg max-w-2xl mx-auto">
            Ein Schützenverein ist mehr als ein Verein – er ist eine Familie, 
            in der Werte gelebt und Traditionen gepflegt werden.
          </p>
        </motion.div>

        {/* Values Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
          {values.map((value, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="group"
            >
              <div className="h-full p-6 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 hover:border-gold/30 hover:bg-white/10 transition-all duration-300 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gold/20 mb-4 group-hover:bg-gold/30 transition-colors">
                  <value.icon className="w-6 h-6 text-gold" />
                </div>
                <h3 className="font-display text-lg font-semibold text-cream mb-2">
                  {value.title}
                </h3>
                <p className="text-cream/60 text-sm leading-relaxed">
                  {value.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Quote / Testimonial Style Block */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-4xl mx-auto text-center"
        >
          <div className="relative p-10 rounded-3xl bg-gradient-to-br from-white/5 to-transparent border border-gold/20">
            {/* Decorative quote marks */}
            <div className="absolute top-6 left-8 text-6xl text-gold/20 font-serif">"</div>
            <div className="absolute bottom-6 right-8 text-6xl text-gold/20 font-serif rotate-180">"</div>
            
            <blockquote className="relative z-10">
              <p className="font-display text-2xl md:text-3xl text-cream/90 italic mb-6 leading-relaxed">
                Ein Verein lebt von seinen Menschen. Mit SchützenHub geben wir ihnen 
                die Werkzeuge, um Tradition zu bewahren und Zukunft zu gestalten.
              </p>
              <footer className="flex items-center justify-center gap-4">
                <div className="w-12 h-px bg-gold/40" />
                <span className="text-gold text-sm font-medium tracking-wide">
                  Für Vereine. Von Vereinsmenschen.
                </span>
                <div className="w-12 h-px bg-gold/40" />
              </footer>
            </blockquote>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default CommunitySection;
