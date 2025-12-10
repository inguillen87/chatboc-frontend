import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, ArrowRight, MessageSquare, ShoppingBag, BarChart2, Store } from 'lucide-react';
import { getTenantPublicInfoFlexible } from '@/api/tenant';
import type { TenantPublicInfo } from '@/types/tenant';
import ChatbocLogoAnimated from '@/components/chat/ChatbocLogoAnimated';
import { useTenant } from '@/context/TenantContext';

// Simple Hero Component for the Demo Page
const DemoHero = ({ tenant }: { tenant: TenantPublicInfo }) => {
  return (
    <div className="bg-muted/30 py-16 md:py-24 border-b border-border/50">
      <div className="container mx-auto px-4 text-center">
        <div className="flex justify-center mb-6">
           {tenant.logo_url ? (
               <img src={tenant.logo_url} alt={tenant.nombre} className="h-20 w-auto object-contain" />
           ) : (
               <div className="h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                  <Store className="h-10 w-10" />
               </div>
           )}
        </div>
        <h1 className="text-4xl font-bold mb-4 tracking-tight text-foreground">
          Demo: {tenant.nombre}
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            {tenant.descripcion || "Explora cómo nuestra IA transforma la experiencia de usuarios y clientes en este sector."}
        </p>
        <div className="flex justify-center gap-4">
            <Button size="lg" className="shadow-lg" onClick={() => document.querySelector('.chatboc-toggle-btn')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))}>
                <MessageSquare className="mr-2 h-5 w-5" /> Probar Agente IA
            </Button>
            {tenant.public_catalog_url && (
                <Button variant="outline" size="lg" onClick={() => window.location.href = tenant.public_catalog_url!}>
                    <ShoppingBag className="mr-2 h-5 w-5" /> Ver Catálogo
                </Button>
            )}
        </div>
      </div>
    </div>
  );
};

const FeatureCard = ({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) => (
    <Card className="border-border shadow-sm hover:shadow-md transition-shadow">
        <CardHeader>
            <div className="mb-2 p-2 bg-primary/10 w-fit rounded-lg text-primary">{icon}</div>
            <CardTitle className="text-lg">{title}</CardTitle>
        </CardHeader>
        <CardContent>
            <CardDescription className="text-base">{desc}</CardDescription>
        </CardContent>
    </Card>
);

const DemoLandingPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState<TenantPublicInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { setTenant: setContextTenant } = useTenant();

  useEffect(() => {
    if (!slug) {
        navigate('/demo');
        return;
    }

    const loadDemo = async () => {
        try {
            setLoading(true);
            // Fetch public info which includes widget config, theme, etc.
            const data = await getTenantPublicInfoFlexible(slug);
            setTenant(data);

            // Important: Set the tenant in the global context so the ChatWidget picks it up
            // This ensures the widget uses the correct slug for its API calls
            setContextTenant(data);

            // Force widget to open via custom event or just relying on `default_open` in config
            // Ideally, we'd update the context to trigger open, but the widget reads `default_open` from config.
            // If the config returned by backend has default_open: true, it handles itself.
        } catch (err) {
            console.error("Failed to load demo:", err);
            setError("No pudimos cargar la demo solicitada. Verifica el nombre o intenta más tarde.");
        } finally {
            setLoading(false);
        }
    };

    loadDemo();
  }, [slug, navigate, setContextTenant]);

  if (loading) {
      return (
          <div className="min-h-screen flex flex-col items-center justify-center bg-background">
              <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Cargando experiencia...</p>
          </div>
      );
  }

  if (error || !tenant) {
      return (
          <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 text-center">
              <h1 className="text-2xl font-bold mb-2">Algo salió mal</h1>
              <p className="text-muted-foreground mb-6">{error || "Demo no encontrada"}</p>
              <Button onClick={() => navigate('/')}>Volver al Inicio</Button>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <DemoHero tenant={tenant} />

      <main className="flex-grow container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FeatureCard
                icon={<MessageSquare className="h-6 w-6" />}
                title="Atención 24/7"
                desc="El Agente IA responde consultas frecuentes, toma pedidos y resuelve reclamos en cualquier momento."
            />
             <FeatureCard
                icon={<ShoppingBag className="h-6 w-6" />}
                title="Catálogo Integrado"
                desc="Los productos y servicios se sincronizan automáticamente. Vende y reserva sin intervención manual."
            />
             <FeatureCard
                icon={<BarChart2 className="h-6 w-6" />}
                title="Datos en Tiempo Real"
                desc="Cada interacción alimenta tu dashboard. Visualiza qué buscan tus clientes y cómo mejorar."
            />
        </div>

        <div className="mt-16 text-center bg-card border border-border rounded-xl p-8 shadow-sm">
            <h2 className="text-2xl font-bold mb-4">¿Te gustaría tener esto en tu organización?</h2>
            <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
                Implementa esta misma tecnología en minutos. Sin código, sin configuraciones complejas.
            </p>
            <Button size="lg" variant="default" onClick={() => navigate('/register')}>
                Crear mi Espacio Gratis <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
        </div>
      </main>

      <footer className="py-8 border-t border-border text-center text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} Chatboc - Plataforma de Agentes IA</p>
      </footer>
    </div>
  );
};

export default DemoLandingPage;
