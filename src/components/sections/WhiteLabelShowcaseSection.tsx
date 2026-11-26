import React, { useEffect, useId, useState } from "react";
import { Send } from "lucide-react";

import BrandBotAvatar, { type BrandBotState } from "@/components/chat/BrandBotAvatar";

type BubbleShape = "globa" | "capsule" | "editorial" | "card";

interface DemoBrandIdentity {
  id: string;
  name: string;
  sector: string;
  tagline: string;
  domain: string;
  assistantName: string;
  palette: [string, string, string, string];
  gradientStops: Array<{ color: string; x: number; y: number }>;
  accentBg: string;
  accentText: string;
  chipBorder: string;
  typography: {
    label: string;
    specimen: string;
    fontFamily: string;
    headingFamily: string;
    letterSpacing: string;
  };
  bubbleStyle: {
    kind: BubbleShape;
    label: string;
    detail: string;
  };
  conversation: {
    userMessage: string;
    botReply: string;
    options: Array<{ label: string; followUp: string }>;
    statusLabel: string;
  };
}

const DEMO_IDENTITIES: DemoBrandIdentity[] = [
  {
    id: "municipio-demo",
    name: "Municipio Demo",
    sector: "Gobierno local",
    tagline: "Atención ciudadana, trámites y reclamos con identidad institucional.",
    domain: "portal.municipio-demo.gob",
    assistantName: "Asistente ciudadano",
    palette: ["#0F766E", "#0284C7", "#10B981", "#38BDF8"],
    gradientStops: [
      { color: "#0F766E", x: 0.16, y: 0.18 },
      { color: "#0284C7", x: 0.86, y: 0.14 },
      { color: "#38BDF8", x: 0.18, y: 0.86 },
      { color: "#10B981", x: 0.84, y: 0.84 },
    ],
    accentBg: "#0F766E",
    accentText: "#FFFFFF",
    chipBorder: "rgba(15, 118, 110, 0.35)",
    typography: {
      label: "Geométrica institucional",
      specimen: "Interletra ajustada, Bold y Regular",
      fontFamily: '"Plus Jakarta Sans", "Inter", system-ui, -apple-system, sans-serif',
      headingFamily: '"Plus Jakarta Sans", "Inter", system-ui, -apple-system, sans-serif',
      letterSpacing: "-0.02em",
    },
    bubbleStyle: {
      kind: "globa",
      label: "Globa con colita",
      detail: "Puntas amplias y colita inferior izquierda",
    },
    conversation: {
      userMessage: "Hola, quiero reportar una luminaria apagada en mi cuadra.",
      botReply:
        "Recibido. Abrí el reclamo y lo asigné a Alumbrado Público. Podés seguir cada cambio desde el portal.",
      options: [
        {
          label: "Compartir ubicación",
          followUp: "Ubicación asociada al reclamo #4082. Te avisamos cuando la cuadrilla tome el caso.",
        },
        {
          label: "Ver estado",
          followUp: "Estado actual: en evaluación. Área asignada: Servicios Urbanos.",
        },
      ],
      statusLabel: "Reclamo con seguimiento en portal público",
    },
  },
  {
    id: "clinica-demo",
    name: "Clínica Demo",
    sector: "Salud y turnos",
    tagline: "Turnos, preparaciones de estudios y recordatorios por web y WhatsApp.",
    domain: "turnos.clinica-demo.salud",
    assistantName: "Guía de turnos",
    palette: ["#1D4ED8", "#06B6D4", "#6366F1", "#14B8A6"],
    gradientStops: [
      { color: "#1D4ED8", x: 0.14, y: 0.2 },
      { color: "#06B6D4", x: 0.88, y: 0.18 },
      { color: "#14B8A6", x: 0.2, y: 0.86 },
      { color: "#6366F1", x: 0.84, y: 0.82 },
    ],
    accentBg: "#1D4ED8",
    accentText: "#FFFFFF",
    chipBorder: "rgba(29, 78, 216, 0.35)",
    typography: {
      label: "Neo-grotesk clínica",
      specimen: "Lectura clara, escala serena",
      fontFamily: '"Inter", system-ui, -apple-system, "Segoe UI", sans-serif',
      headingFamily: '"Inter", system-ui, -apple-system, "Segoe UI", sans-serif',
      letterSpacing: "-0.008em",
    },
    bubbleStyle: {
      kind: "capsule",
      label: "Cápsula orgánica",
      detail: "Bordes redondeados y lectura aireada",
    },
    conversation: {
      userMessage: "Necesito sacar un turno de cardiología para la próxima semana.",
      botReply:
        "Hay horarios disponibles martes 10:30 y jueves 16:00. Elegí uno para confirmar y recibir las indicaciones.",
      options: [
        {
          label: "Martes 10:30",
          followUp: "Turno reservado para el martes 10:30. Enviamos confirmación y recordatorio.",
        },
        {
          label: "Jueves 16:00",
          followUp: "Turno reservado para el jueves 16:00. Podés reprogramar desde este mismo chat.",
        },
      ],
      statusLabel: "Agenda conectada con recordatorio",
    },
  },
  {
    id: "comercio-demo",
    name: "Comercio Demo",
    sector: "Retail y catálogo",
    tagline: "Catálogo interactivo, consultas de stock y pedidos en un solo hilo.",
    domain: "tienda.comercio-demo.shop",
    assistantName: "Asistente de ventas",
    palette: ["#C2410C", "#E11D48", "#D97706", "#FB7185"],
    gradientStops: [
      { color: "#C2410C", x: 0.16, y: 0.16 },
      { color: "#E11D48", x: 0.86, y: 0.18 },
      { color: "#D97706", x: 0.18, y: 0.84 },
      { color: "#FB7185", x: 0.84, y: 0.86 },
    ],
    accentBg: "#C2410C",
    accentText: "#FFFFFF",
    chipBorder: "rgba(194, 65, 12, 0.35)",
    typography: {
      label: "Editorial comercial",
      specimen: "Titulares con serif, cuerpo limpio",
      fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
      headingFamily: 'Georgia, Cambria, "Times New Roman", serif',
      letterSpacing: "0em",
    },
    bubbleStyle: {
      kind: "editorial",
      label: "Bloque editorial",
      detail: "Esquinas firmes con filete lateral de marca",
    },
    conversation: {
      userMessage: "¿Tienen stock del pack mayorista con envío a domicilio?",
      botReply:
        "Sí, está disponible para despacho hoy. Te armé el resumen del pedido con medios de pago y envío.",
      options: [
        {
          label: "Confirmar pedido",
          followUp: "Pedido prearmado en el CRM comercial. Te compartimos el enlace de seguimiento.",
        },
        {
          label: "Ver catálogo",
          followUp: "Abrimos el catálogo filtrado por packs mayoristas con stock inmediato.",
        },
      ],
      statusLabel: "Catálogo y carrito en CRM comercial",
    },
  },
  {
    id: "instituto-demo",
    name: "Instituto Demo",
    sector: "Educación y familias",
    tagline: "Consultas de familias, certificados y comunicación escolar ordenada.",
    domain: "familias.instituto-demo.edu",
    assistantName: "Secretaría virtual",
    palette: ["#6D28D9", "#4F46E5", "#DB2777", "#8B5CF6"],
    gradientStops: [
      { color: "#6D28D9", x: 0.18, y: 0.16 },
      { color: "#4F46E5", x: 0.86, y: 0.2 },
      { color: "#8B5CF6", x: 0.16, y: 0.85 },
      { color: "#DB2777", x: 0.82, y: 0.84 },
    ],
    accentBg: "#6D28D9",
    accentText: "#FFFFFF",
    chipBorder: "rgba(109, 40, 217, 0.35)",
    typography: {
      label: "Académica estructurada",
      specimen: "Metadatos técnicos, títulos nítidos",
      fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
      headingFamily: 'ui-monospace, "Cascadia Code", "SFMono-Regular", Menlo, monospace',
      letterSpacing: "-0.015em",
    },
    bubbleStyle: {
      kind: "card",
      label: "Ficha definida",
      detail: "Contorno fino y jerarquía clara",
    },
    conversation: {
      userMessage: "Necesito el certificado de alumno regular para presentar mañana.",
      botReply:
        "Validé la solicitud y dejé la gestión lista con Secretaría. Elegí cómo querés recibirlo.",
      options: [
        {
          label: "Descargar constancia",
          followUp: "Constancia generada y archivada en el historial familiar con fecha de emisión.",
        },
        {
          label: "Hablar con secretaría",
          followUp: "Derivamos el hilo al equipo escolar conservando todo el contexto.",
        },
      ],
      statusLabel: "Gestión escolar con derivación humana",
    },
  },
];

const BOT_STATES: Array<{ value: BrandBotState; label: string }> = [
  { value: "idle", label: "Reposo" },
  { value: "listening", label: "Escuchando" },
  { value: "thinking", label: "Pensando" },
  { value: "speaking", label: "Hablando" },
];

const usePrefersReducedMotion = () => {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  return reduced;
};

const getBotBubbleClasses = (kind: BubbleShape) => {
  switch (kind) {
    case "globa":
      return "rounded-[12px] rounded-bl-[4px] border border-border bg-background";
    case "capsule":
      return "rounded-[20px] border border-border bg-muted/40";
    case "editorial":
      return "rounded-[8px] border border-border border-l-[3px] bg-background";
    case "card":
      return "rounded-[12px] rounded-tl-[4px] border border-border bg-card";
  }
};

const getUserBubbleClasses = (kind: BubbleShape) => {
  switch (kind) {
    case "globa":
      return "rounded-[12px] rounded-br-[4px]";
    case "capsule":
      return "rounded-[20px]";
    case "editorial":
      return "rounded-[8px]";
    case "card":
      return "rounded-[12px] rounded-tr-[4px]";
  }
};

const WhiteLabelShowcaseSection = () => {
  const reduceMotion = usePrefersReducedMotion();
  const tabBaseId = useId().replace(/:/g, "");
  const [selectedId, setSelectedId] = useState<string>(DEMO_IDENTITIES[0].id);
  const [botState, setBotState] = useState<BrandBotState>("idle");
  const [selectedFollowUp, setSelectedFollowUp] = useState<string | null>(null);

  const active = DEMO_IDENTITIES.find((item) => item.id === selectedId) ?? DEMO_IDENTITIES[0];
  const activeIndex = DEMO_IDENTITIES.findIndex((item) => item.id === active.id);
  const panelId = `${tabBaseId}-panel`;

  const selectBrand = (nextId: string, focusIndex?: number) => {
    setSelectedId(nextId);
    setSelectedFollowUp(null);
    if (typeof focusIndex === "number") {
      document.getElementById(`${tabBaseId}-tab-${focusIndex}`)?.focus();
    }
  };

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (index + 1) % DEMO_IDENTITIES.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (index - 1 + DEMO_IDENTITIES.length) % DEMO_IDENTITIES.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = DEMO_IDENTITIES.length - 1;
    }
    if (nextIndex === null) return;
    event.preventDefault();
    selectBrand(DEMO_IDENTITIES[nextIndex].id, nextIndex);
  };

  return (
    <section
      id="marca-blanca"
      aria-labelledby="whitelabel-title"
      className="border-y border-border bg-muted/20 py-20 text-foreground dark:bg-muted/10 md:py-28"
    >
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-3xl">
            <div className="chatboc-section-kicker mb-4">Marca blanca</div>
            <h2 id="whitelabel-title" className="chatboc-section-heading text-balance">
              Un mismo motor, la identidad exacta de cada organización
            </h2>
            <p className="chatboc-section-copy mt-4 max-w-2xl">
              Cambiá de ejemplo para ver cómo el widget adopta colores, tipografía, burbujas y mascota sin escribir
              código.
            </p>
          </div>

          <div
            className="mt-10 grid grid-cols-2 border-b border-border sm:grid-cols-4"
            role="tablist"
            aria-label="Identidades marca blanca de demostración"
          >
            {DEMO_IDENTITIES.map((brand, index) => {
              const isSelected = brand.id === active.id;
              return (
                <button
                  key={brand.id}
                  id={`${tabBaseId}-tab-${index}`}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  aria-controls={panelId}
                  tabIndex={isSelected ? 0 : -1}
                  onClick={() => selectBrand(brand.id)}
                  onKeyDown={(event) => handleTabKeyDown(event, index)}
                  className={`relative -mb-px flex flex-col items-start border-b-2 px-3 py-4 text-left transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:px-4 ${
                    isSelected
                      ? "border-foreground text-foreground"
                      : "border-transparent text-slate-600 hover:border-border hover:text-foreground dark:text-muted-foreground"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: brand.accentBg }}
                      aria-hidden="true"
                    />
                    <span className="truncate text-sm font-semibold text-foreground">{brand.name}</span>
                  </span>
                  <span className="mt-1 truncate pl-4 text-xs text-slate-600 dark:text-muted-foreground">
                    {brand.sector}
                  </span>
                </button>
              );
            })}
          </div>

          <div
            id={panelId}
            role="tabpanel"
            aria-labelledby={`${tabBaseId}-tab-${activeIndex}`}
            className="mt-10 grid items-start gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:gap-14"
          >
            {/* Left column: editorial specification list */}
            <div>
              <div className="pb-6">
                <h3 className="chatboc-display text-2xl font-semibold text-foreground">{active.name}</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-muted-foreground">{active.domain}</p>
                <p className="mt-3 max-w-lg text-base leading-7 text-slate-600 dark:text-muted-foreground">
                  {active.tagline}
                </p>
              </div>

              <dl className="divide-y divide-border border-y border-border">
                <div className="grid gap-2 py-4 sm:grid-cols-[8.5rem_1fr] sm:items-center sm:gap-5">
                  <dt className="text-sm font-medium text-slate-600 dark:text-muted-foreground">Paleta activa</dt>
                  <dd className="flex flex-wrap items-center gap-3">
                    {active.palette.map((color) => (
                      <div key={color} className="flex items-center gap-1.5">
                        <span
                          className="h-6 w-6 rounded-[8px] border border-black/10 dark:border-white/15"
                          style={{ backgroundColor: color }}
                          title={color}
                          aria-hidden="true"
                        />
                        <span className="font-mono text-xs text-slate-600 dark:text-muted-foreground">{color}</span>
                      </div>
                    ))}
                  </dd>
                </div>

                <div className="grid gap-2 py-4 sm:grid-cols-[8.5rem_1fr] sm:items-baseline sm:gap-5">
                  <dt className="text-sm font-medium text-slate-600 dark:text-muted-foreground">Tipografía</dt>
                  <dd className="flex items-baseline gap-3">
                    <span
                      className="text-2xl font-bold leading-none text-foreground"
                      style={{
                        fontFamily: active.typography.headingFamily,
                        letterSpacing: active.typography.letterSpacing,
                      }}
                    >
                      Aa
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{active.typography.label}</p>
                      <p className="text-xs text-slate-600 dark:text-muted-foreground">{active.typography.specimen}</p>
                    </div>
                  </dd>
                </div>

                <div className="grid gap-2 py-4 sm:grid-cols-[8.5rem_1fr] sm:items-baseline sm:gap-5">
                  <dt className="text-sm font-medium text-slate-600 dark:text-muted-foreground">Forma de burbuja</dt>
                  <dd>
                    <p className="text-sm font-semibold text-foreground">{active.bubbleStyle.label}</p>
                    <p className="text-xs text-slate-600 dark:text-muted-foreground">{active.bubbleStyle.detail}</p>
                  </dd>
                </div>

                <div className="grid gap-2 py-4 sm:grid-cols-[8.5rem_1fr] sm:items-center sm:gap-5">
                  <dt className="text-sm font-medium text-slate-600 dark:text-muted-foreground">
                    Estado de la mascota
                  </dt>
                  <dd>
                    <div
                      className="flex flex-wrap gap-1.5"
                      role="group"
                      aria-label="Probar estados de la mascota animada"
                    >
                      {BOT_STATES.map((item) => {
                        const pressed = botState === item.value;
                        return (
                          <button
                            key={item.value}
                            type="button"
                            aria-pressed={pressed}
                            onClick={() => setBotState(item.value)}
                            className={`rounded-[8px] border px-2.5 py-1.5 text-xs font-semibold transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                              pressed
                                ? "border-transparent"
                                : "border-border bg-card text-foreground hover:border-foreground/40"
                            }`}
                            style={pressed ? { backgroundColor: active.accentBg, color: active.accentText } : undefined}
                          >
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                  </dd>
                </div>
              </dl>

              <p className="mt-4 text-xs leading-5 text-slate-600 dark:text-muted-foreground">
                Cabecera con contraste AA, mascota generada desde tu paleta y soporte para claro, oscuro y movimiento
                reducido.
              </p>
            </div>

            {/* Right column: floating widget mockup */}
            <div className="relative mx-auto w-full max-w-[460px] lg:max-w-none">
              <div
                key={active.id}
                data-testid="whitelabel-widget-preview"
                data-brand-id={active.id}
                data-bubble-style={active.bubbleStyle.kind}
                className="overflow-hidden rounded-[12px] border border-border bg-card shadow-[0_14px_36px_rgba(15,23,42,0.10)] dark:shadow-[0_14px_36px_rgba(0,0,0,0.42)]"
                style={{
                  fontFamily: active.typography.fontFamily,
                  letterSpacing: active.typography.letterSpacing,
                }}
              >
                {/* Brand header */}
                <div
                  className="flex items-center justify-between gap-3 px-4 py-4 sm:px-5"
                  style={{ backgroundColor: active.accentBg, color: active.accentText }}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[8px] bg-black/20">
                      <BrandBotAvatar
                        palette={active.palette}
                        gradientStops={active.gradientStops}
                        state={botState}
                        size={36}
                        title={`Mascota de ${active.name}`}
                        reducedMotion={reduceMotion}
                      />
                    </div>
                    <div className="min-w-0">
                      <p
                        className="truncate text-base font-bold leading-snug text-white"
                        style={{ fontFamily: active.typography.headingFamily }}
                      >
                        {active.assistantName}
                      </p>
                      <p className="truncate text-xs font-medium text-white/90">{active.name}, en línea</p>
                    </div>
                  </div>
                  <span className="shrink-0 text-xs font-medium text-white/90">{active.sector}</span>
                </div>

                {/* Conversation body */}
                <div className="space-y-4 bg-background/70 p-4 sm:p-5">
                  <div className="flex justify-end">
                    <div
                      className={`max-w-[84%] px-4 py-2.5 text-sm font-medium leading-6 ${getUserBubbleClasses(active.bubbleStyle.kind)}`}
                      style={{ backgroundColor: active.accentBg, color: active.accentText }}
                    >
                      {active.conversation.userMessage}
                    </div>
                  </div>

                  <div className="flex items-end gap-2.5">
                    <div className="shrink-0 pb-0.5">
                      <BrandBotAvatar
                        palette={active.palette}
                        gradientStops={active.gradientStops}
                        state={botState}
                        size={30}
                        reducedMotion={reduceMotion}
                        still
                      />
                    </div>
                    <div className="min-w-0 flex-1 space-y-2.5">
                      <div
                        className={`relative px-4 py-3 text-sm leading-6 text-foreground ${getBotBubbleClasses(active.bubbleStyle.kind)}`}
                        style={
                          active.bubbleStyle.kind === "editorial"
                            ? { borderLeftColor: active.accentBg }
                            : undefined
                        }
                      >
                        {active.conversation.botReply}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {active.conversation.options.map((opt) => {
                          const isPicked = selectedFollowUp === opt.followUp;
                          return (
                            <button
                              key={opt.label}
                              type="button"
                              onClick={() => {
                                setSelectedFollowUp(opt.followUp);
                                setBotState("speaking");
                              }}
                              className="rounded-[8px] border px-3 py-1.5 text-xs font-semibold transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                              style={
                                isPicked
                                  ? {
                                      backgroundColor: active.accentBg,
                                      color: active.accentText,
                                      borderColor: active.accentBg,
                                    }
                                  : {
                                      borderColor: active.chipBorder,
                                      color: "hsl(var(--foreground))",
                                      backgroundColor: "hsl(var(--card))",
                                    }
                              }
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>

                      {selectedFollowUp ? (
                        <div
                          className={`px-3.5 py-2.5 text-xs font-medium leading-5 text-foreground ${getBotBubbleClasses(active.bubbleStyle.kind)}`}
                          style={
                            active.bubbleStyle.kind === "editorial"
                              ? { borderLeftColor: active.accentBg }
                              : undefined
                          }
                          role="status"
                        >
                          {selectedFollowUp}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* Mock composer footer */}
                <div className="flex items-center justify-between gap-3 border-t border-border bg-card px-4 py-3 sm:px-5">
                  <span className="truncate text-xs text-slate-600 dark:text-muted-foreground">
                    {active.conversation.statusLabel}
                  </span>
                  <span
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-white"
                    style={{ backgroundColor: active.accentBg }}
                    aria-hidden="true"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </span>
                </div>
              </div>

              {/* Floating launcher preview */}
              <div className="mt-4 flex items-center justify-end gap-3">
                <span className="text-xs text-slate-600 dark:text-muted-foreground">
                  Lanzador con la paleta de <strong className="font-semibold text-foreground">{active.name}</strong>
                </span>
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card shadow-md"
                  aria-hidden="true"
                >
                  <BrandBotAvatar
                    palette={active.palette}
                    gradientStops={active.gradientStops}
                    state={botState}
                    size={36}
                    reducedMotion={reduceMotion}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default WhiteLabelShowcaseSection;
