import React from "react";
import { X, User, ChevronLeft, Volume2, VolumeX, ShoppingCart } from "lucide-react";
import ChatbocLogoAnimated from "./ChatbocLogoAnimated";

interface Props {
  onClose: () => void;
  isTyping?: boolean;
  onProfile?: () => void;
  onBack?: () => void;
  showProfile?: boolean;
  muted?: boolean;
  onToggleSound?: () => void;
  onCart?: () => void;
}

const ChatHeader: React.FC<Props> = ({
  onClose,
  isTyping = false,
  onProfile,
  onBack,
  showProfile = true,
  muted = false,
  onToggleSound,
  onCart,
}) => {
  return (
    <div
      className={`
        flex items-center justify-between
        px-2 sm:px-4 py-3 border-b border-border
        bg-card/90 backdrop-blur-md
        text-card-foreground
        transition-all
      `}
      style={{
        // El header hereda el fondo sutilmente y no es “un recorte”.
        borderRadius: "24px 24px 0 0", // This might need to be dynamic if widget is full screen on mobile (no border radius)
      }}
    >
      {/* Logo y nombre sin cuadrado */}
      <div className="flex items-center gap-2 sm:gap-3"> {/* Reduced gap for mobile */}
        <div className="flex items-center justify-center w-10 h-10">
          {/* Sin fondo ni border ni shadow: que use tu PNG o SVG de logo */}
          <ChatbocLogoAnimated
            size={32}
            smiling={isTyping}
            movingEyes={isTyping}
            blinking
            pulsing
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
      <div className="flex items-center gap-1 sm:gap-2"> {/* Reduced gap for mobile */}
        <span
          className="text-primary text-xs font-semibold flex items-center"
          aria-label="Estado del bot: Online"
        >
          <span className="w-2 h-2 bg-primary rounded-full mr-1 sm:mr-1.5"></span> {/* Reduced margin for mobile */}
          <span className="hidden sm:inline">Online</span> {/* Hide "Online" text on very small screens */}
        </span>
        {onBack ? (
          <button
            onClick={onBack}
            className="text-muted-foreground hover:text-foreground transition"
            aria-label="Volver"
          >
            <ChevronLeft size={20} />
          </button>
        ) : onProfile && showProfile ? (
          <button
            onClick={onProfile}
            className="text-muted-foreground hover:text-foreground transition"
            aria-label="Mi perfil"
          >
            <User size={20} />
          </button>
        ) : null}
        {onCart && (
          <button
            onClick={onCart}
            className="text-muted-foreground hover:text-foreground transition"
            aria-label="Ver carrito"
          >
            <ShoppingCart size={20} />
          </button>
        )}
        {onToggleSound && (
          <button
            onClick={onToggleSound}
            className="text-muted-foreground hover:text-foreground transition"
            aria-label={muted ? 'Activar sonido' : 'Silenciar sonido'}
          >
            {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
        )}
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
