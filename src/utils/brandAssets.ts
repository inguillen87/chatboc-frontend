export const CHATBOC_AGENT_AVATAR =
  "/branding/chatboc-2026/chatboc-agent-avatar.svg?v=20260517-motion3";
export const CHATBOC_AGENT_MARK =
  "/branding/chatboc-2026/chatboc-agent-mark.svg";
export const CHATBOC_AGENT_LAUNCHER_ANIMATED =
  "/branding/chatboc-2026/chatboc-agent-launcher.svg?v=20260517-motion3";
export const CHATBOC_AGENT_LAUNCHER_STATIC =
  "/branding/chatboc-2026/chatboc-agent-launcher-static.svg";

// Legacy names kept as compatibility aliases for existing components.
export const CHATBOC_ORBIT_AVATAR = CHATBOC_AGENT_AVATAR;
export const CHATBOC_ORBIT_REFERENCE = CHATBOC_AGENT_AVATAR;
export const CHATBOC_NAVBAR_MARK_CIRCLE = CHATBOC_AGENT_MARK;
export const CHATBOC_NAVBAR_MARK_CLEAN = CHATBOC_AGENT_MARK;
export const CHATBOC_WIDGET_LAUNCHER_ANIMATED = CHATBOC_AGENT_LAUNCHER_ANIMATED;
export const CHATBOC_WIDGET_LAUNCHER_STATIC = CHATBOC_AGENT_LAUNCHER_STATIC;
export const CHATBOC_WIDGET_LAUNCHER_FALLBACK = CHATBOC_AGENT_MARK;

export const getChatbocBrandLogo = (_isDarkMode: boolean) => {
  return CHATBOC_AGENT_MARK;
};

export const getChatbocBotAvatar = (_isDarkMode: boolean) => {
  return CHATBOC_AGENT_AVATAR;
};
