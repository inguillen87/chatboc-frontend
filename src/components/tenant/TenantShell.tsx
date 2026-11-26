import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
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
import { resolveTenantPublicNavigationTarget } from '@/utils/tenantPaths';
import { organizationTypeLabel } from '@/utils/organizationTypeLabel';
import type { TenantPublicNavigationItem } from '@/types/tenant';
import { tenantHostNavigationTarget } from '@/utils/tenantHostBinding';
import { TenantSwitcher } from './TenantSwitcher';
import { brandAccentVariables, brandFontStack, brandGradientColors, ensureBrandStylesheet } from '@/utils/publicBrandIdentity';
import { formatTenantTitle } from '@/utils/pageTitles';

interface TenantShellProps {
  children: ReactNode;
  compactHeader?: boolean;
  titleSection?: string | null;
}

const TENANT_SHELL_TITLE_ID = 'tenant-shell-title';
const TENANT_RETRY_STATUS_ID = 'tenant-retry-status';
const HEADING_FOCUS_CLASS = 'rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-4';

type RetryAttempt = {
  scope: object;
  button: HTMLButtonElement;
  message: string;
  ownsFocus: boolean;
  stopTracking: () => void;
};

const sanitizePublicMessage = (message?: string | null) => {
  if (!message) return 'No pudimos cargar este espacio en este momento.';
  if (/<[a-z][\s\S]*>/i.test(message)) {
    return 'El espacio no respondió correctamente. Reintentá en unos minutos.';
  }
  return message;
};

export const TenantShell = ({ children, compactHeader = false, titleSection }: TenantShellProps) => {
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
    hostBinding,
    widgetToken,
  } = useTenant();
  const [updatingFollow, setUpdatingFollow] = useState(false);
  const location = useLocation();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const retryButtonRef = useRef<HTMLButtonElement>(null);
  const retryRef = useRef<RetryAttempt | null>(null);
  const [pendingRetry, setPendingRetry] = useState<RetryAttempt | null>(null);
  const [completedRetry, setCompletedRetry] = useState<RetryAttempt | null>(null);

  const rawTenantSlug = tenant?.slug?.trim() || null;
  const resolvedTenant = rawTenantSlug && rawTenantSlug.toLowerCase() !== 'default' ? tenant : null;
  const resolvedTenantSlug = resolvedTenant?.slug?.trim() || null;
  // Published brand identity: a palette band, its typography and its mark.
  // Everything comes from the backend; without it the portal stays neutral.
  const brandIdentity = resolvedTenant?.brand_identity ?? null;
  const brandMark = brandIdentity?.logo?.mark ?? null;
  const brandBand = useMemo(() => {
    if (!brandIdentity) return null;
    const colors = brandGradientColors(brandIdentity);
    return colors.length >= 2 ? `linear-gradient(90deg, ${colors.join(', ')})` : null;
  }, [brandIdentity]);
  const brandTypographyStyle = useMemo(() => {
    const accents = brandAccentVariables(brandIdentity);
    const fontFamily = brandFontStack(brandIdentity?.typography);
    if (!fontFamily && !Object.keys(accents).length) return undefined;
    return {
      ...accents,
      ...(fontFamily ? { fontFamily, letterSpacing: brandIdentity?.typography?.letterSpacing } : {}),
    } as CSSProperties;
  }, [brandIdentity]);
  useEffect(() => {
    ensureBrandStylesheet(brandIdentity?.typography?.stylesheetUrl);
  }, [brandIdentity?.typography?.stylesheetUrl]);
  const normalizedCurrentSlug = currentSlug?.trim().toLowerCase() || null;
  const retryScope = useMemo(() => ({}), [
    location.pathname, location.search, normalizedCurrentSlug, widgetToken, hostBinding?.tenant.id, hostBinding?.tenant.slug,
  ]);
  const activeRetryScope = useRef<object | null>(null);
  useLayoutEffect(() => {
    activeRetryScope.current = retryScope;
    return () => {
      if (activeRetryScope.current === retryScope) activeRetryScope.current = null;
      if (retryRef.current?.scope === retryScope) {
        retryRef.current.stopTracking();
        retryRef.current = null;
      }
    };
  }, [retryScope]);

  useLayoutEffect(() => {
    if (!completedRetry) return;
    if (completedRetry.scope !== retryScope || activeRetryScope.current !== retryScope) {
      setCompletedRetry(null);
      return;
    }
    if (isLoadingTenant) return;
    if (retryRef.current === completedRetry) {
      completedRetry.stopTracking();
      retryRef.current = null;
      const focused = document.activeElement;
      if (completedRetry.ownsFocus && (focused === completedRetry.button || focused === document.body)) {
        (retryButtonRef.current ?? headingRef.current)?.focus({ preventScroll: true });
      }
    }
    setCompletedRetry(null);
  }, [completedRetry, retryScope, isLoadingTenant]);

  const currentRetry = pendingRetry?.scope === retryScope ? pendingRetry
    : isLoadingTenant && completedRetry?.scope === retryScope ? completedRetry : null;
  const recoveryMessage = tenantError || currentRetry?.message || null;
  const retryBusy = Boolean(currentRetry) || isLoadingTenant;
  const navigationTenantSlug =
    !isLoadingTenant &&
    !tenantError &&
    resolvedTenantSlug &&
    normalizedCurrentSlug === resolvedTenantSlug.toLowerCase()
      ? resolvedTenantSlug
      : null;
  const slugForPath = resolvedTenantSlug ?? currentSlug ?? null;
  // La pestaña nombra al organismo solo cuando su identidad coincide con la ruta y la carga terminó;
  // en transición o error vuelve al título previo al espacio, igual que al salir.
  const authoritativeTitle =
    navigationTenantSlug && resolvedTenant?.nombre?.trim()
      ? formatTenantTitle(resolvedTenant.nombre, titleSection)
      : null;
  const titleBeforeSpace = useRef<string | null>(null);
  useEffect(() => {
    if (titleBeforeSpace.current === null) titleBeforeSpace.current = document.title;
    document.title = authoritativeTitle ?? titleBeforeSpace.current;
  }, [authoritativeTitle]);
  useEffect(() => () => {
    if (titleBeforeSpace.current !== null) document.title = titleBeforeSpace.current;
  }, []);
  const basePath = slugForPath ? `/t/${encodeURIComponent(slugForPath)}` : '';

  const handleRetry = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (activeRetryScope.current !== retryScope || retryRef.current || isLoadingTenant) return;
    const button = event.currentTarget;
    const attempt: RetryAttempt = {
      scope: retryScope, button, message: sanitizePublicMessage(tenantError),
      ownsFocus: document.activeElement === button, stopTracking: () => {},
    };
    const trackFocus = (focusEvent: FocusEvent) => { attempt.ownsFocus = focusEvent.target === button; };
    const trackBlur = (focusEvent: FocusEvent) => {
      // Ignore a blur emitted while React retires the control for the confirmed profile.
      if (focusEvent.target === button && button.isConnected && retryButtonRef.current === button) attempt.ownsFocus = false;
    };
    const trackPointer = (pointerEvent: PointerEvent) => {
      if (pointerEvent.target instanceof Node && !button.contains(pointerEvent.target)) attempt.ownsFocus = false;
    };
    document.addEventListener('focusin', trackFocus);
    document.addEventListener('focusout', trackBlur);
    document.addEventListener('pointerdown', trackPointer);
    attempt.stopTracking = () => {
      document.removeEventListener('focusin', trackFocus);
      document.removeEventListener('focusout', trackBlur);
      document.removeEventListener('pointerdown', trackPointer);
    };
    retryRef.current = attempt;
    setPendingRetry(attempt);
    try {
      await refreshTenant();
    } catch {
      // The provider owns the public error and profile; do not invent either.
    } finally {
      if (activeRetryScope.current === retryScope && retryRef.current === attempt) {
        setPendingRetry(null);
        setCompletedRetry(attempt);
      } else {
        attempt.stopTracking();
      }
    }
  };

  const navigationQuery = useQuery({
    queryKey: ['tenant-public-navigation', navigationTenantSlug],
    enabled: Boolean(navigationTenantSlug),
    queryFn: () => getTenantPublicNavigation(navigationTenantSlug as string),
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  // A section the organization has not published is left out of the menu: a
  // greyed, non-interactive label reads as a broken control and cannot be
  // reached by keyboard. Items without a safe destination still render inert.
  const navigationItems = useMemo(
    () => navigationQuery.data?.items?.filter((item) => item.visible !== false && item.enabled !== false) ?? [],
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
    if (recoveryMessage) {
      return (
        <div className="flex flex-col gap-3">
          <h1 ref={headingRef} tabIndex={-1} id={TENANT_SHELL_TITLE_ID} className={cn('text-2xl font-semibold', HEADING_FOCUS_CLASS)}>
            No pudimos cargar este espacio en este momento.
          </h1>
          <Alert variant="destructive" aria-labelledby={TENANT_SHELL_TITLE_ID}>
            <AlertDescription className="break-words [overflow-wrap:anywhere]">{sanitizePublicMessage(recoveryMessage)}</AlertDescription>
          </Alert>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              ref={retryButtonRef}
              type="button"
              onClick={handleRetry}
              variant="outline"
              className="min-h-11 aria-disabled:opacity-50"
              aria-disabled={retryBusy || undefined}
              aria-busy={retryBusy || undefined}
              aria-describedby={retryBusy ? TENANT_RETRY_STATUS_ID : undefined}
            >
              Reintentar
            </Button>
            {retryBusy ? (
              <span id={TENANT_RETRY_STATUS_ID} role="status" aria-live="polite" className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Cargando espacio
              </span>
            ) : null}
            {!hostBinding ? <TenantSwitcher className="w-full max-w-sm" /> : null}
          </div>
        </div>
      );
    }

    if (isLoadingTenant) {
      return (
        <div
          className="flex items-center justify-center gap-3 py-12 text-sm text-muted-foreground"
          role="status"
          aria-live="polite"
          aria-busy="true"
          aria-labelledby={TENANT_SHELL_TITLE_ID}
        >
          <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
          <h1 ref={headingRef} tabIndex={-1} id={TENANT_SHELL_TITLE_ID} className={cn('text-sm font-medium', HEADING_FOCUS_CLASS)}>
            Cargando espacio
          </h1>
        </div>
      );
    }

    if (!slugForPath) {
      return (
        <div className="flex flex-col gap-4">
          <div>
            <h1 ref={headingRef} tabIndex={-1} id={TENANT_SHELL_TITLE_ID} className={cn('text-2xl font-semibold', HEADING_FOCUS_CLASS)}>Explorá espacios disponibles</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Elegí un municipio, colegio o empresa para acceder a sus canales publicados.
            </p>
          </div>
          <TenantSwitcher className="max-w-sm" />
        </div>
      );
    }

    if (!resolvedTenant) {
      return (
        <div className="flex flex-col gap-3">
          <h1 ref={headingRef} tabIndex={-1} id={TENANT_SHELL_TITLE_ID} className={cn('text-2xl font-semibold', HEADING_FOCUS_CLASS)}>No encontramos información para este espacio.</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Button ref={retryButtonRef} type="button" onClick={handleRetry} variant="outline" className="min-h-11">
              Reintentar
            </Button>
            <TenantSwitcher className="w-full max-w-sm" />
          </div>
        </div>
      );
    }

    return (
      <div className={cn('flex flex-col md:flex-row md:items-center md:justify-between', compactHeader ? 'gap-3 sm:gap-4' : 'gap-6')}>
        <div className="flex flex-1 items-start gap-4">
          {brandMark || resolvedTenant.logo_url ? (
            <div className="hidden h-16 w-16 shrink-0 overflow-hidden rounded-2xl border bg-card p-1.5 shadow-sm sm:block">
              <img
                src={brandMark || resolvedTenant.logo_url || undefined}
                alt={`Logo de ${resolvedTenant.nombre}`}
                className="h-full w-full object-contain"
              />
            </div>
          ) : null}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {resolvedTenant.tipo ? (
                <Badge variant="secondary" className="font-medium">
                  {organizationTypeLabel(resolvedTenant.tipo)}
                </Badge>
              ) : null}
              {isCurrentTenantFollowed ? <Badge variant="outline">Favorito</Badge> : null}
            </div>
            <div>
              <h1 ref={headingRef} tabIndex={-1} id={TENANT_SHELL_TITLE_ID} className={cn('font-semibold leading-tight', HEADING_FOCUS_CLASS, compactHeader ? 'text-xl sm:text-2xl' : 'text-3xl')}>{resolvedTenant.nombre}</h1>
              {resolvedTenant.descripcion ? (
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{resolvedTenant.descripcion}</p>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          {/* Secondary on purpose: people come here for help, not to follow. On a
              phone it keeps its own width instead of taking a full row. */}
          <Button
            onClick={handleToggleFollow}
            variant="outline"
            disabled={updatingFollow}
            className="min-h-11 self-start sm:self-auto"
          >
            {isCurrentTenantFollowed ? 'Dejar de seguir' : 'Seguir espacio'}
          </Button>
          {!hostBinding ? <TenantSwitcher className="w-full sm:w-60" /> : null}
        </div>
      </div>
    );
  };

  const renderNavigation = () => {
    if (recoveryMessage || !basePath || !navigationItems.length) return null;

    return (
      <nav
        aria-label="Secciones del espacio"
        className={cn(
          // One swipeable row on a phone, so the help below starts on the first screen.
          '-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden [&>*]:shrink-0',
          compactHeader ? 'mt-3 sm:mt-4' : 'mt-8',
        )}
      >
        {navigationItems.map((item) => {
          const key = item.id || item.route || item.label;
          const to = tenantHostNavigationTarget(hostBinding, resolveTenantPublicNavigationTarget(item, basePath));
          const label = item.label;

          if (!to) {
            return (
              <span
                key={key}
                aria-disabled="true"
                title={item.disabled_reason ?? item.reason_code ?? undefined}
                className="inline-flex min-h-11 items-center rounded-full bg-muted/25 px-4 py-2 text-sm font-medium text-muted-foreground/60"
              >
                {label}
              </span>
            );
          }

          return (
            <NavLink
              key={key}
              to={to}
              end={to === basePath || to === '/'}
              className={({ isActive }) =>
                cn(
                  'inline-flex min-h-11 items-center rounded-full px-4 py-2 text-sm font-medium transition-colors',
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
    <div
      className={cn('mx-auto w-full max-w-5xl', compactHeader ? 'space-y-4 py-3 sm:space-y-5 sm:py-6' : 'space-y-8 py-10')}
      style={brandTypographyStyle}
      data-brand-identity={brandIdentity ? 'published' : undefined}
    >
      <section
        className={cn('relative overflow-hidden rounded-3xl border bg-background/80 shadow-sm backdrop-blur', compactHeader ? 'p-4 sm:p-5' : 'p-6')}
        aria-labelledby={TENANT_SHELL_TITLE_ID}
      >
        {brandBand ? (
          <div
            aria-hidden="true"
            data-testid="tenant-brand-band"
            className="pointer-events-none absolute inset-x-0 top-0 h-1.5"
            style={{ backgroundImage: brandBand }}
          />
        ) : null}
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

      {!recoveryMessage ? <div className="space-y-8">{children}</div> : null}
    </div>
  );
};

export default TenantShell;
