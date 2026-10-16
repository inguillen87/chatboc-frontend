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

  return (
    <section
      aria-label="Opciones de atención humana"
      className={cn(
        "shrink-0 border-b border-border/60 bg-background/[.94] px-2.5 py-2 shadow-[0_1px_0_hsl(var(--border)/0.35)] sm:px-4",
        className,
      )}
    >
      <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-1 basis-36 items-center gap-2">
          <span
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border",
              liveChatAvailable
                ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/70 dark:bg-emerald-950/50 dark:text-emerald-300"
                : "border-border/70 bg-muted/60 text-muted-foreground",
            )}
            aria-hidden="true"
          >
            <UserRound className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="break-words text-xs font-semibold leading-snug text-foreground">Ayuda de una persona</p>
            <p className="break-words text-[11px] leading-snug text-muted-foreground">{statusText}</p>
          </div>
        </div>
        <div className="flex min-w-0 flex-1 basis-32 flex-wrap items-stretch gap-2">
          {onLiveChat ? (
            <button
              type="button"
              onClick={onLiveChat}
              aria-label={primaryLabel}
              className="inline-flex min-h-11 min-w-11 flex-1 basis-28 items-center justify-center gap-1.5 rounded-lg border border-primary/25 bg-primary px-2.5 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              <UserRound className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="min-w-0 break-words leading-snug">
                {primaryLabel}
              </span>
            </button>
          ) : null}
          {onWhatsApp ? (
            <button
              type="button"
              onClick={onWhatsApp}
              aria-label={cleanLabel(whatsappLabel, "WhatsApp")}
              className={cn(
                "inline-flex min-h-11 min-w-11 flex-1 basis-28 items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-semibold shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                onLiveChat
                  ? "border-border/70 bg-card text-foreground hover:border-primary/40 hover:bg-muted/50"
                  : "border-primary/25 bg-primary text-primary-foreground hover:bg-primary/90",
              )}
            >
              <MessageSquare className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="min-w-0 break-words leading-snug">
                {cleanLabel(whatsappLabel, "WhatsApp")}
              </span>
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
};

export default ChatHumanSupportBar;
