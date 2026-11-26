import React, { useId, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Building2,
  Check,
  GraduationCap,
  Landmark,
  Palette,
  Send,
  Sparkles,
  Stethoscope,
  Store,
  Type,
} from "lucide-react";

import BrandBotAvatar, { type BrandBotState } from "@/components/chat/BrandBotAvatar";

type BubbleShape = "globa" | "capsule" | "editorial" | "card";

interface DemoBrandIdentity {
  id: string;
  name: string;
  sector: string;
  tagline: string;
  domain: string;
  assistantName: string;
  icon: React.ComponentType<{ className?: string }>;
  palette: [string, string, string, string];
  gradientStops: Array<{ color: string; x: number; y: number }>;
  headerVeil: string;
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
    icon: Landmark,
    palette: ["#0F766E", "#0284C7", "#10B981", "#38BDF8"],
    gradientStops: [
      { color: "#0F766E", x: 0.16, y: 0.18 },
      { color: "#0284C7", x: 0.86, y: 0.14 },
      { color: "#38BDF8", x: 0.18, y: 0.86 },
      { color: "#10B981", x: 0.84, y: 0.84 },
    ],
    headerVeil: "linear-gradient(180deg, rgba(2, 6, 23, 0.42) 0%, rgba(2, 6, 23, 0.56) 100%)",
    accentBg: "#0F766E",
    accentText: "#FFFFFF",
    chipBorder: "rgba(15, 118, 110, 0.35)",
    typography: {
      label: "Geométrica institucional",
      specimen: "Interletra ajustada · Bold / Regular",
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
        "¡Recibido! Ya abrí el reclamo y lo asigné a Alumbrado Público. Podés seguir cada cambio desde el portal.",
      options: [
        {
          label: "Compartir ubicación",
          followUp: "Ubicación asociada al reclamo #4082. Te avisamos cuando la cuadrilla tome el caso.",
        },
        {
          label: "Ver estado",
          followUp: "Estado actual: En evaluación · Área asignada: Servicios Urbanos.",
        },
      ],
      statusLabel: "Reclamo trazable · Portal público",
    },
  },
  {
    id: "clinica-demo",
    name: "Clínica Demo",
    sector: "Salud y turnos",
    tagline: "Turnos, preparaciones de estudios y recordatorios por web y WhatsApp.",
    domain: "turnos.clinica-demo.salud",
    assistantName: "Guía de turnos",
    icon: Stethoscope,
    palette: ["#1D4ED8", "#06B6D4", "#6366F1", "#14B8A6"],
    gradientStops: [
      { color: "#1D4ED8", x: 0.14, y: 0.2 },
      { color: "#06B6D4", x: 0.88, y: 0.18 },
      { color: "#14B8A6", x: 0.2, y: 0.86 },
      { color: "#6366F1", x: 0.84, y: 0.82 },
    ],
    headerVeil: "linear-gradient(180deg, rgba(2, 6, 23, 0.44) 0%, rgba(2, 6, 23, 0.56) 100%)",
    accentBg: "#1D4ED8",
    accentText: "#FFFFFF",
    chipBorder: "rgba(29, 78, 216, 0.35)",
    typography: {
      label: "Neo-grotesk clínica",
      specimen: "Lectura clara · Escala serena",
      fontFamily: '"Inter", system-ui, -apple-system, "Segoe UI", sans-serif',
      headingFamily: '"Inter", system-ui, -apple-system, "Segoe UI", sans-serif',
      letterSpacing: "-0.008em",
    },
    bubbleStyle: {
      kind: "capsule",
      label: "Cápsula orgánica",
      detail: "Bordes muy redondeados y aireados",
    },
    conversation: {
      userMessage: "Necesito sacar un turno de cardiología para la próxima semana.",
      botReply:
        "Tengo horarios disponibles martes 10:30 y jueves 16:00. Elegí uno para confirmar y recibir las indicaciones.",
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
      statusLabel: "Agenda conectada · Recordatorio automático",
    },
  },
  {
    id: "comercio-demo",
    name: "Comercio Demo",
    sector: "Retail y catálogo",
    tagline: "Catálogo interactivo, consultas de stock y pedidos en un solo hilo.",
    domain: "tienda.comercio-demo.shop",
    assistantName: "Asistente de ventas",
    icon: Store,
    palette: ["#C2410C", "#E11D48", "#D97706", "#FB7185"],
    gradientStops: [
      { color: "#C2410C", x: 0.16, y: 0.16 },
      { color: "#E11D48", x: 0.86, y: 0.18 },
      { color: "#D97706", x: 0.18, y: 0.84 },
      { color: "#FB7185", x: 0.84, y: 0.86 },
    ],
    headerVeil: "linear-gradient(180deg, rgba(2, 6, 23, 0.44) 0%, rgba(2, 6, 23, 0.58) 100%)",
    accentBg: "#C2410C",
    accentText: "#FFFFFF",
    chipBorder: "rgba(194, 65, 12, 0.35)",
    typography: {
      label: "Editorial comercial",
      specimen: "Titulares con serif · Cuerpo limpio",
      fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
      headingFamily: 'Georgia, Cambria, "Times New Roman", serif',
      letterSpacing: "0em",
    },
    bubbleStyle: {
      kind: "editorial",
      label: "Bloque editorial",
      detail: "Esquinas firmes con acento lateral de marca",
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
      statusLabel: "Catálogo y carrito · CRM comercial",
    },
  },
  {
    id: "instituto-demo",
    name: "Instituto Demo",
    sector: "Educación y familias",
    tagline: "Consultas de familias, certificados y comunicación escolar ordenada.",
    domain: "familias.instituto-demo.edu",
    assistantName: "Secretaría virtual",
    icon: GraduationCap,
    palette: ["#6D28D9", "#4F46E5", "#DB2777", "#8B5CF6"],
    gradientStops: [
      { color: "#6D28D9", x: 0.18, y: 0.16 },
      { color: "#4F46E5", x: 0.86, y: 0.2 },
      { color: "#8B5CF6", x: 0.16, y: 0.85 },
      { color: "#DB2777", x: 0.82, y: 0.84 },
    ],
    headerVeil: "linear-gradient(180deg, rgba(2, 6, 23, 0.42) 0%, rgba(2, 6, 23, 0.56) 100%)",
    accentBg: "#6D28D9",
    accentText: "#FFFFFF",
    chipBorder: "rgba(109, 40, 217, 0.35)",
    typography: {
      label: "Académica estructurada",
      specimen: "Metadatos técnicos · Títulos nítidos",
      fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
      headingFamily: 'ui-monospace, "Cascadia Code", "SFMono-Regular", Menlo, monospace',
      letterSpacing: "-0.015em",
    },
    bubbleStyle: {
      kind: "card",
      label: "Tarjeta definida",
      detail: "Contorno fino y jerarquía de ficha",
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
      statusLabel: "Gestión escolar · Derivación humana",
    },
  },
];

const BOT_STATES: Array<{ value: BrandBotState; label: string }> = [
  { value: "idle", label: "Reposo" },
  { value: "listening", label: "Escuchando" },
  { value: "thinking", label: "Pensando" },
  { value: "speaking", label: "Hablando" },
];

const buildMeshHeaderBackground = (identity: DemoBrandIdentity) => {
  const radials = identity.gradientStops.map(
    (stop) =>
      `radial-gradient(ellipse 72% 118% at ${Math.round(stop.x * 100)}% ${Math.round(stop.y * 100)}%, ${stop.color} 0%, transparent 72%)`,
  );
  const base = `linear-gradient(135deg, ${identity.palette[0]} 0%, ${identity.palette[1]} 100%)`;
  return [identity.headerVeil, ...radials, base].join(", ");
};

const getBotBubbleClasses = (kind: BubbleShape) => {
  switch (kind) {
    case "globa":
      return "rounded-[20px] rounded-bl-[5px] border border-border/80 bg-background/95 shadow-sm";
    case "capsule":
      return "rounded-[24px] border border-border/70 bg-muted/45 shadow-none";
    case "editorial":
      return "rounded-[10px] border border-border/80 border-l-[3px] bg-background shadow-sm";
    case "card":
      return "rounded-[14px] rounded-tl-[4px] border border-border bg-card shadow-sm";
  }
};

const getUserBubbleClasses = (kind: BubbleShape) => {
  switch (kind) {
    case "globa":
      return "rounded-[20px] rounded-br-[5px] shadow-md";
    case "capsule":
      return "rounded-[24px] shadow-sm";
    case "editorial":
      return "rounded-[10px] shadow-sm";
    case "card":
      return "rounded-[14px] rounded-tr-[4px] shadow-sm";
  }
};

const WhiteLabelShowcaseSection = () => {
  const reduceMotion = useReducedMotion();
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

  const ActiveIcon = active.icon;

  return (
    <section
      id="marca-blanca"
      aria-labelledby="whitelabel-title"
      className="relative overflow-hidden border-y border-border/60 bg-muted/20 py-20 text-foreground md:py-28"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-60 dark:opacity-45"
        style={{
          background: `radial-gradient(circle at 82% 24%, ${active.palette[0]}1f, transparent 36%), radial-gradient(circle at 18% 82%, ${active.palette[1]}18, transparent 38%)`,
          transition: reduceMotion ? "none" : "background 450ms ease",
        }}
      />

      <div className="container relative mx-auto px-4">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-3xl text-center">
            <div className="chatboc-section-kicker mb-4">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Marca blanca en vivo
            </div>
            <h2 id="whitelabel-title" className="chatboc-section-heading text-balance">
              Un mismo motor, la identidad exacta de cada organización
            </h2>
            <p className="chatboc-section-copy mt-4">
              Cambiá de ejemplo para ver cómo el widget adopta colores, tipografía, burbujas y mascota animada sin
              escribir código.
            </p>
          </div>

          <div
            className="mt-10 grid grid-cols-2 gap-2.5 sm:grid-cols-4"
            role="tablist"
            aria-label="Identidades marca blanca de demostración"
          >
            {DEMO_IDENTITIES.map((brand, index) => {
              const Icon = brand.icon;
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
                  className={`group relative flex min-h-[76px] flex-col justify-between rounded-[14px] border p-3.5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                    isSelected
                      ? "border-primary/50 bg-card shadow-md ring-1 ring-primary/25"
                      : "border-border/75 bg-card/70 hover:border-primary/35 hover:bg-card"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-[9px] text-white shadow-sm"
                      style={{ backgroundColor: brand.accentBg }}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="flex items-center gap-1" aria-hidden="true">
                      {brand.palette.slice(0, 3).map((hex) => (
                        <span
                          key={hex}
                          className="h-2.5 w-2.5 rounded-full border border-white/60 shadow-xs"
                          style={{ backgroundColor: hex }}
                        />
                      ))}
                    </span>
                  </div>
                  <div className="mt-2.5 min-w-0">
                    <p className="truncate text-sm font-bold text-foreground">{brand.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{brand.sector}</p>
                  </div>
                </button>
              );
            })}
          </div>

          <div
            id={panelId}
            role="tabpanel"
            aria-labelledby={`${tabBaseId}-tab-${activeIndex}`}
            className="mt-8 grid items-start gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:gap-10"
          >
            {/* Left column: live design tokens + mascot mood controls */}
            <div className="space-y-4">
              <div className="rounded-[18px] border border-border/80 bg-card/95 p-5 shadow-sm sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-4">
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-11 w-11 items-center justify-center rounded-[12px] text-white shadow-sm"
                      style={{ backgroundColor: active.accentBg }}
                    >
                      <ActiveIcon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div>
                      <h3 className="text-lg font-bold text-foreground">{active.name}</h3>
                      <p className="text-xs text-muted-foreground">{active.domain}</p>
                    </div>
                  </div>
                  <span className="rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-semibold text-foreground">
                    Identidad demo
                  </span>
                </div>

                <p className="mt-4 text-sm leading-6 text-muted-foreground">{active.tagline}</p>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {/* Palette */}
                  <div className="rounded-[12px] border border-border/70 bg-background/80 p-3.5">
                    <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                      <Palette className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                      Paleta activa
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      {active.palette.map((color) => (
                        <div key={color} className="flex flex-col items-center gap-1">
                          <span
                            className="h-7 w-7 rounded-[8px] border border-black/10 shadow-xs dark:border-white/15"
                            style={{ backgroundColor: color }}
                            title={color}
                          />
                          <span className="font-mono text-[10px] text-muted-foreground">{color}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Typography */}
                  <div className="rounded-[12px] border border-border/70 bg-background/80 p-3.5">
                    <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                      <Type className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                      Tipografía y ritmo
                    </div>
                    <div className="mt-2.5 flex items-baseline gap-2.5">
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
                        <p className="truncate text-sm font-semibold text-foreground">{active.typography.label}</p>
                        <p className="truncate text-xs text-muted-foreground">{active.typography.specimen}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {/* Bubble geometry */}
                  <div className="rounded-[12px] border border-border/70 bg-background/80 p-3.5">
                    <p className="text-xs font-semibold text-muted-foreground">
                      Forma de burbuja
                    </p>
                    <p className="mt-1.5 text-sm font-semibold text-foreground">{active.bubbleStyle.label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{active.bubbleStyle.detail}</p>
                  </div>

                  {/* Mascot live states */}
                  <div className="rounded-[12px] border border-border/70 bg-background/80 p-3.5">
                    <p className="text-xs font-semibold text-muted-foreground">
                      Estado de la mascota
                    </p>
                    <div
                      className="mt-2 flex flex-wrap gap-1.5"
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
                            className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                              pressed
                                ? "border-transparent text-white shadow-xs"
                                : "border-border bg-card text-foreground hover:border-primary/40"
                            }`}
                            style={pressed ? { backgroundColor: active.accentBg, color: active.accentText } : undefined}
                          >
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* White-label guarantees strip */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-1 text-xs font-medium text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                  Cabecera con gradiente y contraste AA
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                  Mascota SVG generada con la paleta
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                  Claro, oscuro y movimiento reducido
                </span>
              </div>
            </div>

            {/* Right column: live morphing widget mockup */}
            <div className="relative mx-auto w-full max-w-[460px] lg:max-w-none">
                <motion.div
                  key={active.id}
                  data-testid="whitelabel-widget-preview"
                  data-brand-id={active.id}
                  data-bubble-style={active.bubbleStyle.kind}
                  initial={reduceMotion ? false : { opacity: 1, y: 8, scale: 0.99 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: reduceMotion ? 0 : 0.24, ease: "easeOut" }}
                  className="overflow-hidden rounded-[22px] border border-border/80 bg-card shadow-[0_26px_70px_rgba(15,23,42,0.14)] dark:shadow-[0_26px_70px_rgba(0,0,0,0.48)]"
                  style={{
                    fontFamily: active.typography.fontFamily,
                    letterSpacing: active.typography.letterSpacing,
                  }}
                >
                  {/* Mesh gradient brand header */}
                  <div
                    className="flex items-center justify-between gap-3 px-4 py-4 text-white sm:px-5"
                    style={{ backgroundImage: buildMeshHeaderBackground(active) }}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] border border-white/25 bg-slate-950/25">
                        <BrandBotAvatar
                          palette={active.palette}
                          gradientStops={active.gradientStops}
                          state={botState}
                          size={38}
                          title={`Mascota de ${active.name}`}
                          reducedMotion={Boolean(reduceMotion)}
                        />
                      </div>
                      <div className="min-w-0">
                        <p
                          className="truncate text-base font-bold leading-snug text-white"
                          style={{ fontFamily: active.typography.headingFamily }}
                        >
                          {active.assistantName}
                        </p>
                        <p className="truncate text-xs font-medium text-white/90">{active.name} · En línea</p>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full border border-white/30 bg-slate-950/30 px-2.5 py-1 text-[11px] font-semibold text-white">
                      {active.sector}
                    </span>
                  </div>

                  {/* Conversation body */}
                  <div className="space-y-3.5 bg-background/60 p-4 sm:p-5">
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
                          reducedMotion={Boolean(reduceMotion)}
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
                                className="rounded-full border px-3 py-1.5 text-xs font-semibold transition-all hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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

                  {/* Mock composer + launcher preview */}
                  <div className="flex items-center justify-between gap-3 border-t border-border/70 bg-card px-4 py-3 sm:px-5">
                    <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                      <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span className="truncate">{active.conversation.statusLabel}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-white shadow-sm"
                        style={{ backgroundColor: active.accentBg }}
                        aria-hidden="true"
                      >
                        <Send className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </div>
                </motion.div>

              {/* Floating launcher preview pill */}
              <div className="mt-3 flex items-center justify-end gap-2.5">
                <span className="text-xs font-medium text-muted-foreground">
                  Lanzador con la paleta de <strong className="text-foreground">{active.name}</strong>
                </span>
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-full border border-border/70 bg-card shadow-lg"
                  aria-hidden="true"
                >
                  <BrandBotAvatar
                    palette={active.palette}
                    gradientStops={active.gradientStops}
                    state={botState}
                    size={38}
                    reducedMotion={Boolean(reduceMotion)}
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
