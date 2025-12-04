import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useTenant } from '@/context/TenantContext';
import { buildTenantPath } from '@/utils/tenantPaths';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ShoppingBag, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { usePortalContent } from '@/hooks/usePortalContent';

const statusCopy = {
  available: 'Disponible',
  coming_soon: 'Próximamente',
  paused: 'Temporalmente pausado',
};

const UserCatalogPage = () => {
  const { currentSlug } = useTenant();
  const { content, isDemo } = usePortalContent();
  const loginPath = useMemo(() => buildTenantPath('/login', currentSlug ?? undefined), [currentSlug]);
  const catalog = content.catalog ?? [];

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShoppingBag className="h-4 w-4 text-primary" />
            <span>{isDemo ? 'Catálogo demo offline' : 'Catálogo listo para tu cuenta'}</span>
          </div>
          <h1 className="text-3xl font-bold text-foreground">Catálogo y gestiones</h1>
          <p className="text-muted-foreground text-sm md:text-base max-w-3xl">
            Explora módulos disponibles: seguimientos, notificaciones, beneficios y agenda de eventos.
          </p>
        </div>
        <Button asChild variant="outline">
          <a href={loginPath}>Iniciar sesión</a>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {catalog.map((item) => (
          <motion.div key={item.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="h-full border border-muted/70 shadow-sm overflow-hidden">
              {item.imageUrl && (
                <div className="h-36 w-full overflow-hidden">
                  <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
                </div>
              )}
              <CardHeader className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-lg leading-tight">{item.title}</CardTitle>
                  {item.status && (
                    <Badge variant="outline" className="capitalize text-[11px]">
                      {statusCopy[item.status] ?? item.status}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground leading-snug">{item.description}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span className="capitalize">{item.category}</span>
                  {item.priceLabel && <span className="font-medium text-foreground">{item.priceLabel}</span>}
                </div>
                <Separator />
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Optimizado para inquilinos multi-tenant y sincronización segura.
                </div>
              </CardContent>
              <CardFooter className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Listo para conectar con backend real.</span>
                <Button variant="ghost" size="sm" className="inline-flex items-center gap-1">
                  Ver más
                  <ArrowUpRight className="h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default UserCatalogPage;
