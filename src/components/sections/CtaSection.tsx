
import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

const CtaSection = () => {
  return (
    <section className="section-padding bg-gradient-to-br from-blue-600 to-blue-800 text-white">
      <div className="container px-4 mx-auto">
        <div className="text-center max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            ¿Listo para que Chatboc Comience a Trabajar para Tu Pyme?
          </h2>
          <p className="text-xl opacity-90 mb-8">
            No dejes pasar más oportunidades. Únete a las pymes que están transformando su comunicación y ventas con la inteligencia artificial personalizada de Chatboc. Tu prueba gratuita de 15 días te espera.
          </p>
          <Button 
            size="lg" 
            variant="secondary" 
            className="text-blue-700 hover:text-blue-800 font-medium"
          >
            Sí, ¡Quiero Mi Prueba Gratuita de Chatboc! <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          <div className="mt-4">
            <a href="#" className="text-sm underline underline-offset-4 hover:text-white/80 transition-colors">
              ¿Tienes preguntas? Contáctanos
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CtaSection;
