import React from "react";
import {
  BarChart3,
  BrainCircuit,
  FileUp,
  Gift,
  Map,
  MessageCircle,
  PhoneCall,
  ShieldCheck,
  ShoppingCart,
  Store,
  UserRoundCheck,
  Vote,
} from "lucide-react";

const platformLoops = [
  {
    icon: FileUp,
    title: "Del archivo al marketplace",
    detail:
      "La organizacion sube PDF, Excel, CSV, TXT o listas comerciales. La IA extrae productos, precios, stock, descripciones e imagenes cuando existen.",
  },
  {
    icon: Store,
    title: "Del marketplace a la venta",
    detail:
      "El equipo completa fichas, agrega imagenes, publica productos y deja carrito, pedido, checkout y seguimiento listos para operar.",
  },
  {
    icon: UserRoundCheck,
    title: "Del visitante al portal",
    detail:
      "La persona puede entrar por WhatsApp o widget, comprar como invitada, asociar su cuenta y recuperar historial por organizacion.",
  },
  {
    icon: Gift,
    title: "De la compra a fidelizacion",
    detail:
      "Beneficios, recompensas, encuestas y acciones de participacion conectan cada experiencia con retencion y comunidad.",
  },
];

const intelligenceRows = [
  { icon: MessageCircle, label: "Entiende texto, audio, imagenes y archivos", tone: "blue" },
  { icon: Map, label: "Convierte ubicaciones en mapas y zonas de accion", tone: "green" },
  { icon: Vote, label: "Mide encuestas, sondeos, votos y comentarios", tone: "amber" },
  { icon: PhoneCall, label: "Puede sumar llamadas cuando el canal esta habilitado", tone: "purple" },
  { icon: BarChart3, label: "Resume actividad real para decidir mejor", tone: "cyan" },
  { icon: ShieldCheck, label: "Deriva a humanos con contexto completo", tone: "emerald" },
];

const verticalOutcomes = [
  {
    title: "Pymes",
    items: ["Catalogo importado con IA", "Carrito invitado o registrado", "Pedidos, pagos, comprobantes y seguimiento"],
  },
  {
    title: "Gobiernos",
    items: ["Reclamos con foto, audio y ubicacion", "Mapa operativo y zonas calientes", "Sondeos, votaciones y comentarios"],
  },
  {
    title: "Colegios",
    items: ["Familias, staff y secretaria en un mismo canal", "Inasistencias, certificados, pagos y admisiones", "Casos sensibles con derivacion humana"],
  },
];

const SaaSOperatingSystemSection = () => {
  return (
    <section id="sistema-operativo" className="scroll-mt-24 bg-muted/25 py-16 text-foreground md:py-24">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl text-center">
          <div className="chatboc-section-kicker mb-4">La diferencia que vende</div>
          <h2 className="chatboc-section-heading">No es solo chat. Es un sistema completo para operar, vender y aprender.</h2>
          <p className="chatboc-section-copy mt-4">
            Chatboc une consultoria, IA, canales, marketplace, portal de usuario, participacion y analiticas. Cada modulo
            se activa con informacion real de la organizacion, sin inventar resultados.
          </p>
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-4">
          {platformLoops.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.title} className="chatboc-landing-panel chatboc-hover-lift p-5">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-[8px] bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold text-foreground">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.detail}</p>
              </article>
            );
          })}
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-stretch">
          <div className="chatboc-command-shell p-5 md:p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-[8px] bg-primary/10 text-primary">
                <BrainCircuit className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">IA aplicada a procesos reales</h3>
                <p className="text-sm text-muted-foreground">La demo debe mostrar acciones que el equipo pueda continuar.</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {intelligenceRows.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="rounded-[8px] border border-border/70 bg-background/75 p-3">
                    <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-[8px] bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </div>
                    <p className="text-sm font-medium leading-5 text-foreground">{item.label}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-1">
            {verticalOutcomes.map((vertical) => (
              <article key={vertical.title} className="rounded-[8px] border border-border/70 bg-card/85 p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-base font-semibold text-foreground">{vertical.title}</h3>
                  <ShoppingCart className="h-4 w-4 text-primary" />
                </div>
                <ul className="space-y-2 text-sm leading-6 text-muted-foreground">
                  {vertical.items.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-success" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default SaaSOperatingSystemSection;
