import React from "react";
import { ArrowRight, BarChart3, Bot, Rocket, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const steps = [
  {
    number: "01",
    icon: UploadCloud,
    title: "Cargás tu operación",
    description:
      "Documentos, catálogo, rubros, políticas, preguntas frecuentes o rutas existentes. El contenido queda como fuente operativa.",
  },
  {
    number: "02",
    icon: Bot,
    title: "El backend define la experiencia",
    description:
      "Contratos de widget, demo, quick menu, media, CTAs, casos y analytics indican qué debe mostrar cada pantalla.",
  },
  {
    number: "03",
    icon: Rocket,
    title: "El usuario conversa y avanza",
    description:
      "El agente responde, pide datos, sube adjuntos, toma ubicación, deriva a humano o abre una acción concreta.",
  },
  {
    number: "04",
    icon: BarChart3,
    title: "El equipo mide y mejora",
    description:
      "Dashboards, mapas, SLA, freshness y action center ordenan prioridades para operar con datos vivos.",
  },
];

const HowItWorksSection = () => {
  const navigate = useNavigate();

  return (
    <section id="como-funciona" className="chatboc-muted-band py-16 text-foreground md:py-24">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-12 max-w-3xl text-center md:mb-16">
          <div className="chatboc-section-kicker mb-4">Cómo funciona</div>
          <h2 className="chatboc-section-heading">Menos configuración manual, más sistema funcionando</h2>
          <p className="chatboc-section-copy mt-4">
            El flujo está pensado para crecer por contrato: si el backend suma una capacidad, el frontend la adopta sin convertir
            cada vertical en una pantalla hecha a mano.
          </p>
        </div>

        <div className="relative grid gap-4 lg:grid-cols-4">
          <div className="pointer-events-none absolute left-8 right-8 top-10 hidden h-px bg-border lg:block" />
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <article key={step.number} className="chatboc-landing-panel chatboc-hover-lift relative overflow-hidden p-5 md:p-6">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-emerald-500 to-amber-500 opacity-80" />
                <div className="mb-6 flex items-center justify-between gap-4">
                  <span className="text-sm font-bold text-primary">{step.number}</span>
                  <div className="flex h-10 w-10 items-center justify-center rounded-[8px] border border-primary/20 bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
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
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
