import { Shield } from "lucide-react";

const footerLinks = {
  produkt: [
    { label: "Funktionen", href: "#features" },
    { label: "Preise", href: "#pricing" },
    { label: "Demo", href: "#" },
    { label: "Roadmap", href: "#" },
  ],
  ressourcen: [
    { label: "Dokumentation", href: "#" },
    { label: "Hilfe-Center", href: "#" },
    { label: "API", href: "#" },
    { label: "Status", href: "#" },
  ],
  unternehmen: [
    { label: "Über uns", href: "#" },
    { label: "Blog", href: "#" },
    { label: "Karriere", href: "#" },
    { label: "Kontakt", href: "#" },
  ],
  rechtliches: [
    { label: "Datenschutz", href: "#" },
    { label: "Impressum", href: "#" },
    { label: "AGB", href: "#" },
    { label: "Cookies", href: "#" },
  ],
};

const Footer = () => {
  return (
    <footer className="bg-forest-dark text-cream relative">
      {/* Top decorative border */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
      
      <div className="container mx-auto px-6 py-20">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-10 mb-16">
          {/* Brand */}
          <div className="col-span-2">
            <a href="/" className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gold to-gold-dark flex items-center justify-center shadow-lg">
                <Shield className="w-6 h-6 text-forest-dark" />
              </div>
              <span className="font-display text-2xl font-bold">SchützenHub</span>
            </a>
            <p className="text-cream/60 text-sm leading-relaxed max-w-xs">
              Die moderne Plattform für Schützenvereine. 
              Tradition bewahren, Zukunft gestalten.
            </p>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="font-display font-semibold text-sm uppercase tracking-wider text-gold mb-5">
                {category}
              </h4>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-cream/60 text-sm hover:text-cream hover:translate-x-1 transition-all inline-block"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div className="pt-10 border-t border-cream/10">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <p className="text-cream/40 text-sm">
              © {new Date().getFullYear()} SchützenHub. Alle Rechte vorbehalten.
            </p>
            <div className="flex items-center gap-2 text-cream/40 text-sm">
              <span>Mit</span>
              <span className="text-gold">♦</span>
              <span>für Schützenvereine entwickelt</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
