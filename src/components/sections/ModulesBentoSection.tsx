import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  BarChart3,
  ClipboardCheck,
  Globe,
  ListChecks,
  MessageCircle,
  MessageSquare,
  Mic,
  Users,
} from "lucide-react";

const BENTO_MODULES = [
  {
    id: "widget",
    title: "Widget web marca blanca",
    eyebrow: "Canal web",
    description:
      "Embebido en cualquier sitio o portal con tus colores, tipografía, burbujas, accesibilidad AA y mascota animada.",
    icon: MessageSquare,
    span: "lg:col-span-5",
    pills: ["Claro y oscuro", "Accesibilidad AA", "Mascota SVG"],
    visual: "widget" as const,
  },
  {
    id: "whatsapp",
    title: "WhatsApp operativo",
    eyebrow: "Mensajería oficial",
    description:
      "Recibe texto, audios, fotos y ubicación en el mismo hilo, con continuidad hacia tu equipo cuando hace falta.",
    icon: MessageCircle,
    span: "lg:col-span-4",
    pills: ["Adjuntos y GPS", "Plantillas"],
    visual: "whatsapp" as const,
  },
  {
    id: "voz",
    title: "Voz y audio accesible",
    eyebrow: "Multimodal",
    description:
      "Interacciones por voz y lectura en audio con transcripción y contexto compartido en el CRM.",
    icon: Mic,
    span: "lg:col-span-3",
    pills: ["Audio en vivo", "Lectura accesible"],
    visual: "voice" as const,
  },
  {
    id: "reclamos",
    title: "Reclamos con seguimiento",
    eyebrow: "Gestión de casos",
    description:
      "Abre tickets con evidencia, asigna áreas responsables, controla plazos y notifica cada avance.",
    icon: ClipboardCheck,
    span: "lg:col-span-4",
    pills: ["Estados trazables", "Mapa y fotos"],
    visual: "tickets" as const,
  },
  {
    id: "encuestas",
    title: "Encuestas y participación",
    eyebrow: "Escucha activa",
    description:
      "Publica consultas y encuestas conversacionales con respuestas ordenadas y lectura inmediata por tema.",
    icon: ListChecks,
    span: "lg:col-span-4",
    pills: ["Resultados en vivo", "Portal público"],
    visual: "surveys" as const,
  },
  {
    id: "crm",
    title: "CRM, catálogo y portal",
    eyebrow: "Operación unificada",
    description:
      "Centraliza conversaciones, pedidos, responsables y un portal público propio con la identidad de la organización.",
    icon: Users,
    span: "lg:col-span-4",
    pills: ["Derivación humana", "Catálogo"],
    visual: "crm" as const,
  },
  {
    id: "estadisticas",
    title: "Estadísticas y tablero operativo",
    eyebrow: "Decisión con datos",
    description:
      "Mide demanda por canal, tiempos de respuesta, temas más consultados y resolución por equipo desde un panel claro.",
    icon: BarChart3,
    span: "lg:col-span-12",
    pills: ["7 módulos conectados", "Exportación", "Lectura por canal y área"],
    visual: "analytics" as const,
  },
];

const ModuleMiniVisual = ({
  kind,
  reduceMotion,
}: {
  kind: (typeof BENTO_MODULES)[number]["visual"];
  reduceMotion: boolean;
}) => {
  if (kind === "widget") {
    return (
      <div className="mt-5 rounded-[12px] border border-border/70 bg-background/80 p-3" aria-hidden="true">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-primary" />
            <span className="h-2 w-24 rounded-full bg-foreground/20" />
          </div>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-blue-800 dark:text-primary">
            En vivo
          </span>
        </div>
        <div className="mt-3 space-y-2">
          <div className="ml-auto h-5 w-3/5 rounded-2xl rounded-br-sm bg-primary/85" />
          <div className="h-6 w-4/5 rounded-2xl rounded-bl-sm border border-border bg-card" />
        </div>
      </div>
    );
  }

  if (kind === "voice") {
    const heights = [12, 24, 18, 30, 14, 26, 16];
    return (
      <div className="mt-5 flex h-14 items-center justify-center gap-1.5 rounded-[12px] border border-border/70 bg-background/80 px-3" aria-hidden="true">
        {heights.map((height, idx) => (
          <span
            key={idx}
            className="w-1.5 rounded-full bg-primary/75 transition-transform duration-300 group-hover:scale-y-125"
            style={{
              height: `${height}px`,
              transitionDelay: reduceMotion ? "0ms" : `${idx * 30}ms`,
            }}
          />
        ))}
      </div>
    );
  }

  if (kind === "tickets") {
    return (
      <div className="mt-5 flex items-center gap-2 rounded-[12px] border border-border/70 bg-background/80 p-3 text-[11px] font-semibold" aria-hidden="true">
        <span className="rounded-md bg-amber-500/15 px-2 py-1 text-amber-800 dark:text-amber-300">Ingresado</span>
        <span className="h-px flex-1 bg-border" />
        <span className="rounded-md bg-primary/15 px-2 py-1 text-blue-800 dark:text-primary">En curso</span>
        <span className="h-px flex-1 bg-border" />
        <span className="rounded-md bg-emerald-500/15 px-2 py-1 text-emerald-800 dark:text-emerald-300">Resuelto</span>
      </div>
    );
  }

  if (kind === "surveys") {
    return (
      <div className="mt-5 space-y-2 rounded-[12px] border border-border/70 bg-background/80 p-3" aria-hidden="true">
        {[78, 52, 34].map((width, idx) => (
          <div key={idx} className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary/80 transition-all duration-500 group-hover:brightness-110"
              style={{ width: `${width}%` }}
            />
          </div>
        ))}
      </div>
    );
  }

  if (kind === "analytics") {
    const bars = [38, 56, 48, 72, 64, 88, 76, 94];
    return (
      <div className="grid gap-4 rounded-[14px] border border-border/70 bg-background/80 p-4 sm:grid-cols-[1fr_auto] sm:items-end" aria-hidden="true">
        <div className="flex h-20 items-end gap-2">
          {bars.map((pct, idx) => (
            <div key={idx} className="flex flex-1 flex-col items-center justify-end h-full">
              <div
                className="w-full rounded-t-[6px] bg-gradient-to-t from-primary/70 to-sky-400/90 transition-transform duration-300 group-hover:scale-y-105"
                style={{ height: `${pct}%`, transformOrigin: "bottom" }}
              />
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 sm:flex-col sm:items-end">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-semibold text-foreground">
            <Globe className="h-3.5 w-3.5 text-primary" />
            Portal + Widget + WhatsApp
          </span>
          <span className="text-xs text-slate-600 dark:text-muted-foreground">Seguimiento unificado en un solo tablero</span>
        </div>
      </div>
    );
  }

  return null;
};

const ModulesBentoSection = () => {
  const reduceMotion = Boolean(useReducedMotion());
  const canAnimateInView = !reduceMotion && typeof IntersectionObserver !== "undefined";

  return (
    <section
      aria-labelledby="modules-bento-title"
      className="relative bg-background py-20 text-foreground md:py-28"
    >
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <div className="chatboc-section-kicker mb-4">7 módulos integrados</div>
              <h2 id="modules-bento-title" className="chatboc-section-heading text-balance">
                Todo lo que necesita tu operación, conectado desde el primer día
              </h2>
            </div>
            <p className="chatboc-section-copy max-w-md">
              Activá los módulos que tu equipo necesita: cada conversación conserva historial, datos y seguimiento sin
              saltar entre planillas.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-12">
            {BENTO_MODULES.map((mod, index) => {
              const Icon = mod.icon;
              const isBanner = mod.id === "estadisticas";
              return (
                <motion.article
                  key={mod.id}
                  initial={canAnimateInView ? { opacity: 0.96, y: 18 } : false}
                  whileInView={canAnimateInView ? { opacity: 1, y: 0 } : undefined}
                  viewport={canAnimateInView ? { once: true, amount: 0.2 } : undefined}
                  transition={{
                    duration: canAnimateInView ? 0.42 : 0,
                    delay: canAnimateInView ? Math.min(index * 0.05, 0.25) : 0,
                    ease: "easeOut",
                  }}
                  className={`group relative flex flex-col justify-between overflow-hidden rounded-[18px] border border-border/80 bg-card/95 p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_22px_55px_rgba(15,23,42,0.11)] dark:hover:shadow-[0_22px_55px_rgba(0,0,0,0.42)] sm:p-6 ${mod.span} ${
                    isBanner ? "lg:grid lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-8" : ""
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex h-11 w-11 items-center justify-center rounded-[12px] border border-primary/15 bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-105">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600 dark:text-muted-foreground">
                        {mod.eyebrow}
                      </span>
                    </div>

                    <h3 className="mt-4 text-lg font-bold leading-snug text-foreground">{mod.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-muted-foreground">{mod.description}</p>

                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {mod.pills.map((pill) => (
                        <span
                          key={pill}
                          className="rounded-full border border-border/75 bg-muted/40 px-2.5 py-0.5 text-[11px] font-medium text-foreground/85"
                        >
                          {pill}
                        </span>
                      ))}
                    </div>
                  </div>

                  {mod.visual ? (
                    <div className={isBanner ? "mt-5 lg:mt-0" : ""}>
                      <ModuleMiniVisual kind={mod.visual} reduceMotion={reduceMotion} />
                    </div>
                  ) : null}
                </motion.article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default ModulesBentoSection;
