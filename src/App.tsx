import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ChatPage from "@/pages/ChatPage";
import Documentacion from "@/pages/Documentacion";
import Faqs from "@/pages/Faqs";
import Privacy from "@/pages/legal/Privacy";
import Terms from "@/pages/legal/Terms";
import Cookies from "@/pages/legal/Cookies";
import Layout from "./components/layout/Layout";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Demo from "./pages/Demo";
import Perfil from "./pages/Perfil";
import NotFound from "./pages/NotFound";
import Checkout from "./pages/Checkout";
import ChatWidget from "./components/chat/ChatWidget";
import ChatPosPage from "./pages/ChatPosPage";
import ChatCRMPage from "./pages/ChatCRMPage";
import Iframe from "@/pages/Iframe";
import Integracion from "./pages/Integracion";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <BrowserRouter>
       <Routes>
  {/* Todas las rutas normales con Layout */}
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
    {/* Páginas de ayuda y docs */}
    <Route path="/documentacion" element={<Documentacion />} />
    <Route path="/faqs" element={<Faqs />} />
    {/* Legales */}
    <Route path="/legal/privacy" element={<Privacy />} />
    <Route path="/legal/terms" element={<Terms />} />
    <Route path="/legal/cookies" element={<Cookies />} />
  </Route>

  {/* ---> ESTA ES LA DIFERENCIA <--- */}
  {/* Ruta especial SIN Layout */}
  <Route path="/iframe" element={<Iframe />} />

  {/* 404 */}
  <Route path="*" element={<NotFound />} />
</Routes>
      <ChatWidget />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
