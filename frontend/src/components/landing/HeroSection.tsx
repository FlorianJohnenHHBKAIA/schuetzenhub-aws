import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Shield, Users, Calendar, ChevronDown } from "lucide-react";
import heroBg from "@/assets/hero-bg.jpg";

const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Image with Elegant Overlay */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${heroBg})` }}
      >
        {/* Dark elegant gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-forest-dark/95 via-forest-dark/80 to-forest-dark/95" />
        {/* Gold accent overlay at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-gold/5 to-transparent" />
      </div>

      {/* Elegant Decorative Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Corner ornaments */}
        <div className="absolute top-20 left-10 w-32 h-32 border-l-2 border-t-2 border-gold/20" />
        <div className="absolute top-20 right-10 w-32 h-32 border-r-2 border-t-2 border-gold/20" />
        <div className="absolute bottom-20 left-10 w-32 h-32 border-l-2 border-b-2 border-gold/20" />
        <div className="absolute bottom-20 right-10 w-32 h-32 border-r-2 border-b-2 border-gold/20" />
        
        {/* Subtle gold glow */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.15 }}
          transition={{ duration: 3, ease: "easeOut" }}
          className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-gold blur-[150px]"
        />
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-6 py-20">
        <div className="max-w-5xl mx-auto text-center">
          {/* Emblem / Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
            className="mb-8"
          >
            <div className="inline-flex flex-col items-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-gold to-gold-dark flex items-center justify-center mb-4 shadow-xl shadow-gold/20">
                <Shield className="w-10 h-10 text-forest-dark" />
              </div>
              <div className="h-8 w-px bg-gradient-to-b from-gold to-transparent" />
            </div>
          </motion.div>

          {/* Tagline */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mb-6"
          >
            <span className="inline-block px-6 py-2 text-gold text-sm font-medium tracking-[0.2em] uppercase">
              Die digitale Plattform für Schützenvereine
            </span>
          </motion.div>

          {/* Main Heading */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="font-display text-5xl md:text-7xl lg:text-8xl font-bold text-cream mb-6 leading-[1.1]"
          >
            Tradition trifft{" "}
            <span className="relative">
              <span className="text-gradient-gold">Innovation</span>
              <motion.span
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.8, delay: 0.8 }}
                className="absolute -bottom-2 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-gold to-transparent"
              />
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="text-xl md:text-2xl text-cream/70 mb-12 max-w-3xl mx-auto font-body leading-relaxed"
          >
            Würdevolle Vereinspräsenz nach außen. Effiziente Organisation nach innen. 
            <span className="block mt-2 text-cream/50">Eine Plattform für Ihre Gemeinschaft.</span>
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16"
          >
            <Button variant="hero" size="xl" className="group min-w-[200px]" asChild>
              <Link to="/setup">
                Verein einrichten
                <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
            <Button variant="heroOutline" size="xl" className="min-w-[200px]" asChild>
              <Link to="/auth">Zum Portal</Link>
            </Button>
          </motion.div>

          {/* Stats with elegant styling */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.7 }}
            className="grid grid-cols-3 max-w-2xl mx-auto"
          >
            {[
              { icon: Shield, value: "150+", label: "Vereine" },
              { icon: Users, value: "25.000+", label: "Mitglieder" },
              { icon: Calendar, value: "5.000+", label: "Events" },
            ].map((stat, index) => (
              <div
                key={index}
                className="relative px-6 py-4"
              >
                {index > 0 && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-px h-12 bg-gradient-to-b from-transparent via-gold/30 to-transparent" />
                )}
                <div className="flex flex-col items-center">
                  <stat.icon className="w-5 h-5 text-gold mb-2" />
                  <span className="text-2xl md:text-3xl font-display font-bold text-cream">
                    {stat.value}
                  </span>
                  <span className="text-cream/50 text-sm">{stat.label}</span>
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Elegant Scroll Indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 0.5 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
      >
        <span className="text-cream/40 text-xs uppercase tracking-widest">Entdecken</span>
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <ChevronDown className="w-5 h-5 text-gold/60" />
        </motion.div>
      </motion.div>
    </section>
  );
};

export default HeroSection;
