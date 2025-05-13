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
    "Panel de administración con estadísticas",
    "Aprendizaje continuo y optimizaciones IA avanzadas",
    "Integración Web y WhatsApp Business",
    "Soporte prioritario",
    "Actualizaciones constantes"
  ];

  return (
    <section id="pricing" className="py-14 md:py-20 bg-gray-50">
      <div className="container px-4 mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-12 md:mb-16">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3">
            Planes Pensados para el Éxito de Tu Pyme
          </h2>
          <p className="text-base sm:text-lg text-gray-600">
            Simples, transparentes y sin sorpresas.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8 max-w-5xl mx-auto">
          {/* FREE PLAN */}
          <div className="w-full lg:w-1/2 bg-white rounded-2xl border border-gray-200 shadow-md hover:shadow-lg transition overflow-hidden">
            <div className="p-6 md:p-8 border-b border-gray-100">
              <h3 className="text-lg md:text-xl font-bold mb-2">Prueba Gratuita</h3>
              <div className="flex items-baseline gap-1 mb-3">
                <span className="text-3xl font-bold">GRATIS</span>
                <span className="text-gray-500 text-sm">/ 15 días</span>
              </div>
              <p className="text-gray-600 text-sm">
                Probá Chatboc sin compromisos ni tarjeta de crédito.
              </p>
            </div>
            <div className="p-6 md:p-8">
              <ul className="space-y-2 mb-6">
                {freePlanFeatures.map((feature, index) => (
                  <li key={index} className="flex items-start text-sm">
                    <Check className="h-4 w-4 text-green-500 mr-2 mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Button size="lg" className="w-full">Comenzar GRATIS</Button>
            </div>
          </div>

          {/* PRO PLAN */}
          <div className="w-full lg:w-1/2 bg-white rounded-2xl border border-blue-200 shadow-md hover:shadow-lg transition overflow-hidden">
            <div className="bg-blue-600 p-6 md:p-8 text-white">
              <h3 className="text-lg md:text-xl font-bold mb-2">Chatboc Pro</h3>
              <div className="flex items-baseline gap-1 mb-3">
                <span className="text-3xl font-bold">$20</span>
                <span className="text-sm opacity-90">/ mes</span>
              </div>
              <p className="text-sm opacity-90">
                Solución completa para automatizar tu atención al cliente.
              </p>
            </div>
            <div className="p-6 md:p-8">
              <ul className="space-y-2 mb-6">
                {proPlanFeatures.map((feature, index) => (
                  <li key={index} className="flex items-start text-sm">
                    <Check className="h-4 w-4 text-green-500 mr-2 mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Button size="lg" className="w-full bg-blue-600 hover:bg-blue-700">
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
