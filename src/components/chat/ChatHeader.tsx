import React from "react";
import { X } from "lucide-react";
import ChatbocLogoAnimated from "./ChatbocLogoAnimated";

interface Props {
  onClose: () => void;
}

const ChatHeader: React.FC<Props> = ({ onClose }) => {
  return (
    // MODIFICADO: Usar bg-primary para el fondo y text-primary-foreground para el texto principal
    <div className="flex items-center justify-between p-3 border-b border-border bg-primary text-primary-foreground">
      <div className="flex items-center gap-3">
        <ChatbocLogoAnimated size={28} smiling={false} movingEyes={false} />
          <span className="ml-2 font-bold">Chatboc</span>

        <div className="flex flex-col leading-tight">
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* MODIFICADO: Usar text-green-500 para el online, que funciona en ambos modos */}
        <span
          className="text-green-500 text-xs font-semibold"
          aria-label="Estado del bot: Online"
        >
          ● Online
        </span>
        {/* MODIFICADO: Usar text-muted-foreground y hover:text-foreground */}
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition"
          aria-label="Cerrar chat"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
};

export default ChatHeader;