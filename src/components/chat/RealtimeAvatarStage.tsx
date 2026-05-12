import { Bot, Captions, Mic, MicOff, Radio, Video } from "lucide-react";

import { cn } from "@/lib/utils";

export type RealtimeChannelMode = "voice" | "video";
export type RealtimeSessionState =
  | "idle"
  | "connecting"
  | "live"
  | "reconnecting"
  | "ended";

export interface RealtimeTranscriptItem {
  id: string;
  text: string;
  role: "assistant" | "user";
}

interface RealtimeAvatarStageProps {
  mode: RealtimeChannelMode;
  sessionState: RealtimeSessionState;
  title: string;
  avatarType?: string | null;
  avatarPersona?: string | null;
  logoUrl?: string | null;
  captionsEnabled?: boolean;
  transcript?: RealtimeTranscriptItem[];
  isUserSpeaking?: boolean;
  assistantSpeaking?: boolean;
  isMicMuted?: boolean;
  networkLatency?: "good" | "unstable";
}

const readAvatarText = (value?: string | null, fallback = "") => {
  if (typeof value === "string" && value.trim()) return value.trim();
  return fallback;
};

export default function RealtimeAvatarStage({
  mode,
  sessionState,
  title,
  avatarType,
  avatarPersona,
  logoUrl,
  captionsEnabled,
  transcript = [],
  isUserSpeaking,
  assistantSpeaking,
  isMicMuted,
  networkLatency = "good",
}: RealtimeAvatarStageProps) {
  const avatarLabel = readAvatarText(avatarPersona, readAvatarText(avatarType, "robot"));
  const latestTranscript = transcript.slice(-2);
  const isLive = sessionState === "live";

  return (
    <div className="overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/10 via-background to-background shadow-sm">
      <div className="flex items-center justify-between border-b border-border/60 bg-background/70 px-3 py-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
          {mode === "video" ? (
            <Video className="h-3.5 w-3.5 text-primary" />
          ) : (
            <Radio className="h-3.5 w-3.5 text-primary" />
          )}
          {title}
        </span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
            isLive
              ? "bg-emerald-100 text-emerald-700"
              : sessionState === "connecting" || sessionState === "reconnecting"
                ? "bg-amber-100 text-amber-700"
                : "bg-muted text-muted-foreground",
          )}
        >
          {sessionState}
        </span>
      </div>

      <div className="relative flex min-h-[170px] flex-col items-center justify-center px-4 py-5 text-center">
        <div
          className={cn(
            "absolute inset-x-8 top-8 h-24 rounded-full blur-2xl transition-opacity",
            assistantSpeaking || isUserSpeaking ? "bg-primary/20 opacity-100" : "bg-primary/10 opacity-60",
          )}
        />
        <div
          className={cn(
            "relative flex h-24 w-24 items-center justify-center rounded-[2rem] border bg-background shadow-lg transition",
            isUserSpeaking
              ? "border-primary ring-4 ring-primary/15"
              : assistantSpeaking
                ? "border-primary/50 ring-4 ring-primary/10"
                : "border-border",
          )}
        >
          {logoUrl ? (
            <img
              src={logoUrl}
              alt=""
              className="h-14 w-14 rounded-2xl object-cover"
              draggable={false}
            />
          ) : (
            <Bot className="h-12 w-12 text-primary" />
          )}
          {isLive ? (
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border border-background bg-emerald-500">
              <span className="h-2 w-2 animate-ping rounded-full bg-white" />
            </span>
          ) : null}
        </div>

        <div className="relative mt-3 max-w-[260px]">
          <p className="text-sm font-semibold text-foreground">{avatarLabel}</p>
          <div className="mt-1 flex flex-wrap justify-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="rounded-full border border-border/70 bg-background/80 px-2 py-0.5">
              {mode}
            </span>
            <span className="rounded-full border border-border/70 bg-background/80 px-2 py-0.5">
              {networkLatency}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/80 px-2 py-0.5">
              {isMicMuted ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
              {isMicMuted ? "muted" : isUserSpeaking ? "listening" : "ready"}
            </span>
          </div>
        </div>

        <div className="relative mt-4 flex h-6 items-end gap-1" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((bar) => (
            <span
              key={bar}
              className={cn(
                "w-1.5 rounded-full bg-primary/70 transition-all",
                assistantSpeaking || isUserSpeaking ? "animate-pulse" : "",
              )}
              style={{
                height:
                  assistantSpeaking || isUserSpeaking
                    ? `${10 + ((bar % 3) + 1) * 5}px`
                    : "6px",
                animationDelay: `${bar * 90}ms`,
              }}
            />
          ))}
        </div>
      </div>

      {captionsEnabled ? (
        <div className="border-t border-border/60 bg-black px-3 py-2 text-xs font-medium text-white">
          <div className="mb-1 flex items-center gap-1 text-[10px] uppercase text-white/60">
            <Captions className="h-3 w-3" />
            captions
          </div>
          {latestTranscript.length > 0 ? (
            <div className="space-y-1">
              {latestTranscript.map((item) => (
                <p key={item.id} className="line-clamp-2">
                  <span className="mr-1 text-white/60">{item.role}</span>
                  {item.text}
                </p>
              ))}
            </div>
          ) : (
            <p className="text-white/70">...</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
