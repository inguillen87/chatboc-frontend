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
            pulsing
          />
        </div>
        <div className="ml-1 flex flex-col leading-tight">
          <span className="font-extrabold text-base tracking-wide" style={{ letterSpacing: ".02em" }}> {/* text-base es ~17px en móvil */}
            Chatboc
          </span>
          <span className="text-sm text-muted-foreground" style={{ fontWeight: 500 }}> {/* Aumentado a text-sm (~15px en móvil) */}
            Asistente Virtual
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1"> {/* Reducido gap para más espacio para iconos */}
        <span
          className="text-primary text-sm font-semibold flex items-center mr-1" // Aumentado a text-sm, añadido mr-1
          aria-label="Estado del bot: Online"
        >
          <span className="w-2.5 h-2.5 bg-primary rounded-full mr-1.5"></span> {/* Punto más grande */}
          Online
        </span>
        {onBack ? (
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="Volver">
            <ChevronLeft className="h-5 w-5" /> {/* Iconos h-5 w-5 o h-6 w-6 */}
          </Button>
        ) : onProfile && showProfile ? (
          <Button variant="ghost" size="icon" onClick={onProfile} aria-label="Mi perfil">
            <User className="h-5 w-5" />
          </Button>
        ) : null}
        {onCart && (
          <Button variant="ghost" size="icon" onClick={onCart} aria-label="Ver carrito">
            <ShoppingCart className="h-5 w-5" />
          </Button>
        )}
        {onToggleSound && (
          <Button variant="ghost" size="icon" onClick={onToggleSound} aria-label={muted ? 'Activar sonido' : 'Silenciar sonido'}>
            {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </Button>
        )}
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar chat">
          <X className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
};

export default ChatHeader;
