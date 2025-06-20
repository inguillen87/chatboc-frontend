import React from "react";
import { X } from "lucide-react";
import ChatbocLogoAnimated from "./ChatbocLogoAnimated";

interface Props {
  onClose: () => void;
  isTyping?: boolean;
}

const ChatHeader: React.FC<Props> = ({ onClose, isTyping = false }) => {
  return (
    <div
      className={`
        flex items-center justify-between
        px-4 py-3 border-b border-border
        bg-card/90 backdrop-blur-md
        text-card-foreground
        transition-all
      `}
      style={{
        // El header hereda el fondo sutilmente y no es “un recorte”.
        borderRadius: "24px 24px 0 0",
      }}
    >
      {/* Logo y nombre sin cuadrado */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10">
          {/* Sin fondo ni border ni shadow: que use tu PNG o SVG de logo */}
          <ChatbocLogoAnimated
            size={32}
            smiling={isTyping}
            movingEyes={isTyping}
            blinking
          />
        </div>
        <div className="ml-1 flex flex-col leading-tight">
          <span className="font-extrabold text-base tracking-wide" style={{ letterSpacing: ".02em" }}>
            Chatboc
          </span>
          <span className="text-xs text-muted-foreground" style={{ fontWeight: 500 }}>
            Asistente Virtual
          </span>
        </div>
      </div>
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
