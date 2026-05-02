import React from "react";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  BarChart3,
  Bot,
  CheckCircle2,
  MapPinned,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const proofItems = [
  "Widget, WhatsApp y panel en una misma operación",
  "Contratos backend-first para no hardcodear experiencias",
  "Demo, tickets, pagos, encuestas y analytics listos para crecer",
];

const dashboardRows = [
  { label: "Conversaciones", value: "24/7", tone: "bg-emerald-500" },
  { label: "Tickets activos", value: "SLA", tone: "bg-amber-500" },
  { label: "Leads y pedidos", value: "CRM", tone: "bg-sky-500" },
];

const HeroSection = () => {
  const navigate = useNavigate();

  return (
    <section className="chatboc-hero-grid overflow-hidden pt-24 pb-14 text-foreground md:pt-32 md:pb-20">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-5xl text-center">
          <div className="mb-6 inline-flex items-center gap-3 rounded-[8px] border border-border/70 bg-card/80 px-3 py-2 text-sm text-muted-foreground shadow-sm backdrop-blur">
            <img
              src="/chatboc_frontend_pack/branding/chatboc/navbar/chatboc-navbar-mark-circle.svg"
              alt="Chatboc"
              className="h-7 w-7 rounded-full ring-1 ring-primary/20"
              loading="eager"
              decoding="async"
            />
            <span>Plataforma SaaS de agentes IA operativos</span>
          </div>

          <h1 className="mx-auto max-w-4xl text-4xl font-bold leading-tight tracking-normal text-foreground sm:text-5xl md:text-6xl">
            Agentes IA para operar conversaciones, ventas y servicios desde un solo lugar
          </h1>

          <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-muted-foreground md:text-xl">
            Chatboc convierte chats, trámites, pedidos, encuestas y seguimiento en experiencias guiadas por datos.
            La interfaz muestra lo que el backend define: menús, acciones, estados y próximos pasos sin inventar contenido local.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              size="lg"
              className="chatboc-cta-primary h-12 w-full rounded-[8px] px-6 text-base font-semibold sm:w-auto"
              onClick={() => navigate("/demo")}
            >
              <Zap className="mr-2 h-5 w-5" />
              Probar demo
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="h-12 w-full rounded-[8px] border-border/80 bg-background/70 px-6 text-base font-semibold shadow-sm backdrop-blur hover:border-primary/40 hover:bg-primary/5 sm:w-auto"
              onClick={() => navigate("/register")}
            >
              Crear cuenta
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>

          <div className="mt-7 grid gap-3 text-left sm:grid-cols-3">
            {proofItems.map((item) => (
              <div
                key={item}
                className="flex items-start gap-2 rounded-[8px] border border-border/60 bg-background/70 px-3 py-3 text-sm text-muted-foreground backdrop-blur"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mx-auto mt-12 max-w-6xl">
          <div className="chatboc-landing-panel chatboc-dashboard-scan overflow-hidden">
            <div className="border-b border-border/70 bg-muted/40 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                </div>
                <div className="flex items-center gap-2 rounded-[8px] border border-border/70 bg-background/80 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5 text-success" />
                  Controlado por contratos backend
                </div>
              </div>
            </div>

            <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="border-b border-border/70 p-5 md:p-7 lg:border-b-0 lg:border-r">
                <div className="mb-5 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Centro de operaciones</p>
                    <p className="text-sm text-muted-foreground">Vista compacta para equipos que atienden, venden y resuelven.</p>
                  </div>
                  <div className="rounded-[8px] bg-success/10 px-3 py-1 text-xs font-semibold text-success">Activo</div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {dashboardRows.map((row) => (
                    <div key={row.label} className="rounded-[8px] border border-border/70 bg-background/80 p-4">
                      <div className={`mb-4 h-1.5 w-10 rounded-full ${row.tone}`} />
                      <p className="text-sm text-muted-foreground">{row.label}</p>
                      <p className="mt-1 text-2xl font-bold text-foreground">{row.value}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 rounded-[8px] border border-border/70 bg-background/80 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <BarChart3 className="h-4 w-4 text-primary" />
                      Analytics operativo
                    </div>
                    <span className="text-xs text-muted-foreground">fresh</span>
                  </div>
                  <div className="space-y-2">
                    <div className="h-2 rounded-full bg-primary/80" style={{ width: "84%" }} />
                    <div className="h-2 rounded-full bg-emerald-500/70" style={{ width: "68%" }} />
                    <div className="h-2 rounded-full bg-amber-500/70" style={{ width: "42%" }} />
                  </div>
                </div>
              </div>

              <div className="p-5 md:p-7">
                <div className="rounded-[8px] border border-border/70 bg-background/80 p-4">
                  <div className="mb-4 flex items-center gap-3 border-b border-border/70 pb-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-primary/10 text-primary">
                      <Bot className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Agente IA</p>
                      <p className="text-xs text-muted-foreground">Responde, deriva y registra contexto</p>
                    </div>
                  </div>

                  <div className="space-y-3 text-sm">
                    <div className="max-w-[82%] rounded-[8px] bg-muted px-3 py-2 text-muted-foreground">
                      Necesito resolver una consulta y adjuntar documentación.
                    </div>
                    <div className="ml-auto max-w-[86%] rounded-[8px] bg-primary px-3 py-2 text-primary-foreground">
                      Puedo ayudarte. El backend indica las acciones disponibles para este caso.
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="rounded-[8px] border border-border bg-card px-3 py-2 text-left text-xs font-medium text-foreground">
                        <MessageSquareText className="mb-1 h-4 w-4 text-primary" />
                        action.label
                      </div>
                      <div className="rounded-[8px] border border-border bg-card px-3 py-2 text-left text-xs font-medium text-foreground">
                        <MapPinned className="mb-1 h-4 w-4 text-success" />
                        action.requires_location
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[8px] border border-border/70 bg-background/80 p-4">
                    <Sparkles className="mb-3 h-5 w-5 text-amber-500" />
                    <p className="text-sm font-semibold">Conversion CTAs</p>
                    <p className="mt-1 text-xs text-muted-foreground">Labels y reglas desde backend.</p>
                  </div>
                  <div className="rounded-[8px] border border-border/70 bg-background/80 p-4">
                    <MapPinned className="mb-3 h-5 w-5 text-emerald-500" />
                    <p className="text-sm font-semibold">Mapas accionables</p>
                      <p className="mt-1 text-xs text-muted-foreground">Solo si hay datos para renderizar.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
