import React, { useEffect, useState } from 'react';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { safeSessionStorage } from '@/utils/safeSessionStorage';
import HeroSection from '@/components/sections/HeroSection';
import ProblemsSection from '@/components/sections/ProblemsSection';
import SolutionSection from '@/components/sections/SolutionSection';
import HowItWorksSection from '@/components/sections/HowItWorksSection';
import PricingSection from '@/components/sections/PricingSection';
import TargetSection from '@/components/sections/TargetSection';
// import TestimonialsSection from '@/components/sections/TestimonialsSection';
import CtaSection from '@/components/sections/CtaSection';
import ComingSoonSection from '@/components/sections/ComingSoonSection';
import ChatWidget from "@/components/chat/ChatWidget";

const Index = () => {
  useEffect(() => {
    document.title = 'Chatboc - Tu Experto Virtual';

    // AUTO SCROLL SI HAY UN PENDIENTE
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
      <main className="flex flex-col gap-12 md:gap-16 lg:gap-20 mt-16 scroll-smooth">
        <section id="inicio">
          <HeroSection />
        </section>
        <section id="problemas">
          <ProblemsSection />
        </section>
        <section id="solucion">
          <SolutionSection />
        </section>
        <section id="como-funciona">
          <HowItWorksSection />
        </section>
        <section id="precios">
          <PricingSection />
        </section>
        <section id="publico-objetivo">
          <TargetSection />
        </section>
        {/* <section id="testimonios">
          <TestimonialsSection />
        </section> */}
        <section id="cta">
          <CtaSection />
        </section>
        <section id="proximamente">
          <ComingSoonSection />
        </section>
      </main>
      {/* CHAT FLOTANTE */}
      <ChatWidget mode="standalone" defaultOpen={false} />
    </>
  );
};

export default Index;
