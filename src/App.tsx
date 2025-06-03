import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ChatPage from "@/pages/ChatPage";
import Documentacion from "@/pages/Documentacion"; // O la ruta real
import Layout from "./components/layout/Layout";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Demo from "./pages/Demo";
import Perfil from "./pages/Perfil";
import NotFound from "./pages/NotFound";
import Checkout  from "./pages/Checkout";
import ChatWidget from "./components/chat/ChatWidget";
import ChatPosPage from "./pages/ChatPosPage";
import ChatCRMPage from "./pages/ChatCRMPage";
import Iframe from "@/pages/Iframe"; // Asegurate que el path esté bien
import Integracion from "./pages/Integracion";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <BrowserRouter>
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
            <Route path="/iframe" element={<Iframe />} />
            <Route path="/integracion" element={<Integracion />} />
            <Route path="/documentacion" element={<Documentacion />} />

          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
        {/* Widgets flotantes posicionados correctamente */}
       <ChatWidget />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
