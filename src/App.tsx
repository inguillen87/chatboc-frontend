// src/App.tsx

import React from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";

// Páginas principales
import Layout from "./components/layout/Layout";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import UserLogin from "./pages/UserLogin";
import UserRegister from "./pages/UserRegister";
import Demo from "./pages/Demo";
import Perfil from "./pages/Perfil";
import UserAccount from "./pages/UserAccount";
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
import NotFound from "./pages/NotFound";
import PedidosPage from "./pages/PedidosPage";
import ChatWidget from "@/components/chat/ChatWidget";
import TicketsPanelPro from "./pages/TicketsPanel";
import UsuariosPage from "./pages/UsuariosPage";
import ProductCatalog from "./pages/ProductCatalog";
import MunicipalStats from "./pages/MunicipalStats";
import IncidentsMap from "./pages/IncidentsMap";
import NotificationSettings from "./pages/NotificationSettings";
import TramitesCatalog from "./pages/TramitesCatalog";
import InternalUsers from "./pages/InternalUsers";
import WhatsappIntegration from "./pages/WhatsappIntegration";
import MunicipalSystems from "./pages/MunicipalSystems";
import SatisfactionSurveys from "./pages/SatisfactionSurveys";
import CustomerHistory from "./pages/CustomerHistory";
import BudgetRequest from "./pages/BudgetRequest";
import Reminders from "./pages/Reminders";
import BusinessMetrics from "./pages/BusinessMetrics";
import CrmIntegrations from "./pages/CrmIntegrations";
import PredefinedQueries from "./pages/PredefinedQueries";
import { DateSettingsProvider } from "./hooks/useDateSettings";
import { UserProvider } from "./hooks/useUser";
import useTicketUpdates from "./hooks/useTicketUpdates";

const queryClient = new QueryClient();
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
if (!GOOGLE_CLIENT_ID) {
  console.warn(
    'VITE_GOOGLE_CLIENT_ID is missing. Google OAuth login will fail until this variable is set. See README.md for setup instructions.'
  );
}

function AppRoutes() {
  const location = useLocation();
  useTicketUpdates();

  // Ahora el array soporta rutas exactas y subrutas tipo "/integracion/preview"
  const rutasSinWidget = [
    "/iframe",
    "/login",
    "/register",
    "/user/login",
    "/user/register",
    "/cuenta",
    "/integracion",
    "/demo"
  ];

  // El .some() detecta si la ruta actual *empieza* igual que alguna de la lista
  const ocultarWidgetGlobalEnApp = rutasSinWidget.some(
    (ruta) =>
      location.pathname === ruta || location.pathname.startsWith(ruta + "/")
  );

  return (
    <>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/user/login" element={<UserLogin />} />
          <Route path="/user/register" element={<UserRegister />} />
          <Route path="/cuenta" element={<UserAccount />} />
          <Route path="/demo" element={<Demo />} />
          <Route path="/perfil" element={<Perfil />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/chatpos" element={<ChatPosPage />} />
          <Route path="/chatcrm" element={<ChatCRMPage />} />
          <Route path="/integracion" element={<Integracion />} />
          <Route path="/documentacion" element={<Documentacion />} />
          <Route path="/faqs" element={<Faqs />} />
          <Route path="/legal/privacy" element={<Privacy />} />
          <Route path="/legal/terms" element={<Terms />} />
          <Route path="/legal/cookies" element={<Cookies />} />
          <Route path="/tickets" element={<TicketsPanelPro />} />
          <Route path="/pedidos" element={<PedidosPage />} />
          <Route path="/usuarios" element={<UsuariosPage />} />
          <Route path="/notifications" element={<NotificationSettings />} />
          <Route path="/historial" element={<CustomerHistory />} />
          <Route path="/presupuestos" element={<BudgetRequest />} />
          <Route path="/recordatorios" element={<Reminders />} />
          <Route path="/pyme/metrics" element={<BusinessMetrics />} />
          <Route path="/crm/integrations" element={<CrmIntegrations />} />
          <Route path="/consultas" element={<PredefinedQueries />} />
          <Route path="/pyme/catalog" element={<ProductCatalog />} />
          <Route path="/municipal/tramites" element={<TramitesCatalog />} />
          <Route path="/municipal/usuarios" element={<InternalUsers />} />
          <Route path="/municipal/whatsapp" element={<WhatsappIntegration />} />
          <Route path="/municipal/integrations" element={<MunicipalSystems />} />
          <Route path="/municipal/surveys" element={<SatisfactionSurveys />} />
          <Route path="/municipal/stats" element={<MunicipalStats />} />
          <Route path="/municipal/incidents" element={<IncidentsMap />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>

      {/* Monta el widget global SOLO si no estás en demo/integracion/login/register/iframe */}
      {!ocultarWidgetGlobalEnApp && (
        <ChatWidget mode="standalone" defaultOpen={false} />
      )}
    </>
  );
}

const App = () => (
  <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <UserProvider>
          <DateSettingsProvider>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </DateSettingsProvider>
        </UserProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </GoogleOAuthProvider>
);

export default App;
