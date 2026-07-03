import { useMemo, useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

import { getTenantPublicNavigation } from '@/api/tenant';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { useTenant } from '@/context/TenantContext';
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/utils/api';
import { isAbsoluteUrl, resolveTenantPublicNavigationTarget } from '@/utils/tenantPaths';
import type { TenantPublicNavigationItem } from '@/types/tenant';
import { TenantSwitcher } from './TenantSwitcher';

interface TenantShellProps {
  children: ReactNode;
}

const sanitizePublicMessage = (message?: string | null) => {
  if (!message) return 'No pudimos cargar este espacio en este momento.';
  if (/<[a-z][\s\S]*>/i.test(message)) {
    return 'El espacio no respondio correctamente. Reintenta en unos minutos.';
  }
  return message;
};

export const TenantShell = ({ children }: TenantShellProps) => {
  const {
    tenant,
    currentSlug,
    isLoadingTenant,
    tenantError,
    refreshTenant,
    isCurrentTenantFollowed,
    followCurrentTenant,
    unfollowCurrentTenant,
    followedTenantsError,
    refreshFollowedTenants,
  } = useTenant();
  const [updatingFollow, setUpdatingFollow] = useState(false);

  const slugForPath = tenant?.slug ?? currentSlug ?? null;
  const basePath = slugForPath ? `/t/${encodeURIComponent(slugForPath)}` : '';

  const navigationQuery = useQuery({
    queryKey: ['tenant-public-navigation', slugForPath],
    enabled: Boolean(slugForPath && tenant),
    queryFn: () => getTenantPublicNavigation(slugForPath as string),
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  const navigationItems = useMemo(
    () => navigationQuery.data?.items?.filter((item) => item.visible !== false) ?? [],
    [navigationQuery.data?.items],
  );

  const handleToggleFollow = async () => {
    if (!slugForPath) return;
    setUpdatingFollow(true);
    try {
      if (isCurrentTenantFollowed) {
        await unfollowCurrentTenant();
        toast({ title: 'Espacio quitado de tus favoritos.' });
      } else {
        await followCurrentTenant();
        toast({ title: 'Sumaste este espacio a tus favoritos.' });
      }
    } catch (error) {
      toast({
        title: 'No pudimos actualizar tus espacios seguidos.',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setUpdatingFollow(false);
    }
  };

  const renderHeaderContent = () => {
    if (isLoadingTenant) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      );
    }

    if (!slugForPath) {
      return (
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Explora espacios disponibles</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Elegi un municipio, colegio o empresa para acceder a sus canales publicados.
            </p>
          </div>
          <TenantSwitcher className="max-w-sm" />
        </div>
      );
    }

    if (!tenant) {
      return (
        <div className="flex flex-col gap-3">
          <h1 className="text-2xl font-semibold">No encontramos informacion para este espacio.</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={refreshTenant} variant="outline">
              Reintentar
            </Button>
            <TenantSwitcher className="w-full max-w-sm" />
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 items-start gap-4">
          {tenant.logo_url ? (
            <div className="hidden h-16 w-16 shrink-0 overflow-hidden rounded-2xl border bg-white/80 shadow-sm sm:block">
              <img
                src={tenant.logo_url}
                alt={`Logo de ${tenant.nombre}`}
                className="h-full w-full object-contain"
              />
            </div>
          ) : null}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {tenant.tipo ? (
                <Badge variant="secondary" className="uppercase tracking-wide">
                  {tenant.tipo}
                </Badge>
              ) : null}
              {isCurrentTenantFollowed ? <Badge variant="outline">Favorito</Badge> : null}
            </div>
            <div>
              <h1 className="text-3xl font-semibold leading-tight">{tenant.nombre}</h1>
              {tenant.descripcion ? (
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{tenant.descripcion}</p>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <Button
            onClick={handleToggleFollow}
            variant={isCurrentTenantFollowed ? 'outline' : 'default'}
            disabled={updatingFollow}
          >
            {isCurrentTenantFollowed ? 'Dejar de seguir' : 'Seguir espacio'}
          </Button>
          <TenantSwitcher className="w-full sm:w-60" />
        </div>
      </div>
    );
  };

  const renderNavigation = () => {
    if (!basePath || !navigationItems.length) return null;

    return (
      <nav className="mt-8 flex flex-wrap items-center gap-2">
        {navigationItems.map((item) => {
          const key = item.id || item.route || item.label;
          const enabled = item.enabled !== false;
          const to = resolveTenantPublicNavigationTarget(item, basePath);
          const label = item.label;

          if (!enabled) {
            return (
              <span
                key={key}
                aria-disabled="true"
                title={item.disabled_reason ?? item.reason_code ?? undefined}
                className="rounded-full bg-muted/25 px-3 py-2 text-sm font-medium text-muted-foreground/60"
              >
                {label}
              </span>
            );
          }

          if (isAbsoluteUrl(to)) {
            return (
              <a
                key={key}
                href={to}
                className="rounded-full bg-muted/40 px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
              >
                {label}
              </a>
            );
          }

          return (
            <NavLink
              key={key}
              to={to}
              end={to === basePath}
              className={({ isActive }) =>
                cn(
                  'rounded-full px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted/40 text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                )
              }
            >
              {label}
            </NavLink>
          );
        })}
      </nav>
    );
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 py-10">
      <section className="rounded-3xl border bg-background/80 p-6 shadow-sm backdrop-blur">
        {renderHeaderContent()}
        {renderNavigation()}
      </section>

      {followedTenantsError ? (
        <Alert variant="destructive">
          <AlertTitle>No pudimos sincronizar tus espacios seguidos</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <span>{sanitizePublicMessage(followedTenantsError)}</span>
            <div>
              <Button variant="outline" size="sm" onClick={refreshFollowedTenants}>
                Reintentar
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      {tenantError && slugForPath ? (
        <Alert variant="destructive">
          <AlertTitle>No pudimos cargar la informacion publica</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <span>{sanitizePublicMessage(tenantError)}</span>
            <div>
              <Button variant="outline" size="sm" onClick={refreshTenant}>
                Reintentar
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-8">{children}</div>
      )}
    </div>
  );
};

export default TenantShell;
