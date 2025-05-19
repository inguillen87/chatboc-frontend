import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ChatPage from "@/pages/ChatPage";

import Layout from "./components/layout/Layout";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Demo from "./pages/Demo";
import Perfil from "./pages/Perfil";
import NotFound from "./pages/NotFound";
import Checkout  from "./pages/Checkout";
import ChatWidget from "./components/chat/ChatWidget";
import UserPlanCard from "./components/UserPlanCard";

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
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>

        {/* Widgets flotantes posicionados correctamente */}
        <div className="fixed bottom-24 right-4 z-40 w-[90vw] max-w-sm">
          <UserPlanCard />
        </div>
        <ChatWidget />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
