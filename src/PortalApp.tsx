import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { HashRouter, Navigate, Route, Routes, useParams } from "react-router-dom";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import UserPortalGuard from "@/components/user-portal/UserPortalGuard";
import UserPortalLayout from "@/components/user-portal/layout/UserPortalLayout";
import { TenantProvider } from "@/context/TenantContext";
import { DateSettingsProvider } from "@/hooks/useDateSettings";
import { UserProvider } from "@/hooks/useUser";
import { GOOGLE_CLIENT_ID } from "@/env";
import UserDashboardPage from "@/pages/user-portal/UserDashboardPage";
import UserCatalogPage from "@/pages/user-portal/UserCatalogPage";
import UserOrdersPage from "@/pages/user-portal/UserOrdersPage";
import UserClaimsPage from "@/pages/user-portal/UserClaimsPage";
import UserNewsPage from "@/pages/user-portal/UserNewsPage";
import UserEventsPage from "@/pages/user-portal/UserEventsPage";
import UserBenefitsPage from "@/pages/user-portal/UserBenefitsPage";
import UserSurveysPage from "@/pages/user-portal/UserSurveysPage";
import UserAccountPage from "@/pages/user-portal/UserAccountPage";
import { PortalLandingPage } from "@/pages/user-portal/PortalLandingPage";
import TenantTicketFormPage from "@/pages/tenant/TenantTicketFormPage";
import NotFound from "@/pages/NotFound";
import { buildTenantPath } from "@/utils/tenantPaths";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const guestPortalPaths = [
  "/portal/dashboard",
  "/portal/:tenant",
  "/portal/catalogo",
  "/portal/pedidos",
  "/portal/reclamos",
  "/portal/noticias",
  "/portal/eventos",
  "/portal/beneficios",
  "/portal/encuestas",
  "/portal/cuenta",
  "/t/:tenant/portal/dashboard",
  "/t/:tenant/portal/catalogo",
  "/t/:tenant/portal/pedidos",
  "/t/:tenant/portal/reclamos",
  "/t/:tenant/portal/noticias",
  "/t/:tenant/portal/eventos",
  "/t/:tenant/portal/beneficios",
  "/t/:tenant/portal/encuestas",
  "/t/:tenant/portal/cuenta",
  "/noticias/eventos",
  "/noticias/encuestas",
  "/municipio/reclamos/nuevo",
];

function PortalTenantRedirect() {
  const params = useParams();
  const tenant = typeof params.tenant === "string" ? params.tenant.trim() : "";
  if (!tenant) return <Navigate to="/portal/dashboard" replace />;
  return <Navigate to={buildTenantPath("/portal/dashboard", tenant)} replace />;
}

function PortalRoutes() {
  return (
    <HashRouter>
      <TenantProvider>
        <Routes>
          <Route
            path="/"
            element={<Navigate to="/portal/dashboard" replace />}
          />
          <Route
            element={
              <UserPortalGuard allowGuestPaths={guestPortalPaths}>
                <UserPortalLayout />
              </UserPortalGuard>
            }
          >
            <Route path="/portal/dashboard" element={<UserDashboardPage />} />
            <Route path="/portal/:tenant" element={<PortalTenantRedirect />} />
            <Route path="/portal/catalogo" element={<UserCatalogPage />} />
            <Route path="/portal/pedidos" element={<UserOrdersPage />} />
            <Route path="/portal/reclamos" element={<UserClaimsPage />} />
            <Route path="/portal/noticias" element={<UserNewsPage />} />
            <Route path="/portal/eventos" element={<UserEventsPage />} />
            <Route path="/portal/beneficios" element={<UserBenefitsPage />} />
            <Route path="/portal/encuestas" element={<UserSurveysPage />} />
            <Route path="/portal/cuenta" element={<UserAccountPage />} />
            <Route path="/t/:tenant/portal/dashboard" element={<UserDashboardPage />} />
            <Route path="/t/:tenant/portal/catalogo" element={<UserCatalogPage />} />
            <Route path="/t/:tenant/portal/pedidos" element={<UserOrdersPage />} />
            <Route path="/t/:tenant/portal/reclamos" element={<UserClaimsPage />} />
            <Route path="/t/:tenant/portal/noticias" element={<UserNewsPage />} />
            <Route path="/t/:tenant/portal/eventos" element={<UserEventsPage />} />
            <Route path="/t/:tenant/portal/beneficios" element={<UserBenefitsPage />} />
            <Route path="/t/:tenant/portal/encuestas" element={<UserSurveysPage />} />
            <Route path="/t/:tenant/portal/cuenta" element={<UserAccountPage />} />
            <Route path="/noticias/eventos" element={<UserEventsPage />} />
            <Route path="/noticias/encuestas" element={<UserSurveysPage />} />
            <Route
              path="/municipio/reclamos/nuevo"
              element={<TenantTicketFormPage />}
            />
          </Route>
                    <Route path="/:tenant/welcome" element={<PortalLandingPage />} />
          <Route path="/welcome" element={<PortalLandingPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </TenantProvider>
    </HashRouter>
  );
}

const PortalAppTree = (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <UserProvider>
        <DateSettingsProvider>
          <PortalRoutes />
        </DateSettingsProvider>
      </UserProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default function PortalApp() {
  if (!GOOGLE_CLIENT_ID) {
    return PortalAppTree;
  }

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      {PortalAppTree}
    </GoogleOAuthProvider>
  );
}
