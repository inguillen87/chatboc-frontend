import React from "react";
import { Toaster } from "@/components/ui/sonner"; // Verifica la ruta
import { TooltipProvider } from "@/components/ui/tooltip"; // Verifica la ruta
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";

// Páginas principales (Asegúrate de que estas rutas y componentes existan)
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

// Otras páginas
import Documentacion from "./pages/Documentacion";
import Faqs from "./pages/Faqs";
import Privacy from "./pages/legal/Privacy";
import Terms from "./pages/legal/Terms";
import Cookies from "./pages/legal/Cookies";
import NotFound from "./pages/NotFound"; // Corregido el import si estaba mal

// Chat y rutas especiales
// El ChatWidget global para TU app es un tema aparte. Este App.tsx se centra en las rutas.
import Iframe from "./pages/Iframe";

const queryClient = new QueryClient();

function AppRoutes() {
  // const location = useLocation();
  // const ocultarWidgetGlobalEnApp = ["/iframe"].includes(location.pathname);

  return (
    <>
      <Routes>
        {/* Rutas con Layout general */}
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
          {/* Info y legales */}
          <Route path="/documentacion" element={<Documentacion />} />
          <Route path="/faqs" element={<Faqs />} />
          <Route path="/legal/privacy" element={<Privacy />} />
          <Route path="/legal/terms" element={<Terms />} />
          <Route path="/legal/cookies" element={<Cookies />} />
        </Route>
        {/* Ruta fuera del layout para el iframe */}
        <Route path="/iframe" element={<Iframe />} />
        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
      {/* Si necesitas un widget flotante EN TU PROPIA APLICACIÓN (ej. chatboc.ar/perfil),
        deberás gestionarlo aquí con un componente ChatWidget adecuado para "standalone".
        El ChatWidget.tsx que te pasé está enfocado en el iframe.
        Ejemplo:
        {!ocultarWidgetGlobalEnApp && (
          <ChatWidgetStandaloneProperties ... />
        )}
      */}
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