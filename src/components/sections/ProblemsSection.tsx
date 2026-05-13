import React from "react";
import {
  Activity,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  MessageSquareX,
  SearchX,
  Settings2,
  Store,
  UsersRound,
} from "lucide-react";

const problemsData = [
  {
    icon: UsersRound,
    title: "Canales dispersos",
    description:
      "La atencion queda repartida entre WhatsApp, web, redes, planillas y llamadas. El equipo pierde contexto y el usuario repite su historia.",
    outcome: "Conversacion, historial y proximos pasos en una experiencia consistente.",
  },
  {
    icon: Settings2,
    title: "Configuracion dificil de mantener",
    description:
      "Los flujos rigidos envejecen rapido. Cada cambio de tramite, producto o politica obliga a tocar reglas y pantallas.",
    outcome: "La experiencia cambia sin rehacer pantallas.",
  },
  {
    icon: Store,
    title: "Ventas y servicios sin continuidad",
    description:
      "El interes aparece en el chat, pero la compra, el lead o el ticket quedan en otro sistema y se pierde trazabilidad.",
    outcome: "Chat, marketplace, tickets y pagos comparten contexto operativo.",
  },
  {
    icon: SearchX,
    title: "Datos que llegan tarde",
    description:
      "Sin estado actualizado, mapas accionables ni metricas por fuente, los paneles muestran ceros ambiguos o informacion vieja.",
    outcome: "Metricas y mapas distinguen lo nuevo, lo pendiente y lo resuelto.",
  },
  {
    icon: MessageSquareX,
    title: "Bots que no resuelven",
    description:
      "Un chatbot de guion corta la conversacion justo cuando aparece una intencion real: reclamo, pedido, pago o derivacion humana.",
    outcome: "El agente solicita datos, registra contexto y deriva cuando corresponde.",
  },
  {
    icon: BarChart3,
    title: "Operacion sin prioridad",
    description:
      "Los equipos ven listas largas, pero no saben que caso impacta mas, que fuente esta caida o que accion desbloquea valor.",
    outcome: "Prioridades, tiempos y alertas ordenan el trabajo diario.",
  },
];

const diagnosticRows = [
  { label: "Contexto unificado", value: "la persona no repite todo", tone: "bg-primary" },
  { label: "Proxima accion clara", value: "el equipo sabe que hacer", tone: "bg-emerald-500" },
  { label: "Resultado medible", value: "caso, pedido, encuesta o lead", tone: "bg-amber-500" },
];

const flowNodes = ["Entrada", "Entendimiento", "Accion", "Seguimiento"];

const ProblemsSection = () => {
  return (
    <section id="problemas" className="chatboc-muted-band py-16 text-foreground md:py-24">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-10 max-w-3xl text-center md:mb-14">
          <div className="chatboc-section-kicker mb-4">El problema</div>
          <h2 className="chatboc-section-heading">Lo que frena una operacion moderna</h2>
          <p className="chatboc-section-copy mt-4">
            Chatboc esta pensado para organizaciones que ya tienen demanda real y necesitan que la experiencia digital acompane
            al equipo, no que lo obligue a sostener otra herramienta aislada.
          </p>
        </div>

        <div className="chatboc-landing-panel mb-6 grid gap-0 overflow-hidden lg:grid-cols-[0.92fr_1.08fr]">
          <div className="border-b border-border/70 p-5 md:p-7 lg:border-b-0 lg:border-r">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Diagnostico operativo</p>
                <p className="mt-1 text-sm text-muted-foreground">Primero ordenamos el recorrido; despues automatizamos lo que tiene sentido.</p>
              </div>
            </div>

            <div className="space-y-4">
              {diagnosticRows.map((row) => (
                <div key={row.label} className="rounded-[8px] border border-border/70 bg-background/70 p-4">
                  <div className="flex items-start gap-3">
                    <span className={`mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full ${row.tone}`} />
                    <div>
                      <p className="text-sm font-semibold text-foreground">{row.label}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{row.value}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-5 md:p-7">
            <div className="mb-5 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Activity className="h-4 w-4 text-primary" />
              Del ruido operativo a un recorrido guiado
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              {flowNodes.map((node, index) => (
                <div key={node} className="relative rounded-[8px] border border-border/70 bg-background/70 p-4">
                  <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-[8px] bg-primary/10 text-sm font-bold text-primary">
                    {index + 1}
                  </div>
                  <p className="text-sm font-semibold text-foreground">{node}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {index === 0
                      ? "Chat, voz, web o WhatsApp."
                      : index === 1
                          ? "Chatboc entiende contexto."
                        : index === 2
                          ? "Ticket, pedido o lead."
                          : "Estado y trazabilidad."}
                  </p>
                  {index < flowNodes.length - 1 ? (
                    <ArrowRight className="absolute -right-3 top-6 hidden h-4 w-4 text-primary/55 sm:block" />
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {problemsData.map((problem) => {
            const Icon = problem.icon;
            return (
              <article key={problem.title} className="chatboc-landing-panel chatboc-hover-lift flex h-full flex-col p-5 md:p-6">
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-[8px] bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">{problem.title}</h3>
                <p className="mt-3 flex-1 text-sm leading-6 text-muted-foreground">{problem.description}</p>
                <div className="mt-5 flex items-start gap-2 border-t border-border/70 pt-4 text-sm font-medium text-primary">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>{problem.outcome}</span>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default ProblemsSection;
