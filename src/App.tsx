// src/App.tsx

import React from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";

// Páginas principales
import Layout from "./components/layout/Layout";
import NotFound from "./pages/NotFound";
import ChatWidget from "@/components/chat/ChatWidget";
import routes from "./routesConfig";
import AccessRoute from "@/components/access/AccessRoute";
import UserPortalGuard from "@/components/user-portal/UserPortalGuard";
import { DateSettingsProvider } from "./hooks/useDateSettings";
import { UserProvider } from "./hooks/useUser";
import { RealtimeAlertsProvider } from "@/context/RealtimeAlertsContext";
import { TenantProvider } from "./context/TenantContext";
import { SocketProvider } from "@/context/SocketContext";
import { GOOGLE_CLIENT_ID } from './env';
import UserPortalLayout from "@/components/user-portal/layout/UserPortalLayout";
import TokenRedirectWrapper from "@/components/TokenRedirectWrapper";
import { CapabilitiesProvider } from '@/context/CapabilitiesContext';
import { toCanonicalTenantPath } from '@/utils/canonicalTenantRouting';
import { AppShellStatusBar } from '@/components/app-shell/AppShellStatusBar';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
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
  const layoutExcludedPaths = ['/iframe'];
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
    "/user/login",
    "/user/register",
    "/cuenta",
    '/chat',
    "/tracking",
    "/integracion",
    "/admin"
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
      <Routes>
        <Route element={<Layout />}>
          {layoutRoutes.map(({ path, element, roles, requiredCapabilities }) => (
            <Route
              key={path} // La key ya estaba correctamente aquí. No se requieren cambios.
              path={path}
              element={
                roles || requiredCapabilities ? (
                  <AccessRoute roles={roles} requiredCapabilities={requiredCapabilities}>{element}</AccessRoute>
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
        {standaloneRoutes.map(({ path, element, roles, requiredCapabilities }) => (
          <Route
            key={path}
            path={path}
            element={
              roles || requiredCapabilities ? (
                <AccessRoute roles={roles} requiredCapabilities={requiredCapabilities}>{element}</AccessRoute>
              ) : (
                element
              )
            }
          />
        ))}
        <Route path="*" element={<NotFound />} />
      </Routes>

      {/* Monta el widget global SOLO si no estás en demo/integracion/login/register/iframe */}
      {!ocultarWidgetGlobalEnApp && (
        <ChatWidget mode="standalone" defaultOpen={false} />
      )}
    </TokenRedirectWrapper>
  );
}

const App = () => {
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
                      <AppShellStatusBar />
                      <AppRoutes />
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

  if (!GOOGLE_CLIENT_ID) {
    return appTree;
  }

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      {appTree}
    </GoogleOAuthProvider>
  );
};

export default App;
