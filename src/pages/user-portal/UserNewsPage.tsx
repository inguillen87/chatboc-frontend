import React, { useMemo, useState } from 'react';
import { useTenant } from '@/context/TenantContext';
import { buildTenantPath } from '@/utils/tenantPaths';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { CalendarDays, Link as LinkIcon, Newspaper, Sparkles, Tag } from 'lucide-react';

interface NewsItem {
  id: string;
  title: string;
  category: string;
  date: string;
  summary: string;
  link?: string;
  featured?: boolean;
}

const demoNews: NewsItem[] = [
  {
    id: 'news-001',
    title: 'Nueva versión del portal con seguimiento de gestiones en tiempo real',
    category: 'Plataforma',
    date: '08/05/2024',
    summary: 'Explora el panel de usuario para revisar pedidos, reclamos y encuestas desde un solo lugar.',
    featured: true,
  },
  {
    id: 'news-002',
    title: 'Consejos para mantener tus datos de contacto al día',
    category: 'Tips',
    date: '06/05/2024',
    summary: 'Actualiza tu correo y teléfono para recibir notificaciones de entregas y recordatorios.',
  },
  {
    id: 'news-003',
    title: 'Resultados preliminares de la encuesta de satisfacción ciudadana',
    category: 'Participación',
    date: '04/05/2024',
    summary: 'Gracias por compartir tu opinión. Conoce cómo se priorizan las mejoras del servicio.',
  },
];

const categories = ['todas', 'plataforma', 'tips', 'participación'];

const UserNewsPage = () => {
  const { currentSlug } = useTenant();
  const [activeCategory, setActiveCategory] = useState('todas');
  const loginPath = useMemo(() => buildTenantPath('/login', currentSlug ?? undefined), [currentSlug]);

  const filteredNews = demoNews.filter((item) =>
    activeCategory === 'todas'
      ? true
      : item.category.toLowerCase() === activeCategory,
  );

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="rounded-full">Demo</Badge>
            <p className="text-xs text-muted-foreground">Contenido ilustrativo guardado en este dispositivo</p>
          </div>
          <h1 className="text-3xl font-bold text-foreground">Novedades y avisos</h1>
          <p className="text-muted-foreground text-sm md:text-base max-w-3xl">
            Consulta las últimas noticias, mejoras de la plataforma y recordatorios importantes para tus gestiones.
          </p>
        </div>
        <Button asChild variant="outline">
          <a href={loginPath}>Iniciar sesión</a>
        </Button>
      </div>

      <Tabs value={activeCategory} onValueChange={setActiveCategory} className="space-y-4">
        <TabsList className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-muted/60 dark:bg-muted/40">
          {categories.map((category) => (
            <TabsTrigger key={category} value={category} className="capitalize">
              {category}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={activeCategory} className="space-y-4">
          {filteredNews.map((item) => (
            <Card key={item.id} className="border border-muted/70 shadow-sm bg-card/80">
              <CardHeader className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CalendarDays className="h-4 w-4" />
                    <span>{item.date}</span>
                    <Separator orientation="vertical" className="h-4" />
                    <span className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wide text-primary">
                      <Tag className="h-3 w-3" /> {item.category}
                    </span>
                    {item.featured && (
                      <span className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wide text-amber-600 dark:text-amber-400">
                        <Sparkles className="h-3 w-3" /> Destacado
                      </span>
                    )}
                  </div>
                  <CardTitle className="text-xl leading-tight text-foreground">{item.title}</CardTitle>
                  <p className="text-sm text-muted-foreground max-w-3xl">{item.summary}</p>
                </div>
                <Button variant="secondary" size="sm" className="mt-2 md:mt-0" asChild>
                  <a href={item.link ?? '#'} className="inline-flex items-center gap-2">
                    <LinkIcon className="h-4 w-4" />
                    Ver detalle
                  </a>
                </Button>
              </CardHeader>
            </Card>
          ))}

          {filteredNews.length === 0 && (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">No hay novedades para esta categoría.</CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Card className="bg-muted/40">
        <CardHeader>
          <CardTitle>Centro de notificaciones</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="flex items-start gap-3">
            <Newspaper className="h-4 w-4 mt-0.5 text-primary" />
            <p>Activa las notificaciones en tu perfil para recibir avisos de entregas, reclamos y encuestas pendientes.</p>
          </div>
          <div className="flex items-start gap-3">
            <Sparkles className="h-4 w-4 mt-0.5 text-primary" />
            <p>Al iniciar sesión verás las alertas personalizadas con tus gestiones y puntos acumulados.</p>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between flex-wrap gap-2 text-sm text-muted-foreground">
          <span>Inicia sesión para sincronizar tus avisos reales.</span>
          <Button asChild size="sm">
            <a href={loginPath}>Ir a iniciar sesión</a>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default UserNewsPage;
