import React from "react"; // React es necesario para Suspense y JSX
import { Toaster } from "@/components/ui/sonner"; // Asegúrate que esta ruta sea correcta
import { TooltipProvider } from "@/components/ui/tooltip"; // Asegúrate que esta ruta sea correcta
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";

// Importa tus páginas (Asegúrate de que estas rutas y componentes existan en tu proyecto)
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
import NotFound from "./pages/NotFound"; // Asegúrate que la ruta a NotFound sea correcta

// Página especial para el iframe del widget de PYMEs
import Iframe from "./pages/Iframe";

const queryClient = new QueryClient();

function AppRoutes() {
  const location = useLocation(); // Puedes usar 'location' para lógica condicional si es necesario

  // Ejemplo: podrías querer ocultar un widget flotante global (para TU app) en ciertas rutas
  const RutasDondeOcultarWidgetGlobal = ["/iframe"]; // Añade más rutas si es necesario
  const ocultarWidgetGlobalEnApp = RutasDondeOcultarWidgetGlobal.includes(location.pathname);

  return (
    <>
      <Routes>
        {/* Rutas principales que usan el Layout general de tu aplicación */}
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
          
          {/* Rutas de Información y Legales */}
          <Route path="/documentacion" element={<Documentacion />} />
          <Route path="/faqs" element={<Faqs />} />
          <Route path="/legal/privacy" element={<Privacy />} />
          <Route path="/legal/terms" element={<Terms />} />
          <Route path="/legal/cookies" element={<Cookies />} />
        </Route>

        {/* Ruta especial para el iframe: NO usa el Layout global */}
        <Route path="/iframe" element={<Iframe />} />

        {/* Ruta Catch-all para páginas no encontradas (404) */}
        <Route path="*" element={<NotFound />} />
      </Routes>
      
      {/* ---------------------------------------------------------------------------
        LÓGICA PARA UN WIDGET FLOTANTE EN TU PROPIA APLICACIÓN (chatboc.ar)
        ---------------------------------------------------------------------------
        Esta sección es donde implementarías un widget flotante para las páginas
        de tu propia aplicación. Como mencioné antes, el ChatWidget.tsx que hemos
        estado refinando para el iframe (con postMessage) no es ideal para este uso
        directamente sin adaptaciones o un prop "mode".

        Si tenías un widget funcional aquí antes, deberías restaurar esa lógica.
        Si estás construyendo uno nuevo, necesitarías un componente que se encargue
        de su propio posicionamiento, estado de abierto/cerrado, y arrastre.

        Ejemplo conceptual (requiere un componente ChatWidgetStandalone):
        
        // const ChatWidgetStandalone = React.lazy(() => import("@/components/chat/ChatWidgetStandalone"));
        // {!ocultarWidgetGlobalEnApp && (
        //   <React.Suspense fallback={<div>Cargando Chat...</div>}>
        //     <ChatWidgetStandalone 
        //         defaultOpen={false} // Por ejemplo
        //     />
        //   </React.Suspense>
        // )}
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