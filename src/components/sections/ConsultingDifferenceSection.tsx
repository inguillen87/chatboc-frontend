import React from "react";
import {
  BarChart3,
  ClipboardList,
  FileText,
  GraduationCap,
  Image,
  Landmark,
  MapPin,
  MessageSquareText,
  Mic,
  PhoneCall,
  ShoppingBag,
  Store,
  Users,
  Vote,
  Workflow,
} from "lucide-react";

const capabilityRows = [
  { icon: MessageSquareText, label: "Texto y WhatsApp", detail: "consultas, ventas, turnos, reclamos y seguimiento" },
  { icon: Mic, label: "Notas de voz", detail: "audio convertido en contexto util para responder o derivar" },
  { icon: Image, label: "Imagenes y archivos", detail: "fotos, comprobantes, certificados, adjuntos y pedidos" },
  { icon: MapPin, label: "Ubicacion", detail: "mapas, zonas, reclamos territoriales y recorridos de estado" },
  { icon: PhoneCall, label: "Llamadas", detail: "voz cuando el canal y la organizacion la tienen habilitada" },
  { icon: Vote, label: "Encuestas y votaciones", detail: "sondeos, participacion, comentarios y resultados en vivo" },
];

const operatingFlows = [
  { icon: ClipboardList, label: "Reclamos y casos", detail: "se registran, se priorizan y quedan listos para operar" },
  { icon: ShoppingBag, label: "Pedidos y carrito", detail: "catalogo, compra invitada, checkout y seguimiento" },
  { icon: BarChart3, label: "Metricas y decisiones", detail: "actividad, tiempos, zonas, respuestas y comentarios" },
  { icon: Users, label: "Derivacion humana", detail: "cuando el caso lo necesita, el equipo recibe contexto completo" },
];

const verticalStories = [
  {
    icon: Landmark,
    title: "Gobiernos y municipios",
    points: ["Reclamos con foto, audio y ubicacion", "Estado por codigo o contacto", "Sondeos y participacion territorial"],
  },
  {
    icon: Store,
    title: "Empresas y pymes",
    points: ["Catalogo, pedidos y carrito invitado", "Leads listos para vender", "Comprobantes, stock y seguimiento"],
  },
  {
    icon: GraduationCap,
    title: "Colegios",
    points: ["Familias, secretaria y staff", "Inasistencias, certificados y admisiones", "Casos sensibles con handoff humano"],
  },
];

const liveSignals = [
  "Respuestas de encuestas",
  "Comentarios abiertos",
  "Pedidos y leads",
  "Reclamos geolocalizados",
  "Derivaciones humanas",
];

const ConsultingDifferenceSection = () => {
  return (
    <section id="diferencia-chatboc" className="scroll-mt-24 bg-background py-16 text-foreground md:py-24">
      <div className="container mx-auto px-4">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <div className="chatboc-section-kicker mb-4">Por que no somos un chatbot mas</div>
            <h2 className="chatboc-section-heading">Consultoria, agente IA y operacion real en la misma experiencia</h2>
            <p className="chatboc-section-copy mt-4">
              Chatboc no se queda en responder preguntas. Ayuda a ordenar el recorrido completo: entender lo que pide
              la persona, pedir datos utiles, crear casos o pedidos, medir lo que pasa y dejar al equipo con acciones
              claras.
            </p>

            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              {capabilityRows.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="rounded-[8px] border border-border/70 bg-card/85 p-4">
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-[8px] bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <p className="text-sm font-semibold text-foreground">{item.label}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.detail}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="chatboc-command-shell overflow-hidden">
            <div className="border-b border-border/70 bg-muted/40 px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Centro de resultados en vivo</p>
                  <p className="text-xs text-muted-foreground">Cada modulo muestra datos reales cuando la organizacion esta conectada.</p>
                </div>
                <div className="chatboc-live-chip rounded-[8px] bg-success/10 px-3 py-1.5 text-xs font-semibold text-success">
                  listo para operar
                </div>
              </div>
            </div>

            <div className="grid gap-0 md:grid-cols-[0.95fr_1.05fr]">
              <div className="border-b border-border/70 p-5 md:border-b-0 md:border-r">
                <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Workflow className="h-4 w-4 text-primary" />
                  De mensaje a resultado
                </div>
                <div className="space-y-3">
                  {operatingFlows.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.label} className="flex gap-3 rounded-[8px] border border-border/70 bg-background/70 p-3">
                        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[8px] bg-primary/10 text-primary">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground">{item.label}</p>
                          <p className="text-xs leading-5 text-muted-foreground">{item.detail}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="p-5">
                <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  Senales que se pueden medir
                </div>
                <div className="space-y-3">
                  {liveSignals.map((signal, index) => (
                    <div key={signal} className="rounded-[8px] border border-border/70 bg-background/70 p-3">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="text-sm font-medium text-foreground">{signal}</span>
                        <span className="text-xs text-muted-foreground">
                          {index === 0 ? "participacion" : index === 1 ? "opinion" : index === 2 ? "venta" : index === 3 ? "territorio" : "equipo"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="h-2 w-2 rounded-full bg-success" />
                        <span>se actualiza cuando hay actividad real</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {verticalStories.map((story) => {
            const Icon = story.icon;
            return (
              <article key={story.title} className="chatboc-landing-panel chatboc-hover-lift p-5 md:p-6">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-[8px] bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">{story.title}</h3>
                </div>
                <ul className="space-y-3 text-sm leading-6 text-muted-foreground">
                  {story.points.map((point) => (
                    <li key={point} className="flex gap-2">
                      <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-success" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default ConsultingDifferenceSection;
