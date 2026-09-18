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

  return (
    <section
      aria-label="Opciones de atención humana"
      className={cn(
        "border-b border-border/60 bg-background/94 px-2.5 py-2 shadow-[0_1px_0_hsl(var(--border)/0.35)] sm:px-4",
        className,
      )}
    >
      <div className="mx-auto flex w-full max-w-4xl items-center gap-2.5">
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
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-foreground">Ayuda de una persona</p>
          <p className="truncate text-[11px] text-muted-foreground">{statusText}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {onLiveChat ? (
            <button
              type="button"
              onClick={onLiveChat}
              aria-label={cleanLabel(liveChatLabel, "Hablar con el equipo")}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-primary/25 bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden min-[360px]:inline">
                {cleanLabel(liveChatLabel, "Hablar con el equipo")}
              </span>
              <span className="min-[360px]:hidden">Equipo</span>
            </button>
          ) : null}
          {onWhatsApp ? (
            <button
              type="button"
              onClick={onWhatsApp}
              aria-label={cleanLabel(whatsappLabel, "WhatsApp")}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border/70 bg-card px-2.5 py-1.5 text-xs font-semibold text-foreground shadow-sm transition-colors hover:border-primary/40 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="sr-only sm:not-sr-only">
                {cleanLabel(whatsappLabel, "WhatsApp")}
              </span>
              <span className="sm:hidden" aria-hidden="true">WhatsApp</span>
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
};

export default ChatHumanSupportBar;
