import React from "react";
import { BarChart3, Clock, MessageSquareText, Route, ShieldCheck, UsersRound } from "lucide-react";

const valueSignals = [
  {
    icon: MessageSquareText,
    title: "Conversaciones con contexto",
    detail: "Cada mensaje puede conservar canal, motivo, adjuntos, ubicacion y proxima accion.",
  },
  {
    icon: Route,
    title: "Recorridos accionables",
    detail: "La persona no queda en un menu sin salida: puede avanzar a reclamo, pedido, encuesta o derivacion.",
  },
  {
    icon: BarChart3,
    title: "Resultados medibles",
    detail: "Encuestas, votaciones, comentarios, leads, pedidos y casos alimentan paneles operativos.",
  },
  {
    icon: UsersRound,
    title: "Equipo mejor informado",
    detail: "Cuando interviene una persona, recibe historial y datos utiles para resolver sin empezar de cero.",
  },
  {
    icon: Clock,
    title: "Seguimiento visible",
    detail: "El usuario puede consultar estado y el equipo ve prioridades, tiempos y pendientes.",
  },
  {
    icon: ShieldCheck,
    title: "Implementacion acompanada",
    detail: "Chatboc ayuda a ordenar procesos, menus, permisos y contenidos antes de automatizar.",
  },
];

const TestimonialsSection = () => {
  return (
    <section id="senales-valor" className="bg-background py-16 text-foreground md:py-24">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-12 max-w-3xl text-center md:mb-16">
          <div className="chatboc-section-kicker mb-4">Senales de valor</div>
          <h2 className="chatboc-section-heading">Lo que una primera demo tiene que dejar claro</h2>
          <p className="chatboc-section-copy mt-4">
            Chatboc se vende mejor cuando la persona ve que cada conversacion puede transformarse en trabajo real:
            datos, seguimiento, decision y accion para el equipo.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {valueSignals.map((signal) => {
            const Icon = signal.icon;
            return (
              <article key={signal.title} className="chatboc-landing-panel chatboc-hover-lift p-5 md:p-6">
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-[8px] bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">{signal.title}</h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{signal.detail}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
