
import React from 'react';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';

const PricingSection = () => {
  const freePlanFeatures = [
    "Hasta 10 Preguntas y Respuestas personalizadas",
    "Configuración inicial guiada",
    "Funcionalidad básica de aprendizaje IA",
    "Integración Web (Widget)",
    "Soporte básico"
  ];

  const proPlanFeatures = [
    "Todo lo del plan de prueba, ¡y mucho más!",
    "Hasta 50 Preguntas y Respuestas personalizadas",
    "NLP FAQ avanzado y entrenamiento específico para tu nicho",
    "Panel de administración completo con estadísticas",
    "Aprendizaje continuo y optimizaciones IA avanzadas",
    "Integración Web y WhatsApp Business",
    "Soporte prioritario",
    "Actualizaciones constantes"
  ];

  return (
    <section id="pricing" className="section-padding bg-gray-50">
      <div className="container px-4 mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Planes Pensados para el Éxito de Tu Pyme. Sin Sorpresas.
          </h2>
          <p className="text-lg text-gray-600">
            Elegimos hacer nuestros planes simples y transparentes. Sin costos ocultos, sin sorpresas.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8 max-w-5xl mx-auto">
          {/* Free Trial Plan */}
          <div className="w-full lg:w-1/2 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden transition-transform hover:-translate-y-1 hover:shadow-md">
            <div className="p-8 border-b border-gray-100">
              <h3 className="text-xl font-bold mb-2">Prueba Gratuita Chatboc</h3>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-4xl font-bold">GRATIS</span>
                <span className="text-gray-500">/ 15 días</span>
              </div>
              <p className="text-gray-600">Experimenta el poder de Chatboc sin compromisos.</p>
            </div>
            <div className="p-8">
              <ul className="space-y-3 mb-8">
                {freePlanFeatures.map((feature, index) => (
                  <li key={index} className="flex items-start">
                    <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Button size="lg" className="w-full">Comenzar Mi Prueba GRATIS</Button>
            </div>
          </div>

          {/* Pro Plan */}
          <div className="w-full lg:w-1/2 bg-white rounded-2xl border border-blue-200 shadow-sm overflow-hidden transition-transform hover:-translate-y-1 hover:shadow-md">
            <div className="bg-blue-600 p-8 text-white">
              <h3 className="text-xl font-bold mb-2">Chatboc Pro</h3>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-4xl font-bold">$20</span>
                <span className="opacity-90">/ mes</span>
              </div>
              <p className="opacity-90">La solución completa para optimizar tu comunicación.</p>
            </div>
            <div className="p-8">
              <ul className="space-y-3 mb-8">
                {proPlanFeatures.map((feature, index) => (
                  <li key={index} className="flex items-start">
                    <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Button 
                size="lg" 
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                Elegir Plan Pro
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
