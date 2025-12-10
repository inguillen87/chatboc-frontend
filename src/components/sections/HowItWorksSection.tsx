import React from "react";
import { Button } from "@/components/ui/button";
import { Store, Vote, BarChart3, Rocket, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

const newSteps = [
  {
    number: "1",
    icon: <Store className="h-7 w-7 text-primary" />,
    title: "Crea tu Espacio Digital",
    description: "Configura tu perfil de Municipio o Empresa en minutos. Sube tu logo, define tus colores y lanza tu Marketplace local o Portal de Servicios."
  },
  {
    number: "2",
    icon: <Vote className="h-7 w-7 text-primary" />,
    title: "Lanza Participación en Vivo",
    description: "Crea tu primera encuesta o votación. Invita a la comunidad a participar en tiempo real desde sus móviles, con resultados instantáneos."
  },
  {
    number: "3",
    icon: <BarChart3 className="h-7 w-7 text-primary" />,
    title: "Visualiza y Analiza",
    description: "Accede al panel de control. Observa los mapas de calor de actividad, las tendencias de voto y las métricas de consumo en tu mercado local."
  },
  {
    number: "4",
    icon: <Rocket className="h-7 w-7 text-primary" />,
    title: "Actúa y Crece",
    description: "Usa los insights para tomar decisiones. Mejora servicios, impulsa ofertas comerciales y mantén a tu comunidad conectada y satisfecha."
  }
];

const HowItWorksSection = () => {
  const navigate = useNavigate();

  return (
    <section id="como-funciona" className="py-16 md:py-24 bg-light text-foreground">
      <div className="container px-4 mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-12 md:mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-dark">
            Transformación Digital en 4 Pasos
          </h2>
          <p className="text-lg text-muted-foreground">
            Sin instalaciones complejas ni largas esperas. Nuestra plataforma está lista para usar y diseñada para generar impacto desde el primer día.
          </p>
        </div>

        <div className="max-w-3xl mx-auto">
          {newSteps.map((step, index) => (
            <div key={index} className="flex items-start mb-10 last:mb-0">
              <div className="flex flex-col items-center mr-6">
                <div
                  className="flex-shrink-0 w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center text-2xl font-bold shadow-md mb-2 relative z-10 bg-background"
                >
                  {step.number}
                </div>
                {index < newSteps.length - 1 && (
                  <div className="w-px h-full bg-border absolute mt-14" style={{ height: 'calc(100% + 2.5rem)' }} />
                )}
                {/* Fix for visual connector line if needed, simplified above */}
              </div>
              <div className="bg-card text-card-foreground p-6 rounded-lg border border-border shadow-lg flex-grow hover:shadow-xl transition-shadow duration-300">
                <div className="flex items-center mb-3 gap-3">
                   <div className="p-2 bg-primary/5 rounded-full">{step.icon}</div>
                   <h3 className="text-xl font-semibold text-dark">{step.title}</h3>
                </div>
                <p className="text-muted-foreground">{step.description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-12 md:mt-16">
          <Button
            size="lg"
            className="shadow-lg hover:shadow-xl transition-shadow"
            onClick={() => navigate('/demo')}
          >
            Ver Demo Interactiva <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
