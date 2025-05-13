import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Layout from "./components/layout/Layout"; // ← AGREGADO
import Index from "./pages/Index";
import Login from "./pages/Login";
import Demo from "./pages/Demo";
import Perfil from "./pages/Perfil";
import Register from "./pages/Register";
import NotFound from "./pages/NotFound";

import ChatWidget from "./components/chat/ChatWidget";
import UserPlanCard from "./components/UserPlanCard";
import EnvironmentBadge from "./components/EnvironmentBadge";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/demo" element={<Demo />} />
            <Route path="/perfil" element={<Perfil />} />
            <Route path="/register" element={<Register />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>

        {/* Widgets flotantes */}
        <UserPlanCard />
        <ChatWidget />
        <EnvironmentBadge />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
