import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarDays, Link as LinkIcon, RefreshCw, Tag } from 'lucide-react';

import { useTenant } from '@/context/TenantContext';
import { usePortalContent } from '@/hooks/usePortalContent';
import { buildTenantPath } from '@/utils/tenantPaths';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { GridSkeleton, HeroSkeleton } from '@/components/user-portal/shared/PortalContentSkeleton';

const UserNewsPage = () => {
  const { currentSlug } = useTenant();
  const [activeCategory, setActiveCategory] = useState('todas');
  const { content, isLoading, refetch } = usePortalContent();
  const loginPath = useMemo(() => buildTenantPath('/user/login', currentSlug ?? undefined), [currentSlug]);

  const categories = useMemo(() => {
    const unique = new Set((content.news ?? []).map((item) => item.category?.toLowerCase()).filter(Boolean));
    return ['todas', ...Array.from(unique)] as string[];
  }, [content.news]);

  const filteredNews = (content.news ?? []).filter((item) =>
    activeCategory === 'todas' ? true : item.category?.toLowerCase() === activeCategory,
  );

  const featured = filteredNews.find((item) => item.featured) ?? filteredNews[0];

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Novedades y avisos</h1>
          <p className="text-muted-foreground text-sm md:text-base max-w-3xl">
            Publicaciones entregadas por el backend para este portal.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" aria-label="Actualizar" onClick={() => refetch()}>
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          </Button>
          <Button asChild variant="outline">
            <a href={loginPath}>Iniciar sesion</a>
          </Button>
        </div>
      </div>

      {isLoading && filteredNews.length === 0 ? <HeroSkeleton /> : null}

      {featured && !isLoading ? (
        <Card className="overflow-hidden border border-muted/70 shadow-sm">
          <div className="relative h-56 md:h-64 w-full overflow-hidden">
            {featured.coverUrl ? (
              <img src={featured.coverUrl} alt={featured.title} className="absolute inset-0 w-full h-full object-cover" />
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-6 space-y-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {featured.date ? (
                  <>
                    <CalendarDays className="h-4 w-4" />
                    <span>{featured.date}</span>
                  </>
                ) : null}
                {featured.category ? (
                  <>
                    <Separator orientation="vertical" className="h-4" />
                    <span className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wide text-primary">
                      <Tag className="h-3 w-3" /> {featured.category}
                    </span>
                  </>
                ) : null}
              </div>
              <h2 className="text-2xl font-semibold text-foreground drop-shadow">{featured.title}</h2>
              {featured.summary ? <p className="text-sm text-muted-foreground max-w-3xl">{featured.summary}</p> : null}
              {featured.link ? (
                <div className="flex items-center gap-2">
                  {featured.featured ? <Badge variant="secondary" className="rounded-full">Destacado</Badge> : null}
                  <Button variant="secondary" size="sm" className="mt-1" asChild>
                    <a href={featured.link} className="inline-flex items-center gap-2">
                      <LinkIcon className="h-4 w-4" />
                      Ver detalle
                    </a>
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        </Card>
      ) : null}

      <Tabs value={activeCategory} onValueChange={setActiveCategory} className="space-y-4">
        {categories.length > 1 ? (
          <TabsList className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-muted/60 dark:bg-muted/40">
            {categories.map((category) => (
              <TabsTrigger key={category} value={category} className="capitalize">
                {category}
              </TabsTrigger>
            ))}
          </TabsList>
        ) : null}

        <TabsContent value={activeCategory} className="space-y-4">
          {isLoading && filteredNews.length === 0 ? <GridSkeleton items={4} /> : null}

          {filteredNews.map((item) => (
            <motion.div key={item.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="border border-muted/70 shadow-sm bg-card/80">
                <CardHeader className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {item.date ? (
                        <>
                          <CalendarDays className="h-4 w-4" />
                          <span>{item.date}</span>
                        </>
                      ) : null}
                      {item.category ? (
                        <>
                          <Separator orientation="vertical" className="h-4" />
                          <span className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wide text-primary">
                            <Tag className="h-3 w-3" /> {item.category}
                          </span>
                        </>
                      ) : null}
                    </div>
                    <CardTitle className="text-xl leading-tight text-foreground">{item.title}</CardTitle>
                    {item.summary ? <p className="text-sm text-muted-foreground max-w-3xl">{item.summary}</p> : null}
                  </div>
                  {item.link ? (
                    <Button variant="secondary" size="sm" className="mt-2 md:mt-0" asChild>
                      <a href={item.link} className="inline-flex items-center gap-2">
                        <LinkIcon className="h-4 w-4" />
                        Ver detalle
                      </a>
                    </Button>
                  ) : null}
                </CardHeader>
              </Card>
            </motion.div>
          ))}

          {!isLoading && filteredNews.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">No hay novedades publicadas para esta categoria.</CardContent>
            </Card>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default UserNewsPage;
