import React, { useEffect } from "react";
import { safeSessionStorage } from "@/utils/safeLocalStorage";
import HeroSection from "@/components/sections/HeroSection";
import SaaSOperatingSystemSection from "@/components/sections/SaaSOperatingSystemSection";
import SolutionSection from "@/components/sections/SolutionSection";
import HowItWorksSection from "@/components/sections/HowItWorksSection";
import PricingSection from "@/components/sections/PricingSection";
import DemoShowcaseSection from "@/components/sections/DemoShowcaseSection";
import CtaSection from "@/components/sections/CtaSection";
import { useLandingExperience } from "@/hooks/useLandingExperience";

const LegacyLandingAnchor = ({ id }: { id: string }) => (
  <span id={id} aria-hidden="true" className="block h-0 scroll-mt-24 overflow-hidden" />
);

const Index = () => {
  const { experience: landingExperience } = useLandingExperience();
  // Guard for mixed old/new client chunks while browsers refresh assets.
  // Legacy bundles may still reference showWidget on this page.
  const showWidget = false;

  useEffect(() => {
    document.title = "Chatboc - Agentes IA para operar conversaciones, ventas y servicios";

    const sectionId = safeSessionStorage.getItem("pendingScrollSection");
    if (sectionId) {
      setTimeout(() => {
        const el = document.getElementById(sectionId);
        if (el) {
          el.scrollIntoView({ behavior: "smooth" });
        }
        safeSessionStorage.removeItem("pendingScrollSection");
      }, 200);
    }
  }, []);

  return (
    <>
      <div className="bg-background scroll-smooth">
        <HeroSection experience={landingExperience} />
        <LegacyLandingAnchor id="diferencia-chatboc" />
        <LegacyLandingAnchor id="problemas" />
        <SaaSOperatingSystemSection />
        <SolutionSection />
        <LegacyLandingAnchor id="publico-objetivo" />
        <LegacyLandingAnchor id="senales-valor" />
        <DemoShowcaseSection />
        <HowItWorksSection />
        <LegacyLandingAnchor id="modulos" />
        <PricingSection />
        <CtaSection />
      </div>
      {showWidget && null}
    </>
  );
};

export default Index;
