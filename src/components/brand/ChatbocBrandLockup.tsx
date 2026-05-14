import React from "react";

import {
  CHATBOC_AGENT_AVATAR,
  CHATBOC_AGENT_MARK,
} from "@/utils/brandAssets";
import { cn } from "@/lib/utils";

type ChatbocBrandLockupSize = "nav" | "hero" | "compact";
type ChatbocBrandLockupTone = "light" | "dark" | "auto";

interface ChatbocBrandLockupProps {
  size?: ChatbocBrandLockupSize;
  tone?: ChatbocBrandLockupTone;
  showAgent?: boolean;
  markSrc?: string;
  agentSrc?: string;
  className?: string;
  textClassName?: string;
}

const sizeClassName: Record<ChatbocBrandLockupSize, string> = {
  nav: "chatboc-brand-lockup--nav",
  hero: "chatboc-brand-lockup--hero",
  compact: "chatboc-brand-lockup--compact",
};

const toneClassName: Record<ChatbocBrandLockupTone, string> = {
  light: "chatboc-brand-lockup--light",
  dark: "chatboc-brand-lockup--dark",
  auto: "chatboc-brand-lockup--auto",
};

export function ChatbocBrandLockup({
  size = "nav",
  tone = "auto",
  showAgent = false,
  markSrc = CHATBOC_AGENT_MARK,
  agentSrc = CHATBOC_AGENT_AVATAR,
  className,
  textClassName,
}: ChatbocBrandLockupProps) {
  return (
    <span
      className={cn(
        "chatboc-brand-lockup",
        sizeClassName[size],
        toneClassName[tone],
        showAgent && "chatboc-brand-lockup--with-agent",
        className,
      )}
      aria-label="Chatboc.ar"
    >
      <span className="chatboc-brand-lockup__mark-shell" aria-hidden="true">
        <img
          src={markSrc}
          alt=""
          className="chatboc-brand-lockup__mark"
          loading="eager"
          decoding="async"
          draggable={false}
        />
      </span>
      <span className={cn("chatboc-brand-lockup__name", textClassName)} aria-hidden="true">
        <span>Chatboc</span>
        <span className="chatboc-brand-lockup__tld">.ar</span>
      </span>
      {showAgent ? (
        <span className="chatboc-brand-lockup__agent-shell" aria-hidden="true">
          <img
            src={agentSrc}
            alt=""
            className="chatboc-brand-lockup__agent"
            loading="eager"
            decoding="async"
            draggable={false}
          />
        </span>
      ) : null}
    </span>
  );
}

export default ChatbocBrandLockup;
