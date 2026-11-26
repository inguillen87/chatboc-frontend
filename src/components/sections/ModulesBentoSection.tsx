import React from "react";

// A plain list on purpose. Seven things of the same kind read better as a
// list someone can scan than as seven decorated cards competing for the eye.
const MODULES = [
  {
    id: "widget",
    title: "Widget web marca blanca",
    description:
      "Se instala en tu sitio o portal con tus colores, tu tipografía y tu mascota. Funciona en claro y oscuro.",
    detail: "Web",
  },
  {
    id: "whatsapp",
    title: "WhatsApp operativo",
    description:
      "Recibe texto, audios, fotos y ubicación en el mismo hilo, y pasa la conversación a tu equipo cuando hace falta.",
    detail: "Mensajería",
  },
  {
    id: "voz",
    title: "Voz y audio accesible",
    description:
      "Cada respuesta se puede escuchar, a la velocidad que la persona elija, y los audios que llegan quedan transcriptos.",
    detail: "Accesibilidad",
  },
  {
    id: "reclamos",
    title: "Reclamos con seguimiento",
    description:
      "Cada reclamo queda con su evidencia, su área responsable y su estado. Quien lo hizo recibe un número para seguirlo.",
    detail: "Casos",
  },
  {
    id: "encuestas",
    title: "Encuestas y participación",
    description:
      "Publicás una consulta, la gente responde desde el chat o un enlace, y los resultados se ven a medida que llegan.",
    detail: "Participación",
  },
  {
    id: "crm",
    title: "CRM, catálogo y portal",
    description:
      "Conversaciones, pedidos y responsables en un solo lugar, más un portal público con la identidad de tu organización.",
    detail: "Gestión",
  },
  {
    id: "estadisticas",
    title: "Estadísticas y tablero operativo",
    description:
      "Qué se consulta más, por qué canal entra, cuánto se tarda en responder y qué resuelve cada equipo.",
    detail: "Datos",
  },
];

const ModulesBentoSection = () => (
  <section
    aria-labelledby="modules-bento-title"
    className="relative bg-background py-20 text-foreground md:py-28"
  >
    <div className="container mx-auto px-4">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <div className="chatboc-section-kicker mb-4">7 módulos integrados</div>
          <h2 id="modules-bento-title" className="chatboc-section-heading text-balance">
            Todo lo que necesita tu operación, conectado desde el primer día
          </h2>
          <p className="chatboc-section-copy mt-5 max-w-md">
            Activás los que tu equipo necesita. Todos comparten el mismo historial, así nadie salta entre planillas.
          </p>
        </div>

        <ul className="border-t border-border">
          {MODULES.map((mod) => (
            <li
              key={mod.id}
              className="grid gap-x-8 gap-y-1 border-b border-border py-6 sm:grid-cols-[1fr_auto] sm:items-baseline"
            >
              <h3 className="chatboc-display text-xl font-semibold leading-snug text-foreground md:text-2xl">
                {mod.title}
              </h3>
              <span className="order-first text-sm text-slate-600 dark:text-muted-foreground sm:order-none sm:text-right">
                {mod.detail}
              </span>
              <p className="max-w-[60ch] text-base leading-7 text-slate-600 dark:text-muted-foreground sm:col-span-2">
                {mod.description}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  </section>
);

export default ModulesBentoSection;
