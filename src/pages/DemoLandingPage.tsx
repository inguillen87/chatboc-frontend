import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart2,
  Bot,
  Calendar,
  CheckCircle2,
  Loader2,
  MessageSquare,
  PhoneCall,
  PieChart,
  QrCode,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Store,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardPreview } from "@/components/demo/DashboardPreview";
import { ContextualSurvey } from "@/components/demo/ContextualSurvey";
import { VotingWidget } from "@/components/demo/VotingWidget";
import { MarketCartProvider } from "@/context/MarketCartContext";
import { useTenant } from "@/context/TenantContext";
import { getTenantPublicInfoFlexible, listTenantEvents, listTenantNews } from "@/api/tenant";
import ProductCatalog from "@/pages/ProductCatalog";
import type { TenantEventItem, TenantNewsItem, TenantPublicInfo } from "@/types/tenant";
import type { RealtimeVoiceCapabilities } from "@/types/realtimeVoice";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import DemoWorkspace from "@/features/demo/DemoWorkspace";
import {
  getRealtimeVoiceBadges,
  isRealtimeVoiceRenderable,
} from "@/utils/realtimeVoice";

const openWidget = () => {
  document.querySelector(".chatboc-toggle-btn")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
};

const DemoHero = ({
  tenant,
  realtimeVoice,
  showRealtimeVoice,
}: {
  tenant: TenantPublicInfo;
  realtimeVoice?: RealtimeVoiceCapabilities | null;
  showRealtimeVoice?: boolean;
}) => {
  const isMunicipio = tenant.tipo === "municipio" || tenant.slug === "municipio" || tenant.slug === "demo-municipio";
  const realtimeVoiceBadges = getRealtimeVoiceBadges(realtimeVoice);

  return (
    <section className="chatboc-hero-grid overflow-hidden pt-24 pb-12 text-foreground md:pt-32 md:pb-16">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-5xl text-center">
          <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-[8px] border border-border/70 bg-card/90 p-3 shadow-sm md:h-28 md:w-28">
            {tenant.logo_url ? (
              <img src={tenant.logo_url} alt={tenant.nombre} className="h-full w-full object-contain" />
            ) : (
              <Store className="h-10 w-10 text-primary" />
            )}
          </div>

          <Badge variant="outline" className="mb-5 rounded-[8px] border-primary/20 bg-primary/5 px-4 py-1.5 text-primary">
            Demo interactiva
          </Badge>
          <h1 className="mx-auto max-w-4xl text-4xl font-bold leading-tight tracking-normal md:text-6xl">{tenant.nombre}</h1>
          <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 text-muted-foreground md:text-xl">
            {tenant.descripcion ||
              "Simulación real de una experiencia Chatboc conectada a chat, panel, catálogo, contenido y analítica operativa."}
          </p>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button size="lg" className="chatboc-cta-primary h-12 rounded-[8px] px-7 font-semibold" onClick={openWidget}>
              <MessageSquare className="mr-2 h-5 w-5" />
              Abrir chat demo
            </Button>
            {showRealtimeVoice ? (
              <Button
                variant="secondary"
                size="lg"
                className="h-12 rounded-[8px] px-7 font-semibold"
                onClick={openWidget}
              >
                <PhoneCall className="mr-2 h-5 w-5" />
                Probar llamada IA
              </Button>
            ) : null}
            <Button
              variant="outline"
              size="lg"
              className="h-12 rounded-[8px] border-border/80 px-7 font-semibold hover:border-primary/40 hover:bg-primary/5"
              onClick={() => document.getElementById("demo-interactive-section")?.scrollIntoView({ behavior: "smooth" })}
            >
              {isMunicipio ? <Users className="mr-2 h-5 w-5" /> : <ShoppingBag className="mr-2 h-5 w-5" />}
              Ver experiencia
            </Button>
          </div>

          {showRealtimeVoice && realtimeVoiceBadges.length > 0 ? (
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {realtimeVoiceBadges.map((badge) => (
                <span
                  key={badge}
                  className="rounded-[8px] border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary"
                >
                  {badge}
                </span>
              ))}
            </div>
          ) : null}

          <div className="mx-auto mt-10 max-w-4xl">
            <div className="mb-3 flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground">
              <BarChart2 className="h-4 w-4" />
              Vista previa del panel operativo
            </div>
            <div className="chatboc-landing-panel chatboc-dashboard-scan h-[300px] overflow-hidden p-2">
              <DashboardPreview type={isMunicipio ? "municipio" : "pyme"} tenantName={tenant.nombre} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const FeatureCard = ({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) => (
  <Card className="chatboc-hover-lift h-full rounded-[8px] border-border/70 bg-card/90 shadow-sm">
    <CardHeader>
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-[8px] bg-primary/10 text-primary">{icon}</div>
      <CardTitle className="text-xl">{title}</CardTitle>
    </CardHeader>
    <CardContent>
      <CardDescription className="text-base leading-7">{desc}</CardDescription>
    </CardContent>
  </Card>
);

const DemoLandingPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState<TenantPublicInfo | null>(null);
  const [news, setNews] = useState<TenantNewsItem[]>([]);
  const [events, setEvents] = useState<TenantEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { setTenantSlug } = useTenant();
  const effectiveRealtimeVoice =
    tenant?.realtime_voice ||
    tenant?.widget?.realtime_voice ||
    tenant?.support_channels?.voice_call?.capabilities ||
    tenant?.widget?.support_channels?.voice_call?.capabilities ||
    null;
  const voiceCallConfig = useMemo(
    () =>
      tenant?.support_channels?.voice_call ||
      tenant?.widget?.support_channels?.voice_call ||
      null,
    [tenant?.support_channels?.voice_call, tenant?.widget?.support_channels?.voice_call],
  );
  const showRealtimeVoice = isRealtimeVoiceRenderable(
    effectiveRealtimeVoice,
    voiceCallConfig,
  );

  useEffect(() => {
    safeLocalStorage.removeItem("chatboc_chat_session_id");
    safeLocalStorage.removeItem("chatboc_thread_id");
  }, [slug]);

  useEffect(() => {
    if (!slug) {
      navigate("/demo");
      return;
    }

    const loadDemo = async () => {
      try {
        setLoading(true);
        const data = await getTenantPublicInfoFlexible(slug);
        setTenant(data);

        if (data.slug) {
          setTenantSlug(data.slug);
          const [newsData, eventsData] = await Promise.all([
            listTenantNews(data.slug).catch(() => []),
            listTenantEvents(data.slug).catch(() => []),
          ]);
          setNews(newsData);
          setEvents(eventsData);
        }

        setTimeout(() => {
          if (!document.querySelector(".chatboc-widget-window")) {
            openWidget();
          }
        }, 1500);
      } catch (err) {
        console.error("Failed to load demo:", err);
        setError("No pudimos cargar la demo solicitada. Verificá el enlace o intentá nuevamente.");
      } finally {
        setLoading(false);
      }
    };

    loadDemo();
  }, [slug, navigate, setTenantSlug]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
        <Loader2 className="mb-4 h-12 w-12 animate-spin text-primary" />
        <p className="text-lg text-muted-foreground">Configurando entorno de demostración...</p>
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
        <div className="mb-4 rounded-[8px] bg-destructive/10 p-4 text-destructive">
          <Store className="h-8 w-8" />
        </div>
        <h1 className="mb-2 text-2xl font-bold">Algo salió mal</h1>
        <p className="mb-6 max-w-md text-muted-foreground">{error || "Demo no encontrada."}</p>
        <Button onClick={() => navigate("/")} variant="outline" className="rounded-[8px]">
          Volver al inicio
        </Button>
      </div>
    );
  }

  const hasContent = news.length > 0 || events.length > 0;
  const isMunicipio = tenant.tipo === "municipio" || tenant.slug === "municipio" || tenant.slug === "demo-municipio";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <DemoHero
        tenant={tenant}
        realtimeVoice={effectiveRealtimeVoice}
        showRealtimeVoice={showRealtimeVoice}
      />

      <main className="container mx-auto px-4 py-16 md:py-20">
        <div className="mb-12">
          <DemoWorkspace tenantSlug={tenant.slug} sector={isMunicipio ? "gobierno" : "empresas"} />
        </div>

        <div className="mx-auto mb-12 max-w-3xl text-center">
          <div className="chatboc-section-kicker mb-4">Tecnología visible</div>
          <h2 className="chatboc-section-heading">La conversación y el panel se actualizan juntos</h2>
          <p className="chatboc-section-copy mt-4">
            Esta demo mantiene el tenant activo, abre el widget y muestra cómo la experiencia pública conversa con datos y módulos operativos.
          </p>
        </div>

        <div className="mb-20 grid gap-4 md:grid-cols-3">
          <FeatureCard
            icon={<Smartphone className="h-6 w-6" />}
            title="Omnicanalidad"
            desc="La misma lógica puede operar web, widget y canales conversacionales sin duplicar la experiencia."
          />
          <FeatureCard
            icon={<PieChart className="h-6 w-6" />}
            title="Métricas útiles"
            desc="La demo muestra conversación, contenido, tickets o catálogo como parte de un circuito medible."
          />
          <FeatureCard
            icon={<ShieldCheck className="h-6 w-6" />}
            title="Contratos estables"
            desc="La UI consume datos del backend y evita personalizaciones locales que rompan el modelo white label."
          />
        </div>

        {hasContent ? (
          <section className="mb-20">
            <div className="mb-10 text-center">
              <Badge variant="secondary" className="mb-3 rounded-[8px]">
                Portal público
              </Badge>
              <h2 className="text-3xl font-bold tracking-normal">Novedades de {tenant.nombre}</h2>
              <p className="mt-3 text-muted-foreground">Contenido cargado desde la plataforma para este tenant.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {news.map((item) => (
                <Card key={item.id} className="chatboc-hover-lift overflow-hidden rounded-[8px] border-border/70">
                  {item.cover_url ? (
                    <div className="relative h-48 w-full bg-muted">
                      <img src={item.cover_url} alt={item.titulo} className="h-full w-full object-cover" />
                      <div className="absolute right-2 top-2 rounded-[8px] bg-background/90 px-2 py-1 text-xs font-semibold backdrop-blur">
                        Noticia
                      </div>
                    </div>
                  ) : null}
                  <CardHeader>
                    <CardTitle className="line-clamp-2 text-lg">{item.titulo}</CardTitle>
                    <CardDescription className="line-clamp-3">{item.resumen}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="link" className="h-auto p-0 text-primary">
                      Leer más
                      <ArrowUpRight className="ml-1 h-3 w-3" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
              {events.map((item) => (
                <Card key={item.id} className="chatboc-hover-lift overflow-hidden rounded-[8px] border-border/70">
                  {item.cover_url ? (
                    <div className="relative h-48 w-full bg-muted">
                      <img src={item.cover_url} alt={item.titulo} className="h-full w-full object-cover" />
                      <div className="absolute right-2 top-2 flex items-center gap-1 rounded-[8px] bg-background/90 px-2 py-1 text-xs font-semibold backdrop-blur">
                        <Calendar className="h-3 w-3" />
                        Evento
                      </div>
                    </div>
                  ) : null}
                  <CardHeader>
                    <CardTitle className="line-clamp-2 text-lg">{item.titulo}</CardTitle>
                    <CardDescription className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 opacity-70" />
                      {item.starts_at ? new Date(item.starts_at).toLocaleDateString() : "Próximamente"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="link" className="h-auto p-0 text-primary">
                      Ver detalles
                      <ArrowUpRight className="ml-1 h-3 w-3" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ) : null}

        <section id="demo-interactive-section" className="mb-20 scroll-mt-24">
          <div className="mb-10 text-center">
            <Badge variant="secondary" className="mb-3 rounded-[8px]">
              Experiencia de usuario
            </Badge>
            <h2 className="text-3xl font-bold tracking-normal">{isMunicipio ? "Participación ciudadana" : "Catálogo digital inteligente"}</h2>
            <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
              {isMunicipio
                ? "Vista de referencia para probar una votación simple conectada a la experiencia del portal."
                : "Vista de referencia para explorar catálogo, carrito y feedback contextual dentro del tenant."}
            </p>
          </div>

          <div className="chatboc-landing-panel overflow-hidden">
            {isMunicipio ? (
              <div className="grid md:grid-cols-2">
                <div className="flex flex-col justify-center bg-muted/30 p-6 md:p-10">
                  <h3 className="mb-4 text-2xl font-bold">Votación demo</h3>
                  <p className="mb-6 text-muted-foreground">
                    Ejemplo de participación digital con una pregunta breve y respuesta inmediata.
                  </p>
                  <div className="w-full max-w-md rounded-[8px] border bg-background p-5 shadow-sm">
                    <VotingWidget question="¿Qué opción priorizarías?" yesLabel="Opción A" noLabel="Opción B" />
                  </div>
                </div>
                <div className="flex items-center justify-center bg-primary/5 p-8 text-center md:p-10">
                  <div className="max-w-sm">
                    <QrCode className="mx-auto mb-6 h-28 w-28 text-primary opacity-80" />
                    <h4 className="mb-2 font-semibold">Acceso rápido</h4>
                    <p className="text-sm text-muted-foreground">
                      El portal puede distribuirse por QR, link público o canal conversacional.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid min-h-[600px] grid-cols-1 lg:grid-cols-3">
                <div className="border-border/60 lg:col-span-2 lg:border-r">
                  {tenant.slug ? (
                    <MarketCartProvider tenantSlug={tenant.slug}>
                      <div className="h-full bg-muted/10 p-4">
                        <ProductCatalog tenantSlug={tenant.slug} isDemoMode />
                      </div>
                    </MarketCartProvider>
                  ) : (
                    <div className="flex h-full items-center justify-center p-12 text-muted-foreground">
                      Catálogo no disponible en esta demo.
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-center justify-center bg-background p-6 text-center">
                  <Badge variant="outline" className="mb-3 rounded-[8px]">
                    Feedback
                  </Badge>
                  <h4 className="text-lg font-semibold">Encuestas contextuales</h4>
                  <p className="mb-6 mt-2 text-sm text-muted-foreground">
                    Captura señales después de una compra, consulta o interacción.
                  </p>
                  <ContextualSurvey />
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="chatboc-landing-panel p-6 md:p-10">
          <div className="grid gap-10 md:grid-cols-2 md:items-center">
            <div>
              <h2 className="text-3xl font-bold tracking-normal">Activá una experiencia similar para tu organización</h2>
              <ul className="mt-6 space-y-3 text-muted-foreground">
                {[
                  "Configuración guiada y compatible con contratos actuales",
                  "Widget, panel y canales conectados al tenant",
                  "Soporte para evolución por etapas",
                  "Integración progresiva con sistemas existentes",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-success" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Button size="lg" className="chatboc-cta-primary mt-8 rounded-[8px] px-7 font-semibold" onClick={() => navigate("/register")}>
                Crear cuenta
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
            <div className="rounded-[8px] border border-border/70 bg-background p-7 text-center shadow-sm">
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-[8px] bg-primary/10 text-primary">
                <Bot className="h-7 w-7" />
              </div>
              <h3 className="text-xl font-semibold">Panel y agente en el mismo circuito</h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Conversaciones, contenido, acciones y métricas se sostienen desde una base común para evitar experiencias duplicadas.
              </p>
              <Button variant="outline" size="sm" className="mt-5 rounded-[8px]" onClick={openWidget}>
                Abrir chat
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-muted/20 py-10 text-center">
        <div className="container mx-auto px-4">
          <div className="mb-4 flex items-center justify-center gap-2">
            <img
              src="/chatboc_frontend_pack/branding/chatboc/navbar/chatboc-navbar-mark-circle.svg"
              alt="Chatboc"
              className="h-8 w-8 rounded-full"
            />
            <span className="font-bold">Chatboc</span>
          </div>
          <p className="mx-auto max-w-lg text-sm text-muted-foreground">
            Plataforma de agentes IA para operar conversaciones, ventas y servicios con contratos estables.
          </p>
          <div className="mt-6 text-xs text-muted-foreground/70">
            © {new Date().getFullYear()} Chatboc Technologies. Todos los derechos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default DemoLandingPage;
