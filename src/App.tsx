// src/App.tsx

import React from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";

// Páginas principales
import Layout from "./components/layout/Layout";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Demo from "./pages/Demo";
import Perfil from "./pages/Perfil";
import ChatPage from "./pages/ChatPage";
import ChatPosPage from "./pages/ChatPosPage";
import ChatCRMPage from "./pages/ChatCRMPage";
import Integracion from "./pages/Integracion";
import Checkout from "./pages/Checkout";
import Documentacion from "./pages/Documentacion";
import Faqs from "./pages/Faqs";
import Privacy from "./pages/legal/Privacy";
import Terms from "./pages/legal/Terms";
import Cookies from "./pages/legal/Cookies";
import NotFound from "./pages/NotFound";
import PedidosPage from "./pages/PedidosPage";
import ChatWidget from "@/components/chat/ChatWidget";
import TicketsPanelPro from "./pages/TicketsPanel";
import { DateSettingsProvider } from "./hooks/useDateSettings";
import { UserProvider } from "./hooks/useUser";

const queryClient = new QueryClient();

function AppRoutes() {
  const location = useLocation();

  // Ahora el array soporta rutas exactas y subrutas tipo "/integracion/preview"
  const rutasSinWidget = [
    "/iframe",
    "/login",
    "/register",
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
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/demo" element={<Demo />} />
          <Route path="/perfil" element={<Perfil />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/chatpos" element={<ChatPosPage />} />
          <Route path="/chatcrm" element={<ChatCRMPage />} />
          <Route path="/integracion" element={<Integracion />} />
          <Route path="/documentacion" element={<Documentacion />} />
          <Route path="/faqs" element={<Faqs />} />
          <Route path="/legal/privacy" element={<Privacy />} />
          <Route path="/legal/terms" element={<Terms />} />
          <Route path="/legal/cookies" element={<Cookies />} />
          <Route path="/tickets" element={<TicketsPanelPro />} />
          <Route path="/pedidos" element={<PedidosPage />} />
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
);

export default App;
