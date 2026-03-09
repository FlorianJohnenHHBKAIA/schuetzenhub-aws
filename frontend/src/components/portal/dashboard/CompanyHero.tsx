import { motion } from "framer-motion";
import { Building2, Users } from "lucide-react";
import { Link } from "react-router-dom";

interface CompanyHeroProps {
  companyId: string | null;
  companyName: string | null;
  companyLogoUrl: string | null;
  memberFirstName: string;
}

const CompanyHero = ({ companyId, companyName, companyLogoUrl, memberFirstName }: CompanyHeroProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-card to-card border border-primary/20 p-6 md:p-8"
    >
      {/* Decorative background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-gold rounded-full blur-3xl transform -translate-x-1/2 translate-y-1/2" />
      </div>
      
      <div className="relative flex flex-col md:flex-row items-center gap-6">
        {/* Company Logo/Crest */}
        {companyId ? (
          <Link 
            to={`/portal/company/${companyId}`}
            className="shrink-0 group"
          >
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-2xl bg-background/80 border-2 border-primary/20 flex items-center justify-center overflow-visible p-3 group-hover:border-primary/40 transition-colors shadow-lg">
              {companyLogoUrl ? (
                <img 
                  src={companyLogoUrl} 
                  alt={companyName || "Kompanie"} 
                  className="w-full h-full object-contain"
                />
              ) : (
                <Building2 className="w-12 h-12 text-primary/60" />
              )}
            </div>
          </Link>
        ) : (
          <div className="w-24 h-24 md:w-32 md:h-32 rounded-2xl bg-background/80 border-2 border-muted flex items-center justify-center">
            <Users className="w-12 h-12 text-muted-foreground/40" />
          </div>
        )}
        
        {/* Welcome Text */}
        <div className="text-center md:text-left flex-1">
          <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-2">
            Willkommen, {memberFirstName}!
          </h1>
          {companyName ? (
            <p className="text-muted-foreground text-lg">
              Du bist Mitglied der <span className="text-primary font-semibold">{companyName}</span>
            </p>
          ) : (
            <p className="text-muted-foreground">
              Du bist noch keiner Kompanie zugeordnet.
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default CompanyHero;
