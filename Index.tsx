import React, { useEffect } from 'react';
import HeroSection from '@/components/sections/HeroSection';
import ProblemsSection from '@/components/sections/ProblemsSection';
import SolutionSection from '@/components/sections/SolutionSection';
import HowItWorksSection from '@/components/sections/HowItWorksSection';
import PricingSection from '@/components/sections/PricingSection';
import TargetSection from '@/components/sections/TargetSection';
import TestimonialsSection from '@/components/sections/TestimonialsSection';
import CtaSection from '@/components/sections/CtaSection';
import ComingSoonSection from '@/components/sections/ComingSoonSection';

const Index = () => {
  useEffect(() => {
    document.title = 'Chatboc - Tu Experto Virtual';
  }, []);

  return (
    <main className="flex flex-col gap-12 md:gap-16 lg:gap-20 mt-24 bg-background text-foreground transition-all duration-500 ease-in-out">
      <section className="reveal-animation">
        <HeroSection />
      </section>
      <section id="problemas" className="reveal-animation">
        <ProblemsSection />
      </section>
      <section id="solution" className="reveal-animation">
        <SolutionSection />
      </section>
      <section id="how-it-works" className="reveal-animation">
        <HowItWorksSection />
      </section>
      <section id="pricing" className="reveal-animation">
        <PricingSection />
      </section>
      <section className="reveal-animation">
        <TargetSection />
      </section>
      <section className="reveal-animation">
        <TestimonialsSection />
      </section>
      <section className="reveal-animation">
        <CtaSection />
      </section>
      <section className="reveal-animation">
        <ComingSoonSection />
      </section>
    </main>
  );
};

export default Index;
