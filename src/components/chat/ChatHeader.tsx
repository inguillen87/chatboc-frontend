import React from "react";
import { X } from "lucide-react";

interface Props {
  onClose: () => void;
}

const ChatHeader: React.FC<Props> = ({ onClose }) => {
  return (
    // MODIFICADO: Usar bg-primary para el fondo y text-primary-foreground para el texto principal
    <div className="flex items-center justify-between p-3 border-b border-border bg-primary text-primary-foreground">
      <div className="flex items-center gap-3">
        <img
          src="/chatboc_logo_clean_transparent.png"
          alt="Chatboc Logo"
          className="w-9 h-9 rounded-full p-1"
          style={{
            backgroundColor: "transparent",
            filter: "drop-shadow(0 0 2px rgba(0,0,0,0.2))", // Se mantiene el filtro de sombra
          }}
        />

        <div className="flex flex-col leading-tight">
          {/* MODIFICADO: Usar text-primary-foreground */}
          <span className="text-sm font-semibold">
            Chatboc
          </span>
          {/* MODIFICADO: Usar text-muted-foreground */}
          <span className="text-xs text-muted-foreground">
            Asistente Virtual
          </span>
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