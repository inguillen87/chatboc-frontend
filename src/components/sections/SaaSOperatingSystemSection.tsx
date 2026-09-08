import React from "react";

const ServiceJourneyFlow = React.lazy(() => import("./ServiceJourneyFlow"));

const journeyStages = [
  {
    eyebrow: "01 · Entrada",
    title: "Canales ciudadanos",
    description: "WhatsApp, web, voz y formularios accesibles.",
  },
  {
    eyebrow: "02 · Comprensión",
    title: "Agente conversacional",
    description: "Ordena la solicitud, solicita lo necesario y conserva el contexto.",
  },
  {
    eyebrow: "03 · Resolución",
    title: "Equipo y automatizaciones",
    description: "Asigna responsables, controla plazos y habilita la atención humana.",
  },
  {
    eyebrow: "04 · Gestión",
    title: "CRM y analítica",
    description: "Reúne trazabilidad, resultados y señales para decidir mejor.",
  },
] as const;

const JourneyFlowLoading = () => (
  <div
    className="mt-9 overflow-hidden rounded-[16px] border border-border bg-card shadow-sm"
    aria-label="Cargando recorrido conectado"
    role="status"
  >
    <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-4 sm:px-6">
      <div className="space-y-2">
        <div className="h-4 w-36 animate-pulse rounded bg-muted motion-reduce:animate-none" />
        <div className="h-3 w-64 max-w-[70vw] animate-pulse rounded bg-muted/70 motion-reduce:animate-none" />
      </div>
      <div className="hidden h-10 w-44 animate-pulse rounded-[10px] bg-muted sm:block motion-reduce:animate-none" />
    </div>
    <div className="grid gap-3 p-4 sm:grid-cols-4 sm:p-6">
      {["Canales", "Agente", "Operación", "Gestión"].map((label) => (
        <div key={label} className="rounded-[12px] border border-border bg-background p-4">
          <p className="text-xs font-bold uppercase tracking-[0.11em] text-primary">{label}</p>
          <div className="mt-3 h-3 w-4/5 animate-pulse rounded bg-muted motion-reduce:animate-none" />
        </div>
      ))}
    </div>
  </div>
);

const JourneyFlowStatic = () => (
  <div
    className="mt-9 overflow-hidden rounded-[16px] border border-border bg-card shadow-sm"
    aria-label="Recorrido conectado"
    role="region"
  >
    <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div>
        <p className="text-sm font-semibold text-foreground">Recorrido conectado</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Vista esencial disponible incluso cuando la conexión es inestable.
        </p>
      </div>
      <span className="w-fit rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary">
        Continuidad operativa
      </span>
    </div>

    <ol className="grid gap-3 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-4" aria-label="Recorrido operativo esencial">
      {journeyStages.map((stage) => (
        <li key={stage.title} className="relative rounded-[12px] border border-border bg-background p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.11em] text-primary">{stage.eyebrow}</p>
          <h3 className="mt-2 text-base font-semibold text-foreground">{stage.title}</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{stage.description}</p>
        </li>
      ))}
    </ol>
  </div>
);

const subscribeToConnectivity = (onStoreChange: () => void) => {
  if (typeof window === "undefined") return () => undefined;

  window.addEventListener("online", onStoreChange);
  window.addEventListener("offline", onStoreChange);

  return () => {
    window.removeEventListener("online", onStoreChange);
    window.removeEventListener("offline", onStoreChange);
  };
};

const readConnectivity = () => typeof navigator === "undefined" || navigator.onLine !== false;

const SaaSOperatingSystemSection = () => {
  const isOnline = React.useSyncExternalStore(subscribeToConnectivity, readConnectivity, () => true);

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

          {isOnline ? (
            <React.Suspense fallback={<JourneyFlowLoading />}>
              <ServiceJourneyFlow />
            </React.Suspense>
          ) : (
            <JourneyFlowStatic />
          )}
        </div>
      </div>
    </section>
  );
};

export default SaaSOperatingSystemSection;
