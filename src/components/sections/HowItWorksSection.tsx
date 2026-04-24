import React from "react";
import { Button } from "@/components/ui/button";
import { UploadCloud, Bot, Rocket, BarChart3, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

const newSteps = [
  {
    number: "1",
    icon: <UploadCloud className="h-7 w-7 text-primary" />,
    title: "Sube tu Información",
    description: "Carga tus normativas, catálogos de productos o servicios. No necesitas configurar flujos complejos; simplemente entréganos tus datos."
  },
  {
    number: "2",
    icon: <Bot className="h-7 w-7 text-primary" />,
    title: "Nuestra IA hace el Trabajo",
    description: "La plataforma procesa tu información automáticamente, crea tu Base de Conocimiento y genera tu Marketplace o Portal de Servicios al instante."
  },
  {
    number: "3",
    icon: <Rocket className="h-7 w-7 text-primary" />,
    title: "Listo para Usar",
    description: "Tu Agente IA y tu Mercado Digital están activos. Sin configuraciones técnicas, menús complicados ni pérdidas de tiempo. Todo llave en mano."
  },
  {
    number: "4",
    icon: <BarChart3 className="h-7 w-7 text-primary" />,
    title: "Visualiza Resultados",
    description: "Accede a tu Dashboard con Mapas de Calor, métricas de participación y estadísticas de ventas. Toma decisiones basadas en datos reales."
  }
];

const HowItWorksSection = () => {
  const navigate = useNavigate();

  return (
    <section id="como-funciona" className="py-16 md:py-24 bg-muted text-foreground">
      <div className="container px-4 mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-12 md:mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
            Sin complicaciones técnicas, todo listo para ti
          </h2>
          <p className="text-lg text-muted-foreground">
            Olvídate de configurar "flujos" o menús interminables como en otras plataformas. Nosotros nos diferenciamos por darte una solución terminada y automática.
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
              </div>
              <div className="bg-card text-card-foreground p-6 rounded-lg border border-border shadow-lg flex-grow hover:shadow-xl transition-shadow duration-300">
                <div className="flex items-center mb-3 gap-3">
                   <div className="p-2 bg-primary/5 rounded-full">{step.icon}</div>
                   <h3 className="text-xl font-semibold text-foreground">{step.title}</h3>
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
