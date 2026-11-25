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
      "La atención queda repartida entre WhatsApp, web, redes, planillas y llamadas. El equipo pierde contexto y el usuario repite su historia.",
    outcome: "Conversación, historial y próximos pasos en el mismo hilo.",
  },
  {
    icon: Settings2,
    title: "Configuración difícil de mantener",
    description:
      "Los flujos rígidos envejecen rápido. Cada cambio de trámite, producto o política obliga a tocar reglas y pantallas.",
    outcome: "Cambiás un proceso sin rehacer pantallas.",
  },
  {
    icon: Store,
    title: "Ventas y servicios sin continuidad",
    description:
      "El interés aparece en el chat, pero la compra, la consulta o el ticket quedan en otro sistema y se pierde trazabilidad.",
    outcome: "Chat, tienda, tickets y pagos comparten el mismo historial.",
  },
  {
    icon: SearchX,
    title: "Datos que llegan tarde",
    description:
      "Sin estado actualizado, mapas accionables ni métricas por fuente, los paneles muestran ceros ambiguos o información vieja.",
    outcome: "Métricas y mapas distinguen lo nuevo, lo pendiente y lo resuelto.",
  },
  {
    icon: MessageSquareX,
    title: "Bots que no resuelven",
    description:
      "Un chatbot de guion corta la conversación justo cuando aparece una necesidad real: reclamo, pedido, pago o derivación humana.",
    outcome: "El agente pide datos, registra el contexto y deriva cuando corresponde.",
  },
  {
    icon: BarChart3,
    title: "Operación sin prioridad",
    description:
      "Los equipos ven listas largas, pero no saben qué caso impacta más, qué fuente está caída o qué acción destraba el día.",
    outcome: "Prioridades, tiempos y alertas ordenan el trabajo diario.",
  },
];

const diagnosticRows = [
  { label: "Contexto unificado", value: "la persona no repite todo", tone: "bg-primary" },
  { label: "Próxima acción clara", value: "el equipo sabe qué hacer", tone: "bg-emerald-500" },
  { label: "Resultado medible", value: "caso, pedido, encuesta o consulta", tone: "bg-amber-500" },
];

const flowNodes = ["Entrada", "Entendimiento", "Acción", "Seguimiento"];

const ProblemsSection = () => {
  return (
    <section id="problemas" className="chatboc-muted-band py-16 text-foreground md:py-24">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-10 max-w-3xl text-center md:mb-14">
          <div className="chatboc-section-kicker mb-4">El problema</div>
          <h2 className="chatboc-section-heading">Lo que frena una operación ordenada</h2>
          <p className="chatboc-section-copy mt-4">
            Chatboc está pensado para organizaciones que ya reciben consultas todos los días y necesitan una
            herramienta que acompañe al equipo, no otra planilla aislada para sostener.
          </p>
        </div>

        <div className="chatboc-landing-panel mb-6 grid gap-0 overflow-hidden lg:grid-cols-[0.92fr_1.08fr]">
          <div className="border-b border-border/70 p-5 md:p-7 lg:border-b-0 lg:border-r">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Diagnóstico operativo</p>
                <p className="mt-1 text-sm text-muted-foreground">Primero ordenamos el recorrido; después automatizamos lo que tiene sentido.</p>
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
