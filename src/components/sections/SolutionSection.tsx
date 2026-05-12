import React from "react";
import {
  Bot,
  ClipboardList,
  DatabaseZap,
  Gift,
  LineChart,
  MapPinned,
  ShoppingBag,
  Sparkles,
  Users,
  Workflow,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const solutionFeatures = [
  {
    icon: Bot,
    title: "Agentes IA con contexto",
    description:
      "Responden con lenguaje natural, conservan sesión, entienden intención y usan las acciones que devuelve el backend.",
  },
  {
    icon: ClipboardList,
    title: "Tickets y casos operativos",
    description:
      "Cada conversación puede terminar en un ticket, lead, caso escolar, pedido o derivación humana con trazabilidad.",
  },
  {
    icon: ShoppingBag,
    title: "Comercio y checkout",
    description:
      "Catálogo, carrito, pagos, puntos y estado post-pago integrados sin separar la experiencia de atención.",
  },
  {
    icon: Gift,
    title: "Fidelización y recompensas",
    description:
      "Puntos, beneficios e incentivos se conectan con participación, compras y acciones reales del usuario.",
  },
  {
    icon: MapPinned,
    title: "Territorio y mapas",
    description:
      "Mapas de calor y puntos geográficos se renderizan solo cuando el backend confirma que hay datos útiles.",
  },
  {
    icon: LineChart,
    title: "Analytics accionable",
    description:
      "KPIs, freshness, SLA, action center y resumen ejecutivo ayudan a priorizar el trabajo de cada equipo.",
  },
];

const pipelineSteps = [
  { label: "Resolver", detail: "chat, voz, WhatsApp", tone: "bg-primary" },
  { label: "Registrar", detail: "ticket, lead, pedido", tone: "bg-emerald-500" },
  { label: "Medir", detail: "SLA, freshness, mapa", tone: "bg-amber-500" },
];

const SolutionSection = () => {
  const navigate = useNavigate();

  return (
    <section id="solucion" className="bg-background py-16 text-foreground md:py-24">
      <div className="container mx-auto px-4">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div className="lg:sticky lg:top-28">
            <div className="chatboc-section-kicker mb-4">La solución</div>
            <h2 className="chatboc-section-heading">Una plataforma SaaS que conecta frontend, backend y operación real</h2>
            <p className="chatboc-section-copy mt-4">
              La experiencia visible no vive aislada en React. Chatboc consume contratos estables, muestra estados accionables
              y mantiene compatibilidad con lo que ya funciona.
            </p>

            <div className="chatboc-landing-panel mt-7 p-4">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
                <Workflow className="h-4 w-4 text-primary" />
                Motor operativo compartido
              </div>
              <div className="grid gap-3">
                {pipelineSteps.map((step) => (
                  <div key={step.label} className="flex items-center gap-3 rounded-[8px] border border-border/70 bg-background/70 p-3">
                    <span className={`h-2.5 w-2.5 rounded-full ${step.tone}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">{step.label}</p>
                      <p className="text-xs text-muted-foreground">{step.detail}</p>
                    </div>
                    <Sparkles className="h-4 w-4 text-muted-foreground" />
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
              <Button
                size="lg"
                className="chatboc-cta-primary rounded-[8px] font-semibold"
                onClick={() => navigate("/demo")}
              >
                <Bot className="mr-2 h-5 w-5" />
                Probar agente
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="rounded-[8px] border-border/80 font-semibold hover:border-primary/40 hover:bg-primary/5"
                onClick={() => navigate("/register")}
              >
                <Users className="mr-2 h-5 w-5" />
                Crear cuenta
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <article className="chatboc-command-shell chatboc-hover-lift p-5 md:p-6 sm:col-span-2">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Backend-first por diseño</h3>
                  <p className="mt-1 text-sm text-muted-foreground">La UI recibe contratos, no inventa experiencias por tenant.</p>
                </div>
                <div className="rounded-[8px] border border-border/70 bg-background/80 px-3 py-1.5 text-xs font-semibold text-primary">
                  JSON ready
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {["quick_menu", "freshness", "next_best_actions"].map((item, index) => (
                  <div key={item} className="rounded-[8px] border border-border/70 bg-background/75 p-4">
                    <DatabaseZap className="mb-3 h-4 w-4 text-primary" />
                    <p className="text-sm font-semibold text-foreground">{item}</p>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                      <span
                        className="chatboc-meter block h-full rounded-full bg-primary"
                        style={{ width: `${92 - index * 14}%`, animationDelay: `${index * 120}ms` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </article>

            {solutionFeatures.map((feature) => {
              const Icon = feature.icon;
              return (
                <article key={feature.title} className="chatboc-landing-panel chatboc-hover-lift p-5 md:p-6">
                  <div className="mb-5 flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-[8px] bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">{feature.title}</h3>
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">{feature.description}</p>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default SolutionSection;
