import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Building2, Check, GraduationCap, Landmark } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";

const solutions = [
  {
    icon: Landmark,
    sector: "Gobierno",
    accent: "from-sky-500/80 via-primary/80 to-emerald-400/80",
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
    accent: "from-primary/85 via-indigo-500/80 to-cyan-400/80",
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
    accent: "from-violet-500/80 via-primary/80 to-sky-400/80",
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
  const reduceMotion = Boolean(useReducedMotion());
  // One orchestrated moment lives in the hero; sections below stay still.
  const canAnimateInView = false && !reduceMotion;

  return (
    <section
      id="solucion"
      aria-labelledby="solutions-title"
      className="bg-muted/25 py-20 text-foreground md:py-28"
    >
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-3xl">
            <div className="chatboc-section-kicker mb-4">Soluciones</div>
            <h2 id="solutions-title" className="chatboc-section-heading text-balance">
              Una plataforma, tres formas de operar
            </h2>
            <p className="chatboc-section-copy mt-4 max-w-2xl">
              Cada implementación se configura con los procesos, canales y datos disponibles de la organización.
            </p>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {solutions.map((solution, index) => {
              const Icon = solution.icon;
              return (
                <motion.article
                  key={solution.sector}
                  initial={canAnimateInView ? { opacity: 0.96, y: 18 } : false}
                  whileInView={canAnimateInView ? { opacity: 1, y: 0 } : undefined}
                  viewport={canAnimateInView ? { once: true, amount: 0.2 } : undefined}
                  transition={{ duration: canAnimateInView ? 0.4 : 0, delay: canAnimateInView ? index * 0.08 : 0, ease: "easeOut" }}
                  className="group relative flex h-full flex-col overflow-hidden rounded-[18px] border border-border/80 bg-card p-6 shadow-sm transition-all duration-300 hover:border-primary/40 hover:shadow-[0_22px_55px_rgba(15,23,42,0.12)] dark:hover:shadow-[0_22px_55px_rgba(0,0,0,0.42)]"
                >
                  <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${solution.accent}`} aria-hidden="true" />
                  <div className="flex items-center gap-3 border-b border-border/70 pb-5">
                    <span className="flex h-11 w-11 flex-none items-center justify-center rounded-[11px] bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <h3 className="text-lg font-bold text-foreground">{solution.sector}</h3>
                  </div>

                  <div className="flex flex-1 flex-col pt-5">
                    <p className="text-base font-semibold leading-6 text-foreground">{solution.title}</p>
                    <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-muted-foreground">{solution.description}</p>
                    <ul className="mt-6 space-y-3" aria-label={`Capacidades para ${solution.sector}`}>
                      {solution.capabilities.map((capability) => (
                        <li key={capability} className="flex gap-3 text-sm leading-5 text-foreground/85">
                          <Check className="mt-0.5 h-4 w-4 flex-none text-primary" aria-hidden="true" />
                          <span>{capability}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </motion.article>
              );
            })}
          </div>

          <div className="mt-10 flex justify-start">
            <Button
              size="lg"
              className="chatboc-cta-primary h-12 w-full rounded-[10px] px-6 font-semibold sm:w-auto"
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
