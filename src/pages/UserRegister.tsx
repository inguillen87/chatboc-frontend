import React from "react";
import { useNavigate } from "react-router-dom";
import ChatUserRegisterPanel from "@/components/chat/ChatUserRegisterPanel";
import type { Role } from "@/utils/roles";

const UserRegister = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-4 bg-gradient-to-br from-background via-card to-muted text-foreground">
      <ChatUserRegisterPanel
        onSuccess={(rol: Role) =>
          rol === "admin" || rol === "empleado"
            ? navigate("/perfil")
            : navigate("/cuenta")
        }
        onShowLogin={() => navigate("/user/login")}
      />
    </div>
  );
};

export default UserRegister;
