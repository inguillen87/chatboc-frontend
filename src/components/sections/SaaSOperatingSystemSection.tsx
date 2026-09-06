import React from "react";
import { BarChart3, Inbox, Route } from "lucide-react";

const operatingFlow = [
  {
    icon: Inbox,
    title: "Recibir",
    description: "Centraliza consultas y archivos desde los canales que la organización haya habilitado.",
    scope: "WhatsApp · Web · Voz",
  },
  {
    icon: Route,
    title: "Resolver",
    description: "Conserva el contexto para responder, crear un caso, registrar un pedido o derivar al equipo.",
    scope: "Respuesta · Caso · Pedido",
  },
  {
    icon: BarChart3,
    title: "Medir",
    description: "Ordena estados y actividad para que cada gestión pueda seguirse de principio a fin.",
    scope: "Estado · Historial · Prioridad",
  },
];

const SaaSOperatingSystemSection = () => {
  return (
    <section
      id="sistema-operativo"
      aria-labelledby="operating-system-title"
      className="scroll-mt-24 border-y border-border/60 bg-background py-14 text-foreground md:py-20"
    >
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr] lg:items-end lg:gap-12">
            <div>
              <div className="chatboc-section-kicker mb-4">Operación conectada</div>
              <h2 id="operating-system-title" className="chatboc-section-heading max-w-xl">
                Recibir, resolver y medir en un mismo flujo
              </h2>
            </div>
            <p className="chatboc-section-copy max-w-2xl lg:pb-1">
              Chatboc conecta la atención con el trabajo del equipo y mantiene el contexto disponible durante todo el
              recorrido.
            </p>
          </div>

          <ol className="mt-9 grid overflow-hidden rounded-[12px] border border-border bg-card shadow-sm lg:grid-cols-3">
            {operatingFlow.map((step, index) => {
              const Icon = step.icon;
              return (
                <li
                  key={step.title}
                  className="relative border-b border-border p-5 last:border-b-0 sm:p-6 lg:border-b-0 lg:border-r lg:p-7 lg:last:border-r-0"
                >
                  <div className="mb-7 flex items-center justify-between gap-4">
                    <span className="text-xs font-semibold tabular-nums text-primary" aria-hidden="true">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="flex h-10 w-10 items-center justify-center rounded-[8px] border border-border bg-muted/40 text-primary">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                  </div>
                  <h3 className="text-xl font-semibold tracking-tight text-foreground">{step.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{step.description}</p>
                  <p className="mt-6 border-t border-border/70 pt-4 text-xs font-semibold uppercase tracking-[0.08em] text-foreground/70">
                    {step.scope}
                  </p>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
};

export default SaaSOperatingSystemSection;
