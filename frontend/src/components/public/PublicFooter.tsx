import { Link } from "react-router-dom";
import { Shield, Mail, Phone, Globe, MapPin } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface PublicFooterProps {
  clubName: string;
  clubSlug: string;
  logoUrl: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  websiteUrl?: string | null;
  locationCity?: string | null;
  imprintText?: string | null;
  privacyText?: string | null;
}

const PublicFooter = ({
  clubName,
  clubSlug,
  logoUrl,
  contactEmail,
  contactPhone,
  websiteUrl,
  locationCity,
  imprintText,
  privacyText,
}: PublicFooterProps) => {
  return (
    <footer className="bg-forest-dark text-cream relative">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
      
      <div className="container mx-auto px-6 py-16">
        <div className="grid md:grid-cols-3 gap-12 mb-12">
          {/* Club Info */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gold to-gold-dark flex items-center justify-center overflow-hidden">
                {logoUrl ? (
                  <img src={logoUrl} alt={clubName} className="w-full h-full object-contain" />
                ) : (
                  <Shield className="w-6 h-6 text-forest-dark" />
                )}
              </div>
              <span className="font-display text-xl font-bold">{clubName}</span>
            </div>
            {locationCity && (
              <div className="flex items-center gap-2 text-cream/60 text-sm">
                <MapPin className="w-4 h-4" />
                <span>{locationCity}</span>
              </div>
            )}
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-display text-lg font-semibold mb-4 text-gold">Schnellzugriff</h4>
            <nav className="flex flex-col gap-2">
              <Link to={`/verein/${clubSlug}`} className="text-cream/70 hover:text-cream text-sm transition-colors">
                Startseite
              </Link>
              <Link to={`/verein/${clubSlug}/termine`} className="text-cream/70 hover:text-cream text-sm transition-colors">
                Termine
              </Link>
              <Link to={`/verein/${clubSlug}/aktuelles`} className="text-cream/70 hover:text-cream text-sm transition-colors">
                Aktuelles
              </Link>
              <Link to={`/verein/${clubSlug}/galerie`} className="text-cream/70 hover:text-cream text-sm transition-colors">
                Galerie
              </Link>
              <Link to={`/verein/${clubSlug}/mitmachen`} className="text-cream/70 hover:text-cream text-sm transition-colors">
                Mitmachen
              </Link>
            </nav>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-display text-lg font-semibold mb-4 text-gold">Kontakt</h4>
            <div className="flex flex-col gap-3">
              {contactEmail && (
                <a 
                  href={`mailto:${contactEmail}`} 
                  className="flex items-center gap-2 text-cream/70 hover:text-cream text-sm transition-colors"
                >
                  <Mail className="w-4 h-4" />
                  {contactEmail}
                </a>
              )}
              {contactPhone && (
                <a 
                  href={`tel:${contactPhone}`} 
                  className="flex items-center gap-2 text-cream/70 hover:text-cream text-sm transition-colors"
                >
                  <Phone className="w-4 h-4" />
                  {contactPhone}
                </a>
              )}
              {websiteUrl && (
                <a 
                  href={websiteUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-cream/70 hover:text-cream text-sm transition-colors"
                >
                  <Globe className="w-4 h-4" />
                  Website
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-cream/10 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-cream/40 text-sm">
              © {new Date().getFullYear()} {clubName}. Alle Rechte vorbehalten.
            </p>

            <div className="flex items-center gap-4">
              {imprintText && (
                <AlertDialog>
                  <AlertDialogTrigger className="text-cream/60 text-sm hover:text-cream transition-colors">
                    Impressum
                  </AlertDialogTrigger>
                  <AlertDialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Impressum</AlertDialogTitle>
                      <AlertDialogDescription asChild>
                        <div className="whitespace-pre-wrap text-sm text-foreground/80">
                          {imprintText}
                        </div>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Schließen</AlertDialogCancel>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              {privacyText && (
                <AlertDialog>
                  <AlertDialogTrigger className="text-cream/60 text-sm hover:text-cream transition-colors">
                    Datenschutz
                  </AlertDialogTrigger>
                  <AlertDialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Datenschutzerklärung</AlertDialogTitle>
                      <AlertDialogDescription asChild>
                        <div className="whitespace-pre-wrap text-sm text-foreground/80">
                          {privacyText}
                        </div>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Schließen</AlertDialogCancel>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              <Link to="/auth" className="text-cream/60 text-sm hover:text-cream transition-colors">
                Mitgliederportal
              </Link>
            </div>
          </div>

          <div className="text-center mt-6 text-cream/40 text-sm">
            Powered by{" "}
            <Link to="/" className="text-gold hover:text-gold-light transition-colors font-medium">
              SchützenHub
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default PublicFooter;
