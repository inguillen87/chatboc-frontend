import React from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";

// Importa tus páginas
import Layout from "./components/layout/Layout"; // Asume que tienes estos
import Index from "./pages/Index";
// ... otras importaciones de páginas ...
import Iframe from "./pages/Iframe"; // La página que hostea el ChatWidget para el iframe
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AppRoutes() {
  // const location = useLocation(); // Si necesitas ocultar algo basado en ruta
  // const ocultarWidgetGlobal = ["/iframe"].includes(location.pathname);

  return (
    <Routes>
      {/* Rutas principales con tu Layout */}
      <Route element={<Layout />}>
        <Route path="/" element={<Index />} />
        {/* ... Más rutas de tu aplicación ... */}
      </Route>

      {/* Ruta para el iframe, sin el Layout global */}
      <Route path="/iframe" element={<Iframe />} />

      {/* Ruta para 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
    // Si deseas un widget flotante en TU PROPIA APP (ej. chatboc.ar/perfil),
    // necesitarías una instancia de ChatWidget aquí con una lógica para modo "standalone"
    // que no dependa de postMessage para redimensionar un iframe, sino que se posicione
    // y se muestre/oculte a sí mismo con CSS y estado de React.
    // La versión de ChatWidget.tsx actual está optimizada para el iframe.
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