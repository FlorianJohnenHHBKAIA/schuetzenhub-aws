import Header from "@/components/landing/Header";
import HeroSection from "@/components/landing/HeroSection";
import FeaturesSection from "@/components/landing/FeaturesSection";
import CommunitySection from "@/components/landing/CommunitySection";
import TwoSidesSection from "@/components/landing/TwoSidesSection";
import OrganizationSection from "@/components/landing/OrganizationSection";
import UpcomingEvents from "@/components/landing/UpcomingEvents";
import NewsSection from "@/components/landing/NewsSection";
import CTASection from "@/components/landing/CTASection";
import Footer from "@/components/landing/Footer";

const Index = () => {
  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <HeroSection />
        <section id="features">
          <FeaturesSection />
        </section>
        <CommunitySection />
        <TwoSidesSection />
        <section id="organization">
          <OrganizationSection />
        </section>
        <UpcomingEvents />
        <NewsSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
