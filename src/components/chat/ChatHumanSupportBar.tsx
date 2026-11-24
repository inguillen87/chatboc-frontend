import React from "react";
import { MessageSquare, UserRound } from "lucide-react";

import { cn } from "@/lib/utils";

interface ChatHumanSupportBarProps {
  liveChatLabel?: string | null;
  liveChatStatus?: string | null;
  liveChatAvailable?: boolean;
  onLiveChat?: () => void;
  whatsappLabel?: string | null;
  onWhatsApp?: () => void;
  className?: string;
}

const cleanLabel = (value: string | null | undefined, fallback: string) => {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || fallback;
};

const ChatHumanSupportBar: React.FC<ChatHumanSupportBarProps> = ({
  liveChatLabel,
  liveChatStatus,
  liveChatAvailable = false,
  onLiveChat,
  whatsappLabel,
  onWhatsApp,
  className,
}) => {
  if (!onLiveChat && !onWhatsApp) return null;

  const statusText = onLiveChat
    ? cleanLabel(
        liveChatStatus,
        liveChatAvailable ? "Equipo disponible ahora" : "Podés dejar un mensaje",
      )
    : "Continuidad por WhatsApp";
  const primaryLabel = cleanLabel(liveChatLabel, liveChatAvailable ? "Hablar con el equipo" : "Dejar mensaje");

  const whatsappText = cleanLabel(whatsappLabel, "WhatsApp");

  return (
    <section
      aria-label="Opciones de atención humana"
      className={cn(
        "shrink-0 border-b border-border/60 bg-background/[.94] px-2.5 py-1 shadow-[0_1px_0_hsl(var(--border)/0.35)] sm:px-4 sm:py-1.5",
        className,
      )}
    >
      <div className="mx-auto flex w-full max-w-4xl flex-nowrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span
            className={cn(
              "h-2 w-2 shrink-0 rounded-full sm:hidden",
              liveChatAvailable ? "bg-emerald-500" : "bg-muted-foreground/50",
            )}
            aria-hidden="true"
          />
          <span
            className={cn(
              "hidden h-7 w-7 shrink-0 items-center justify-center rounded-full border sm:flex",
              liveChatAvailable
                ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/70 dark:bg-emerald-950/50 dark:text-emerald-300"
                : "border-border/70 bg-muted/60 text-muted-foreground",
            )}
            aria-hidden="true"
          >
            <UserRound className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold leading-tight text-foreground">Ayuda de una persona</p>
            <p className="truncate text-[11px] leading-tight text-muted-foreground">{statusText}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-nowrap items-center gap-1.5">
          {onLiveChat ? (
            <button
              type="button"
              onClick={onLiveChat}
              aria-label={primaryLabel}
              className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-primary/25 bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              <UserRound className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="max-w-[9.5rem] truncate whitespace-nowrap leading-none sm:max-w-none">
                {primaryLabel}
              </span>
            </button>
          ) : null}
          {onWhatsApp ? (
            <button
              type="button"
              onClick={onWhatsApp}
              aria-label={whatsappText}
              className={cn(
                "inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-semibold shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                onLiveChat
                  ? "border-border/70 bg-card px-2.5 text-foreground hover:border-primary/40 hover:bg-muted/50 sm:px-3"
                  : "border-primary/25 bg-primary px-3 text-primary-foreground hover:bg-primary/90",
              )}
            >
              <MessageSquare className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span
                className={cn(
                  "leading-none",
                  onLiveChat ? "sr-only sm:not-sr-only sm:whitespace-nowrap" : "max-w-[9.5rem] truncate whitespace-nowrap sm:max-w-none",
                )}
              >
                {whatsappText}
              </span>
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
};

export default ChatHumanSupportBar;
