// src/App.tsx

import React from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";

// Páginas principales
import Layout from "./components/layout/Layout";
import NotFound from "./pages/NotFound";
import ScrollMascotGuide from "@/components/guidance/ScrollMascotGuide";
import routes from "./routesConfig";
import AccessRoute from "@/components/access/AccessRoute";
import SessionBootstrapGuard from "@/components/access/SessionBootstrapGuard";
import UserPortalGuard from "@/components/user-portal/UserPortalGuard";
import { DateSettingsProvider } from "./hooks/useDateSettings";
import { UserProvider } from "./hooks/useUser";
import { RealtimeAlertsProvider } from "@/context/RealtimeAlertsContext";
import { TenantProvider } from "./context/TenantContext";
import { SocketProvider } from "@/context/SocketContext";
import { CLERK_AUTH_ENABLED, CLERK_PUBLISHABLE_KEY, GOOGLE_CLIENT_ID } from './env';
import UserPortalLayout from "@/components/user-portal/layout/UserPortalLayout";
import TokenRedirectWrapper from "@/components/TokenRedirectWrapper";
import { CapabilitiesProvider } from '@/context/CapabilitiesContext';
import { toCanonicalTenantPath } from '@/utils/canonicalTenantRouting';
import { AppShellStatusBar } from '@/components/app-shell/AppShellStatusBar';
import { AppAccessibility } from '@/components/app-shell/AppAccessibility';
import { PwaInstallPrompt } from '@/components/app-shell/PwaInstallPrompt';
import ClerkAuthBridge from '@/components/auth/ClerkAuthBridge';
import { fetchClerkFrontendConfig } from '@/api/clerkAuth';
import {
  ClerkRuntimeProvider,
  DEFAULT_CLERK_RUNTIME,
  type ClerkRuntimeValue,
  useClerkRuntime,
} from '@/components/auth/ClerkRuntimeContext';
import {
  buildClerkBackendUnavailableRuntime,
  buildPublicPreviewPresentationRuntime,
  buildClerkRuntimeFromEnv,
  CLERK_RUNTIME_BOOTSTRAP_TIMEOUT_MS,
  isClerkOriginCompatible,
  isPublicPreviewPresentation,
  shouldReloadAfterPublicPreviewNavigation,
} from '@/components/auth/clerkRuntimeResolver';

const ChatWidget = React.lazy(() => import("@/components/chat/ChatWidget"));

// The public executive demo is a primary presentation surface. Start fetching
// its route chunk while the optional auth runtime is being resolved so the
// security bootstrap and code download happen in parallel on a cold visit.
if (
  typeof window !== 'undefined' &&
  (window.location.pathname === '/demo' || window.location.pathname.startsWith('/demo/'))
) {
  void import('@/pages/Demo').catch((error) => {
    console.warn('[Demo] No se pudo precargar la ruta publica', error);
  });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
export const RouteLoadingFallback = () => (
  <main
    id="main-content"
    tabIndex={-1}
    className="min-h-[65vh] bg-background px-4 py-8 text-foreground sm:px-6 lg:px-8"
    aria-labelledby="route-loading-title"
    aria-describedby="route-loading-description"
    aria-busy="true"
  >
    <div className="mx-auto w-full max-w-7xl" role="status" aria-live="polite">
      <div className="flex items-start gap-3 rounded-2xl border border-border/70 bg-card/80 px-4 py-3 shadow-sm sm:px-5">
        <span
          className="mt-1 h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-primary motion-reduce:animate-none"
          aria-hidden="true"
        />
        <div>
          <h1 id="route-loading-title" className="text-sm font-semibold sm:text-base">
            Preparando tu espacio de trabajo
          </h1>
          <p id="route-loading-description" className="mt-1 text-xs leading-5 text-muted-foreground sm:text-sm">
            Cargando datos y herramientas de forma segura.
          </p>
        </div>
      </div>

      <div
        className="mt-5 grid animate-pulse gap-4 motion-reduce:animate-none lg:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.75fr)]"
        aria-hidden="true"
      >
        <section className="rounded-2xl border border-border/60 bg-card/60 p-5 shadow-sm sm:p-6">
          <div className="h-3 w-28 rounded-full bg-muted" />
          <div className="mt-4 h-7 w-3/5 max-w-md rounded-lg bg-muted" />
          <div className="mt-3 h-3 w-full max-w-2xl rounded-full bg-muted/80" />
          <div className="mt-2 h-3 w-4/5 max-w-xl rounded-full bg-muted/80" />
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="rounded-xl border border-border/50 bg-background/70 p-4">
                <div className="h-3 w-20 rounded-full bg-muted" />
                <div className="mt-3 h-8 w-24 rounded-lg bg-muted/80" />
                <div className="mt-3 h-2.5 w-full rounded-full bg-muted/70" />
              </div>
            ))}
          </div>
          <div className="mt-5 h-52 rounded-2xl border border-border/50 bg-muted/50 sm:h-64" />
        </section>

        <aside className="rounded-2xl border border-border/60 bg-card/60 p-5 shadow-sm sm:p-6">
          <div className="h-3 w-24 rounded-full bg-muted" />
          <div className="mt-4 h-6 w-2/3 rounded-lg bg-muted" />
          <div className="mt-6 space-y-3">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/70 p-3">
                <div className="h-9 w-9 shrink-0 rounded-xl bg-muted" />
                <div className="min-w-0 flex-1">
                  <div className="h-3 w-2/3 rounded-full bg-muted" />
                  <div className="mt-2 h-2.5 w-full rounded-full bg-muted/70" />
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  </main>
);

const AppBootstrapFallback = () => (
  <main
    id="main-content"
    tabIndex={-1}
    className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground"
    aria-labelledby="app-bootstrap-title"
    aria-describedby="app-bootstrap-description"
    aria-busy="true"
  >
    <div
      className="flex max-w-sm items-center gap-4 rounded-2xl border border-border/70 bg-card/80 px-5 py-4 shadow-sm"
      role="status"
      aria-live="polite"
    >
      <span
        className="h-3 w-3 shrink-0 animate-pulse rounded-full bg-primary motion-reduce:animate-none"
        aria-hidden="true"
      />
      <div>
        <h1 id="app-bootstrap-title" className="text-sm font-semibold">
          Preparando Chatboc
        </h1>
        <p id="app-bootstrap-description" className="mt-1 text-xs text-muted-foreground">
          Validando la configuracion segura de acceso...
        </p>
      </div>
    </div>
  </main>
);

const useResolvedClerkRuntime = (): ClerkRuntimeValue => {
  const allowEnvFallback = import.meta.env.DEV;
  const [publicPreviewPresentation] = React.useState(() =>
    typeof window !== 'undefined' && isPublicPreviewPresentation({
      hostname: window.location.hostname,
      pathname: window.location.pathname,
      search: window.location.search,
    }),
  );
  const [runtime, setRuntime] = React.useState<ClerkRuntimeValue>(() =>
    publicPreviewPresentation
      ? buildPublicPreviewPresentationRuntime(CLERK_PUBLISHABLE_KEY)
      : buildClerkRuntimeFromEnv({
          allowEnvFallback,
          envEnabled: CLERK_AUTH_ENABLED,
          loading: true,
          publishableKey: CLERK_PUBLISHABLE_KEY,
        }),
  );

  React.useEffect(() => {
    // The explicit remote Preview presentation is guest-only and never needs
    // Clerk. Resolve it synchronously so a cold auth backend cannot block the
    // public executive demo; all normal and private routes keep the fail-closed
    // bootstrap below.
    if (publicPreviewPresentation) return undefined;

    let cancelled = false;
    let settled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const settleRuntime = (nextRuntime: ClerkRuntimeValue) => {
      if (cancelled || settled) return false;
      settled = true;
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      setRuntime(nextRuntime);
      return true;
    };

    const buildUnavailableRuntime = () =>
      buildClerkBackendUnavailableRuntime({
        allowEnvFallback,
        envEnabled: CLERK_AUTH_ENABLED,
        loading: false,
        publishableKey: CLERK_PUBLISHABLE_KEY,
      });

    const loadConfig = async () => {
      try {
        const config = await fetchClerkFrontendConfig();
        const publishableKey =
          (typeof config.publishable_key === 'string' ? config.publishable_key.trim() : '') ||
          CLERK_PUBLISHABLE_KEY;
        const productionGate = config.environment !== 'production' || config.production_ready === true;
        const originGate = isClerkOriginCompatible({
          environment: config.environment,
          hostname: typeof window !== 'undefined' ? window.location.hostname : '',
          publishableKey,
        });
        const enabled = Boolean(
          config.enabled &&
          publishableKey &&
          config.ready_for_session_sync &&
          productionGate &&
          originGate,
        );
        settleRuntime({
          enabled,
          loading: false,
          publishableKey,
          source: enabled ? 'backend' : 'disabled',
          environment: typeof config.environment === 'string' ? config.environment : 'unknown',
          productionReady: Boolean(config.production_ready),
          socialProviders: Array.isArray(config.social_providers) && config.social_providers.length
            ? config.social_providers
            : DEFAULT_CLERK_RUNTIME.socialProviders,
          oauthCallbackPath:
            typeof config.oauth_callback_path === 'string' && config.oauth_callback_path.trim()
              ? config.oauth_callback_path.trim()
              : DEFAULT_CLERK_RUNTIME.oauthCallbackPath,
          readyForSessionSync: Boolean(config.ready_for_session_sync),
          configurationWarnings: [
            ...(Array.isArray(config.configuration_warnings) ? config.configuration_warnings : []),
            ...(!originGate
              ? [{
                  code: 'production_origin_mismatch',
                  message: 'Clerk de produccion queda deshabilitado fuera de chatboc.ar.',
                }]
              : []),
          ],
          productionRequirements: config.production_requirements,
        });
      } catch (error) {
        if (settleRuntime(buildUnavailableRuntime())) {
          console.warn('[Clerk] No se pudo cargar la configuracion publica del backend', error);
        }
      }
    };

    timeoutId = setTimeout(() => {
      if (settleRuntime(buildUnavailableRuntime())) {
        console.warn(
          `[Clerk] La configuracion publica excedio ${CLERK_RUNTIME_BOOTSTRAP_TIMEOUT_MS} ms; se aplica el fallback seguro`,
        );
      }
    }, CLERK_RUNTIME_BOOTSTRAP_TIMEOUT_MS);
    loadConfig();
    return () => {
      cancelled = true;
      if (timeoutId !== null) clearTimeout(timeoutId);
    };
  }, [allowEnvFallback, publicPreviewPresentation]);

  return runtime;
};

function AppRoutes() {
  const location = useLocation();
  const navigate = useNavigate();
  const clerkRuntime = useClerkRuntime();

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!shouldReloadAfterPublicPreviewNavigation({
      runtime: clerkRuntime,
      hostname: window.location.hostname,
      pathname: location.pathname,
      search: location.search,
    })) {
      return;
    }

    // The Preview presentation deliberately mounts without Clerk. Once the
    // visitor leaves that public URL, reload the new route so the normal
    // fail-closed auth topology is restored before login or private UI mounts.
    window.location.reload();
  }, [clerkRuntime, location.pathname, location.search]);

  React.useEffect(() => {
    const canonicalPath = toCanonicalTenantPath(location.pathname);
    if (!canonicalPath || canonicalPath === location.pathname) return;
    navigate(`${canonicalPath}${location.search}${location.hash}`, { replace: true });
  }, [location.hash, location.pathname, location.search, navigate]);

  // Ensure persistent anonymous session on app load
  React.useEffect(() => {
    // This triggers the internal getOrCreateAnonId logic within apiFetch context or utils
    // Accessing the util directly if possible, or just ensuring headers are set on next request.
    // Since getOrCreateAnonId is internal to api.ts (not exported), we rely on apiFetch
    // or we can import the header generation logic if we export it.
    // However, the requirement is "On first app load... generate...".
    // api.ts already does this lazily. To be explicit:
    try {
       // We trigger a "no-op" or just let the lazy load happen on first actual request.
       // But to be compliant with "On first app load", we can force it here:
       const anonId = localStorage.getItem('chatboc_anon_id');
       if (!anonId) {
           if (typeof crypto !== 'undefined' && crypto.randomUUID) {
               localStorage.setItem('chatboc_anon_id', crypto.randomUUID());
           }
       }
    } catch (e) {
       console.warn("Failed to initialize anon session", e);
    }
  }, []);
  const layoutExcludedPaths = ['/iframe', '/sso-callback', '/auth/sso-callback'];
  const layoutRoutes = routes.filter(({ path, userPortal }) => !layoutExcludedPaths.includes(path) && !userPortal);
  const portalRoutes = routes.filter(({ userPortal }) => userPortal);
  const guestPortalPaths = portalRoutes.filter(({ allowGuest }) => allowGuest).map(({ path }) => path);
  const standaloneRoutes = routes.filter(({ path, userPortal }) => layoutExcludedPaths.includes(path) && !userPortal);

  // Ahora el array soporta rutas exactas y subrutas tipo "/integracion/preview"
  const rutasSinWidget = [
    // '/', // ENABLE WIDGET ON LANDING PAGE
    "/iframe",
    "/demo",
    "/demo-catalogs",
    "/login",
    "/register",
    "/sso-callback",
    "/auth/sso-callback",
    "/user/login",
    "/user/register",
    "/cuenta",
    '/chat',
    "/tracking",
    "/integracion",
    "/admin",
    "/perfil",
    "/empleados",
    "/usuarios",
    "/403",
    "/superadmin"
  ];

  // Detecta rutas de integración como segmento, incluso con prefijos de tenant (ej: /t/slug/integracion)
  const isIntegrationRoute = location.pathname
    .toLowerCase()
    .split("/")
    .includes("integracion");
  const ocultarWidgetGlobalEnApp = rutasSinWidget.some(
    (ruta) =>
      location.pathname === ruta || location.pathname.startsWith(ruta + "/")
  ) || isIntegrationRoute;

  // Evita que el widget global quede montado en rutas de integración
  React.useEffect(() => {
    if (ocultarWidgetGlobalEnApp) {
      (window as any).chatbocDestroyWidget?.();
    }
  }, [ocultarWidgetGlobalEnApp]);

  return (
    <TokenRedirectWrapper>
      <React.Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
        <Route element={<Layout />}>
          {layoutRoutes.map(({ path, element, roles, requiredCapabilities, requiredAllCapabilities }) => (
            <Route
              key={path} // La key ya estaba correctamente aquí. No se requieren cambios.
              path={path}
              element={
                roles?.length || requiredCapabilities?.length || requiredAllCapabilities?.length ? (
                  <AccessRoute
                    roles={roles}
                    requiredCapabilities={requiredCapabilities}
                    requiredAllCapabilities={requiredAllCapabilities}
                  >
                    {element}
                  </AccessRoute>
                ) : (
                  element
                )
              }
            />
          ))}
        </Route>
        {portalRoutes.length > 0 && (
          <Route
            element={
              <UserPortalGuard allowGuestPaths={guestPortalPaths}>
                <UserPortalLayout />
              </UserPortalGuard>
            }
          >
            {portalRoutes.map(({ path, element }) => (
              <Route key={path} path={path} element={element} />
            ))}
          </Route>
        )}
        {standaloneRoutes.map(({ path, element, roles, requiredCapabilities, requiredAllCapabilities }) => (
          <Route
            key={path}
            path={path}
            element={
              roles?.length || requiredCapabilities?.length || requiredAllCapabilities?.length ? (
                <AccessRoute
                  roles={roles}
                  requiredCapabilities={requiredCapabilities}
                  requiredAllCapabilities={requiredAllCapabilities}
                >
                  {element}
                </AccessRoute>
              ) : (
                element
              )
            }
          />
        ))}
        <Route path="*" element={<NotFound />} />
        </Routes>
      </React.Suspense>

      {/* Monta el widget global SOLO si no estás en demo/integracion/login/register/iframe */}
      {!ocultarWidgetGlobalEnApp && (
        <React.Suspense fallback={null}>
          <ChatWidget
            mode="standalone"
            defaultOpen={false}
            welcomeTitle="Asistente Virtual"
            welcomeSubtitle="Consultas, ventas y soporte con Chatboc"
          />
        </React.Suspense>
      )}
      <ScrollMascotGuide />
    </TokenRedirectWrapper>
  );
}

const AppRuntime = ({
  tenantBootstrapEnabled,
}: {
  tenantBootstrapEnabled: boolean;
}) => (
  <SocketProvider>
    <TenantProvider bootstrapEnabled={tenantBootstrapEnabled}>
      <CapabilitiesProvider>
        <RealtimeAlertsProvider>
          <AppShellStatusBar />
          <AppAccessibility />
          <AppRoutes />
          <PwaInstallPrompt />
        </RealtimeAlertsProvider>
      </CapabilitiesProvider>
    </TenantProvider>
  </SocketProvider>
);

const renderAppRuntime = (tenantBootstrapEnabled: boolean) => (
  <AppRuntime tenantBootstrapEnabled={tenantBootstrapEnabled} />
);

const BearerSessionBootstrapBoundary = () => (
  <SessionBootstrapGuard
    clerkStatus="disabled"
    renderRuntime={renderAppRuntime}
  />
);

const ClerkSessionBootstrapBoundary = () => {
  const { isLoaded, isSignedIn, userId, sessionId } = useAuth();
  const identity = isLoaded && isSignedIn && userId
    ? `${userId}:${sessionId || ''}`
    : null;
  const identityRef = React.useRef(identity);
  const [readyIdentity, setReadyIdentity] = React.useState<string | null>(null);
  identityRef.current = identity;

  React.useEffect(() => {
    setReadyIdentity((current) => (current === identity ? current : null));
  }, [identity]);

  const handleSessionPending = React.useCallback((pendingIdentity: string) => {
    if (identityRef.current === pendingIdentity) {
      setReadyIdentity(null);
    }
  }, []);

  const handleSessionReady = React.useCallback((syncedIdentity: string) => {
    if (identityRef.current === syncedIdentity) {
      setReadyIdentity(syncedIdentity);
    }
  }, []);

  const handleSessionReset = React.useCallback(() => {
    setReadyIdentity(null);
  }, []);

  const clerkStatus = !isLoaded
    ? 'loading'
    : !isSignedIn || !identity
      ? 'signed_out'
      : readyIdentity === identity
        ? 'ready'
        : 'syncing';

  return (
    <>
      <ClerkAuthBridge
        onSessionPending={handleSessionPending}
        onSessionReady={handleSessionReady}
        onSessionReset={handleSessionReset}
      />
      <SessionBootstrapGuard
        clerkStatus={clerkStatus}
        renderRuntime={renderAppRuntime}
      />
    </>
  );
};

const App = () => {
  const clerkRuntime = useResolvedClerkRuntime();

  // The provider topology cannot change after product routes become interactive.
  // Resolve the optional Clerk runtime first, then mount the application exactly once.
  if (clerkRuntime.loading) {
    return (
      <ClerkRuntimeProvider value={clerkRuntime}>
        <AppBootstrapFallback />
      </ClerkRuntimeProvider>
    );
  }

  const appTree = (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <UserProvider>
          <DateSettingsProvider>
            <BrowserRouter
              future={{
                v7_startTransition: true,
                v7_relativeSplatPath: true,
              }}
            >
              {clerkRuntime.enabled ? (
                <ClerkSessionBootstrapBoundary />
              ) : (
                <BearerSessionBootstrapBoundary />
              )}
            </BrowserRouter>
          </DateSettingsProvider>
        </UserProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );

  const appWithRuntime = (
    <ClerkRuntimeProvider value={clerkRuntime}>
      {clerkRuntime.enabled ? (
        <ClerkProvider publishableKey={clerkRuntime.publishableKey}>
          {appTree}
        </ClerkProvider>
      ) : appTree}
    </ClerkRuntimeProvider>
  );

  const appWithClerk = appWithRuntime;

  if (!GOOGLE_CLIENT_ID) {
    return appWithClerk;
  }

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      {appWithClerk}
    </GoogleOAuthProvider>
  );
};

export default App;
