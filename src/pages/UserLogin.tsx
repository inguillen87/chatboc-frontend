import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ChatUserLoginPanel from "@/components/chat/ChatUserLoginPanel";
import { useTenant } from "@/context/TenantContext";
import type { Role } from "@/utils/roles";

const UserLogin = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { widgetToken } = useTenant();
  const redirectTo = (location.state as { redirectTo?: string } | null)?.redirectTo;
  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-4 bg-gradient-to-br from-background via-card to-muted text-foreground">
      <ChatUserLoginPanel
        onSuccess={(rol: Role) =>
          redirectTo
            ? navigate(redirectTo)
            : rol === "admin" || rol === "empleado"
            ? navigate("/perfil")
            : navigate("/cuenta")
        }
        onShowRegister={() => navigate("/user/register")}
        entityToken={widgetToken ?? undefined}
      />
    </div>
  );
};

export default UserLogin;
