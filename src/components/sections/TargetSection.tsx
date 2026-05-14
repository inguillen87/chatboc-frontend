import React from "react";
import {
  ArrowRight,
  Briefcase,
  Calendar,
  CheckCircle2,
  GraduationCap,
  Landmark,
  MapPinned,
  MessageSquareText,
  ShoppingBag,
  Vote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const targetGroups = [
  {
    icon: Landmark,
    signalIcon: MapPinned,
    title: "Gobiernos y municipios",
    path: "/demo?sector=gobierno",
    cta: "Probar gobierno",
    description:
      "Atencion ciudadana, reclamos, tramites, mapas, sondeos y participacion con seguimiento para cada area.",
    promise: "Un vecino escribe, manda evidencia y el equipo recibe un caso ordenado para operar.",
    flow: [
      "Texto, foto, audio o ubicacion entran por web o WhatsApp",
      "El agente pide el dato justo y clasifica categoria, zona y prioridad",
      "El panel deja ticket, seguimiento y lectura territorial cuando hay coordenadas",
    ],
    points: ["Reclamos trazables", "Mapas y zonas calientes", "Sondeos y votaciones"],
  },
  {
    icon: Briefcase,
    signalIcon: ShoppingBag,
    title: "Empresas y pymes",
    path: "/demo?sector=empresas",
    cta: "Probar pyme",
    description:
      "Ventas asistidas, soporte, catalogo, pedidos, leads y seguimiento comercial sin cortar la conversacion.",
    promise: "Una consulta se convierte en pedido, oportunidad o caso de soporte con historial.",
    flow: [
      "El cliente consulta por producto, precio, stock, envio o servicio",
      "Chatboc ordena la necesidad y captura contacto cuando hace falta",
      "El equipo recibe lead, pedido o caso con contexto para cerrar mejor",
    ],
    points: ["Catalogo y carrito", "Leads con contexto", "Soporte y ventas"],
  },
  {
    icon: GraduationCap,
    signalIcon: MessageSquareText,
    title: "Colegios e instituciones",
    path: "/demo?sector=educacion",
    cta: "Probar colegio",
    description:
      "Familias, secretaria y direccion trabajando con consultas, documentacion, pagos, avisos y casos sensibles.",
    promise: "Una familia pregunta, adjunta comprobantes o autorizaciones y queda un caso listo.",
    flow: [
      "La familia consulta por pagos, turnos, certificados, comunicados o autorizaciones",
      "El agente entiende el pedido y solicita adjuntos o datos faltantes",
      "Secretaria ve caso, estado, historial y derivacion si corresponde",
    ],
    points: ["Casos escolares", "Familias y adjuntos", "Encuestas por comunidad"],
  },
  {
    icon: Vote,
    signalIcon: Vote,
    title: "Encuestas y participacion",
    path: "/demo?sector=gobierno",
    cta: "Ver participacion",
    description:
      "Sondeos, votaciones, comentarios y analitica para leer decisiones de usuarios, vecinos o comunidades.",
    promise: "Cada respuesta necesita ser auditable, medible y visible en tiempo real para decidir mejor.",
    flow: [
      "La persona responde desde una experiencia publica simple",
      "El sistema registra voto, comentario, canal y contexto permitido",
      "El panel muestra participacion, tendencias y ubicaciones cuando existen datos reales",
    ],
    points: ["Resultados en vivo", "Comentarios accionables", "Analitica por canal"],
  },
];

const TargetSection = () => {
  const navigate = useNavigate();

  const handleConsultingClick = () => {
    window.open("https://calendly.com/chatboc", "_blank", "noopener,noreferrer");
  };

  return (
    <section id="publico-objetivo" className="bg-background py-16 text-foreground md:py-24">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-12 max-w-4xl text-center md:mb-16">
          <h2 className="chatboc-section-heading">Demos por rubro, con valor operativo desde el primer mensaje</h2>
          <p className="chatboc-section-copy mt-4">
            La venta no es mostrar un chat. Es mostrar como una conversacion se transforma en trabajo ordenado,
            datos utiles y seguimiento para el equipo que atiende.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {targetGroups.map((group) => {
            const Icon = group.icon;
            const SignalIcon = group.signalIcon;
            return (
              <article
                key={group.title}
                className="chatboc-landing-panel chatboc-hover-lift flex h-full flex-col overflow-hidden p-5 md:p-6"
              >
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-[8px] bg-primary/10 text-primary">
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="flex items-center gap-2 rounded-[8px] border border-border/70 bg-background/70 px-3 py-2 text-xs font-semibold text-muted-foreground">
                    <SignalIcon className="h-4 w-4 text-primary" />
                    Flujo real
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-foreground">{group.title}</h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{group.description}</p>
                <p className="mt-4 rounded-[8px] border border-primary/15 bg-primary/5 p-3 text-sm font-medium leading-6 text-foreground">
                  {group.promise}
                </p>

                <ol className="mt-5 space-y-3 border-t border-border/70 pt-5">
                  {group.flow.map((step, index) => (
                    <li key={step} className="grid grid-cols-[28px_1fr] gap-3 text-sm leading-6 text-muted-foreground">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {index + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>

                <ul className="mt-5 grid gap-2 border-t border-border/70 pt-4 text-sm text-muted-foreground sm:grid-cols-3">
                  {group.points.map((point) => (
                    <li key={point} className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-success" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="mt-6 h-11 justify-between rounded-[8px] font-semibold"
                  onClick={() => navigate(group.path)}
                >
                  {group.cta}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </article>
            );
          })}
        </div>

        <div className="mt-10 flex justify-center">
          <Button
            size="lg"
            variant="secondary"
            className="rounded-[8px] border border-border/70 bg-card px-6 font-semibold shadow-sm hover:bg-accent"
            onClick={handleConsultingClick}
          >
            <Calendar className="mr-2 h-4 w-4" />
            Agendar consultoria de implementacion
          </Button>
        </div>
      </div>
    </section>
  );
};

export default TargetSection;
