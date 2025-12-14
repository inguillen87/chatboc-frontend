import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowRight, MessageSquare, ShoppingBag, BarChart2, Store, Smartphone, PieChart, CheckCircle2, QrCode, Users, Calendar, Newspaper, ArrowUpRight } from 'lucide-react';
import { getTenantPublicInfoFlexible, listTenantNews, listTenantEvents } from '@/api/tenant';
import type { TenantPublicInfo, TenantNewsItem, TenantEventItem } from '@/types/tenant';
import { useTenant } from '@/context/TenantContext';
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import { DashboardPreview } from '@/components/demo/DashboardPreview';
import ProductCatalog from '@/pages/ProductCatalog';
import { MarketCartProvider } from '@/context/MarketCartContext';

// --- Components for Visual Enhancement ---

const DemoHero = ({ tenant }: { tenant: TenantPublicInfo }) => {
  const isMunicipio = tenant.tipo === 'municipio';

  return (
    <div className="relative bg-gradient-to-b from-background via-muted/20 to-background pt-24 pb-32 overflow-hidden">
      {/* Abstract Background Shapes */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-primary/5 rounded-full blur-3xl"></div>
          <div className="absolute bottom-[10%] left-[-5%] w-72 h-72 bg-blue-500/5 rounded-full blur-3xl"></div>
      </div>

      <div className="container mx-auto px-4 text-center relative z-10">
        <div className="flex justify-center mb-8">
           <div className="relative group">
                {/* Glow effect behind logo */}
                <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full scale-110 group-hover:scale-125 transition-transform duration-500"></div>
                {tenant.logo_url ? (
                    <img src={tenant.logo_url} alt={tenant.nombre} className="h-24 w-24 md:h-28 md:w-28 object-contain relative z-10 drop-shadow-sm" />
                ) : (
                    <div className="h-24 w-24 bg-background border-2 border-primary/20 rounded-full flex items-center justify-center text-primary relative z-10 shadow-lg">
                        <Store className="h-10 w-10" />
                    </div>
                )}
           </div>
        </div>

        <Badge variant="outline" className="mb-6 px-4 py-1.5 border-primary/20 text-primary bg-primary/5 text-sm backdrop-blur-sm">
            {isMunicipio ? 'Soluciones para Gobierno' : 'Soluciones para Empresas'}
        </Badge>

        <h1 className="text-4xl md:text-6xl font-extrabold mb-6 tracking-tight text-foreground leading-tight">
          {tenant.nombre}
          <span className="block text-primary mt-2 text-2xl md:text-4xl font-semibold opacity-90">
             {isMunicipio ? 'Participación Ciudadana e IA' : 'Automatización de Ventas con IA'}
          </span>
        </h1>

        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            {tenant.descripcion || "Esta es una simulación real de cómo nuestra tecnología automatiza la atención, ventas y procesos en este sector."}
        </p>

        <div className="flex flex-col sm:flex-row justify-center gap-4 mb-16">
            <Button size="lg" className="h-12 px-8 text-base shadow-lg hover:shadow-primary/20 hover:scale-105 transition-all duration-300"
                    onClick={() => document.querySelector('.chatboc-toggle-btn')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))}>
                <MessageSquare className="mr-2 h-5 w-5" /> Iniciar Chat Demo
            </Button>
            {isMunicipio ? (
                 <Button variant="outline" size="lg" className="h-12 px-8 text-base border-primary/20 hover:bg-primary/5"
                    onClick={() => document.getElementById('demo-interactive-section')?.scrollIntoView({ behavior: 'smooth' })}>
                    <Users className="mr-2 h-5 w-5" /> Participación Ciudadana
                </Button>
            ) : (
                <Button variant="outline" size="lg" className="h-12 px-8 text-base border-primary/20 hover:bg-primary/5"
                        onClick={() => document.getElementById('demo-interactive-section')?.scrollIntoView({ behavior: 'smooth' })}>
                    <ShoppingBag className="mr-2 h-5 w-5" /> Explorar Catálogo
                </Button>
            )}
        </div>

        {/* Dashboard Preview */}
        <div className="mt-8 perspective-1000 max-w-4xl mx-auto">
             <div className="text-sm font-medium text-muted-foreground mb-4 flex items-center justify-center gap-2">
                <BarChart2 className="w-4 h-4" />
                Vista previa del {isMunicipio ? 'Panel de Gobierno' : 'Panel de Control'}
             </div>
             <div className="h-[300px] w-full">
                <DashboardPreview type={isMunicipio ? 'municipio' : 'pyme'} tenantName={tenant.nombre} />
             </div>
        </div>
      </div>
    </div>
  );
};

const FeatureCard = ({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) => (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-300 h-full">
        <CardHeader>
            <div className="mb-4 p-3 bg-primary/10 w-fit rounded-xl text-primary ring-1 ring-primary/20">{icon}</div>
            <CardTitle className="text-xl">{title}</CardTitle>
        </CardHeader>
        <CardContent>
            <CardDescription className="text-base leading-relaxed">{desc}</CardDescription>
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
    const [demoVote, setDemoVote] = useState<string | null>(null);
  const { setTenantSlug } = useTenant();

  // Reset logic to prevent context bleeding between demos
  useEffect(() => {
    // 1. Clear chat session storage to avoid "Welcome to Clinic" when visiting "Municipality"
    safeLocalStorage.removeItem("chatboc_chat_session_id");
    safeLocalStorage.removeItem("chatboc_thread_id");

    // 2. Force widget reload if necessary (by dispatching a custom event the widget listens to, or relying on key change)
    // For now, removing session_id is the most critical step as the backend uses it to retrieve history.
  }, [slug]);

  useEffect(() => {
    if (!slug) {
        navigate('/demo');
        return;
    }

    const loadDemo = async () => {
        try {
            setLoading(true);
            // Fetch basic tenant info
            const data = await getTenantPublicInfoFlexible(slug);
            setTenant(data);

            // Fetch dynamic content
            if (data.slug) {
                setTenantSlug(data.slug);

                // Parallel fetch for news and events
                const [newsData, eventsData] = await Promise.all([
                    listTenantNews(data.slug).catch(() => []),
                    listTenantEvents(data.slug).catch(() => [])
                ]);
                setNews(newsData);
                setEvents(eventsData);
            }

            // Auto-open widget after a short delay for better UX
            setTimeout(() => {
                const widgetBtn = document.querySelector('.chatboc-toggle-btn');
                if (widgetBtn && !document.querySelector('.chatboc-widget-window')) {
                    widgetBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                }
            }, 1500);

        } catch (err) {
            console.error("Failed to load demo:", err);
            setError("No pudimos cargar la demo solicitada. Verifica el nombre o intenta más tarde.");
        } finally {
            setLoading(false);
        }
    };

    loadDemo();
  }, [slug, navigate, setTenantSlug]);

  if (loading) {
      return (
          <div className="min-h-screen flex flex-col items-center justify-center bg-background">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground text-lg animate-pulse">Configurando entorno de demostración...</p>
          </div>
      );
  }

  if (error || !tenant) {
      return (
          <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 text-center">
              <div className="bg-destructive/10 p-4 rounded-full mb-4 text-destructive">
                  <Store className="h-8 w-8" />
              </div>
              <h1 className="text-2xl font-bold mb-2">Algo salió mal</h1>
              <p className="text-muted-foreground mb-6 max-w-md">{error || "Demo no encontrada"}</p>
              <Button onClick={() => navigate('/')} variant="outline">Volver al Inicio</Button>
          </div>
      );
  }

  const hasContent = news.length > 0 || events.length > 0;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      <DemoHero tenant={tenant} />

      <main className="flex-grow container mx-auto px-4 py-20">
        <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl font-bold mb-4">Tecnología Transparente</h2>
            <p className="text-muted-foreground text-lg">
                Mientras tus usuarios interactúan con el chat, tu panel de control se actualiza en tiempo real.
            </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-24">
            <FeatureCard
                icon={<Smartphone className="h-6 w-6" />}
                title="Omnicanalidad Real"
                desc="El mismo asistente atiende en Web, WhatsApp, Instagram y Telegram. Una sola configuración, múltiples canales."
            />
             <FeatureCard
                icon={<PieChart className="h-6 w-6" />}
                title="Métricas de Negocio"
                desc="No solo medimos mensajes, medimos resultados: ventas cerradas, turnos agendados y reclamos resueltos."
            />
             <FeatureCard
                icon={<CheckCircle2 className="h-6 w-6" />}
                title="Autonomía Total"
                desc="El agente aprende de tu documentación y catálogo. Responde preguntas complejas sin intervención humana."
            />
        </div>

        {/* Dynamic Content Section (If Available) */}
        {hasContent && (
            <section className="mb-24">
                <div className="text-center mb-12">
                    <Badge variant="secondary" className="mb-3">Portal de {tenant.tipo === 'municipio' ? 'Vecinos' : 'Clientes'}</Badge>
                    <h2 className="text-3xl font-bold mb-4">Últimas Novedades en {tenant.nombre}</h2>
                    <p className="text-muted-foreground">Contenido real generado automáticamente por la plataforma.</p>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {news.map((item) => (
                        <Card key={item.id} className="hover:shadow-md transition-shadow cursor-pointer overflow-hidden border-border/50">
                            {item.cover_url && (
                                <div className="h-48 w-full bg-muted relative">
                                    <img src={item.cover_url} alt={item.titulo} className="w-full h-full object-cover" />
                                    <div className="absolute top-2 right-2 bg-background/90 backdrop-blur px-2 py-1 rounded text-xs font-semibold">Noticia</div>
                                </div>
                            )}
                            <CardHeader>
                                <CardTitle className="line-clamp-2 text-lg">{item.titulo}</CardTitle>
                                <CardDescription className="line-clamp-3">{item.resumen}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Button variant="link" className="p-0 h-auto text-primary">Leer más <ArrowUpRight className="ml-1 w-3 h-3" /></Button>
                            </CardContent>
                        </Card>
                    ))}
                    {events.map((item) => (
                        <Card key={item.id} className="hover:shadow-md transition-shadow cursor-pointer overflow-hidden border-border/50">
                             {item.cover_url && (
                                <div className="h-48 w-full bg-muted relative">
                                    <img src={item.cover_url} alt={item.titulo} className="w-full h-full object-cover" />
                                    <div className="absolute top-2 right-2 bg-background/90 backdrop-blur px-2 py-1 rounded text-xs font-semibold flex items-center gap-1">
                                        <Calendar className="w-3 h-3" /> Evento
                                    </div>
                                </div>
                            )}
                            <CardHeader>
                                <CardTitle className="line-clamp-2 text-lg">{item.titulo}</CardTitle>
                                <CardDescription className="flex items-center gap-2 mt-1">
                                    <Calendar className="w-4 h-4 opacity-70" />
                                    {item.starts_at ? new Date(item.starts_at).toLocaleDateString() : 'Próximamente'}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Button variant="link" className="p-0 h-auto text-primary">Ver detalles <ArrowUpRight className="ml-1 w-3 h-3" /></Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </section>
        )}

        {/* Interactive Ecosystem Section */}
        <section id="demo-interactive-section" className="mb-24 scroll-mt-24">
            <div className="text-center mb-12">
                 <Badge variant="secondary" className="mb-3">Experiencia del Usuario</Badge>
                 <h2 className="text-3xl font-bold mb-4">
                     {tenant.tipo === 'municipio' ? 'Participación Ciudadana en Acción' : 'Tu Catálogo Digital Inteligente'}
                 </h2>
                 <p className="text-muted-foreground max-w-2xl mx-auto">
                     {tenant.tipo === 'municipio'
                        ? 'Así ven tus vecinos las encuestas y servicios digitales. Pruébalo ahora mismo.'
                        : 'Tus clientes pueden navegar, comprar y pagar sin salir del chat. Integración total con WhatsApp.'}
                 </p>
            </div>

            <div className="bg-card border rounded-3xl overflow-hidden shadow-sm">
                {tenant.tipo === 'municipio' ? (
                    // Government / Survey Mock
                    <div className="grid md:grid-cols-2">
                        <div className="p-8 md:p-12 flex flex-col justify-center bg-muted/30">
                             <h3 className="text-2xl font-bold mb-4">Presupuesto Participativo 2024</h3>
                             <p className="text-muted-foreground mb-6">
                                 Ejemplo real de votación ciudadana. Los vecinos eligen qué obras priorizar en su barrio mediante un formulario simple y seguro.
                             </p>
                             <div className="bg-background rounded-xl p-6 shadow-sm border max-w-md w-full mx-auto md:mx-0">
                                 {demoVote ? (
                                     <div className="text-center py-8">
                                         <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                                         <h4 className="text-xl font-bold mb-2">¡Voto Registrado!</h4>
                                         <p className="text-muted-foreground text-sm">
                                             Gracias por participar. En un entorno real, esto actualiza el panel de gestión en tiempo real.
                                         </p>
                                         <Button variant="ghost" size="sm" className="mt-4" onClick={() => setDemoVote(null)}>Votar de nuevo</Button>
                                     </div>
                                 ) : (
                                     <div className="space-y-4">
                                         <div className="space-y-2">
                                             <label className="text-sm font-medium">¿Qué obra priorizarías?</label>
                                             <div className="space-y-2">
                                                 {['Mejoras en Plazas', 'Nuevas Luminarias LED', 'Cámaras de Seguridad'].map((opt) => (
                                                     <div
                                                        key={opt}
                                                        className="flex items-center space-x-3 border p-3 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                                                        onClick={() => setDemoVote(opt)}
                                                     >
                                                         <div className={`w-4 h-4 rounded-full border ${demoVote === opt ? 'border-primary bg-primary' : 'border-muted-foreground'}`}></div>
                                                         <span className="text-sm">{opt}</span>
                                                     </div>
                                                 ))}
                                             </div>
                                         </div>
                                         <Button className="w-full" disabled={!demoVote} onClick={() => setDemoVote('submitted')}>Enviar Voto (Demo)</Button>
                                     </div>
                                 )}
                             </div>
                        </div>
                        <div className="bg-primary/5 p-8 md:p-12 flex items-center justify-center">
                             <div className="text-center max-w-sm">
                                 <QrCode className="w-32 h-32 mx-auto text-primary mb-6 opacity-80" />
                                 <h4 className="font-semibold mb-2">Escanea para probar en tu móvil</h4>
                                 <p className="text-sm text-muted-foreground">
                                     Los vecinos pueden acceder escaneando un QR en la vía pública o mediante un link de WhatsApp.
                                 </p>
                             </div>
                        </div>
                    </div>
                ) : (
                    // Retail / Catalog Embed
                    <div className="min-h-[600px] border-t relative">
                        {tenant.slug ? (
                            <MarketCartProvider tenantSlug={tenant.slug}>
                                <div className="h-full bg-muted/10 p-4">
                                    <ProductCatalog tenantSlug={tenant.slug} isDemoMode={true} />
                                </div>
                            </MarketCartProvider>
                        ) : (
                            <div className="flex items-center justify-center h-full p-12 text-muted-foreground">
                                Catálogo no disponible en esta demo.
                            </div>
                        )}
                    </div>
                )}
            </div>
        </section>

        <div className="relative bg-primary/5 rounded-3xl p-8 md:p-12 overflow-hidden border border-primary/10">
             <div className="absolute top-0 right-0 -mt-16 -mr-16 w-64 h-64 bg-primary/10 rounded-full blur-3xl"></div>

             <div className="relative z-10 grid md:grid-cols-2 gap-12 items-center">
                 <div>
                    <h2 className="text-3xl font-bold mb-6">¿Listo para transformar tu {tenant.tipo === 'municipio' ? 'gestión pública' : 'negocio'}?</h2>
                    <ul className="space-y-4 mb-8">
                        {[
                            'Configuración en menos de 5 minutos',
                            'Prueba gratuita sin tarjeta de crédito',
                            'Soporte técnico prioritario',
                            'Integración con tus sistemas actuales'
                        ].map((item, i) => (
                            <li key={i} className="flex items-center gap-3">
                                <CheckCircle2 className="w-5 h-5 text-primary" />
                                <span>{item}</span>
                            </li>
                        ))}
                    </ul>
                    <Button size="lg" className="h-14 px-8 text-lg shadow-xl hover:shadow-primary/25 transition-all" onClick={() => navigate('/register')}>
                        Crear mi Cuenta Gratis <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                 </div>
                 <div className="relative h-64 md:h-full min-h-[300px] bg-background rounded-xl border shadow-lg flex items-center justify-center p-8 text-center">
                     <div className="space-y-4 max-w-xs mx-auto">
                        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mx-auto mb-4">
                            <Store className="w-8 h-8" />
                        </div>
                        <h3 className="font-semibold text-xl">Tu Panel de Control</h3>
                        <p className="text-sm text-muted-foreground">
                            Visualiza todas las conversaciones, gestiona tu catálogo y analiza el rendimiento de tu agente desde un solo lugar.
                        </p>
                        <Button variant="outline" size="sm" className="w-full">Ver Demo del Panel</Button>
                     </div>
                 </div>
             </div>
        </div>
      </main>

      <footer className="py-12 border-t border-border bg-muted/20 text-center">
        <div className="container mx-auto px-4">
            <div className="flex items-center justify-center gap-2 mb-4 opacity-80">
                <div className="h-8 w-8 bg-primary/20 rounded-lg flex items-center justify-center text-primary">
                    <Store className="h-5 w-5" />
                </div>
                <span className="font-bold text-lg">Chatboc</span>
            </div>
            <p className="text-sm text-muted-foreground mb-8 max-w-lg mx-auto">
                La plataforma líder de Agentes IA para Gobiernos y Empresas en Latinoamérica.
            </p>
            <div className="text-xs text-muted-foreground/60">
                © {new Date().getFullYear()} Chatboc Technologies. Todos los derechos reservados.
            </div>
        </div>
      </footer>
    </div>
  );
};

export default DemoLandingPage;
