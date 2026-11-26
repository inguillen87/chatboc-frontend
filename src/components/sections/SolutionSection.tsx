import React from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";

const solutions = [
  {
    sector: "Gobierno",
    title: "Atención ciudadana y gestión territorial",
    description: "Recibe consultas y reclamos, registra casos y los deriva al área responsable con su contexto.",
    capabilities: [
      "Reclamos, trámites y derivaciones por área",
      "Fotos, audios transcriptos y ubicación cuando la persona los comparte",
      "Estados públicos y número de seguimiento por caso",
    ],
  },
  {
    sector: "Empresa",
    title: "Atención comercial conectada a la operación",
    description: "Vincula cada conversación con catálogo, pedidos y seguimiento sin separar atención y ventas.",
    capabilities: [
      "Consultas, catálogo y armado de pedidos en el mismo hilo",
      "Compra como invitado o con cuenta registrada",
      "Seguimiento posventa y pase a tu equipo comercial",
    ],
  },
  {
    sector: "Educación",
    title: "Gestiones escolares con contexto",
    description: "Ordena consultas y documentación entre familias, secretaría y equipos de la institución.",
    capabilities: [
      "Admisiones y consultas frecuentes de familias",
      "Inasistencias, certificados y consulta de pagos",
      "Derivación humana para casos que requieren seguimiento",
    ],
  },
];

const SolutionSection = () => {
  const navigate = useNavigate();

  return (
    <section
      id="solucion"
      aria-labelledby="solutions-title"
      className="bg-muted/20 py-20 text-foreground dark:bg-muted/10 md:py-28"
    >
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-3xl">
            <div className="chatboc-section-kicker mb-4">Soluciones</div>
            <h2 id="solutions-title" className="chatboc-section-heading text-balance">
              Una plataforma, tres formas de operar
            </h2>
            <p className="chatboc-section-copy mt-4 max-w-2xl">
              Cada implementación se configura con los procesos, canales y datos de tu organización.
            </p>
          </div>

          <div className="mt-12 border-t border-border">
            {solutions.map((solution) => (
              <article
                key={solution.sector}
                className="grid gap-6 border-b border-border py-8 md:py-10 lg:grid-cols-[0.65fr_1.15fr_1.2fr] lg:gap-12"
              >
                <div>
                  <h3 className="chatboc-display text-2xl font-semibold text-foreground">{solution.sector}</h3>
                </div>

                <div>
                  <p className="text-base font-semibold leading-6 text-foreground">{solution.title}</p>
                  <p className="mt-2.5 text-sm leading-6 text-slate-600 dark:text-muted-foreground">
                    {solution.description}
                  </p>
                </div>

                <ul
                  className="space-y-2.5 text-sm leading-6 text-foreground/90"
                  aria-label={`Capacidades para ${solution.sector}`}
                >
                  {solution.capabilities.map((capability) => (
                    <li key={capability} className="flex items-start gap-2.5">
                      <span aria-hidden="true" className="select-none text-slate-400 dark:text-muted-foreground">
                        —
                      </span>
                      <span>{capability}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>

          <div className="mt-10 flex justify-start">
            <Button
              size="lg"
              className="chatboc-cta-primary h-11 w-full rounded-[8px] px-6 font-semibold shadow-none sm:w-auto"
              onClick={() => navigate("/contacto")}
            >
              Solicitar demostración
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default SolutionSection;
