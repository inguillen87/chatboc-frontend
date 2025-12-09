// src/App.tsx

import React from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";

// Páginas principales
import Layout from "./components/layout/Layout";
import NotFound from "./pages/NotFound";
import ChatWidget from "@/components/chat/ChatWidget";
import routes from "./routesConfig";
import ProtectedRoute from "@/components/ProtectedRoute";
import UserPortalGuard from "@/components/user-portal/UserPortalGuard";
import { DateSettingsProvider } from "./hooks/useDateSettings";
import { UserProvider } from "./hooks/useUser";
import useTicketUpdates from "./hooks/useTicketUpdates";
import { TenantProvider } from "./context/TenantContext";
import { GOOGLE_CLIENT_ID } from './env';
import UserPortalLayout from "@/components/user-portal/layout/UserPortalLayout";
import TokenRedirectWrapper from "@/components/TokenRedirectWrapper";

const queryClient = new QueryClient();
function AppRoutes() {
  const location = useLocation();
  useTicketUpdates();

  const layoutExcludedPaths = ['/iframe'];
  const layoutRoutes = routes.filter(({ path, userPortal }) => !layoutExcludedPaths.includes(path) && !userPortal);
  const portalRoutes = routes.filter(({ userPortal }) => userPortal);
  const guestPortalPaths = portalRoutes.filter(({ allowGuest }) => allowGuest).map(({ path }) => path);
  const standaloneRoutes = routes.filter(({ path, userPortal }) => layoutExcludedPaths.includes(path) && !userPortal);

  // Ahora el array soporta rutas exactas y subrutas tipo "/integracion/preview"
  const rutasSinWidget = [
    // '/', // ENABLE WIDGET ON LANDING PAGE
    "/iframe",
    "/login",
    "/register",
    "/user/login",
    "/user/register",
    "/cuenta",
    '/chat',
    "/integracion",
    "/demo"
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
    <TenantProvider>
      <TokenRedirectWrapper>
        <Routes>
          <Route element={<Layout />}>
            {layoutRoutes.map(({ path, element, roles }) => (
              <Route
              key={path} // La key ya estaba correctamente aquí. No se requieren cambios.
              path={path}
              element={
                roles ? (
                  <ProtectedRoute roles={roles}>{element}</ProtectedRoute>
                ) : (
                  element
                )
              }
              />
            ))}
          </Route>
          {portalRoutes.length > 0 && (
            <Route element={<UserPortalGuard allowGuestPaths={guestPortalPaths}><UserPortalLayout /></UserPortalGuard>}>
              {portalRoutes.map(({ path, element }) => (
                <Route key={path} path={path} element={element} />
              ))}
            </Route>
          )}
          {standaloneRoutes.map(({ path, element, roles }) => (
            <Route
              key={path}
              path={path}
              element={roles ? <ProtectedRoute roles={roles}>{element}</ProtectedRoute> : element}
            />
          ))}
          <Route path="*" element={<NotFound />} />
        </Routes>

        {/* Monta el widget global SOLO si no estás en demo/integracion/login/register/iframe */}
        {!ocultarWidgetGlobalEnApp && (
          <ChatWidget mode="standalone" defaultOpen={false} />
        )}
      </TokenRedirectWrapper>
    </TenantProvider>
  );
}

const App = () => {
  const appTree = (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <UserProvider>
          <DateSettingsProvider>
            <BrowserRouter future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true
            }}>
              <AppRoutes />
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
