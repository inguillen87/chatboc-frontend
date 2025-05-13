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
    <main className="flex flex-col">
      <HeroSection />
      <ProblemsSection />
      <SolutionSection />
      <HowItWorksSection />
      <PricingSection />
      <TargetSection />
      <TestimonialsSection />
      <CtaSection />
    </main>
  );
};

export default Index;
