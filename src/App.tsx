// src/App.tsx

import React from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { ClerkProvider } from "@clerk/clerk-react";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";

// Páginas principales
import Layout from "./components/layout/Layout";
import NotFound from "./pages/NotFound";
import ScrollMascotGuide from "@/components/guidance/ScrollMascotGuide";
import routes from "./routesConfig";
import AccessRoute from "@/components/access/AccessRoute";
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
} from '@/components/auth/ClerkRuntimeContext';
import {
  buildClerkBackendUnavailableRuntime,
  buildClerkRuntimeFromEnv,
} from '@/components/auth/clerkRuntimeResolver';

const ChatWidget = React.lazy(() => import("@/components/chat/ChatWidget"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
const RouteLoadingFallback = () => (
  <div className="flex min-h-[45vh] items-center justify-center bg-background text-sm text-muted-foreground">
    Cargando modulo...
  </div>
);

const useResolvedClerkRuntime = (): ClerkRuntimeValue => {
  const allowEnvFallback = import.meta.env.DEV;
  const [runtime, setRuntime] = React.useState<ClerkRuntimeValue>(() =>
    buildClerkRuntimeFromEnv({
      allowEnvFallback,
      envEnabled: CLERK_AUTH_ENABLED,
      loading: true,
      publishableKey: CLERK_PUBLISHABLE_KEY,
    }),
  );

  React.useEffect(() => {
    let cancelled = false;
    const loadConfig = async () => {
      try {
        const config = await fetchClerkFrontendConfig();
        if (cancelled) return;
        const publishableKey =
          (typeof config.publishable_key === 'string' ? config.publishable_key.trim() : '') ||
          CLERK_PUBLISHABLE_KEY;
        const enabled = Boolean(config.enabled && publishableKey && config.ready_for_session_sync);
        setRuntime({
          enabled,
          loading: false,
          publishableKey,
          source: enabled ? 'backend' : 'disabled',
          socialProviders: Array.isArray(config.social_providers) && config.social_providers.length
            ? config.social_providers
            : DEFAULT_CLERK_RUNTIME.socialProviders,
          oauthCallbackPath:
            typeof config.oauth_callback_path === 'string' && config.oauth_callback_path.trim()
              ? config.oauth_callback_path.trim()
              : DEFAULT_CLERK_RUNTIME.oauthCallbackPath,
          readyForSessionSync: Boolean(config.ready_for_session_sync),
          configurationWarnings: Array.isArray(config.configuration_warnings)
            ? config.configuration_warnings
            : [],
        });
      } catch (error) {
        if (!cancelled) {
          console.warn('[Clerk] No se pudo cargar la configuracion publica del backend', error);
          setRuntime(
            buildClerkBackendUnavailableRuntime({
              allowEnvFallback,
              envEnabled: CLERK_AUTH_ENABLED,
              loading: false,
              publishableKey: CLERK_PUBLISHABLE_KEY,
            }),
          );
        }
      }
    };

    loadConfig();
    return () => {
      cancelled = true;
    };
  }, [allowEnvFallback]);

  return runtime;
};

function AppRoutes() {
  const location = useLocation();
  const navigate = useNavigate();

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
          <ChatWidget mode="standalone" defaultOpen={false} />
        </React.Suspense>
      )}
      <ScrollMascotGuide />
    </TokenRedirectWrapper>
  );
}

const App = () => {
  const clerkRuntime = useResolvedClerkRuntime();
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
              <SocketProvider>
                <TenantProvider>
                  <CapabilitiesProvider>
                    <RealtimeAlertsProvider>
                      {clerkRuntime.enabled && <ClerkAuthBridge />}
                      <AppShellStatusBar />
                      <AppAccessibility />
                      <AppRoutes />
                      <PwaInstallPrompt />
                    </RealtimeAlertsProvider>
                  </CapabilitiesProvider>
                </TenantProvider>
              </SocketProvider>
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
