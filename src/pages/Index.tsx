import React, { useEffect } from 'react';
import HeroSection from '@/components/sections/HeroSection';
import ProblemsSection from '@/components/sections/ProblemsSection';
import SolutionSection from '@/components/sections/SolutionSection';
import HowItWorksSection from '@/components/sections/HowItWorksSection';
import PricingSection from '@/components/sections/PricingSection';
import TargetSection from '@/components/sections/TargetSection';
import TestimonialsSection from '@/components/sections/TestimonialsSection';
import CtaSection from '@/components/sections/CtaSection';

const Index = () => {
  useEffect(() => {
    document.title = 'Chatboc - Tu Experto Virtual para Pymes';
  }, []);

  return (
    <main className="flex flex-col gap-12 md:gap-16 lg:gap-20">
      <section>
        <HeroSection />
      </section>
      <section>
        <ProblemsSection />
      </section>
      <section>
        <SolutionSection />
      </section>
      <section>
        <HowItWorksSection />
      </section>
      <section>
        <PricingSection />
      </section>
      <section>
        <TargetSection />
      </section>
      <section>
        <TestimonialsSection />
      </section>
      <section>
        <CtaSection />
      </section>
    </main>
  );
};

export default Index;
