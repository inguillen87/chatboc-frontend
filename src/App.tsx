import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

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

// Otras páginas
import Documentacion from "./pages/Documentacion";
import Faqs from "./pages/Faqs";
import Privacy from "./pages/legal/Privacy";
import Terms from "./pages/legal/Terms";
import Cookies from "./pages/legal/Cookies";
import NotFound from "./pages/NotFound";

// Chat y rutas especiales
import ChatWidget from "./components/chat/ChatWidget";
import Iframe from "./pages/Iframe";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <BrowserRouter>
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

          {/* Rutas fuera del layout (sin header/footer/globales) */}
          <Route path="/iframe" element={<Iframe />} />

          {/* 404 - Not found */}
          <Route path="*" element={<NotFound />} />
        </Routes>

        {/* Widget global flotante para todas las páginas comunes */}
        <ChatWidget />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
