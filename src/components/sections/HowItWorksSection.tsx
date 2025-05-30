import React from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

const steps = [
  {
    number: "1",
    title: "Prueba Gratis Sin Tarjeta",
    description: "Registrate en segundos y accedé a una prueba gratuita de 15 días. No te pedimos tarjeta de crédito."
  },
  {
    number: "2",
    title: "Configuración Guiada",
    description: "Definimos juntos tus primeras preguntas clave y respuestas. Te acompañamos en la puesta a punto para que tu bot impacte desde el primer día."
  },
  {
    number: "3",
    title: "Integrá y Probá",
    description: "Sumá Chatboc a tu web o WhatsApp en minutos. Mirá cómo responde, genera consultas y vende mientras vos te ocupás de lo importante."
  },
  {
    number: "4",
    title: "Escalá con el Plan Pro",
    description: "¿Viste el potencial? Pasate al Plan Pro y desbloqueá más respuestas, IA avanzada, panel de administración y soporte prioritario."
  }
];

const HowItWorksSection = () => (
  <section id="how-it-works" className="py-16 md:py-24 bg-background text-foreground transition-colors">
    <div className="container px-4 mx-auto">
      <div className="text-center max-w-3xl mx-auto mb-16">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">
          Así de fácil es revolucionar tu atención al cliente
        </h2>
        <p className="text-lg text-muted-foreground">
          En menos de un día podés tener tu asistente IA funcionando y vendiendo por vos.
        </p>
      </div>

      <div className="max-w-4xl mx-auto">
        {steps.map((step, index) => (
          <div key={index} className="relative">
            <div className="flex items-start mb-12 last:mb-0 flex-col sm:flex-row">
              <div className="flex-shrink-0 mr-4 mb-4 sm:mb-0 relative">
                <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                  {step.number}
                </div>
                {index < steps.length - 1 && (
                  <div className="hidden sm:block absolute left-1/2 top-12 transform -translate-x-1/2 h-full">
                    <div className="h-full border-l-2 border-dashed border-blue-300 dark:border-blue-700" />
                  </div>
                )}
              </div>
              <div className="bg-card text-card-foreground p-6 rounded-xl border border-border shadow-sm flex-grow">
                <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                <p className="text-muted-foreground mb-2">{step.description}</p>
                {index === 0 && (
                  <Button
                    className="mt-2"
                    size="lg"
                    onClick={() => window.location.href = "/register"}
                  >
                    Empezar Prueba Gratis <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* CTA Final, refuerza conversión */}
      <div className="text-center mt-12">
        <Button
          size="lg"
          className="px-8 py-4 text-base"
          onClick={() => window.location.href = "/register"}
        >
          Registrate ahora y probá gratis Chatboc
        </Button>
      </div>
    </div>
  </section>
);

export default HowItWorksSection;
