
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Demo from "./pages/Demo";
import NotFound from "./pages/NotFound";
import ChatWidget from "./components/chat/ChatWidget";
import UserPlanCard from './components/UserPlanCard';
import EnvironmentBadge from "./components/EnvironmentBadge";
import Perfil from "./pages/Perfil";
import Register from "./pages/Register";



const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
           <Route path="/login" element={<Login />} />
           <Route path="/demo" element={<Demo />} />
           <Route path="/perfil" element={<Perfil />} />
           <Route path="/register" element={<Register />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
      <UserPlanCard />
      <ChatWidget />
      <EnvironmentBadge /> {/* Etiqueta flotante en la esquina */}
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
