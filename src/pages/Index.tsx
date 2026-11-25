import React, { useEffect } from "react";
import { useReducedMotion } from "framer-motion";
import { ReactLenis } from "lenis/react";
import { safeSessionStorage } from "@/utils/safeLocalStorage";
import HeroSection from "@/components/sections/HeroSection";
import WhiteLabelShowcaseSection from "@/components/sections/WhiteLabelShowcaseSection";
import ModulesBentoSection from "@/components/sections/ModulesBentoSection";
import SaaSOperatingSystemSection from "@/components/sections/SaaSOperatingSystemSection";
import SolutionSection from "@/components/sections/SolutionSection";
import PricingSection from "@/components/sections/PricingSection";
import DemoShowcaseSection from "@/components/sections/DemoShowcaseSection";
import CtaSection from "@/components/sections/CtaSection";
import { useLandingExperience } from "@/hooks/useLandingExperience";
import { LANDING_TITLE } from "@/utils/pageTitles";

const LegacyLandingAnchor = ({ id }: { id: string }) => (
  <span id={id} aria-hidden="true" className="block h-0 scroll-mt-24 overflow-hidden" />
);

const Index = () => {
  const { experience: landingExperience } = useLandingExperience();
  const reduceMotion = useReducedMotion();
  const canUseSmoothScroll =
    typeof window !== "undefined" &&
    typeof window.requestAnimationFrame === "function" &&
    typeof ResizeObserver !== "undefined";
  useEffect(() => {
    document.title = LANDING_TITLE;

    const sectionId = safeSessionStorage.getItem("pendingScrollSection");
    if (sectionId) {
      setTimeout(() => {
        const el = document.getElementById(sectionId);
        if (el) {
          el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
        }
        safeSessionStorage.removeItem("pendingScrollSection");
      }, 200);
    }
  }, [reduceMotion]);

  const landing = (
      <div className="bg-background">
        <HeroSection experience={landingExperience} />
        <LegacyLandingAnchor id="diferencia-chatboc" />
        <WhiteLabelShowcaseSection />
        <LegacyLandingAnchor id="modulos" />
        <ModulesBentoSection />
        <LegacyLandingAnchor id="problemas" />
        <LegacyLandingAnchor id="como-funciona" />
        <SaaSOperatingSystemSection />
        <SolutionSection />
        <LegacyLandingAnchor id="publico-objetivo" />
        <LegacyLandingAnchor id="senales-valor" />
        <DemoShowcaseSection />
        <PricingSection />
        <CtaSection />
      </div>
  );

  return (
    reduceMotion || !canUseSmoothScroll ? landing : (
      <ReactLenis root options={{ anchors: true, autoRaf: true, lerp: 0.085, smoothWheel: true }}>
        {landing}
      </ReactLenis>
    )
  );
};

export default Index;
