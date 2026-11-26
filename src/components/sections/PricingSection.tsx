import React from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const pricingOptions = [
  {
    name: "Plan Esencial",
    tier: "Inicio rápido",
    headline: "Un canal activo para empezar ordenado",
    description: "Para publicar el chat web con tu marca, cargar las respuestas base y seguir las primeras consultas.",
    features: [
      "Chat web marca blanca listo para publicar",
      "Base inicial de respuestas y documentos",
      "Seguimiento de conversaciones clave",
      "Puesta en marcha acompañada por nuestro equipo",
      "Panel básico con métricas esenciales",
    ],
    cta: "Agendar activación",
    ctaLink:
      "https://wa.me/5492613168608?text=Hola!%20Quiero%20activar%20el%20Plan%20Esencial%20de%20Chatboc%20junto%20a%20un%20especialista",
    highlight: false,
  },
  {
    name: "Plan Operativo",
    tier: "Recomendado",
    headline: "Web, WhatsApp, reclamos y seguimiento",
    description:
      "Para equipos con consultas diarias que conectan atención, pedidos, reclamos y reportes en un mismo panel.",
    features: [
      "Todo lo del Plan Esencial",
      "Chat web, WhatsApp y panel operativo",
      "Tickets, reclamos, encuestas y acciones guiadas",
      "Identidad completa: paleta, tipografía y mascota",
      "Ajustes periódicos con nuestro equipo",
    ],
    cta: "Hablar con un asesor",
    ctaLink:
      "https://wa.me/5492613168608?text=Hola!%20Quiero%20una%20demostraci%C3%B3n%20del%20Plan%20Operativo%20de%20Chatboc",
    highlight: true,
  },
  {
    name: "Plan Institucional",
    tier: "Escala y gobierno",
    headline: "Procesos, integraciones y portal público",
    description:
      "Para gobiernos y organizaciones que necesitan permisos por área, trazabilidad e integraciones con sistemas propios.",
    features: [
      "Diseño de circuitos y puesta en marcha con tu equipo",
      "Integración con sistemas existentes y portal público",
      "Tableros operativos multi-organización",
      "Permisos, plazos y auditoría por área",
      "Soporte dedicado para sumar nuevos trámites",
    ],
    cta: "Coordinar reunión",
    ctaLink:
      "https://wa.me/5492613168608?text=Hola!%20Necesito%20una%20propuesta%20institucional%20de%20Chatboc",
    highlight: false,
  },
];

const PricingSection = () => {
  const navigate = useNavigate();

  return (
    <section
      id="precios"
      aria-labelledby="plans-title"
      className="border-t border-border bg-muted/20 py-20 text-foreground dark:bg-muted/10 md:py-28"
    >
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-3xl">
            <div className="chatboc-section-kicker mb-4">Planes</div>
            <h2 id="plans-title" className="chatboc-section-heading text-balance">
              Planes claros para implementar y escalar
            </h2>
            <p className="chatboc-section-copy mt-4 max-w-2xl">
              Elegí según lo que necesitás hoy: publicar un primer canal, ordenar la atención diaria o integrar
              sistemas propios con nuestro equipo.
            </p>
          </div>

          <div className="mt-12 grid divide-y divide-border overflow-hidden rounded-[12px] border border-border bg-card lg:grid-cols-3 lg:divide-x lg:divide-y-0">
            {pricingOptions.map((option) => (
              <article
                key={option.name}
                className={`flex h-full flex-col p-6 md:p-8 ${
                  option.highlight ? "bg-muted/30 dark:bg-muted/20" : "bg-card"
                }`}
              >
                <p
                  className={`text-sm font-medium ${
                    option.highlight ? "text-primary" : "text-slate-600 dark:text-muted-foreground"
                  }`}
                >
                  {option.tier}
                </p>

                <h3 className="chatboc-display mt-2 text-2xl font-semibold text-foreground">{option.name}</h3>
                <p className="mt-2 text-sm font-semibold text-foreground">{option.headline}</p>
                <p className="mt-2.5 text-sm leading-6 text-slate-600 dark:text-muted-foreground">
                  {option.description}
                </p>

                <div className="my-6 border-t border-border" aria-hidden="true" />

                <ul className="flex-1 space-y-3 text-sm leading-6 text-foreground/90">
                  {option.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5">
                      <span aria-hidden="true" className="select-none text-slate-400 dark:text-muted-foreground">
                        —
                      </span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  size="lg"
                  variant={option.highlight ? "default" : "outline"}
                  className={`mt-8 h-11 w-full rounded-[8px] font-semibold shadow-none ${
                    option.highlight
                      ? "chatboc-cta-primary shadow-none"
                      : "border-border bg-background hover:bg-muted/50"
                  }`}
                  onClick={() => {
                    if (option.ctaLink.startsWith("http")) {
                      window.open(option.ctaLink, "_blank", "noopener,noreferrer");
                    } else {
                      navigate(option.ctaLink);
                    }
                  }}
                >
                  {option.cta}
                </Button>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
