import React from "react";
import { X, User, ChevronLeft, Volume2, VolumeX, ShoppingCart } from "lucide-react";
import ChatbocLogoAnimated from "./ChatbocLogoAnimated";
import AccessibilityToggle, { Prefs } from "./AccessibilityToggle";

interface Props {
  onClose: () => void;
  isTyping?: boolean;
  onProfile?: () => void;
  onBack?: () => void;
  showProfile?: boolean;
  muted?: boolean;
  onToggleSound?: () => void;
  onCart?: (target?: "cart" | "catalog" | "market") => void;
  cartCount?: number;
  logoUrl?: string;
  title?: string;
  subtitle?: string;
  logoAnimation?: string;
  onA11yChange?: (p: Prefs) => void;
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
  cartCount,
  logoUrl,
  title,
  subtitle,
  logoAnimation,
  onA11yChange,
}) => {
  return (
    <div
      className={`
        flex items-center justify-between flex-shrink-0 w-full
        px-2 sm:px-4 py-3 border-b border-border
        bg-primary backdrop-blur-md
        text-primary-foreground
        transition-all rounded-t-[inherit] overflow-hidden
      `}
    >
      {/* Logo y nombre sin cuadrado */}
      <div className="flex items-center gap-2 sm:gap-3"> {/* Reduced gap for mobile */}
        <div className="flex items-center justify-center w-10 h-10">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Logo"
              style={{ width: 32, height: 32, borderRadius: "50%", animation: logoAnimation || undefined }}
            />
          ) : (
            <ChatbocLogoAnimated
              size={32}
              smiling={isTyping}
              movingEyes={isTyping}
              blinking
              pulsing
            />
          )}
        </div>
        <div className="ml-1 flex flex-col leading-tight">
          <span className="font-extrabold text-base tracking-wide" style={{ letterSpacing: ".02em" }}>
            {title || 'Chatboc'}
          </span>
          <span className="text-xs text-primary-foreground/80" style={{ fontWeight: 500 }}>
            {subtitle || 'Asistente Virtual'}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1 sm:gap-2"> {/* Reduced gap for mobile */}
        <AccessibilityToggle onChange={onA11yChange} />
        {onBack ? (
          <button
            onClick={onBack}
            className="text-primary-foreground/80 hover:text-primary-foreground transition"
            aria-label="Volver"
          >
            <ChevronLeft size={20} />
          </button>
        ) : onProfile && showProfile ? (
          <button
            onClick={onProfile}
            className="text-primary-foreground/80 hover:text-primary-foreground transition"
            aria-label="Mi perfil"
          >
            <User size={20} />
          </button>
        ) : null}
        {onCart && (
          <button
            onClick={() => onCart()}
            className="relative text-primary-foreground/80 hover:text-primary-foreground transition"
            aria-label="Ver carrito"
          >
            <ShoppingCart size={20} />
            {cartCount && cartCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold leading-tight flex items-center justify-center shadow-sm">
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            )}
          </button>
        )}
        {onToggleSound && (
          <button
            onClick={onToggleSound}
            className="text-primary-foreground/80 hover:text-primary-foreground transition"
            aria-label={muted ? 'Activar sonido' : 'Silenciar sonido'}
          >
            {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
        )}
        <button
          onClick={onClose}
          className="text-primary-foreground/80 hover:text-primary-foreground transition"
          aria-label="Cerrar chat"
        >
          <X size={20} />
        </button>
      </div>
    </div>
  );
};

export default ChatHeader;
