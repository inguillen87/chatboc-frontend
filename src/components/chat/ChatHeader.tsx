import React from "react";
import ChatbocLogoAnimated from "./ChatbocLogoAnimated";
import AccessibilityToggle, { Prefs } from "./AccessibilityToggle";

const IconButton = {
  Close: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  User: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  Back: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="15 18 9 12 15 6" />
    </svg>
  ),
  Cart: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  ),
  VolumeOn: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  ),
  VolumeOff: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M9 9v6" />
      <path d="m16 16-5-5" />
      <path d="m12 12-7-7" />
      <path d="m20 20-8-8" />
      <path d="m19 5-3.35 3.35" />
      <path d="m14 10-4-4L6 6 2 10v4h4l5 4V8" />
    </svg>
  ),
};

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
            <IconButton.Back className="h-5 w-5" />
          </button>
        ) : onProfile && showProfile ? (
          <button
            onClick={onProfile}
            className="text-primary-foreground/80 hover:text-primary-foreground transition"
            aria-label="Mi perfil"
          >
            <IconButton.User className="h-5 w-5" />
          </button>
        ) : null}
        {onCart && (
          <button
            onClick={() => onCart()}
            className="relative text-primary-foreground/80 hover:text-primary-foreground transition"
            aria-label="Ver carrito"
          >
            <IconButton.Cart className="h-5 w-5" />
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
            {muted ? <IconButton.VolumeOff className="h-5 w-5" /> : <IconButton.VolumeOn className="h-5 w-5" />}
          </button>
        )}
        <button
          onClick={onClose}
          className="text-primary-foreground/80 hover:text-primary-foreground transition"
          aria-label="Cerrar chat"
        >
          <IconButton.Close className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};

export default ChatHeader;
