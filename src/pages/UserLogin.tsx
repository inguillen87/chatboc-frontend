import React, { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ChatUserLoginPanel from "@/components/chat/ChatUserLoginPanel";
import { useTenant } from "@/context/TenantContext";
import { buildTenantPath } from "@/utils/tenantPaths";
import type { Role } from "@/utils/roles";
import { safeLocalStorage } from "@/utils/safeLocalStorage";

const UserLogin = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { widgetToken, currentSlug } = useTenant();

  const effectiveTenantSlug = useMemo(
    () => currentSlug ?? safeLocalStorage.getItem('tenantSlug') ?? null,
    [currentSlug]
  );

  const redirectTo = (location.state as { redirectTo?: string } | null)?.redirectTo;

  const defaultDashboard = buildTenantPath("/portal/dashboard", effectiveTenantSlug);
  const registerPath = buildTenantPath("/register", effectiveTenantSlug);

  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-4 bg-gradient-to-br from-background via-card to-muted text-foreground">
      <ChatUserLoginPanel
        onSuccess={(rol: Role) => {
          if (redirectTo) {
             navigate(redirectTo);
             return;
          }
          if (rol === "admin" || rol === "empleado") {
            // Admins go to internal panel
            // TODO: Ensure this uses tenant prefix too if needed, e.g. /:tenant/perfil?
            // Currently /perfil is global for logged in user usually?
            navigate("/perfil");
          } else {
            // End users go to Portal Dashboard
            navigate(defaultDashboard);
          }
        }}
        onShowRegister={() => navigate(registerPath)}
        entityToken={widgetToken ?? undefined}
      />
    </div>
  );
};

export default UserLogin;
