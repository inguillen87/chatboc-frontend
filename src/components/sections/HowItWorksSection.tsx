
import React from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle2, ArrowDown } from 'lucide-react';

const HowItWorksSection = () => {
  const steps = [
    {
      number: "1",
      title: "Prueba Gratuita y Sin Compromisos",
      description: "Regístrate en segundos para tu prueba gratuita de 15 días. Sin necesidad de ingresar datos de tarjeta de crédito."
    },
    {
      number: "2",
      title: "Configuración Inicial Personalizada y Guiada",
      description: "Definimos juntos tus primeras 10 preguntas y respuestas esenciales. Nuestro equipo te acompaña para que Chatboc esté listo para impresionar desde el primer momento."
    },
    {
      number: "3",
      title: "Lanza y Observa la Magia",
      description: "Integra Chatboc fácilmente en tu sitio web o WhatsApp. Mira cómo gestiona consultas, capta leads y aprende continuamente para ofrecer un servicio cada vez mejor."
    },
    {
      number: "4",
      title: "Crece sin Límites con el Plan Pro",
      description: "¿Viste el potencial? Actualiza a nuestro plan Pro por un costo mensual accesible y desbloquea hasta 50 Q&A personalizadas, NLP avanzado para tu nicho, el panel de administración completo y mucho más."
    }
  ];

  return (
    <section id="how-it-works" className="section-padding bg-white">
      <div className="container px-4 mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Empezar a Revolucionar la Comunicación de tu Pyme con Chatboc es Muy Fácil
          </h2>
          <p className="text-lg text-gray-600">
            Implementar Chatboc en tu negocio es un proceso simple y guiado que te permitirá ver resultados desde el primer día.
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          {steps.map((step, index) => (
            <div key={index} className="relative">
              <div className="flex items-start mb-12 last:mb-0">
                <div className="flex-shrink-0 mr-4">
                  <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white text-xl font-bold">
                    {step.number}
                  </div>
                  {index < steps.length - 1 && (
                    <div className="absolute left-6 top-12 transform -translate-x-1/2 h-full">
                      <div className="h-full border-l-2 border-dashed border-blue-200"></div>
                    </div>
                  )}
                </div>
                <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex-grow">
                  <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                  <p className="text-gray-600 mb-4">{step.description}</p>
                  {index === 0 && (
                    <Button>Iniciar Prueba Gratuita</Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
