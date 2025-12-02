import React from "react";
import { useNavigate } from "react-router-dom";
import ChatUserLoginPanel from "@/components/chat/ChatUserLoginPanel";
import type { Role } from "@/utils/roles";

const UserLogin = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-4 bg-gradient-to-br from-background via-card to-muted text-foreground">
      <ChatUserLoginPanel
        onSuccess={(rol: Role) =>
          rol === "admin" || rol === "empleado"
            ? navigate("/perfil")
            : navigate("/cuenta")
        }
        onShowRegister={() => navigate("/user/register")}
      />
    </div>
  );
};

export default UserLogin;
