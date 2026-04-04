import React from "react";
import { MessageCircleMore, Sparkles } from "lucide-react";
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
  recommendationLabel?: string | null;
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
  supportChannels?: {
    live_chat?: { realtime?: boolean; available?: boolean; label?: string };
    whatsapp?: { enabled?: boolean; realtime_bridge?: boolean; label?: string };
  } | null;
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
  supportChannels,
  recommendationLabel,
}) => {
  const liveChatVisible = Boolean(supportChannels?.live_chat?.realtime || supportChannels?.live_chat?.available);
  const whatsappVisible = Boolean(supportChannels?.whatsapp?.enabled && supportChannels?.whatsapp?.realtime_bridge);
  const liveChatLabel = typeof supportChannels?.live_chat?.label === 'string' ? supportChannels.live_chat.label.trim() : '';
  const whatsappLabel = typeof supportChannels?.whatsapp?.label === 'string' ? supportChannels.whatsapp.label.trim() : '';
  const actionButtonClass =
    "flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/10 p-2 text-primary-foreground/80 backdrop-blur transition motion-safe:hover:scale-[1.03] hover:bg-white/16 hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-1 focus-visible:ring-offset-primary";
  const rawStatusLabel = recommendationLabel || (liveChatVisible ? liveChatLabel : whatsappVisible ? whatsappLabel : null);
  const statusLabel = (() => {
    const normalized = typeof rawStatusLabel === "string" ? rawStatusLabel.trim() : "";
    if (!normalized) return null;
    const blocked = new Set(["widget", "whatsapp", "voice", "chat", "canal"]);
    return blocked.has(normalized.toLowerCase()) ? null : normalized;
  })();

  return (
    <div
      className={`
        relative flex items-center justify-between flex-shrink-0 w-full overflow-hidden rounded-t-[inherit]
        border-b border-white/10 px-3 py-3.5 sm:px-4 sm:py-4
        text-primary-foreground transition-all
      `}
      style={{
        background: 'linear-gradient(135deg, color-mix(in srgb, hsl(var(--primary)) 88%, #020617), color-mix(in srgb, hsl(var(--primary)) 64%, #38bdf8 36%))',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12)',
      }}
    >
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute inset-y-0 left-0 w-40 bg-white/10 blur-3xl" />
        <div className="absolute -right-10 top-0 h-24 w-24 rounded-full bg-cyan-300/20 blur-2xl" />
        <div className="absolute bottom-0 right-10 h-20 w-20 rounded-full bg-fuchsia-300/10 blur-2xl" />
      </div>
      <div className="relative flex min-w-0 items-center gap-3 sm:gap-4">
        <div className="relative flex h-11 w-11 items-center justify-center rounded-[18px] border border-white/20 bg-white/10 shadow-[0_10px_35px_rgba(0,0,0,0.22)] backdrop-blur-xl">
          <span className="absolute inset-[2px] rounded-[16px] bg-gradient-to-br from-white/18 to-white/5" />
          <div className="relative flex items-center justify-center">
            <ChatbocLogoAnimated
              src={logoUrl}
              size={32}
              smiling={isTyping}
              movingEyes={isTyping}
              blinking
              pulsing
              animation={logoAnimation}
            />
          </div>
        </div>
        <div className="min-w-0 overflow-hidden">
          <div className="flex items-center gap-2">
            <span className="truncate text-base font-black tracking-[0.02em] sm:text-[1.02rem]">
              {title || 'Chatboc'}
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/90 backdrop-blur">
              <Sparkles className="h-3 w-3" />
              Live
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-primary-foreground/82">
            <MessageCircleMore className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate font-medium">{subtitle || 'Asistente Virtual'}</span>
          </div>
          {statusLabel ? (
            <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-primary-foreground/80">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
              <span className="truncate">{statusLabel}</span>
            </div>
          ) : null}
          {isTyping ? (
            <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-emerald-300/25 bg-emerald-400/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-50">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-200" />
              </span>
              Respondiendo
            </div>
          ) : null}
        </div>
      </div>
      <div className="relative flex items-center gap-1.5 sm:gap-2">
        <AccessibilityToggle onChange={onA11yChange} />
        {onBack ? (
          <button
            onClick={onBack}
            className={actionButtonClass}
            aria-label="Volver"
            title="Volver"
          >
            <IconButton.Back className="h-5 w-5" />
          </button>
        ) : onProfile && showProfile ? (
          <button
            onClick={onProfile}
            className={actionButtonClass}
            aria-label="Mi perfil"
            title="Mi perfil"
          >
            <IconButton.User className="h-5 w-5" />
          </button>
        ) : null}
        {onCart && (
          <button
            onClick={() => onCart()}
            className={`relative ${actionButtonClass}`}
            aria-label="Ver carrito"
            title="Ver carrito"
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
            className={actionButtonClass}
            aria-label={muted ? 'Activar sonido' : 'Silenciar sonido'}
            aria-pressed={muted}
            title={muted ? 'Activar sonido' : 'Silenciar sonido'}
          >
            {muted ? <IconButton.VolumeOff className="h-5 w-5" /> : <IconButton.VolumeOn className="h-5 w-5" />}
          </button>
        )}
        <button
          onClick={onClose}
          className={actionButtonClass}
          aria-label="Cerrar chat"
          title="Cerrar chat"
        >
          <IconButton.Close className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};

export default ChatHeader;
