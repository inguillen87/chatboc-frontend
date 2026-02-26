import React, { useEffect } from 'react';
import { safeSessionStorage } from '@/utils/safeLocalStorage';
import HeroSection from '@/components/sections/HeroSection';
import ProblemsSection from '@/components/sections/ProblemsSection';
import SolutionSection from '@/components/sections/SolutionSection';
import HowItWorksSection from '@/components/sections/HowItWorksSection';
import PricingSection from '@/components/sections/PricingSection';
import TargetSection from '@/components/sections/TargetSection';
import DemoShowcaseSection from '@/components/sections/DemoShowcaseSection';
import TestimonialsSection from '@/components/sections/TestimonialsSection'; // Descomentado
import CtaSection from '@/components/sections/CtaSection';
import ComingSoonSection from '@/components/sections/ComingSoonSection';

const Index = () => {
  // Guard for mixed old/new client chunks during deploy rollouts.
  // Legacy bundles may still reference showWidget on this page.
  const showWidget = false;
  useEffect(() => {
    document.title = 'Chatboc - Conectando Gobiernos y Empresas con sus Comunidades'; // Título actualizado

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
      {/* Ajustar el espaciado general y el margen superior si es necesario */}
      <main className="flex flex-col gap-16 md:gap-20 lg:gap-24 mt-0 md:mt-0 scroll-smooth"> {/* Ajustar mt si el Navbar es fijo y ocupa espacio */}
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
        <section id="publico-objetivo"> {/* Renombrado el id para consistencia si es necesario */}
          <TargetSection />
        </section>
        <div id="demos-wrapper">
          <DemoShowcaseSection />
        </div>
        <section id="testimonios"> {/* Descomentado y añadido */}
          <TestimonialsSection />
        </section>
        <section id="precios">
          <PricingSection />
        </section>
        <section id="cta">
          <CtaSection />
        </section>
        <section id="proximamente">
          <ComingSoonSection />
        </section>
      </main>
      {showWidget && null}
    </>
  );
};

export default Index;
