import React from "react";
import { X } from "lucide-react";
import ChatbocLogoAnimated from "./ChatbocLogoAnimated";

interface Props {
  onClose: () => void;
  isTyping?: boolean; // opcional, para animar la sonrisa
}

const ChatHeader: React.FC<Props> = ({ onClose, isTyping = false }) => {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-primary text-primary-foreground">
      {/* LOGO + NOMBRE */}
      <div className="flex items-center gap-3">
        {/* Logo bien visible y con animación */}
        <div className="flex items-center justify-center w-11 h-11 rounded-lg bg-white/95 shadow-lg border border-blue-100 dark:bg-[#111a28] dark:border-blue-800">
          <ChatbocLogoAnimated
            size={32}
            smiling={isTyping}
            movingEyes={isTyping}
            
          />
        </div>
        {/* Nombre y subtítulo */}
        <div className="ml-2 flex flex-col leading-tight">
          <span className="font-extrabold text-base tracking-wide" style={{letterSpacing: ".02em"}}>
            Chatboc
          </span>
          <span className="text-xs text-muted-foreground" style={{fontWeight: 500}}>
            Asistente Virtual
          </span>
        </div>
      </div>

      {/* ONLINE + CERRAR */}
      <div className="flex items-center gap-2">
        <span
          className="text-green-500 text-xs font-semibold"
          aria-label="Estado del bot: Online"
        >
          ● Online
        </span>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition"
          aria-label="Cerrar chat"
        >
          <X size={20} />
        </button>
      </div>
    </div>
  );
};

export default ChatHeader;
