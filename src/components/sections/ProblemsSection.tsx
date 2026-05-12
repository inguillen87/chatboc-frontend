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
    outcome: "Conversación, historial y próximos pasos en una experiencia consistente.",
  },
  {
    icon: Settings2,
    title: "Configuración difícil de mantener",
    description:
      "Los flujos rígidos envejecen rápido. Cada cambio de trámite, producto o política obliga a tocar reglas y pantallas.",
    outcome: "La UI se adapta al contrato que manda el backend.",
  },
  {
    icon: Store,
    title: "Ventas y servicios sin continuidad",
    description:
      "El interés aparece en el chat, pero la compra, el lead o el ticket quedan en otro sistema y se pierde trazabilidad.",
    outcome: "Chat, marketplace, tickets y pagos comparten contexto operativo.",
  },
  {
    icon: SearchX,
    title: "Datos que llegan tarde",
    description:
      "Sin freshness, mapas accionables ni métricas por fuente, los paneles muestran ceros ambiguos o información vieja.",
    outcome: "Analytics y mapas distinguen datos frescos, degradados o vacíos.",
  },
  {
    icon: MessageSquareX,
    title: "Bots que no resuelven",
    description:
      "Un chatbot de guion corta la conversación justo cuando aparece una intención real: reclamo, pedido, pago o derivación humana.",
    outcome: "El agente solicita datos, registra contexto y deriva cuando corresponde.",
  },
  {
    icon: BarChart3,
    title: "Operación sin prioridad",
    description:
      "Los equipos ven listas largas, pero no saben qué caso impacta más, qué fuente está caída o qué acción desbloquea valor.",
    outcome: "Action center, SLA, cobertura y alertas ordenan el trabajo diario.",
  },
];

const diagnosticRows = [
  { label: "Contexto recuperado", value: "82%", width: "82%", tone: "bg-primary" },
  { label: "Casos con próxima acción", value: "68%", width: "68%", tone: "bg-emerald-500" },
  { label: "Riesgo operativo visible", value: "41%", width: "41%", tone: "bg-amber-500" },
];

const flowNodes = ["Entrada", "Contrato", "Acción", "Seguimiento"];

const ProblemsSection = () => {
  return (
    <section id="problemas" className="chatboc-muted-band py-16 text-foreground md:py-24">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-10 max-w-3xl text-center md:mb-14">
          <div className="chatboc-section-kicker mb-4">El problema</div>
          <h2 className="chatboc-section-heading">Lo que frena una operación moderna</h2>
          <p className="chatboc-section-copy mt-4">
            Chatboc está pensado para organizaciones que ya tienen demanda real y necesitan que la experiencia digital acompañe
            al equipo, no que lo obligue a sostener otra herramienta aislada.
          </p>
        </div>

        <div className="chatboc-landing-panel mb-6 grid gap-0 overflow-hidden lg:grid-cols-[0.92fr_1.08fr]">
          <div className="border-b border-border/70 p-5 md:p-7 lg:border-b-0 lg:border-r">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Diagnóstico operativo</p>
                <p className="mt-1 text-sm text-muted-foreground">Dónde se pierde velocidad antes de automatizar.</p>
              </div>
              <div className="rounded-[8px] border border-border/70 bg-background/70 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                before / after
              </div>
            </div>

            <div className="space-y-4">
              {diagnosticRows.map((row) => (
                <div key={row.label} className="rounded-[8px] border border-border/70 bg-background/70 p-4">
                  <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                    <span className="font-semibold text-foreground">{row.label}</span>
                    <span className="text-muted-foreground">{row.value}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <span className={`chatboc-meter block h-full rounded-full ${row.tone}`} style={{ width: row.width }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-5 md:p-7">
            <div className="mb-5 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Activity className="h-4 w-4 text-primary" />
              Del ruido operativo a un viaje guiado
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
                        ? "Backend define opciones."
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
