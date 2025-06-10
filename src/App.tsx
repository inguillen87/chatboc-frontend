import React from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";

// Páginas principales (Asegúrate que existan estos componentes)
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

import Iframe from "./pages/Iframe";

// Importá tu componente TicketsPanelPro aquí
import TicketsPanelPro from "./pages/TicketsPanel";
// --- NUEVO: Importa tu componente PedidosPage aquí ---
import PedidosPage from "./pages/PedidosPage"; 

const queryClient = new QueryClient();

function AppRoutes() {
  const location = useLocation();
  const RutasDondeOcultarWidgetGlobal = ["/iframe", "/login", "/register"];
  const ocultarWidgetGlobalEnApp = RutasDondeOcultarWidgetGlobal.includes(location.pathname);

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
          {/* Ruta para panel de tickets */}
          <Route path="/tickets" element={<TicketsPanelPro />} />
          {/* --- NUEVA RUTA PARA PANEL DE PEDIDOS --- */}
          <Route path="/pedidos" element={<PedidosPage />} /> 
        </Route>

        <Route path="/iframe" element={<Iframe />} />
        <Route path="*" element={<NotFound />} />
      </Routes>

      {/* Aquí puedes reactivar el chatwidget global si querés */}
      {/* {!ocultarWidgetGlobalEnApp && <ChatWidget mode="standalone" defaultOpen={false} />} */}
    </>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;