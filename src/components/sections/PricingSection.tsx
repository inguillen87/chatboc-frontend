import React from "react";
import { Building, Check, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const pricingOptions = [
  {
    name: "Plan Esencial",
    headline: "Activación guiada para validar rápido",
    description:
      "Ideal para probar atención con IA, cargar contenido base y medir primeras conversaciones sin una implementación pesada.",
    features: [
      "Chat web listo para activar",
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
    headline: "Omnicanalidad, tickets y automatización",
    description:
      "Para equipos que ya atienden demanda real y necesitan conectar chat, leads, pedidos, soporte y reportes.",
    features: [
      "Todo lo del Plan Esencial",
      "Chat web, WhatsApp y panel operativo",
      "Tickets, leads y acciones contextuales",
      "Métricas, tiempos y alertas principales",
      "Acompañamiento estratégico continuo",
    ],
    cta: "Hablar con un asesor",
    ctaLink:
      "https://wa.me/5492613168608?text=Hola!%20Quiero%20una%20demostraci%C3%B3n%20del%20Plan%20Operativo%20de%20Chatboc",
    highlight: true,
    icon: Users,
  },
  {
    name: "Plan Institucional",
    headline: "Procesos, integraciones y escala",
    description:
      "Para gobiernos, instituciones y organizaciones que necesitan seguridad, gobierno de datos e integraciones a medida.",
    features: [
      "Consultoría de arquitectura y operación",
      "Integración con sistemas existentes",
      "Dashboards ejecutivos multi-organización",
      "Tiempos, permisos y trazabilidad avanzada",
      "Soporte dedicado para evolución continua",
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

  return (
    <section id="precios" className="chatboc-muted-band py-16 text-foreground md:py-24">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-12 max-w-3xl text-center md:mb-16">
          <div className="chatboc-section-kicker mb-4">Planes</div>
          <h2 className="chatboc-section-heading">Paquetes claros para empezar y escalar</h2>
          <p className="chatboc-section-copy mt-4">
            La propuesta se adapta al nivel de operación: validar el canal, conectar procesos o desplegar una solución
            institucional con procesos e integraciones.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {pricingOptions.map((option) => {
            const Icon = option.icon;
            return (
              <article
                key={option.name}
                className={`chatboc-landing-panel chatboc-hover-lift relative flex h-full flex-col overflow-hidden p-5 md:p-6 ${
                  option.highlight ? "border-primary/50 ring-1 ring-primary/30" : ""
                }`}
              >
                {option.highlight ? (
                  <div className="absolute right-4 top-4 rounded-[8px] bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                    Recomendado
                  </div>
                ) : null}

                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-emerald-500 to-amber-500 opacity-80" />
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-[8px] bg-primary/10 text-primary">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="text-2xl font-bold text-foreground">{option.name}</h3>
                <p className="mt-2 text-sm font-semibold text-primary">{option.headline}</p>
                <p className="mt-4 text-sm leading-6 text-muted-foreground">{option.description}</p>

                <ul className="mt-6 flex-1 space-y-3 text-sm text-muted-foreground">
                  {option.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5">
                      <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  size="lg"
                  variant={option.highlight ? "default" : "outline"}
                  className="mt-7 w-full rounded-[8px] font-semibold"
                  onClick={() => {
                    if (option.ctaLink.startsWith("http")) {
                      window.open(option.ctaLink, "_blank");
                    } else {
                      navigate(option.ctaLink);
                    }
                  }}
                >
                  {option.cta}
                </Button>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
