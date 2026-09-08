import React from "react";
import { MessageCircleMore, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ChatbocLogoAnimated from "./ChatbocLogoAnimated";
import AccessibilityToggle, { Prefs } from "./AccessibilityToggle";
import type { ChatWidgetUiHints } from "@/types/chat";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

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
  compactActions?: boolean;
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
  accessibilityHints?: ChatWidgetUiHints["accessibility"];
  supportChannels?: {
    live_chat?: {
      realtime?: boolean;
      available?: boolean;
      label?: string;
      socket_enabled?: boolean | string | number | null;
    };
    whatsapp?: { enabled?: boolean; realtime_bridge?: boolean; label?: string };
  } | null;
}

const isEnabledFlag = (value: unknown, fallback = true) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "si", "on", "enabled"].includes(normalized)) return true;
    if (["false", "0", "no", "off", "disabled"].includes(normalized)) return false;
  }
  return fallback;
};

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
  accessibilityHints,
  supportChannels,
  recommendationLabel,
  compactActions = false,
}) => {
  const isMobile = useIsMobile();
  const isUltraCompact = compactActions && isMobile;
  const liveChatSocketEnabled = isEnabledFlag(
    supportChannels?.live_chat?.socket_enabled,
    false,
  );
  const liveChatVisible = Boolean(
    liveChatSocketEnabled &&
      (supportChannels?.live_chat?.realtime || supportChannels?.live_chat?.available),
  );
  const whatsappVisible = Boolean(supportChannels?.whatsapp?.enabled && supportChannels?.whatsapp?.realtime_bridge);
  const liveChatLabel = typeof supportChannels?.live_chat?.label === 'string' ? supportChannels.live_chat.label.trim() : '';
  const whatsappLabel = typeof supportChannels?.whatsapp?.label === 'string' ? supportChannels.whatsapp.label.trim() : '';
  const rawStatusLabel = liveChatVisible
    ? liveChatLabel
    : whatsappVisible
      ? whatsappLabel
      : recommendationLabel;
  const statusLabel = (() => {
    const normalized = typeof rawStatusLabel === "string" ? rawStatusLabel.trim() : "";
    if (!normalized) return null;
    const blocked = new Set(["widget", "voice", "chat", "canal"]);
    return blocked.has(normalized.toLowerCase()) ? null : normalized;
  })();
  const hasSecondaryActions = Boolean((onProfile && showProfile) || onCart || onToggleSound);
  const actionButtonClass = cn(
    "flex items-center justify-center rounded-lg border border-white/20 bg-white/10 text-white/90 transition-colors hover:bg-white/18 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary",
    isUltraCompact ? "h-8 w-8 p-1.5" : "h-9 w-9 p-2",
  );

  return (
    <div
      aria-busy={isTyping}
      className={`
        relative flex items-center justify-between gap-2 flex-shrink-0 w-full overflow-hidden rounded-t-[inherit]
        border-b border-white/10 px-2.5 py-2.5 sm:px-4 sm:py-4
        text-white transition-all
      `}
      style={{
        background: 'linear-gradient(115deg, #071a51 0%, color-mix(in srgb, hsl(var(--primary)) 78%, #0d35c3) 100%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12)',
        paddingTop: isUltraCompact ? "max(0.625rem, env(safe-area-inset-top))" : undefined,
      }}
    >
      <div className="relative flex min-w-0 flex-1 items-center gap-2.5">
        <div className={cn(
          "relative flex shrink-0 items-center justify-center border border-white/25 bg-white/10 shadow-sm",
          isUltraCompact ? "h-9 w-9 rounded-lg" : "h-11 w-11 rounded-xl",
        )}>
          <div className="relative flex items-center justify-center">
            <ChatbocLogoAnimated
              src={logoUrl}
              size={isUltraCompact ? 26 : 32}
              smiling={isTyping}
              movingEyes={isTyping}
              blinking
              pulsing={false}
              animation={logoAnimation}
            />
          </div>
        </div>
        <div className="min-w-0 overflow-hidden">
          <div className="flex items-center gap-2">
            <span className="break-words text-sm font-bold leading-snug tracking-[0.01em] sm:text-base" title={title || 'Chatboc'}>
              {title || 'Chatboc'}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-white/82 sm:text-xs">
            <MessageCircleMore className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate font-medium">{subtitle || 'Asistente digital'}</span>
          </div>
          {statusLabel && !isUltraCompact ? (
            <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-white/80">
              <span className={cn("h-1.5 w-1.5 rounded-full", liveChatVisible ? "bg-emerald-300" : "bg-sky-200")} />
              <span className="truncate">{statusLabel}</span>
            </div>
          ) : null}
          {isTyping && !isUltraCompact ? (
            <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-emerald-300/25 bg-emerald-400/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-50">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75 motion-safe:animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-200" />
              </span>
              Preparando respuesta
            </div>
          ) : null}
        </div>
      </div>
      <div className="relative flex shrink-0 items-center gap-1">
        <AccessibilityToggle
          onChange={onA11yChange}
          compact={compactActions}
          hints={accessibilityHints}
          className={isUltraCompact ? "h-8 w-8" : undefined}
        />
        {onBack ? (
          <button
            onClick={onBack}
            className={actionButtonClass}
            aria-label="Volver"
            title="Volver"
          >
            <IconButton.Back className="h-5 w-5" />
          </button>
        ) : null}
        {hasSecondaryActions ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={actionButtonClass}
                aria-label="Opciones del chat"
                title="Perfil, carrito y sonido"
              >
                <MoreHorizontal className="h-5 w-5" />
              </button>
            </DropdownMenuTrigger>
            {/* The menu portal must sit above the floating widget (z-index 999999). */}
            <DropdownMenuContent align="end" className="z-[1000004] min-w-52 max-w-[calc(100vw-24px)]">
              {onProfile && showProfile ? (
                <DropdownMenuItem onSelect={onProfile} className="min-h-11 gap-2">
                  <IconButton.User className="h-4 w-4" /> Mi perfil
                </DropdownMenuItem>
              ) : null}
              {onCart ? (
                <DropdownMenuItem onSelect={() => onCart()} className="min-h-11 gap-2">
                  <IconButton.Cart className="h-4 w-4" /> Ver carrito
                  {typeof cartCount === 'number' && cartCount > 0 ? (
                    <span className="ml-auto rounded-full bg-primary/10 px-2 text-xs font-semibold text-primary" aria-label={`${cartCount} productos`}>
                      {cartCount > 99 ? '99+' : cartCount}
                    </span>
                  ) : null}
                </DropdownMenuItem>
              ) : null}
              {onToggleSound ? (
                <DropdownMenuItem onSelect={onToggleSound} className="min-h-11 gap-2">
                  {muted ? <IconButton.VolumeOff className="h-4 w-4" /> : <IconButton.VolumeOn className="h-4 w-4" />}
                  {muted ? 'Activar sonido' : 'Silenciar sonido'}
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
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
