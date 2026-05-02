import React, { useEffect } from "react";
import { safeSessionStorage } from "@/utils/safeLocalStorage";
import HeroSection from "@/components/sections/HeroSection";
import ProblemsSection from "@/components/sections/ProblemsSection";
import SolutionSection from "@/components/sections/SolutionSection";
import HowItWorksSection from "@/components/sections/HowItWorksSection";
import PricingSection from "@/components/sections/PricingSection";
import TargetSection from "@/components/sections/TargetSection";
import DemoShowcaseSection from "@/components/sections/DemoShowcaseSection";
import TestimonialsSection from "@/components/sections/TestimonialsSection";
import CtaSection from "@/components/sections/CtaSection";
import ComingSoonSection from "@/components/sections/ComingSoonSection";

const Index = () => {
  // Guard for mixed old/new client chunks during deploy rollouts.
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
      <main className="bg-background scroll-smooth">
        <section id="inicio">
          <HeroSection />
        </section>
        <ProblemsSection />
        <SolutionSection />
        <HowItWorksSection />
        <TargetSection />
        <DemoShowcaseSection />
        <TestimonialsSection />
        <PricingSection />
        <CtaSection />
        <ComingSoonSection />
      </main>
      {showWidget && null}
    </>
  );
};

export default Index;
