import React from "react"; // React es necesario para Suspense y JSX
import { Toaster } from "@/components/ui/sonner"; // Asumo que existen estos componentes
import { TooltipProvider } from "@/components/ui/tooltip"; // Asumo que existen
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";

// Importa tus páginas (ajusta rutas según tu estructura)
import Layout from "./components/layout/Layout"; // Asume que tienes un Layout
import Index from "./pages/Index"; // Asume que tienes una página Index
// Descomenta e importa las páginas que realmente tienes en tu proyecto:
import Login from "./pages/Login"; // Ejemplo
import Perfil from "./pages/Perfil"; // Ejemplo
import Demo from "./pages/Demo"; // Ejemplo
import ChatPage from "./pages/ChatPage"; // Ejemplo
import Checkout from "./pages/Checkout"; // Ejemplo
// ... y cualquier otra página que uses ...

import Iframe from "./pages/Iframe"; // La página que hostea el ChatWidget para el iframe
import NotFound from "./pages/NotFound"; // Asume que tienes una página 404 (corregí el import)

const queryClient = new QueryClient();

function AppRoutes() {
  const location = useLocation(); // Descomentado para que puedas usarlo
  // Ejemplo: podrías querer ocultar un widget global en la página del iframe
  const ocultarWidgetGlobalEnApp = ["/iframe"].includes(location.pathname);

  return (
    <>
      <Routes>
        {/* Rutas principales con tu Layout */}
        <Route element={<Layout />}>
          <Route path="/" element={<Index />} />
          {/* Aquí van el resto de las rutas de tu aplicación principal */}
          {/* Asegúrate de que estas rutas y componentes existan en tu proyecto */}
          <Route path="/login" element={<Login />} />
          <Route path="/perfil" element={<Perfil />} />
          <Route path="/demo" element={<Demo />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/checkout" element={<Checkout />} />
          {/* ... Añade más rutas de tu aplicación aquí ... */}
        </Route>

        {/* Ruta para el iframe, importante que NO use el Layout global */}
        <Route path="/iframe" element={<Iframe />} />

        {/* Ruta para 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
      
      {/*
        PARA UN WIDGET FLOTANTE EN TU PROPIA APLICACIÓN (ej. en chatboc.ar/perfil):
        - Este es el lugar donde implementarías la lógica para mostrar un ChatWidget
          en las páginas de TU aplicación (no en las de tus clientes PYMEs).
        - El ChatWidget.tsx que te proporcioné para el sistema de iframe con postMessage
          está optimizado para ESE CASO DE USO.
        - Si quieres un widget flotante aquí, necesitarías:
            1. Usar una versión de ChatWidget diseñada para ser "standalone"
               (como la que tenía el prop `mode="standalone"` que discutimos antes,
               con su propio posicionamiento fijo, botón de toggle, y lógica de arrastre).
            2. O adaptar el ChatWidget.tsx actual para que, si detecta que NO está
               en un iframe (window.parent === window), cambie su comportamiento.
               Esto puede añadir bastante complejidad al componente ChatWidget.

        Ejemplo conceptual (si tuvieras un ChatWidgetStandalone):

        const ChatWidgetStandalone = React.lazy(() => import("@/components/chat/ChatWidgetStandalone"));
        // ... más abajo ...
        {!ocultarWidgetGlobalEnApp && (
          <React.Suspense fallback={<div>Cargando Chat...</div>}>
            <ChatWidgetStandalone defaultOpen={false} initialPosition={{ bottom: 20, right: 20 }} />
          </React.Suspense>
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