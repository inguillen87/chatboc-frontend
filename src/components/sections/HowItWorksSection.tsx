import React from "react";
import { ArrowRight, BarChart3, Bot, Rocket, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const steps = [
  {
    number: "01",
    icon: UploadCloud,
    title: "Relevamiento operativo",
    description:
      "Documentamos consultas, reclamos, pedidos, encuestas, catálogos, políticas y rutas de derivación antes de configurar el servicio.",
  },
  {
    number: "02",
    icon: Bot,
    title: "Configuración del servicio",
    description:
      "Definimos menús, datos requeridos, permisos, responsables y criterios de atención para cada recorrido.",
  },
  {
    number: "03",
    icon: Rocket,
    title: "Puesta en marcha controlada",
    description:
      "Validamos conversaciones, adjuntos, ubicación consentida, derivaciones y acciones concretas antes de ampliar el alcance.",
  },
  {
    number: "04",
    icon: BarChart3,
    title: "Medición y mejora continua",
    description:
      "El equipo revisa estados, tiempos, encuestas, mapas y prioridades con trazabilidad para ajustar la operación.",
  },
];

const HowItWorksSection = () => {
  const navigate = useNavigate();

  return (
    <section
      id="como-funciona"
      aria-labelledby="implementation-title"
      className="chatboc-muted-band py-16 text-foreground md:py-24"
    >
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-12 max-w-3xl text-center md:mb-16">
          <div className="chatboc-section-kicker mb-4">Implementación</div>
          <h2 id="implementation-title" className="chatboc-section-heading">
            Un recorrido operativo, de punta a punta
          </h2>
          <p className="chatboc-section-copy mt-4">
            Cada canal se incorpora con alcance, responsables y criterios de validación definidos. La organización puede
            comenzar con un proceso y sumar capacidades sin perder contexto ni trazabilidad.
          </p>
        </div>

        <div className="relative grid gap-4 lg:grid-cols-4">
          <div className="pointer-events-none absolute left-8 right-8 top-10 hidden h-px bg-border lg:block" />
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <article key={step.number} className="chatboc-landing-panel chatboc-hover-lift relative overflow-hidden p-5 md:p-6">
                <div className="absolute inset-x-0 top-0 h-1 bg-primary/80" />
                <div className="mb-6 flex items-center justify-between gap-4">
                  <span className="text-sm font-bold text-primary">{step.number}</span>
                  <div className="flex h-10 w-10 items-center justify-center rounded-[8px] border border-primary/20 bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-foreground">{step.title}</h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{step.description}</p>
              </article>
            );
          })}
        </div>

        <div className="mt-10 flex justify-center">
          <Button
            size="lg"
            className="chatboc-cta-primary rounded-[8px] font-semibold"
            onClick={() => navigate("/demo")}
          >
            Ver demo interactiva
            <ArrowRight className="ml-2 h-5 w-5" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
