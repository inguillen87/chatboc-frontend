import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Building, Check, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const pricingOptions = [
  {
    name: "Plan Esencial",
    tier: "Inicio rápido",
    headline: "Activación guiada para validar rápido",
    description:
      "Para activar un canal, cargar tus respuestas base y medir las primeras consultas.",
    features: [
      "Chat web marca blanca listo para activar",
      "Base inicial de respuestas y documentos",
      "Seguimiento de conversaciones clave",
      "Configuración acompañada por especialista",
      "Panel básico con métricas esenciales",
    ],
    cta: "Agendar activación",
    ctaLink:
      "https://wa.me/5492613168608?text=Hola!%20Quiero%20activar%20el%20Plan%20Esencial%20de%20Chatboc%20junto%20a%20un%20especialista",
    highlight: false,
    icon: Sparkles,
  },
  {
    name: "Plan Operativo",
    tier: "Más elegido",
    headline: "Web, WhatsApp, tickets y seguimiento",
    description:
      "Para equipos con consultas diarias que necesitan conectar conversaciones, pedidos, soporte y reportes.",
    features: [
      "Todo lo del Plan Esencial",
      "Chat web, WhatsApp y panel operativo",
      "Tickets, reclamos, encuestas y acciones contextuales",
      "Identidad completa: paleta, tipografía y mascota",
      "Seguimiento y ajustes con nuestro equipo",
    ],
    cta: "Hablar con un asesor",
    ctaLink:
      "https://wa.me/5492613168608?text=Hola!%20Quiero%20una%20demostraci%C3%B3n%20del%20Plan%20Operativo%20de%20Chatboc",
    highlight: true,
    icon: Users,
  },
  {
    name: "Plan Institucional",
    tier: "Escala y gobierno",
    headline: "Procesos, integraciones y escala institucional",
    description:
      "Para gobiernos y organizaciones que requieren seguridad, gobierno de datos, permisos e integraciones a medida.",
    features: [
      "Diseño de circuitos y puesta en marcha con tu equipo",
      "Integración con sistemas existentes y portal público",
      "Tableros ejecutivos multi-organización",
      "Tiempos, permisos y trazabilidad avanzada",
      "Soporte dedicado para sumar nuevos procesos",
    ],
    cta: "Coordinar reunión",
    ctaLink:
      "https://wa.me/5492613168608?text=Hola!%20Necesito%20una%20propuesta%20institucional%20de%20Chatboc",
    highlight: false,
    icon: Building,
  },
];

const PricingSection = () => {
  const navigate = useNavigate();
  const reduceMotion = Boolean(useReducedMotion());
  const canAnimateInView = !reduceMotion && typeof IntersectionObserver !== "undefined";

  return (
    <section
      id="precios"
      aria-labelledby="plans-title"
      className="chatboc-muted-band relative overflow-hidden py-20 text-foreground md:py-28"
    >
      <div className="container relative mx-auto px-4">
        <div className="mx-auto mb-12 max-w-3xl text-center md:mb-16">
          <div className="chatboc-section-kicker mb-4">Planes</div>
          <h2 id="plans-title" className="chatboc-section-heading text-balance">
            Planes claros para implementar y escalar
          </h2>
          <p className="chatboc-section-copy mt-4">
            Elegí según lo que necesitás hoy: activar un primer canal, ordenar la atención diaria o integrar sistemas
            propios con nuestro equipo.
          </p>
        </div>

        <div className="mx-auto grid max-w-6xl items-stretch gap-5 lg:grid-cols-3">
          {pricingOptions.map((option, index) => {
            const Icon = option.icon;
            return (
              <motion.article
                key={option.name}
                initial={canAnimateInView ? { opacity: 0.96, y: 18 } : false}
                whileInView={canAnimateInView ? { opacity: 1, y: 0 } : undefined}
                viewport={canAnimateInView ? { once: true, amount: 0.2 } : undefined}
                transition={{ duration: canAnimateInView ? 0.4 : 0, delay: canAnimateInView ? index * 0.08 : 0, ease: "easeOut" }}
                className={`group relative flex h-full flex-col overflow-hidden rounded-[20px] border p-6 transition-all duration-300 hover:-translate-y-1 md:p-7 ${
                  option.highlight
                    ? "border-primary/55 bg-card shadow-[0_28px_70px_rgba(13,53,195,0.16)] ring-1 ring-primary/30 dark:shadow-[0_28px_70px_rgba(37,99,235,0.22)]"
                    : "border-border/80 bg-card/95 shadow-sm hover:border-primary/35 hover:shadow-xl"
                }`}
              >
                <div
                  aria-hidden="true"
                  className={`absolute inset-x-0 top-0 h-1.5 ${
                    option.highlight
                      ? "bg-gradient-to-r from-primary via-sky-400 to-emerald-400"
                      : "bg-primary/25 transition-colors group-hover:bg-primary/60"
                  }`}
                />

                <div className="mb-5 flex items-center justify-between gap-3">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-[12px] ${
                      option.highlight ? "bg-primary text-primary-foreground shadow-md" : "bg-primary/10 text-primary"
                    }`}
                  >
                    <Icon className="h-6 w-6" aria-hidden="true" />
                  </div>
                  {option.highlight ? (
                    <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground shadow-xs">
                      Recomendado
                    </span>
                  ) : (
                    <span className="rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
                      {option.tier}
                    </span>
                  )}
                </div>

                <h3 className="text-2xl font-bold tracking-tight text-foreground">{option.name}</h3>
                <p className="mt-2 text-sm font-semibold text-primary">{option.headline}</p>
                <p className="mt-4 text-sm leading-6 text-muted-foreground">{option.description}</p>

                <div className="my-6 h-px bg-border/70" aria-hidden="true" />

                <ul className="flex-1 space-y-3 text-sm text-foreground/85">
                  {option.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                      <span className="leading-5">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  size="lg"
                  variant={option.highlight ? "default" : "outline"}
                  className={`mt-8 h-12 w-full rounded-[10px] font-semibold ${
                    option.highlight ? "chatboc-cta-primary shadow-md" : "hover:border-primary/45 hover:bg-primary/5"
                  }`}
                  onClick={() => {
                    if (option.ctaLink.startsWith("http")) {
                      window.open(option.ctaLink, "_blank", "noopener,noreferrer");
                    } else {
                      navigate(option.ctaLink);
                    }
                  }}
                >
                  <span>{option.cta}</span>
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </Button>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
