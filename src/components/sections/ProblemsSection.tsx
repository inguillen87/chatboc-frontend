import React from "react";
import { BarChart3, MessageSquareX, SearchX, Settings2, Store, UsersRound } from "lucide-react";

const problemsData = [
  {
    icon: UsersRound,
    title: "Canales dispersos",
    description:
      "La atención queda repartida entre WhatsApp, web, redes, planillas y llamadas. El equipo pierde contexto y el usuario repite su historia.",
    outcome: "Unifica conversación, historial y próximos pasos en una experiencia consistente.",
  },
  {
    icon: Settings2,
    title: "Configuración difícil de mantener",
    description:
      "Los flujos rígidos envejecen rápido. Cada cambio de trámite, producto o política obliga a tocar reglas y pantallas.",
    outcome: "La UI se adapta al contrato que manda el backend: menús, acciones y estados.",
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
    outcome: "El agente entiende intención, solicita datos y deriva cuando corresponde.",
  },
  {
    icon: BarChart3,
    title: "Operación sin prioridad",
    description:
      "Los equipos ven listas largas, pero no saben qué caso impacta más, qué fuente está caída o qué acción desbloquea valor.",
    outcome: "Action center, SLA, cobertura y alertas ordenan el trabajo diario.",
  },
];

const ProblemsSection = () => {
  return (
    <section id="problemas" className="chatboc-muted-band py-16 text-foreground md:py-24">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-12 max-w-3xl text-center md:mb-16">
          <div className="chatboc-section-kicker mb-4">El problema</div>
          <h2 className="chatboc-section-heading">Lo que frena una operación moderna</h2>
          <p className="chatboc-section-copy mt-4">
            Chatboc está pensado para organizaciones que ya tienen demanda real y necesitan que la experiencia digital acompañe
            al equipo, no que lo obligue a sostener otra herramienta aislada.
          </p>
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
                <div className="mt-5 border-t border-border/70 pt-4 text-sm font-medium text-primary">{problem.outcome}</div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default ProblemsSection;
