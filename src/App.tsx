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
import { DateSettingsProvider } from "./hooks/useDateSettings";
import { UserProvider } from "./hooks/useUser";
import useTicketUpdates from "./hooks/useTicketUpdates";

const queryClient = new QueryClient();
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
if (!GOOGLE_CLIENT_ID) {
  console.warn(
    'VITE_GOOGLE_CLIENT_ID is missing. Google OAuth login will fail until this variable is set. See README.md for setup instructions.'
  );
}

function AppRoutes() {
  const location = useLocation();
  useTicketUpdates();

  // Ahora el array soporta rutas exactas y subrutas tipo "/integracion/preview"
  const rutasSinWidget = [
    '/',
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

  // El .some() detecta si la ruta actual *empieza* igual que alguna de la lista
  const ocultarWidgetGlobalEnApp = rutasSinWidget.some(
    (ruta) =>
      location.pathname === ruta || location.pathname.startsWith(ruta + "/")
  );

  return (
    <>
      <Routes>
        <Route element={<Layout />}>
          {routes.map(({ path, element, roles }) => (
            <Route
              key={path}
              path={path}
              element={roles ? (
                <ProtectedRoute roles={roles}>{element}</ProtectedRoute>
              ) : (
                element
              )}
            />
          ))}
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>

      {/* Monta el widget global SOLO si no estás en demo/integracion/login/register/iframe */}
      {!ocultarWidgetGlobalEnApp && (
        <ChatWidget mode="standalone" defaultOpen={false} />
      )}
    </>
  );
}

const App = () => (
  <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <UserProvider>
          <DateSettingsProvider>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </DateSettingsProvider>
        </UserProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </GoogleOAuthProvider>
);

export default App;
