import React from "react";
import { ArrowRight, Building2, Check, GraduationCap, Landmark } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";

const solutions = [
  {
    icon: Landmark,
    sector: "Gobierno",
    title: "Atención ciudadana y gestión territorial",
    description: "Recibe consultas y reclamos, registra casos y los deriva al área responsable con su contexto.",
    capabilities: [
      "Reclamos, trámites y derivaciones",
      "Fotos, audio y ubicación cuando se aportan",
      "Estados y seguimiento de casos",
    ],
  },
  {
    icon: Building2,
    sector: "Empresa",
    title: "Atención comercial conectada a la operación",
    description: "Vincula conversaciones con catálogo, pedidos y seguimiento sin separar la atención de la venta.",
    capabilities: [
      "Consultas, catálogo y pedidos",
      "Compra como invitado o con cuenta",
      "Atención y seguimiento posventa",
    ],
  },
  {
    icon: GraduationCap,
    sector: "Educación",
    title: "Gestiones escolares con contexto",
    description: "Ordena consultas y documentación entre familias, secretaría y equipos de la institución.",
    capabilities: [
      "Admisiones y consultas de familias",
      "Inasistencias, certificados y pagos",
      "Derivación humana para casos sensibles",
    ],
  },
];

const SolutionSection = () => {
  const navigate = useNavigate();

  return (
    <section
      id="solucion"
      aria-labelledby="solutions-title"
      className="bg-muted/25 py-14 text-foreground md:py-20"
    >
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-3xl">
            <div className="chatboc-section-kicker mb-4">Soluciones</div>
            <h2 id="solutions-title" className="chatboc-section-heading">
              Una plataforma, tres formas de operar
            </h2>
            <p className="chatboc-section-copy mt-4 max-w-2xl">
              Cada implementación se configura con los procesos, canales y datos disponibles de la organización.
            </p>
          </div>

          <div className="mt-9 grid gap-4 lg:grid-cols-3">
            {solutions.map((solution) => {
              const Icon = solution.icon;
              return (
                <article
                  key={solution.sector}
                  className="flex h-full flex-col rounded-[12px] border border-border bg-card p-5 shadow-sm sm:p-6"
                >
                  <div className="flex items-center gap-3 border-b border-border/70 pb-5">
                    <span className="flex h-11 w-11 flex-none items-center justify-center rounded-[8px] bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <h3 className="text-lg font-semibold text-foreground">{solution.sector}</h3>
                  </div>

                  <div className="flex flex-1 flex-col pt-5">
                    <p className="text-base font-semibold leading-6 text-foreground">{solution.title}</p>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{solution.description}</p>
                    <ul className="mt-6 space-y-3" aria-label={`Capacidades para ${solution.sector}`}>
                      {solution.capabilities.map((capability) => (
                        <li key={capability} className="flex gap-3 text-sm leading-5 text-foreground/80">
                          <Check className="mt-0.5 h-4 w-4 flex-none text-primary" aria-hidden="true" />
                          <span>{capability}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="mt-8 flex justify-start">
            <Button
              size="lg"
              className="chatboc-cta-primary w-full rounded-[8px] font-semibold sm:w-auto"
              onClick={() => navigate("/contacto")}
            >
              Solicitar demostración
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default SolutionSection;
