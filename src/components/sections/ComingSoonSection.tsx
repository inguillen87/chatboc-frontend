import React from "react";
import { ArrowRight, ShoppingCart, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const futureSolutions = [
  {
    id: "chatpos",
    icon: ShoppingCart,
    title: "ChatPOS",
    description:
      "Punto de atención y venta para operar pedidos, servicios, pagos y seguimiento desde una interfaz simple.",
    imageSrc: "/images/chatpos.png",
    imageAlt: "Vista de ChatPOS",
    demoLink: "/chatpos",
    buttonText: "Conocer ChatPOS",
    accent: "bg-emerald-500",
  },
  {
    id: "chatcrm",
    icon: Users,
    title: "ChatCRM",
    description:
      "Gestión de relaciones, conversaciones, perfiles y campañas conectadas a los datos reales de cada tenant.",
    imageSrc: "/images/chatcrm.png",
    imageAlt: "Vista de ChatCRM",
    demoLink: "/chatcrm",
    buttonText: "Explorar ChatCRM",
    accent: "bg-amber-500",
  },
];

const ComingSoonSection = () => {
  return (
    <section id="proximamente" className="chatboc-muted-band py-16 text-foreground md:py-24">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-12 max-w-3xl text-center md:mb-16">
          <div className="chatboc-section-kicker mb-4">Ecosistema</div>
          <h2 className="chatboc-section-heading">Módulos preparados para ampliar la operación</h2>
          <p className="chatboc-section-copy mt-4">
            La plataforma crece con herramientas especializadas, pero mantiene una base común de identidad, tenant,
            conversaciones y contratos.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {futureSolutions.map((solution) => {
            const Icon = solution.icon;
            return (
              <article key={solution.id} className="chatboc-landing-panel chatboc-hover-lift overflow-hidden">
                <div className={`h-1.5 ${solution.accent}`} />
                <div className="grid gap-6 p-5 md:grid-cols-[0.9fr_1.1fr] md:p-6">
                  <div className="flex flex-col">
                    <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-[8px] bg-primary/10 text-primary">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="text-2xl font-bold text-foreground">{solution.title}</h3>
                    <p className="mt-3 flex-1 text-sm leading-6 text-muted-foreground">{solution.description}</p>
                    <Button asChild className="mt-6 w-full rounded-[8px] font-semibold sm:w-fit">
                      <Link to={solution.demoLink}>
                        {solution.buttonText}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>

                  <div className="flex min-h-[180px] items-center justify-center rounded-[8px] border border-border/70 bg-muted/40 p-4">
                    <img
                      src={solution.imageSrc}
                      alt={solution.imageAlt}
                      className="max-h-56 w-full max-w-sm rounded-[8px] object-contain shadow-sm"
                      loading="lazy"
                    />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default ComingSoonSection;
