import React from "react";

const ServiceJourneyFlow = React.lazy(() => import("./ServiceJourneyFlow"));

const JourneyFlowFallback = () => (
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

          <React.Suspense fallback={<JourneyFlowFallback />}>
            <ServiceJourneyFlow />
          </React.Suspense>
        </div>
      </div>
    </section>
  );
};

export default SaaSOperatingSystemSection;
