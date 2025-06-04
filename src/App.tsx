import React from "react"; // React es necesario para Suspense y JSX
import { Toaster } from "@/components/ui/sonner"; // Asumiendo que existen estos componentes
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

// Importa tus páginas (ajusta rutas según tu estructura)
import Layout from "./components/layout/Layout"; // Asume que tienes un Layout
import Index from "./pages/Index"; // Asume que tienes una página Index
// ... Si tienes otras páginas como Login, Perfil, etc., impórtalas aquí
// import Login from "./pages/Login";
// import Perfil from "./pages/Perfil";
import Iframe from "./pages/Iframe"; // La página que hostea el ChatWidget para el iframe
import NotFound from "./pages.NotFound"; // Asume que tienes una página 404

const queryClient = new QueryClient();

function AppRoutes() {
  // const location = useLocation(); // Descomenta si necesitas lógica basada en la ruta actual
  // const ocultarWidgetGlobal = ["/iframe"].includes(location.pathname); // Ejemplo

  return (
    <Routes>
      {/* Rutas principales con tu Layout */}
      <Route element={<Layout />}>
        <Route path="/" element={<Index />} />
        {/* Aquí van el resto de las rutas de tu aplicación principal */}
        {/* Ejemplo:
        <Route path="/login" element={<Login />} />
        <Route path="/perfil" element={<Perfil />} />
        */}
      </Route>

      {/* Ruta para el iframe, importante que NO use el Layout global */}
      <Route path="/iframe" element={<Iframe />} />

      {/* Ruta para 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
    
    {/*
      PARA UN WIDGET FLOTANTE EN TU PROPIA APLICACIÓN (ej. en chatboc.ar/perfil):
      - El ChatWidget.tsx actual está diseñado para funcionar con widget.js y postMessage.
      - Si necesitas un widget flotante en tu app, necesitarías:
          1. Una versión diferente de ChatWidget (como la que tenías con `mode="standalone"`).
          2. O adaptar el ChatWidget.tsx actual para que, si no está en un iframe
             (window.parent === window), se comporte como un widget flotante autocontenido.
             Esto haría el componente más complejo.
      - Ejemplo conceptual de cómo se añadiría un widget standalone (requiere el componente adecuado):
        {!ocultarWidgetGlobal && (
          <StandaloneFloatingChatWidget defaultOpen={false} />
        )}
    */}
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider> {/* Asumiendo que usas tooltips */}
      <Toaster /> {/* Para notificaciones Sonner */}
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;