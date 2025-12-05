import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import ChatUserRegisterPanel from "@/components/chat/ChatUserRegisterPanel";
import { useTenant } from "@/context/TenantContext";
import { buildTenantPath } from "@/utils/tenantPaths";
import type { Role } from "@/utils/roles";
import { safeLocalStorage } from "@/utils/safeLocalStorage";

const UserRegister = () => {
  const navigate = useNavigate();
  const { widgetToken, currentSlug } = useTenant();

  const effectiveTenantSlug = useMemo(
    () => currentSlug ?? safeLocalStorage.getItem('tenantSlug') ?? null,
    [currentSlug]
  );

  const defaultDashboard = buildTenantPath("/portal/dashboard", effectiveTenantSlug);
  const loginPath = buildTenantPath("/login", effectiveTenantSlug);

  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-4 bg-gradient-to-br from-background via-card to-muted text-foreground">
      <ChatUserRegisterPanel
        onSuccess={(rol: Role) =>
          rol === "admin" || rol === "empleado"
            ? navigate("/perfil")
            : navigate(defaultDashboard)
        }
        onShowLogin={() => navigate(loginPath)}
        entityToken={widgetToken ?? undefined}
      />
    </div>
  );
};

export default UserRegister;
