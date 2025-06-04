import React from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";

// Páginas principales (Asegúrate de que estas rutas y componentes existan y las rutas de importación sean correctas)
import Layout from "./components/layout/Layout";
import Index from "./pages/Index";
import Login from "./pages/Login"; // Descomentado
import Perfil from "./pages/Perfil"; // Descomentado
// Si tienes estas páginas, asegúrate que los archivos existan en ./pages/
// import Demo from "./pages/Demo";
// import ChatPage from "./pages/ChatPage";
// import Checkout from "./pages/Checkout";
// import ChatPosPage from "./pages/ChatPosPage";
// import ChatCRMPage from "./pages/ChatCRMPage";
// import Integracion from "./pages/Integracion";
// import Documentacion from "./pages/Documentacion";
// import Faqs from "./pages/Faqs";
// import Privacy from "./pages/legal/Privacy";
// import Terms from "./pages/legal/Terms";
// import Cookies from "./pages/legal/Cookies";

import Iframe from "./pages/Iframe"; // La página que hostea el ChatWidget para el iframe
import NotFound from "./pages/NotFound"; // Asegúrate que este archivo exista

const queryClient = new QueryClient();

function AppRoutes() {
  const location = useLocation();
  // Lógica para ocultar un posible widget global en tu propia app, si lo tuvieras
  const ocultarWidgetGlobalEnApp = ["/iframe"].includes(location.pathname);

  return (
    <>
      <Routes>
        {/* Rutas principales con tu Layout */}
        <Route element={<Layout />}>
          <Route path="/" element={<Index />} />
          {/* Aquí las rutas que tenías y que funcionaban */}
          <Route path="/login" element={<Login />} />
          <Route path="/perfil" element={<Perfil />} />
          {/* Descomenta y verifica las siguientes si las usas y los componentes existen:
          <Route path="/demo" element={<Demo />} />
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
          */}
        </Route>

        {/* Ruta para el iframe, importante que NO use el Layout global */}
        <Route path="/iframe" element={<Iframe />} />

        {/* Ruta para 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
      
      {/*
        Si tenías un ChatWidget flotante global para TU PROPIA APLICACIÓN aquí,
        ese ChatWidget necesitaría ser una versión "standalone" (autocontenida),
        diferente del ChatWidget.tsx que te pasé arriba, que está diseñado para
        funcionar con widget.js y postMessage.
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