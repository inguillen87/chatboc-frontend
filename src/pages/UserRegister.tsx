import React, { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ChatUserRegisterPanel from "@/components/chat/ChatUserRegisterPanel";
import { useTenant } from "@/context/TenantContext";
import { buildTenantPath } from "@/utils/tenantPaths";
import type { Role } from "@/utils/roles";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import ErrorBoundary from "@/components/ErrorBoundary";

const UserRegister = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { widgetToken, currentSlug } = useTenant();

  const effectiveTenantSlug = useMemo(
    () => currentSlug ?? safeLocalStorage.getItem('tenantSlug') ?? null,
    [currentSlug]
  );

  const redirectTo = (location.state as { redirectTo?: string } | null)?.redirectTo;
  const defaultDashboard = buildTenantPath("/portal/dashboard", effectiveTenantSlug);
  const loginPath = buildTenantPath("/user/login", effectiveTenantSlug);

  return (
    <ErrorBoundary fallbackMessage="Ocurrió un problema al cargar el formulario de registro. Por favor, intente recargar la página o deshabilitar extensiones del navegador que puedan interferir.">
      <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-4 bg-gradient-to-br from-background via-card to-muted text-foreground">
        <ChatUserRegisterPanel
          onSuccess={(rol: Role) => {
            if (redirectTo) {
              navigate(redirectTo);
              return;
            }
            if (rol === "admin" || rol === "empleado") {
              navigate("/perfil");
            } else {
              navigate(defaultDashboard);
            }
          }}
          onShowLogin={() => navigate(loginPath)}
          entityToken={widgetToken ?? undefined}
        />
      </div>
    </ErrorBoundary>
  );
};

export default UserRegister;
