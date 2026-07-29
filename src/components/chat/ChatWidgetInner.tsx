// src/components/chat/ChatWidgetInner.tsx

import { useWidgetSessionStore } from '@/stores';
import React, { Suspense, useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useDarkMode } from "@/hooks/useDarkMode";
import { getCurrentTipoChat } from "@/utils/tipoChat";
import { cn } from "@/lib/utils";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import { hasPersistedClerkSession } from "@/utils/sessionLogout";
import { extractRubroKey } from "@/utils/rubros";
import { trackWidgetEvent } from "@/utils/widgetTelemetry";
import { getOrCreateAnonId } from "@/utils/anonIdGenerator";
import { motion, AnimatePresence } from "framer-motion";
import type { AnimatePresenceProps } from "framer-motion";
import { useUser } from "@/hooks/useUser";
import { apiFetch, getErrorMessage } from "@/utils/api";
import ReadingRuler from "./ReadingRuler";
import { ACCESSIBILITY_EVENT, readAccessibilityPrefs, type Prefs } from "./AccessibilityToggle";
import { useCartCount } from "@/hooks/useCartCount";
import { buildTenantNavigationUrl, TENANT_ROUTE_PREFIXES } from "@/utils/tenantPaths"; // Fixed import
import { useTenant } from "@/context/TenantContext";
import { toast } from "sonner";
import { tenantService } from "@/services/tenantService";
import { ChatWidgetProps } from "./types";
import { hexToHsl, getContrastColorHsl } from "@/utils/color";
import { apiClient } from "@/api/client";
import { esRubroPublico } from "@/utils/chatEndpoints";
import {
  CHATBOC_AGENT_AVATAR,
  CHATBOC_AGENT_LAUNCHER_STATIC,
  CHATBOC_AGENT_MARK,
  getChatbocBotAvatar,
} from "@/utils/brandAssets";
import { createDemoSession } from "@/features/demo/demoApi";
import { clearDemoRuntimeStorage } from "@/features/demo/demoStorage";
import getOrCreateChatSessionId, { persistChatSessionId, resetChatSessionId } from "@/utils/chatSessionId";
import { isPublicPlatformSurfacePath } from "@/utils/widgetTenantResolution";
import {
  getWidgetCartSnapshot,
  getWidgetCommerceSession,
  getWidgetTenantHistory,
} from "@/api/widgetCommerce";
import type {
  WidgetCommerceCartSnapshot,
  WidgetCommerceHistory,
  WidgetCommerceSession,
} from "@/types/widgetCommerce";
import type { ChatWidgetUiHints } from "@/types/chat";
import { isBackofficeRole } from "@/utils/roles";
import {
  clearCachedWidgetToken,
  clearWidgetRuntimeCacheForTenantSwitch,
  normalizeWidgetTenantScopeSlug,
  resolveWidgetTokenForTenant,
} from "@/utils/widgetTokenScope";
import {
  mergeActionMenus,
  readWorkspaceActionMenu,
} from "@/utils/widgetActionMenu";

// Use constants from new file
import { TENANT_PLACEHOLDER_SLUGS } from "@/constants/tenant";

// Alias for backward compatibility if needed locally, though direct usage is preferred
const PLACEHOLDER_SLUGS_SET = TENANT_PLACEHOLDER_SLUGS;

const MOBILE_PORTAL_NAV_BREAKPOINT_PX = 768;
const MOBILE_PORTAL_NAV_HEIGHT = "4rem";

export const isUserPortalSurfacePath = (pathname: string) => {
  const segments = pathname
    .split('/')
    .filter(Boolean)
    .map((segment) => segment.toLowerCase());
  const portalIndex = segments.indexOf('portal');

  if (portalIndex === 0 || portalIndex === 1) return true;
  return (
    portalIndex === 2 &&
    TENANT_ROUTE_PREFIXES.some((prefix) => prefix === segments[0])
  );
};

export const resolveStandaloneLauncherBottom = ({
  pathname,
  viewportWidth,
  isMobileView,
  closedOffsetBottom,
}: {
  pathname: string;
  viewportWidth: number;
  isMobileView: boolean;
  closedOffsetBottom: number;
}) => {
  const hasMobilePortalNavigation =
    viewportWidth > 0 &&
    viewportWidth < MOBILE_PORTAL_NAV_BREAKPOINT_PX &&
    isUserPortalSurfacePath(pathname);

  if (hasMobilePortalNavigation) {
    return `calc(env(safe-area-inset-bottom) + ${MOBILE_PORTAL_NAV_HEIGHT} + ${closedOffsetBottom}px)`;
  }

  return isMobileView
    ? `calc(env(safe-area-inset-bottom) + ${closedOffsetBottom}px)`
    : `${closedOffsetBottom}px`;
};

const readFirstString = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
};

const readFirstNumber = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return 0;
};

const readOptionalBoolean = (value: unknown, fallback = false) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "si", "on", "enabled"].includes(normalized)) return true;
    if (["false", "0", "no", "off", "disabled"].includes(normalized)) return false;
  }
  return fallback;
};

const readCssPixelValue = (value: string) => {
  const trimmed = value.trim();
  if (/^\d+(?:\.\d+)?$/.test(trimmed)) return Number(trimmed);
  const match = trimmed.match(/^(\d+(?:\.\d+)?)px$/);
  return match ? Number(match[1]) : null;
};

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const normalizeRubroSelectorOptions = (selector: unknown) => {
  const record = isPlainRecord(selector) ? selector : {};
  const categories = Array.isArray(record.categories)
    ? record.categories
    : Array.isArray(record.items)
      ? record.items
      : [];

  return categories
    .map((item, index) => {
      if (typeof item === "string") {
        const label = item.trim();
        const rubro = extractRubroKey(label);
        return label && rubro ? { id: `rubro-${index}`, label, rubro, sector: "empresas" } : null;
      }
      if (!isPlainRecord(item)) return null;
      const label = readFirstString(item.label, item.title, item.name, item.text, item.display_name, item.slug, item.value, item.key);
      const rubro = extractRubroKey(
        readFirstString(item.rubro, item.rubro_slug, item.rubro_key, item.slug, item.value, item.key, label),
      );
      if (!label || !rubro) return null;
      const payload = isPlainRecord(item.payload)
        ? item.payload
        : isPlainRecord(item.data)
          ? item.data
          : null;
      return {
        id: readFirstString(item.id, item.key, item.slug, item.value) || `rubro-${index}`,
        label,
        title: readFirstString(item.title, item.name) || null,
        description: readFirstString(item.description, item.subtitle, item.detail) || null,
        sector: "empresas",
        rubro,
        payload,
      };
    })
    .filter(Boolean);
};

const getSessionRubroSelector = (session: any) =>
  session?.workspace?.rubro_selector ||
  session?.widget_onboarding?.rubro_selector ||
  session?.frontend_contract?.rubro_selector ||
  null;

const isRubroSelectionDemoSession = (session: any) => {
  const nextStep = readFirstString(session?.next_step, session?.frontend_contract?.next_step).toLowerCase();
  const status = readFirstString(session?.widget_onboarding?.status).toLowerCase();
  const renderAs = readFirstString(session?.frontend_contract?.render_as, session?.workspace?.rubro_selector?.render_as).toLowerCase();
  return Boolean(
    session?.requires_rubro_selection === true ||
      nextStep === "select_rubro" ||
      status === "select_rubro" ||
      renderAs === "demo_rubro_selector" ||
      renderAs === "rubro_selector",
  );
};

const pickMenuSource = (...sources: unknown[]) => {
  for (const source of sources) {
    if (!source) continue;
    if (Array.isArray(source) && source.length) return { items: source };
    if (isPlainRecord(source)) {
      if (Array.isArray(source.items) && source.items.length) return source;
      if (Array.isArray(source.options) && source.options.length) return { ...source, items: source.options };
      if (Array.isArray(source.buttons) && source.buttons.length) return { ...source, items: source.buttons };
      if (Array.isArray(source.botones) && source.botones.length) return { ...source, items: source.botones };
    }
  }
  return null;
};

function normalizeCtaMessages(rawMessages: any): string[] {
  if (!Array.isArray(rawMessages)) return [];

  return rawMessages
    .map((msg: any) => {
      if (!msg) return '';
      if (typeof msg === 'string') return msg;
      return msg.text || msg.message || '';
    })
    .map((msg: string) => msg.trim())
    .filter((msg: string) => msg.length > 0);
}

function buildPlatformWidgetFallbackConfig() {
  const quickMenu = [
    {
      id: "gobierno",
      sector: "gobierno",
      label: "Gobiernos",
      description: "Reclamos, tramites y atencion ciudadana.",
    },
    {
      id: "empresas",
      sector: "empresas",
      label: "Empresas",
      description: "Ventas, pedidos, catalogos y soporte comercial.",
    },
    {
      id: "educacion",
      sector: "educacion",
      label: "Colegios",
      description: "Familias, cuotas, comprobantes y gestion escolar.",
    },
  ];

  return {
    contract_version: "public.widget_config.v1",
    tenant: {
      slug: "chatboc-platform",
      tipo: "platform",
      nombre: "Chatboc",
      white_label: false,
    },
    onboarding: {
      contract_version: "public.widget_onboarding.v1",
      mode: "platform_sector_selector",
      title: "Experiencias Chatboc",
      entry_question: "¿Qué querés probar?",
      required_step: "select_sector",
      autostart_after_selection: true,
      selection_endpoint: "/api/v2/demo/session",
      catalog_endpoint: "/api/v2/demo/catalog",
      chat_header_policy: "use_chat_bootstrap_from_demo_session",
      quick_menu: quickMenu,
    },
    ui_hints: {
      contract_version: "widget.ui_hints.v1",
      density: "compact",
      max_visible_quick_replies: 3,
      collapse_extra_quick_replies: true,
      composer: {
        single_row_actions: true,
        icon_buttons_only: true,
        show_labels_on_hover: true,
        hide_disabled_actions: true,
        send_button_always_visible: true,
      },
      toolbar: {
        position: "composer",
        avoid_header_action_overload: true,
        show: ["attach_file", "share_location", "record_audio", "emoji"],
        collapse: ["whatsapp", "voice_call", "video_call", "catalog"],
      },
    },
    realtime: {
      socket_enabled: false,
      socket_url: null,
      fallback_mode: "http_chat",
    },
    visibility_rules: {
      allow_websocket: false,
      allow_realtime_live_chat: false,
      fallback_mode: "http_chat",
    },
    support_channels: {
      live_chat: {
        enabled: false,
        realtime: false,
        available: false,
        socket_enabled: false,
        socket_url: null,
        fallback_mode: "http_chat",
      },
    },
    quick_menu: quickMenu,
  };
}

function isPlatformWidgetConfig(config: any) {
  if (!config || typeof config !== "object") return false;
  const tenant = config.tenant && typeof config.tenant === "object" ? config.tenant : {};
  return (
    config.onboarding?.mode === "platform_sector_selector" ||
    tenant.tipo === "platform" ||
    tenant.slug === "chatboc-platform"
  );
}

function normalizePlatformWidgetConfig(rawConfig: any) {
  const fallback = buildPlatformWidgetFallbackConfig();
  if (!isPlatformWidgetConfig(rawConfig)) return null;

  const quickMenu = Array.isArray(rawConfig.quick_menu) && rawConfig.quick_menu.length > 0
    ? rawConfig.quick_menu
    : Array.isArray(rawConfig.onboarding?.quick_menu) && rawConfig.onboarding.quick_menu.length > 0
      ? rawConfig.onboarding.quick_menu
      : fallback.quick_menu;

  return {
    ...fallback,
    ...rawConfig,
    tenant: {
      ...fallback.tenant,
      ...(rawConfig.tenant || {}),
    },
    onboarding: {
      ...fallback.onboarding,
      ...(rawConfig.onboarding || {}),
      quick_menu: Array.isArray(rawConfig.onboarding?.quick_menu) && rawConfig.onboarding.quick_menu.length > 0
        ? rawConfig.onboarding.quick_menu
        : quickMenu,
    },
    ui_hints: rawConfig.ui_hints || fallback.ui_hints,
    realtime: rawConfig.realtime || rawConfig.widget?.realtime || fallback.realtime,
    visibility_rules: rawConfig.visibility_rules || fallback.visibility_rules,
    support_channels: rawConfig.support_channels || rawConfig.widget?.support_channels || fallback.support_channels,
    quick_menu: quickMenu,
  };
}


function SafeAnimatePresence({ children = null, ...rest }: React.PropsWithChildren<AnimatePresenceProps>) {
  return <AnimatePresence {...rest}>{children}</AnimatePresence>;
}

const ChatHeader = React.lazy(() => import("./ChatHeader"));
const ChatPanel = React.lazy(() => import("@/features/chat/ChatPanel"));
const ChatUserRegisterPanel = React.lazy(() => import("./ChatUserRegisterPanel"));
const ChatUserLoginPanel = React.lazy(() => import("./ChatUserLoginPanel"));
const ChatUserPanel = React.lazy(() => import("./ChatUserPanel"));
const EntityInfoPanel = React.lazy(() => import("./EntityInfoPanel"));
const ProactiveBubble = React.lazy(() => import("./ProactiveBubble"));

function sanitizeTenantSlug(slug?: string | null) {
  try {
    if (!slug) return null;
    const trimmed = slug.trim();
    if (!trimmed) return null;

    const lowered = trimmed.toLowerCase();

    if (TENANT_PLACEHOLDER_SLUGS.has(lowered)) return null;
    if (
      lowered === "localhost" ||
      lowered === "::1" ||
      /^\d+$/.test(lowered) ||
      /^\d{1,3}(?:\.\d{1,3}){3}$/.test(lowered)
    ) {
      return null;
    }

    return trimmed;
  } catch (e) {
    console.warn("Error sanitizing tenant slug", e);
    return null;
  }
}

const readResponseTenantSlug = (value: unknown): string | null => {
  if (!isPlainRecord(value)) return null;
  const tenant = isPlainRecord(value.tenant) ? value.tenant : null;
  const session = isPlainRecord(value.session) ? value.session : null;
  return readFirstString(
    tenant?.slug,
    tenant?.tenant_slug,
    value.tenant_slug,
    session?.tenant_slug,
    session?.tenant,
  ) || null;
};

const responseMatchesTenant = (value: unknown, activeTenantSlug?: string | null) => {
  const responseTenant = normalizeWidgetTenantScopeSlug(readResponseTenantSlug(value));
  const activeTenant = normalizeWidgetTenantScopeSlug(activeTenantSlug);
  return !responseTenant || !activeTenant || responseTenant === activeTenant;
};

function readTenantFromScripts(): string | null {
  if (typeof document === "undefined") return null;

  try {
    const scripts = Array.from(document.querySelectorAll("script"));
    for (const script of scripts) {
      const dataset = (script as HTMLScriptElement).dataset;
      if (!dataset) continue;

      const slug =
        dataset.tenant?.trim() ||
        dataset.tenantSlug?.trim() ||
        dataset.tenant_slug?.trim() ||
        null;

      if (slug) return slug;
    }
  } catch (e) {
    console.warn("Error reading tenant from scripts", e);
  }

  return null;
}

function readTenantFromSubdomain(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const host = window.location.hostname;
    if (!host || host === "localhost") return null;
    if (host === "::1" || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return null;

    const segments = host.split(".");
    if (segments.length < 2) return null;

    const candidate = segments[0];
    if (!candidate || /^\d+$/.test(candidate) || ["www", "app", "panel"].includes(candidate.toLowerCase())) return null;
    return candidate;
  } catch (e) {
    console.warn("Error reading tenant from subdomain", e);
    return null;
  }
}

function ChatWidgetInner({
  mode = "standalone",
  defaultOpen = false,
  initialView = 'chat',
  widgetId = "chatboc-widget-iframe",
  ownerToken,
  initialRubro,
  openWidth = "420px",
  openHeight = "680px",
  closedWidth = "64px",
  closedHeight = "64px",
  tipoChat,
  initialPosition = { bottom: 24, right: 24 },
  ctaMessage,
  customLauncherLogoUrl,
  logoAnimation,
  headerLogoUrl,
  welcomeTitle,
  welcomeSubtitle,
  tenantSlug: explicitTenantSlug,
  primaryColor,
  accentColor,
  userMsgColor,
  chatBackground,
  borderRadius,
  fontFamily,
}: ChatWidgetProps) {
  const location = useLocation();
  const CHATBOC_WIDGET_STATIC = CHATBOC_AGENT_LAUNCHER_STATIC;
  const CHATBOC_WIDGET_PNG_FALLBACK = CHATBOC_AGENT_MARK;
  const CHATBOC_WIDGET_FALLBACK = CHATBOC_AGENT_AVATAR;
  const DEFAULT_WIDGET_UX = {
    preset: 'premium',
    motionLevel: 'balanced',
    glassmorphism: true,
    logoRing: true,
    gradientStart: '#0f172a',
    gradientEnd: '#007aff',
    typingAnimation: 'wave-dots',
    bubbleAnimation: 'soft-rise',
    launcherAnimation: 'none',
    messageEnterAnimation: 'fade-up',
    logoBadgeStyle: 'ring',
    cursorTrail: false,
    ambientParticles: false,
  } as const;

  const normalizeUxBool = (value: unknown, fallback: boolean) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true') return true;
      if (normalized === 'false') return false;
    }
    return fallback;
  };

  const normalizeUxString = (value: unknown, fallback: string) => {
    if (typeof value !== 'string') return fallback;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  };

  const resolveWidgetUxConfig = (publicConfig: any, fallbackTipoChat: 'municipio' | 'pyme') => {
    const attrs = publicConfig?.widget?.attributes || {};
    const ux = publicConfig?.builder_config?.ux || {};
    const defaultPreset = fallbackTipoChat === 'municipio' ? 'civic-premium' : 'commerce-neon';

    return {
      preset: normalizeUxString(attrs['data-widget-preset'] ?? ux.preset, defaultPreset),
      motionLevel: normalizeUxString(attrs['data-motion-level'] ?? ux.motion_level, DEFAULT_WIDGET_UX.motionLevel),
      glassmorphism: normalizeUxBool(attrs['data-glassmorphism'] ?? ux.glassmorphism, DEFAULT_WIDGET_UX.glassmorphism),
      logoRing: normalizeUxBool(attrs['data-logo-ring'] ?? ux.logo_ring, DEFAULT_WIDGET_UX.logoRing),
      gradientStart: normalizeUxString(attrs['data-gradient-start'] ?? ux.gradient_start, DEFAULT_WIDGET_UX.gradientStart),
      gradientEnd: normalizeUxString(attrs['data-gradient-end'] ?? ux.gradient_end, DEFAULT_WIDGET_UX.gradientEnd),
      typingAnimation: normalizeUxString(attrs['data-typing-animation'] ?? ux.typing_animation, DEFAULT_WIDGET_UX.typingAnimation),
      bubbleAnimation: normalizeUxString(attrs['data-bubble-animation'] ?? ux.bubble_animation, DEFAULT_WIDGET_UX.bubbleAnimation),
      launcherAnimation: DEFAULT_WIDGET_UX.launcherAnimation,
      messageEnterAnimation: normalizeUxString(attrs['data-message-enter-animation'] ?? ux.message_enter_animation, DEFAULT_WIDGET_UX.messageEnterAnimation),
      logoBadgeStyle: normalizeUxString(attrs['data-logo-badge-style'] ?? ux.logo_badge_style, DEFAULT_WIDGET_UX.logoBadgeStyle),
      cursorTrail: normalizeUxBool(attrs['data-cursor-trail'] ?? ux.cursor_trail, DEFAULT_WIDGET_UX.cursorTrail),
      ambientParticles: normalizeUxBool(attrs['data-ambient-particles'] ?? ux.ambient_particles, DEFAULT_WIDGET_UX.ambientParticles),
    };
  };

  const proactiveMessageTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hideProactiveBubbleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isDarkMode = useDarkMode();
  const widgetContainerRef = useRef<HTMLDivElement>(null);

  const [isOpen, setIsOpen] = useState(() => {
    if (mode !== 'standalone' && typeof defaultOpen === 'string') {
      return defaultOpen === 'true';
    }
    return !!defaultOpen;
  });
  const [muted, setMuted] = useState(() => {
    if (typeof window === 'undefined') return false;
    return safeLocalStorage.getItem('chatboc_muted') === '1';
  });
  const [view, setView] = useState<'chat' | 'register' | 'login' | 'user' | 'info'>(initialView);
  const { user } = useUser();
  const isBackofficeUser = isBackofficeRole(user?.rol);
  const [contextOverride, setContextOverride] = useState<any>(null);
  const [resolvedTipoChat, setResolvedTipoChat] = useState<'pyme' | 'municipio'>(() => {
    return tipoChat || getCurrentTipoChat();
  });
  const [entityInfo, setEntityInfo] = useState<any | null>(null);
  const [isProfileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [platformSelectionLoadingId, setPlatformSelectionLoadingId] = useState<string | null>(null);
  const [platformSelectionError, setPlatformSelectionError] = useState<string | null>(null);
  const [activeDemoTenantSlug, setActiveDemoTenantSlug] = useState<string | null>(null);
  const [chatPanelResetKey, setChatPanelResetKey] = useState(0);
  const [requireCatalogAuth, setRequireCatalogAuth] = useState(false);
  const [catalogInfo, setCatalogInfo] = useState<any | null>(null);
  const [widgetCommerceSession, setWidgetCommerceSession] = useState<WidgetCommerceSession | null>(null);
  const [widgetCommerceHistory, setWidgetCommerceHistory] = useState<WidgetCommerceHistory | null>(null);
  const [widgetCommerceCart, setWidgetCommerceCart] = useState<WidgetCommerceCartSnapshot | null>(null);

  const [duplicateInstance, setDuplicateInstance] = useState(false);
  const isEmbedded = mode !== "standalone";
  const isPublicPlatformSurface = useMemo(() => {
    if (typeof window === "undefined" || isEmbedded) return false;
    return isPublicPlatformSurfacePath(window.location.pathname);
  }, [isEmbedded]);

  const resolvedOwnerToken = useMemo(() => {
    const isDemoSessionContext =
      Boolean(activeDemoTenantSlug) ||
      entityInfo?.onboarding?.mode === "demo_session" ||
      entityInfo?.widget_onboarding?.status === "ready";
    if (isDemoSessionContext && !ownerToken) return null;
    if (isDemoSessionContext && isPublicPlatformSurface) return null;
    if (ownerToken) return ownerToken;
    return (
      entityInfo?.owner_token ||
      entityInfo?.entity_token ||
      entityInfo?.widget_token ||
      entityInfo?.token ||
      null
    );
  }, [activeDemoTenantSlug, entityInfo, isPublicPlatformSurface, ownerToken]);
  const openPanelRef = useRef<HTMLDivElement>(null);
  const launcherButtonRef = useRef<HTMLButtonElement>(null);
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);

  const [isMobileView, setIsMobileView] = useState(
    typeof window !== "undefined" && window.innerWidth < 640
  );
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [launcherImageSrc, setLauncherImageSrc] = useState(CHATBOC_WIDGET_STATIC);
  const [hideClosedLauncherForHeroPreview, setHideClosedLauncherForHeroPreview] = useState(false);

  const { tenant, currentSlug } = useTenant();
  const storedTenantSlug = useMemo(
    () => sanitizeTenantSlug(safeLocalStorage.getItem("tenantSlug")),
    [],
  );

  const catalogMetadata = useMemo(() => {
    if (!catalogInfo) return null;
    return (
      catalogInfo?.metadata ?? {
        title: catalogInfo?.title,
        description: catalogInfo?.description,
        banner_url: catalogInfo?.banner_url,
        enabled: catalogInfo?.enabled,
        is_public: catalogInfo?.is_public,
        share_on_intent: catalogInfo?.share_on_intent,
        prefer_pdf_on_whatsapp: catalogInfo?.prefer_pdf_on_whatsapp,
        default_message: catalogInfo?.default_message,
      }
    );
  }, [catalogInfo]);

  const catalogLinks = useMemo(() => {
    if (!catalogInfo) return null;
    return (
      catalogInfo?.links ?? {
        view_url: catalogInfo?.view_url,
        download_url: catalogInfo?.download_url,
        download_url_json: catalogInfo?.download_url_json,
        view_label: catalogInfo?.view_label,
        download_label: catalogInfo?.download_label,
        cta_label: catalogInfo?.cta_label,
      }
    );
  }, [catalogInfo]);

  const catalogCard = useMemo(
    () => ({
      bannerUrl: catalogMetadata?.banner_url ?? null,
      viewUrl: catalogLinks?.view_url ?? null,
      downloadUrl: catalogLinks?.download_url ?? null,
      viewLabel: catalogLinks?.view_label ?? null,
      downloadLabel: catalogLinks?.download_label ?? null,
    }),
    [catalogLinks, catalogMetadata],
  );

  const catalogCtaLabel = catalogLinks?.cta_label ?? catalogLinks?.view_label;
  const supportChannels = useMemo(
    () => entityInfo?.widget?.support_channels || entityInfo?.support_channels || null,
    [entityInfo],
  );
  const realtimeVoice = useMemo(
    () =>
      entityInfo?.realtime_voice ||
      entityInfo?.widget?.realtime_voice ||
      supportChannels?.voice_call?.capabilities ||
      null,
    [entityInfo, supportChannels?.voice_call?.capabilities],
  );
  const realtimeConfig = useMemo(() => {
    const attrs = entityInfo?.widget?.attributes || {};
    const realtimeMeta =
      entityInfo?.builder_config?.enterprise_iteration?.realtime || {};
    const publicRealtime = entityInfo?.realtime || entityInfo?.widget?.realtime || {};
    const avatarMeta = entityInfo?.avatar || entityInfo?.widget?.avatar || publicRealtime?.avatar || {};
    const voiceHandoff = realtimeMeta?.voice_handoff || {};
    const toBool = (value: unknown, fallback = false) => {
      if (typeof value === 'boolean') return value;
      if (typeof value === 'number') return value === 1;
      if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['true', '1', 'yes', 'si', 'on', 'enabled'].includes(normalized)) return true;
        if (['false', '0', 'no', 'off', 'disabled'].includes(normalized)) return false;
      }
      return fallback;
    };
    const toText = (value: unknown, fallback = '') => (typeof value === 'string' && value.trim() ? value.trim() : fallback);
    const toList = (value: unknown): string[] => {
      if (!Array.isArray(value)) return [];
      return value
        .map((item) => (typeof item === 'string' && item.trim() ? item.trim() : null))
        .filter((item): item is string => Boolean(item));
    };

    return {
      model: toText(
        attrs['data-realtime-model'],
        toText(
          realtimeVoice?.recommended_model,
          toText(realtimeMeta?.model, supportChannels?.voice_call?.model || supportChannels?.video_call?.model || ''),
        ),
      ),
      fallbackModel: toText(
        attrs['data-realtime-fallback-model'],
        toText(realtimeVoice?.fallback_model, toText(realtimeMeta?.fallback_model, supportChannels?.voice_call?.fallback_model || '')),
      ),
      voice: toText(
        attrs['data-realtime-voice'],
        toText(realtimeVoice?.voice, toText(realtimeMeta?.voice, supportChannels?.voice_call?.voice || '')),
      ),
      transport: toText(
        attrs['data-realtime-transport'],
        toText(realtimeMeta?.transport, toText(realtimeVoice?.transports?.browser, 'webrtc')),
      ),
      profile: toText(
        attrs['data-realtime-profile'],
        toText(realtimeMeta?.profile, toText(supportChannels?.voice_call?.profile, 'realtime_voice_native')),
      ),
      voiceEnabled: toBool(attrs['data-realtime-voice-enabled'], Boolean(supportChannels?.voice_call?.enabled)),
      videoEnabled: toBool(attrs['data-realtime-video-enabled'], Boolean(supportChannels?.video_call?.enabled)),
      liveVideoAnalysis: toBool(
        attrs['data-realtime-live-video-analysis'],
        Boolean(
          realtimeVoice?.features?.live_video_analysis ||
            realtimeVoice?.features?.video_analysis_ready ||
            realtimeVoice?.features?.multimodal_capture ||
            supportChannels?.video_call?.features?.live_video_analysis ||
            supportChannels?.video_call?.features?.video_analysis_ready ||
            supportChannels?.video_call?.features?.analysis_ready ||
            supportChannels?.video_call?.features?.multimodal_capture ||
            supportChannels?.video_call?.features?.visual_capture,
        ),
      ),
      avatarEnabled: toBool(attrs['data-avatar-enabled'], toBool(avatarMeta?.enabled, false)),
      avatarContractVersion: toText(attrs['data-avatar-contract-version'], toText(avatarMeta?.contract_version, '')),
      avatarType: toText(attrs['data-avatar-type'], toText(avatarMeta?.type, 'robot')),
      avatarPersona: toText(attrs['data-avatar-persona'], toText(avatarMeta?.persona, '')),
      avatarDisplayName: toText(attrs['data-avatar-display-name'], toText(avatarMeta?.display_name, '')),
      avatarStateSource: toText(attrs['data-avatar-state-source'], toText(avatarMeta?.state_source, '')),
      voiceLabel: toText(attrs['data-realtime-voice-label'], toText(supportChannels?.voice_call?.label, '')),
      videoLabel: toText(attrs['data-realtime-video-label'], toText(supportChannels?.video_call?.label, '')),
      socketEnabled: toBool(
        publicRealtime?.socket_enabled ?? supportChannels?.live_chat?.socket_enabled,
        false,
      ),
      socketUrl: toText(
        publicRealtime?.socket_url,
        toText(supportChannels?.live_chat?.socket_url, ''),
      ) || null,
      fallbackMode: toText(
        publicRealtime?.fallback_mode,
        toText(supportChannels?.live_chat?.fallback_mode, ''),
      ) || null,
      voiceHandoff: {
        enabled: toBool(voiceHandoff?.enabled, false),
        supportsWhatsAppFollowup: toBool(
          voiceHandoff?.supports_whatsapp_followup ?? voiceHandoff?.supportsWhatsAppFollowup,
          false,
        ),
        supportsConfirmationCards: toBool(
          voiceHandoff?.supports_confirmation_cards ?? voiceHandoff?.supportsConfirmationCards,
          false,
        ),
        preferredChannels: toList(
          voiceHandoff?.preferred_channels ?? voiceHandoff?.preferredChannels,
        ),
      },
    };
  }, [
    entityInfo?.builder_config?.enterprise_iteration?.realtime,
    entityInfo?.realtime,
    entityInfo?.avatar,
    entityInfo?.widget?.avatar,
    entityInfo?.widget?.attributes,
    entityInfo?.widget?.realtime,
    supportChannels?.live_chat?.fallback_mode,
    supportChannels?.live_chat?.socket_enabled,
    supportChannels?.live_chat?.socket_url,
    realtimeVoice,
    supportChannels?.video_call?.enabled,
    supportChannels?.video_call?.features,
    supportChannels?.video_call?.label,
    supportChannels?.video_call?.model,
    supportChannels?.voice_call?.enabled,
    supportChannels?.voice_call?.fallback_model,
    supportChannels?.voice_call?.label,
    supportChannels?.voice_call?.model,
    supportChannels?.voice_call?.profile,
    supportChannels?.voice_call?.voice,
  ]);
  const showCatalogCta =
    !!catalogCtaLabel &&
    !!catalogLinks?.view_url &&
    catalogMetadata?.enabled !== false &&
    catalogMetadata?.is_public !== false;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const globalAny = window as any;
    if (typeof globalAny._t !== "function") {
      globalAny._t = (value: any) => value;
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (mode === "preview") return;

    if ((window as any).__chatbocWidgetMounted) {
      setDuplicateInstance(true);
      return;
    }

    (window as any).__chatbocWidgetMounted = true;

    return () => {
      delete (window as any).__chatbocWidgetMounted;
    };
  }, [mode]);

  const derivedEntityTitle =
    (typeof entityInfo?.nombre_empresa === "string" && entityInfo.nombre_empresa.trim()) ||
    (typeof entityInfo?.nombre === "string" && entityInfo.nombre.trim()) ||
    (typeof entityInfo?.nombre_publico === "string" && entityInfo.nombre_publico.trim()) ||
    (typeof entityInfo?.nombre_fantasia === "string" && entityInfo.nombre_fantasia.trim()) ||
    (typeof entityInfo?.nombreFantasia === "string" && entityInfo.nombreFantasia.trim()) ||
    (typeof entityInfo?.nombre_asistente === "string" && entityInfo.nombre_asistente.trim()) ||
    (typeof entityInfo?.nombreAsistente === "string" && entityInfo.nombreAsistente.trim()) ||
    (typeof entityInfo?.bot_nombre === "string" && entityInfo.bot_nombre.trim()) ||
    (typeof entityInfo?.botNombre === "string" && entityInfo.botNombre.trim()) ||
    (typeof entityInfo?.display_name === "string" && entityInfo.display_name.trim()) ||
    (typeof entityInfo?.municipio_nombre === "string" && entityInfo.municipio_nombre.trim()) ||
    (typeof entityInfo?.municipio === "string" && entityInfo.municipio.trim()) ||
    "";

  const derivedEntitySubtitle =
    (typeof entityInfo?.rubro === "string" && entityInfo.rubro.trim()) ||
    (typeof entityInfo?.descripcion === "string" && entityInfo.descripcion.trim()) ||
    (typeof entityInfo?.descripcion_corta === "string" && entityInfo.descripcion_corta.trim()) ||
    (typeof entityInfo?.tagline === "string" && entityInfo.tagline.trim()) ||
    (typeof entityInfo?.eslogan === "string" && entityInfo.eslogan.trim()) ||
    (typeof entityInfo?.slogan === "string" && entityInfo.slogan.trim()) ||
    "";

  const headerTitle = isEmbedded ? (welcomeTitle || derivedEntityTitle) : welcomeTitle;
  const headerSubtitle = isEmbedded ? (welcomeSubtitle || derivedEntitySubtitle) : welcomeSubtitle;

  const tenantSlugFromEntity = useMemo(() => {
    if (entityInfo?.onboarding?.mode === "demo_session") return null;

    const candidates = [
      entityInfo?.slug,
      entityInfo?.slug_publico,
      entityInfo?.slugPublico,
      entityInfo?.tenant_slug,
      entityInfo?.tenantSlug,
      entityInfo?.tenant,
      entityInfo?.endpoint,
      entityInfo?.municipio_slug,
      entityInfo?.municipioSlug,
      entityInfo?.public_slug,
      entityInfo?.publicSlug,
      entityInfo?.empresa_slug,
      entityInfo?.empresaSlug,
    ];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    }

    return null;
  }, [entityInfo]);

  const tenantSlugFromLocation = useMemo(() => {
    if (typeof window === 'undefined') return null;

    try {
      const params = new URLSearchParams(window.location.search);
      const fromQuery = params.get('tenant_slug') || params.get('tenant');
      const sanitizedFromQuery = sanitizeTenantSlug(fromQuery);
      if (sanitizedFromQuery) {
        return sanitizedFromQuery;
      }

      const segments = window.location.pathname.split('/').filter(Boolean);
      if (segments[0] && TENANT_ROUTE_PREFIXES.includes(segments[0] as (typeof TENANT_ROUTE_PREFIXES)[number]) && segments[1]) {
        return sanitizeTenantSlug(decodeURIComponent(segments[1]));
      }

      if (segments[0]) {
        const maybeSlug = decodeURIComponent(segments[0]);
        return sanitizeTenantSlug(maybeSlug);
      }
    } catch (error) {
      console.warn('No se pudo resolver tenant_slug desde la URL', error);
    }

    return null;
  }, []);

  const tenantSlugFromScripts = useMemo(() => sanitizeTenantSlug(readTenantFromScripts()), []);
  const tenantSlugFromSubdomain = useMemo(() => sanitizeTenantSlug(readTenantFromSubdomain()), []);

  const tenantSlugFromGlobalConfig = useMemo(() => {
    if (typeof window === "undefined") return null;
    const cfg = (window as any).CHATBOC_CONFIG || {};
    return sanitizeTenantSlug(cfg.tenant || cfg.tenantSlug || cfg.tenant_slug);
  }, []);

  const explicitResolvedTenantSlug = useMemo(() => {
    const candidates = [
      contextOverride?.tenantSlug,
      explicitTenantSlug,
      tenantSlugFromEntity,
      tenantSlugFromLocation,
      tenantSlugFromScripts,
      tenantSlugFromSubdomain,
      tenantSlugFromGlobalConfig,
    ];

    for (const candidate of candidates) {
      const sanitized = sanitizeTenantSlug(candidate);
      if (sanitized) return sanitized;
    }

    return null;
  }, [
    contextOverride,
    explicitTenantSlug,
    tenantSlugFromEntity,
    tenantSlugFromLocation,
    tenantSlugFromScripts,
    tenantSlugFromSubdomain,
    tenantSlugFromGlobalConfig,
  ]);

  const accountTenantSlug = useMemo(() => {
    const candidates = [currentSlug, tenant?.slug];

    for (const candidate of candidates) {
      const sanitized = sanitizeTenantSlug(candidate);
      if (sanitized) return sanitized;
    }

    return null;
  }, [currentSlug, tenant?.slug]);

  const embeddedTenantSlug = useMemo(() => {
    if (explicitResolvedTenantSlug) return explicitResolvedTenantSlug;
    if (isPublicPlatformSurface) return null;
    return accountTenantSlug;
  }, [accountTenantSlug, explicitResolvedTenantSlug, isPublicPlatformSurface]);

  const resolvedTenantSlug = useMemo(() => {
    if (isEmbedded) {
      return embeddedTenantSlug;
    }

    if (embeddedTenantSlug) return embeddedTenantSlug;
    if (isPublicPlatformSurface) return null;
    return storedTenantSlug;
  }, [embeddedTenantSlug, isEmbedded, isPublicPlatformSurface, storedTenantSlug]);
  const chatTenantSlug = activeDemoTenantSlug || resolvedTenantSlug;
  const chatBootstrap = entityInfo?.chat_bootstrap ?? entityInfo?.workspace?.chat_bootstrap ?? null;
  const effectiveUiHints: ChatWidgetUiHints | null = useMemo(() => {
    const base = (entityInfo?.ui_hints ?? widgetCommerceSession?.ui_hints ?? null) as ChatWidgetUiHints | null;
    const accessibility =
      entityInfo?.ui_hints?.accessibility ??
      widgetCommerceSession?.ui_hints?.accessibility ??
      widgetCommerceSession?.accessibility ??
      null;

    if (!base && !accessibility) return null;
    return {
      ...(base ?? {}),
      ...(accessibility ? { accessibility } : {}),
    };
  }, [entityInfo?.ui_hints, widgetCommerceSession?.accessibility, widgetCommerceSession?.ui_hints]);
  const demoSessionId = readFirstString(
    entityInfo?.demo_session_id,
    entityInfo?.session_id,
    entityInfo?.workspace?.demo_session_id,
    chatBootstrap?.payload?.demo_session_id,
    chatBootstrap?.query?.demo_session_id,
    widgetCommerceSession?.session?.demo_session_id,
  );
  const commerceTenantSlug = readFirstString(
    widgetCommerceSession?.tenant?.slug,
    widgetCommerceSession?.tenant?.tenant_slug,
    chatTenantSlug,
  );

  useEffect(() => {
    if (entityInfo?.onboarding?.mode === "demo_session") return;

    const sanitized = sanitizeTenantSlug(resolvedTenantSlug);
    if (sanitized) {
      safeLocalStorage.setItem("tenantSlug", sanitized);
      return;
    }

    if (isEmbedded || isPublicPlatformSurface) {
      safeLocalStorage.removeItem("tenantSlug");
    }
  }, [entityInfo?.onboarding?.mode, isEmbedded, isPublicPlatformSurface, resolvedTenantSlug]);

  useEffect(() => {
    if (!isEmbedded) return;

    const embeddedSourceSlug = sanitizeTenantSlug(explicitTenantSlug) || embeddedTenantSlug;
    setContextOverride((prev: any) => {
      if (!prev?.tenantSlug) return prev;
      if (!embeddedSourceSlug) {
        const { tenantSlug: _tenantSlug, ...rest } = prev;
        return Object.keys(rest).length ? rest : null;
      }
      const sanitizedPrev = sanitizeTenantSlug(prev.tenantSlug);
      return sanitizedPrev === embeddedSourceSlug ? prev : { ...prev, tenantSlug: embeddedSourceSlug };
    });
  }, [embeddedTenantSlug, explicitTenantSlug, isEmbedded]);

  useEffect(() => {
    const checkMobile = () => {
      if (typeof window !== "undefined") {
        setIsMobileView(window.innerWidth < 640);
      }
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    const toggleHeroPreviewVisibilityClass = (visible: boolean) => {
      document.documentElement.classList.toggle("chatboc-hero-preview-visible", visible);
    };

    if (
      typeof window === "undefined" ||
      mode !== "standalone" ||
      !isMobileView ||
      isOpen
    ) {
      setHideClosedLauncherForHeroPreview(false);
      if (typeof document !== "undefined") {
        toggleHeroPreviewVisibilityClass(false);
      }
      return;
    }

    let animationFrame = 0;
    const timers: number[] = [];
    let mutationObserver: MutationObserver | null = null;

    const checkHeroPreview = () => {
      const heroPreview = document.querySelector(".chatboc-hero-preview");
      if (!heroPreview) {
        setHideClosedLauncherForHeroPreview(false);
        toggleHeroPreviewVisibilityClass(false);
        return;
      }

      const rect = heroPreview.getBoundingClientRect();
      const visibleHeight = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
      const visibleRatio = visibleHeight / Math.max(rect.height, 1);
      const launcherOverlapZoneTop = window.innerHeight - 120;
      const overlapsLauncherZone = rect.top < window.innerHeight && rect.bottom > launcherOverlapZoneTop;
      const shouldHideLauncher = visibleRatio > 0.08 || overlapsLauncherZone;
      setHideClosedLauncherForHeroPreview(shouldHideLauncher);
      toggleHeroPreviewVisibilityClass(shouldHideLauncher);
    };

    const scheduleCheck = () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(checkHeroPreview);
    };

    checkHeroPreview();
    timers.push(window.setTimeout(checkHeroPreview, 250));
    timers.push(window.setTimeout(checkHeroPreview, 850));
    timers.push(window.setTimeout(checkHeroPreview, 1600));
    timers.push(window.setTimeout(checkHeroPreview, 2600));
    timers.push(window.setTimeout(checkHeroPreview, 4200));
    window.addEventListener("scroll", scheduleCheck, { passive: true });
    window.addEventListener("resize", scheduleCheck);
    window.addEventListener("load", scheduleCheck);

    if ("MutationObserver" in window && document.body) {
      mutationObserver = new MutationObserver(scheduleCheck);
      mutationObserver.observe(document.body, { childList: true, subtree: true });
    }

    return () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      timers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener("scroll", scheduleCheck);
      window.removeEventListener("resize", scheduleCheck);
      window.removeEventListener("load", scheduleCheck);
      mutationObserver?.disconnect();
      toggleHeroPreviewVisibilityClass(false);
    };
  }, [isMobileView, isOpen, mode]);

  useEffect(() => {
    getOrCreateAnonId();
  }, []);

  useEffect(() => {
    const fromEntity =
      (entityInfo as any)?.require_login_for_catalog ??
      (entityInfo as any)?.requireLoginForCatalog ??
      (entityInfo as any)?.catalog_requires_login;

    if (typeof fromEntity === "boolean") {
      setRequireCatalogAuth(fromEntity);
      return;
    }

    if (typeof fromEntity === "string") {
      setRequireCatalogAuth(fromEntity === "true" || fromEntity === "1");
    }
  }, [entityInfo]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get("requireLoginForCatalog") || params.get("catalogRequiresLogin");
    if (fromQuery) {
      setRequireCatalogAuth(fromQuery === "true" || fromQuery === "1");
      return;
    }

    const scripts = Array.from(document.querySelectorAll<HTMLScriptElement>("script[data-owner-token], script[data-tenant], script[data-tenant-slug], script[data-tenant_slug]"));

    for (const script of scripts) {
      const { dataset } = script;
      const matchesOwner = ownerToken && dataset.ownerToken === ownerToken;
      if (!matchesOwner && ownerToken) {
        continue;
      }

      const requireLogin = dataset.requireLoginForCatalog || dataset.requireLoginForMarket || dataset.catalogRequiresLogin;
      if (requireLogin) {
        setRequireCatalogAuth(requireLogin === "true" || requireLogin === "1");
        return;
      }
    }
  }, [ownerToken]);

  const [authTokenState, setAuthTokenState] = useState<string | null>(() =>
    safeLocalStorage.getItem("authToken") || safeLocalStorage.getItem("chatAuthToken"),
  );

  useEffect(() => {
    setAuthTokenState(
      safeLocalStorage.getItem("authToken") || safeLocalStorage.getItem("chatAuthToken"),
    );
  }, [user]);

  const [showCta, setShowCta] = useState(false);
  const [proactiveMessage, setProactiveMessage] = useState<string | null>(null);
  const [showProactiveBubble, setShowProactiveBubble] = useState(false);
  const [proactiveCycle, setProactiveCycle] = useState(0);
  const [widgetUx, setWidgetUx] = useState(DEFAULT_WIDGET_UX);
  const [cursorTrailPoint, setCursorTrailPoint] = useState<{ x: number; y: number } | null>(null);
  const applyWidgetFallbackProfile = useCallback(() => {
    const inferredTipo = tipoChat === 'municipio' ? 'municipio' : 'pyme';
    setEntityInfo({
      nombre_empresa:
        welcomeTitle || (inferredTipo === 'municipio' ? 'Asistente ciudadano' : 'Asistente Virtual'),
      descripcion:
        welcomeSubtitle || 'Atencion con IA de Chatboc disponible en modo basico.',
      slug: resolvedTenantSlug || 'chatboc-platform',
      tipo_chat: inferredTipo,
      quick_menu: [],
      degraded_mode: true,
    });
    setWidgetUx(DEFAULT_WIDGET_UX);
    setResolvedTipoChat(inferredTipo);
    setProfileError(null);
  }, [resolvedTenantSlug, tipoChat, welcomeSubtitle, welcomeTitle]);

  // Apply Theme Config
  useEffect(() => {
    // Priority:
    // 1. Backend provided theme config (entityInfo.theme_config) - Apply BASE theme (bg, text)
    // 2. URL/Prop provided colors (primaryColor, accentColor) - OVERRIDE primary/secondary

    // Avoid polluting global styles if on main landing page and running as a widget
    // We only apply this if we are in iframe/embed mode OR if we are on a specific tenant page
    // If we are on the root landing page, we should preserve the landing page's branding
    if (typeof window !== 'undefined' && window.location.pathname === '/' && (mode === 'standalone' || mode === 'script')) {
        return;
    }

    const root = document.documentElement;
    // Strictly scope to container unless we are in full-page iframe mode.
    // This prevents the widget from polluting the host page's global styles (like dark mode background).
    const target = mode === 'iframe' ? root : widgetContainerRef.current;

    // First, apply the base theme from entity config (if available) to ensure background/text are correct
    if (entityInfo?.theme_config) {
      try {
        const modeTheme = entityInfo.theme_config.mode;
        const isDark = modeTheme === 'dark' || (modeTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        const theme = isDark ? entityInfo.theme_config.dark : entityInfo.theme_config.light;

        if (theme) {
          Object.entries(theme).forEach(([key, value]) => {
            // Apply only to the widget container if standalone, or global root if iframe
             if (target) {
                if (key === 'primary') {
                    target.style.setProperty('--primary', value as string);
                    // Assume value is HSL or can be converted. If from theme config, it might already be HSL?
                    // Usually theme config has raw colors. Assuming HSL for now as per ShadCN convention.
                }
                if (key === 'secondary') target.style.setProperty('--secondary', value as string);
                if (key === 'background') target.style.setProperty('--background', value as string);
                if (key === 'text') target.style.setProperty('--foreground', value as string);
             }
          });
        }
      } catch (e) {
        console.warn("Error applying theme config:", e);
      }
    }

    // Then, override primary/secondary colors if explicitly passed via props (URL/Iframe)
    // Note: We avoid setting these on 'root' globally if we are in standalone mode on the main landing page,
    // to prevent breaking the landing page styles. The widget container itself will handle scoped styles via inline styles or class isolation if needed.
    // However, ShadCN components rely on CSS variables.
    // If we are in 'iframe' mode, it's safe to set on root.
    if (primaryColor && target) {
        target.style.setProperty('--primary', hexToHsl(primaryColor));
        target.style.setProperty('--primary-foreground', getContrastColorHsl(primaryColor));
    }
    if (accentColor && target) {
        target.style.setProperty('--secondary', hexToHsl(accentColor));
        target.style.setProperty('--secondary-foreground', getContrastColorHsl(accentColor));
    }

    // Additional Customizations
    if (target) {
        if (userMsgColor) {
             target.style.setProperty('--user-msg-bg', userMsgColor);
             target.style.setProperty('--user-msg-fg', getContrastColorHsl(userMsgColor));
        }
        if (chatBackground) {
             target.style.setProperty('--chat-bg', chatBackground);
        }
        if (borderRadius !== undefined) {
             target.style.setProperty('--radius', `${borderRadius}px`);
        }
        if (fontFamily) {
             // Basic font mapping or direct usage
             let fontStack = 'Inter, sans-serif';
             if (fontFamily === 'Roboto') fontStack = 'Roboto, sans-serif';
             if (fontFamily === 'Montserrat') fontStack = 'Montserrat, sans-serif';
             if (fontFamily === 'Open Sans') fontStack = '"Open Sans", sans-serif';

             target.style.setProperty('--font-sans', fontStack);
             // Also force on body/container just in case
             target.style.fontFamily = fontStack;
        }
    }

  }, [entityInfo, primaryColor, accentColor, userMsgColor, chatBackground, borderRadius, fontFamily, mode, isDarkMode]);

  const proactiveMessages = useMemo(() => {
    const backendMessages = normalizeCtaMessages(entityInfo?.cta_messages || entityInfo?.interaction?.cta_messages);
    const propMessage = typeof ctaMessage === 'string' && ctaMessage.trim().length > 0 ? [ctaMessage.trim()] : [];
    return [...propMessage, ...backendMessages].filter((message, index, current) => current.indexOf(message) === index);
  }, [entityInfo, ctaMessage]);

  // Proactive Bubble Logic
  useEffect(() => {
    if (proactiveMessages.length === 0) {
      setShowProactiveBubble(false);
      setProactiveMessage(null);
      return;
    }

    const shouldForceShow = entityInfo?.force_proactive === true;
    if (shouldForceShow && !safeLocalStorage.getItem('proactive_bubble_shown_v2')) {
      const timer = setTimeout(() => {
        if (!isOpen) {
          setProactiveMessage(proactiveMessages[0]);
          setShowProactiveBubble(true);
        }
        safeLocalStorage.setItem('proactive_bubble_shown_v2', '1');
      }, 3000);
      return () => clearTimeout(timer);
    }

    const cycleTimer = setInterval(() => {
      if (isOpen) return;

      const nextIdx = (proactiveCycle + 1) % proactiveMessages.length;
      setProactiveMessage(proactiveMessages[nextIdx]);
      setProactiveCycle(nextIdx);

      if (!showProactiveBubble) {
        setShowProactiveBubble(true);
      }
    }, 6000);

    return () => clearInterval(cycleTimer);
  }, [isOpen, showProactiveBubble, proactiveCycle, proactiveMessages, entityInfo?.force_proactive]);

  const toggleChat = useCallback(() => {
    const sharedAudioContext =
      typeof window !== "undefined"
        ? ((window as any).chatbocAudioContext as AudioContext | undefined)
        : undefined;
    if (sharedAudioContext?.state === "suspended") {
      void sharedAudioContext.resume();
    }

    setIsOpen((prevIsOpen) => {
      const nextIsOpen = !prevIsOpen;
      if (nextIsOpen && typeof document !== "undefined") {
        lastFocusedElementRef.current = document.activeElement instanceof HTMLElement
          ? document.activeElement
          : launcherButtonRef.current;
      }
      if (!nextIsOpen) {
          safeLocalStorage.setItem('widget_manually_closed', '1');
      }
      
      if (nextIsOpen) {
        trackWidgetEvent('widget_opened');
        setShowProactiveBubble(false);
        if (proactiveMessageTimeoutRef.current) clearTimeout(proactiveMessageTimeoutRef.current);
        if (hideProactiveBubbleTimeoutRef.current) clearTimeout(hideProactiveBubbleTimeoutRef.current);
      }
      return nextIsOpen;
    });
  }, [isOpen]);

  const handleOpenPanelKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setIsOpen(false);
      safeLocalStorage.setItem('widget_manually_closed', '1');
      return;
    }

    if (event.key !== "Tab") return;
    const panel = openPanelRef.current;
    if (!panel) return;
    const focusables = (Array.from(
      panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ) as HTMLElement[]).filter((element) => element.offsetParent !== null || element === document.activeElement);

    if (!focusables.length) {
      event.preventDefault();
      panel.focus();
      return;
    }

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
      return;
    }
    if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      lastFocusedElementRef.current?.focus?.();
      return;
    }

    const timer = window.setTimeout(() => {
      const panel = openPanelRef.current;
      if (!panel) return;
      const firstFocusable = panel.querySelector<HTMLElement>(
        'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      );
      (firstFocusable ?? panel).focus();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [isOpen]);

  const handleProactiveClick = useCallback(() => {
      let backendMessages = entityInfo?.cta_messages || entityInfo?.interaction?.cta_messages;
      if (backendMessages && Array.isArray(backendMessages) && backendMessages.length > 0) {
          const currentMsgObj = backendMessages[proactiveCycle % backendMessages.length];
          if (currentMsgObj && typeof currentMsgObj === 'object' && currentMsgObj.action) {
              setIsOpen(true);
              trackWidgetEvent('lead_cta_clicked');
              safeLocalStorage.setItem('pending_widget_action', JSON.stringify({
                  action: currentMsgObj.action,
                  payload: currentMsgObj.payload,
                  text: currentMsgObj.text || currentMsgObj.message
              }));
              return;
          }
      }

      // Ensure toggleChat opens the chat if closed
      setIsOpen(true); // Explicitly open instead of toggle to be safe
      trackWidgetEvent('widget_opened');

      if (proactiveMessageTimeoutRef.current) clearTimeout(proactiveMessageTimeoutRef.current);
      if (hideProactiveBubbleTimeoutRef.current) clearTimeout(hideProactiveBubbleTimeoutRef.current);
      setShowProactiveBubble(false);

  }, [entityInfo, proactiveCycle]);

  const [selectedRubro, setSelectedRubro] = useState<string | null>(() => extractRubroKey(initialRubro) ?? null);
  const [pendingRedirect, setPendingRedirect] = useState<"cart" | "market" | "portal" | null>(null);
  const cartCount = useCartCount();
  const commerceCartCount = readFirstNumber(
    widgetCommerceCart?.items_count,
    widgetCommerceCart?.total_items,
    widgetCommerceCart?.cart?.items_count,
    widgetCommerceCart?.cart?.total_items,
    Array.isArray(widgetCommerceCart?.items) ? widgetCommerceCart.items.length : null,
    widgetCommerceHistory?.cart?.items_count,
    widgetCommerceHistory?.cart?.total_items,
    widgetCommerceSession?.cart?.items_count,
  );
  const effectiveCartCount = commerceCartCount > 0 ? commerceCartCount : cartCount;
  const hasPublishedCommercialCatalog = useMemo(() => {
    const catalog = widgetCommerceSession?.catalog;
    const primaryActions = widgetCommerceSession?.frontend_contract?.primary_actions;
    const catalogRequestedByContract =
      Array.isArray(primaryActions) && primaryActions.includes("catalog");
    const catalogEnabled =
      catalogRequestedByContract ||
      readOptionalBoolean(catalog?.enabled, false) ||
      readOptionalBoolean(catalogInfo?.enabled, false);
    const hasCatalogDestination = Boolean(
      readFirstString(
        catalog?.view_url,
        catalog?.url,
        catalog?.endpoint,
        catalogInfo?.view_url,
        catalogInfo?.url,
        catalogCard.viewUrl,
        catalogCard.downloadUrl,
      ),
    );

    return catalogEnabled && hasCatalogDestination;
  }, [catalogCard.downloadUrl, catalogCard.viewUrl, catalogInfo, widgetCommerceSession]);
  const shouldExposeCommerceControls =
    resolvedTipoChat !== "municipio" || hasPublishedCommercialCatalog;
  const entityDefaultRubro = useMemo(() => {
    if (!entityInfo) return null;

    const info: any = entityInfo;
    const bootstrapPayload =
      info?.chat_bootstrap?.payload ||
      info?.workspace?.chat_bootstrap?.payload ||
      {};
    const bootstrapQuery =
      info?.chat_bootstrap?.query ||
      info?.workspace?.chat_bootstrap?.query ||
      {};
    const rawRubro =
      bootstrapPayload?.rubro_clave ??
      bootstrapPayload?.rubro_key ??
      bootstrapPayload?.rubro_slug ??
      bootstrapPayload?.rubro ??
      bootstrapQuery?.rubro_clave ??
      bootstrapQuery?.rubro_key ??
      bootstrapQuery?.rubro_slug ??
      bootstrapQuery?.rubro ??
      info?.rubro_clave ??
      info?.rubroClave ??
      info?.rubro_nombre ??
      info?.rubroNombre ??
      info?.defaultRubro ??
      info?.rubro_default ??
      info?.rubro;

    const normalized = extractRubroKey(rawRubro);
    return normalized;
  }, [entityInfo]);
  const [a11yPrefs, setA11yPrefs] = useState<Prefs>(readAccessibilityPrefs);

  useEffect(() => {
    const handleStorage = () => {
      setA11yPrefs(readAccessibilityPrefs());
    };
    const handleAccessibilityChange = (event: Event) => {
      const detail = (event as CustomEvent<Prefs>).detail;
      setA11yPrefs(detail ?? readAccessibilityPrefs());
    };
    if (typeof window !== "undefined") {
      window.addEventListener("storage", handleStorage);
      window.addEventListener(ACCESSIBILITY_EVENT, handleAccessibilityChange as EventListener);
      return () => {
        window.removeEventListener("storage", handleStorage);
        window.removeEventListener(ACCESSIBILITY_EVENT, handleAccessibilityChange as EventListener);
      };
    }
  }, []);

  const lastOwnerTokenRef = useRef<string | null | undefined>(ownerToken);

  const widgetStore = useWidgetSessionStore();

  useEffect(() => {
    if (widgetStore.status === 'idle') {
      widgetStore.bootstrapWidget({ entityToken: ownerToken || undefined });
    }
  }, [widgetStore, ownerToken]);


  useEffect(() => {
    if (selectedRubro) {
      return;
    }

    const fallbackCandidate = initialRubro ?? entityDefaultRubro;
    const fallbackRubro =
      typeof fallbackCandidate === "string"
        ? fallbackCandidate.trim()
        : fallbackCandidate;

    const normalizedFallback = extractRubroKey(fallbackRubro);
    if (normalizedFallback) {
      setSelectedRubro(normalizedFallback);
    }
  }, [selectedRubro, initialRubro, entityDefaultRubro]);

  useEffect(() => {
    const trimmedInitial =
      typeof initialRubro === "string" ? initialRubro.trim() : null;

    const normalizedInitial = trimmedInitial ? extractRubroKey(trimmedInitial) : null;

    if (normalizedInitial) {
      if (selectedRubro !== normalizedInitial) {
        setSelectedRubro(normalizedInitial);
      }
    } else if (lastOwnerTokenRef.current !== ownerToken) {
      setSelectedRubro(null);
    }

    lastOwnerTokenRef.current = ownerToken;
  }, [ownerToken, initialRubro, selectedRubro]);

  const openUserPanel = useCallback(() => {
    if (user) {
      if (user.rol && user.rol !== 'usuario') {
        window.location.href = '/perfil';
      } else {
        setView('user');
      }
    } else if (entityInfo) {
      setView('info');
    } else {
      setView('login');
    }
  }, [user, entityInfo]);

  const buildMarketCartUrl = useCallback((slug?: string | null, baseUrl?: string | null) => {
    const safeSlug = slug?.trim();
    if (!safeSlug) return null;
    const path = `/${encodeURIComponent(safeSlug)}/productos`;

    try {
      if (baseUrl) {
        return new URL(path, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`).toString();
      }
      if (typeof window !== "undefined" && window.location?.origin) {
        return new URL(path, window.location.origin).toString();
      }
    } catch (error) {
      console.warn('[market] No se pudo componer la URL pública', error);
    }

    return path;
  }, []);

  const openCart = useCallback(
    (target: "cart" | "catalog" | "market" = "cart") => {
      const storedTenant = sanitizeTenantSlug(safeLocalStorage.getItem("tenantSlug"));
      const slug = sanitizeTenantSlug(commerceTenantSlug) ?? activeDemoTenantSlug ?? resolvedTenantSlug ?? storedTenant;

      if (!slug) {
        toast.error("No hay un tenant configurado para el carrito.");
        return;
      }

      if (target === "market" || target === "catalog") {
        const destination =
          readFirstString(
            widgetCommerceSession?.catalog?.view_url,
            widgetCommerceSession?.catalog?.url,
          ) || buildMarketCartUrl(slug, tenant?.public_base_url ?? null);
        if (!destination) {
          toast.error("No pudimos abrir el catálogo público.");
          return;
        }
        window.open(destination, "_blank");
        return;
      }

      const basePath = "/cart";

      const preferredUrl =
        readFirstString(widgetCommerceSession?.cart?.view_url, widgetCommerceSession?.cart?.url) ||
        tenant?.public_cart_url ||
        user?.publicCartUrl ||
        null;

      const authToken = authTokenState ?? safeLocalStorage.getItem("authToken") ?? safeLocalStorage.getItem("chatAuthToken");
      const guestCartAllowed = readOptionalBoolean(
        widgetCommerceSession?.cart?.allow_guest_cart ?? widgetCommerceSession?.session?.can_checkout_as_guest,
        true,
      );
      const requiresAuth = (target === "cart" && !guestCartAllowed) || requireCatalogAuth;
      const hasSession = Boolean(user && (authToken || hasPersistedClerkSession()));

      if (requiresAuth && !hasSession) {
        setPendingRedirect("cart");
        setView("login");
        setIsOpen(true);
        return;
      }

      const destination = preferredUrl
        ? preferredUrl
        : buildTenantNavigationUrl({
            basePath,
            tenantSlug: slug,
            tenant,
            preferredUrl,
            fallbackQueryParam: "tenant_slug",
          });

      window.open(destination, "_blank");
    },
    [
      authTokenState,
      activeDemoTenantSlug,
      buildMarketCartUrl,
      commerceTenantSlug,
      resolvedTenantSlug,
      requireCatalogAuth,
      tenant,
      user,
      widgetCommerceSession?.cart?.allow_guest_cart,
      widgetCommerceSession?.cart?.url,
      widgetCommerceSession?.cart?.view_url,
      widgetCommerceSession?.catalog?.url,
      widgetCommerceSession?.catalog?.view_url,
      widgetCommerceSession?.session?.can_checkout_as_guest,
    ]
  );

  const openPortal = useCallback(() => {
    if (isBackofficeUser) {
      toast.error("El portal es para usuarios finales vinculados por chat o WhatsApp.");
      return;
    }

    const storedTenant = sanitizeTenantSlug(safeLocalStorage.getItem("tenantSlug"));
    const slug = sanitizeTenantSlug(commerceTenantSlug) ?? activeDemoTenantSlug ?? resolvedTenantSlug ?? storedTenant;
    const authToken = authTokenState ?? safeLocalStorage.getItem("authToken") ?? safeLocalStorage.getItem("chatAuthToken");
    const hasSession = Boolean(user && (authToken || hasPersistedClerkSession()));
    const portalUrl = readFirstString(widgetCommerceSession?.portal?.url, widgetCommerceSession?.portal?.view_url);
    const portalHistoryEndpoint = readFirstString(
      widgetCommerceSession?.portal?.history_endpoint,
      widgetCommerceSession?.history?.endpoint,
      widgetCommerceSession?.history?.history_endpoint,
    );
    const primaryActions = widgetCommerceSession?.frontend_contract?.primary_actions;
    const portalRequestedByContract =
      Array.isArray(primaryActions) && primaryActions.includes("portal");
    const portalEnabledFlag = widgetCommerceSession?.portal?.enabled;
    const portalEnabled =
      portalEnabledFlag === undefined || portalEnabledFlag === null
        ? portalRequestedByContract
        : readOptionalBoolean(portalEnabledFlag, false);
    const hasPortalDestination = Boolean(portalUrl || portalHistoryEndpoint || slug);

    if (!slug || !portalEnabled || !hasPortalDestination) {
      toast.error("El portal de usuario no esta disponible para esta sesion.");
      return;
    }

    const requiresAccount =
      readOptionalBoolean(widgetCommerceSession?.portal?.requires_auth, false) ||
      readOptionalBoolean(widgetCommerceSession?.portal?.requires_login, false);

    if (requiresAccount && !hasSession) {
      setPendingRedirect("portal");
      setView("login");
      setIsOpen(true);
      return;
    }

    const destination =
      portalUrl ||
      (typeof window !== "undefined"
        ? new URL(`/portal/${encodeURIComponent(slug)}`, window.location.origin).toString()
        : buildTenantNavigationUrl({
            basePath: "/portal/dashboard",
            tenantSlug: slug,
            tenant,
            fallbackQueryParam: "tenant_slug",
          }));

    window.open(destination, "_blank");
  }, [
    activeDemoTenantSlug,
    authTokenState,
    commerceTenantSlug,
    isBackofficeUser,
    resolvedTenantSlug,
    tenant,
    user,
    widgetCommerceSession?.frontend_contract?.primary_actions,
    widgetCommerceSession?.history?.endpoint,
    widgetCommerceSession?.history?.history_endpoint,
    widgetCommerceSession?.portal?.enabled,
    widgetCommerceSession?.portal?.history_endpoint,
    widgetCommerceSession?.portal?.requires_auth,
    widgetCommerceSession?.portal?.requires_login,
    widgetCommerceSession?.portal?.url,
    widgetCommerceSession?.portal?.view_url,
  ]);

  const handleAuthSuccess = useCallback(() => {
    setAuthTokenState(
      safeLocalStorage.getItem("authToken") || safeLocalStorage.getItem("chatAuthToken") || null,
    );
    if (pendingRedirect === "cart") {
      setPendingRedirect(null);
      openCart();
      return;
    }
    if (pendingRedirect === "market") {
      setPendingRedirect(null);
      openCart("market");
      return;
    }
    if (pendingRedirect === "portal") {
      setPendingRedirect(null);
      openPortal();
      return;
    }
    setView("chat");
  }, [openCart, openPortal, pendingRedirect]);

  const toggleMuted = useCallback(() => {
    setMuted((m) => {
      const nv = !m;
      safeLocalStorage.setItem('chatboc_muted', nv ? '1' : '0');
      return nv;
    });
  }, []);

  const handleRubroSelect = useCallback((value: any) => {
    const normalized = extractRubroKey(value);
    setSelectedRubro(normalized ?? null);
  }, []);

  const handlePlatformSelection = useCallback(async (option: any) => {
    if (!option || typeof option !== "object") return;
    if (platformSelectionLoadingId) return;
    const optionId = String(option.id || option.sector || option.label || "platform_option");
    const normalizeSectorCandidate = (value: unknown) =>
      String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
    const sectorCandidate = [
      option.sector,
      option.pillar,
      option.id,
      option.key,
      option.label,
      option.title,
    ].map(normalizeSectorCandidate);
    const sector =
      sectorCandidate.some((value) => value.includes("educacion") || value.includes("coleg"))
        ? "educacion"
        : sectorCandidate.some((value) => value.includes("gobierno") || value.includes("municip"))
          ? "gobierno"
          : sectorCandidate.some((value) => value.includes("empresa") || value.includes("pyme") || value.includes("comerc"))
            ? "empresas"
            : typeof option.sector === "string"
              ? option.sector
              : undefined;
    const tenantSlug = typeof option.tenant_slug === "string" ? option.tenant_slug : undefined;
    const optionPayload = isPlainRecord(option.payload) ? option.payload : {};
    const rubro = extractRubroKey(
      readFirstString(
        option.rubro,
        option.slug,
        option.value,
        optionPayload.rubro,
        optionPayload.rubro_slug,
        optionPayload.rubro_key,
      ),
    ) || (typeof tenantSlug === "string" ? tenantSlug : undefined);
    const isRubroSelectorStep =
      entityInfo?.onboarding?.mode === "demo_rubro_selector" ||
      entityInfo?.widget_onboarding?.status === "select_rubro" ||
      entityInfo?.frontend_contract?.next_step === "select_rubro";
    const isPlatformSectorSelector =
      entityInfo?.onboarding?.mode === "platform_sector_selector" ||
      entityInfo?.tenant?.tipo === "platform" ||
      entityInfo?.tenant?.slug === "chatboc-platform";
    setPlatformSelectionLoadingId(optionId);
    setPlatformSelectionError(null);
    setWidgetCommerceSession(null);
    setWidgetCommerceHistory(null);
    setWidgetCommerceCart(null);
    clearWidgetRuntimeCacheForTenantSwitch();
    clearDemoRuntimeStorage();
    try {
      const label = readFirstString(option.label, option.title, option.name, option.sector, sector);
      const chatSessionIdForDemo = resetChatSessionId();
      const sessionPayload = isPlatformSectorSelector || isRubroSelectorStep
        ? {
            surface: "widget",
            source: isRubroSelectorStep ? "landing_widget_rubro_selector" : "landing_widget_selector",
            sector: isRubroSelectorStep ? "empresas" : sector,
            label,
            ...(isRubroSelectorStep && rubro ? { rubro } : {}),
            anon_id: getOrCreateAnonId() || null,
            chat_session_id: chatSessionIdForDemo || null,
          }
        : {
            sector,
            tenant_slug: tenantSlug || null,
            rubro,
          };
      const session = await createDemoSession(sessionPayload, {
        strictSelection: !isPlatformSectorSelector,
      });
      const workspace = session.workspace || {};
      if (isRubroSelectionDemoSession(session)) {
        const selector = getSessionRubroSelector(session);
        const rubroOptions = normalizeRubroSelectorOptions(selector);
        const nextInfo = {
          ...(entityInfo || {}),
          ...workspace,
          tenant: entityInfo?.tenant || session.tenant || null,
          slug: entityInfo?.slug || null,
          tenant_slug: null,
          tipo_chat: "pyme",
          chat_bootstrap: null,
          quick_menu: rubroOptions,
          onboarding: {
            ...(entityInfo?.onboarding || {}),
            ...(session.widget_onboarding || {}),
            mode: "demo_rubro_selector",
            title:
              readFirstString((selector as any)?.title, session.widget_onboarding?.title, entityInfo?.onboarding?.title) ||
              entityInfo?.onboarding?.title ||
              null,
            entry_question:
              readFirstString(
                (selector as any)?.entry_question,
                (selector as any)?.question,
                (selector as any)?.label,
                session.widget_onboarding?.entry_question,
                entityInfo?.onboarding?.entry_question,
              ) || entityInfo?.onboarding?.entry_question || null,
            quick_menu: rubroOptions,
          },
          widget_onboarding: session.widget_onboarding || null,
          frontend_contract: session.frontend_contract || null,
          rubro_selector: selector,
        };
        setEntityInfo(nextInfo);
        setActiveDemoTenantSlug(null);
        setSelectedRubro(null);
        setResolvedTipoChat("pyme");
        return;
      }
      const demoTenantSlug =
        session.tenant?.slug || session.tenant_slug || session.session?.tenant_slug || (!isPlatformSectorSelector ? tenantSlug : null) || null;
      const demoChatSessionId =
        session.session?.chat_session_id || session.chat_session_id || workspace.chat_bootstrap?.session?.chat_session_id || null;
      if (demoChatSessionId) {
        persistChatSessionId(demoChatSessionId);
      }
      const bootstrapPayload = workspace.chat_bootstrap?.payload || {};
      const backendRubro = extractRubroKey(
        bootstrapPayload.rubro_clave ||
          bootstrapPayload.rubro ||
          workspace.rubro_clave ||
          workspace.rubro ||
          rubro,
      );
      const nextTipo =
        bootstrapPayload.tipo_chat === "municipio" ||
        session.tenant?.tipo === "municipio" ||
        sector === "gobierno"
          ? "municipio"
          : "pyme";
      const workspaceActionMenu = readWorkspaceActionMenu(workspace, sector, backendRubro || rubro);
      const primaryDefaultMenu = pickMenuSource(
        workspaceActionMenu,
        workspace.default_menu,
        workspace.chat_bootstrap?.default_menu,
        session.widget_onboarding?.default_menu,
        workspace.quick_menu,
        workspace.quick_replies,
      );
      const primaryQuickMenu = workspaceActionMenu.length
        ? workspaceActionMenu
        : Array.isArray((workspace.default_menu as any)?.items)
          ? (workspace.default_menu as any).items
          : Array.isArray(workspace.quick_menu)
            ? workspace.quick_menu
            : Array.isArray(workspace.quick_replies)
              ? workspace.quick_replies
              : workspaceActionMenu;
      const nextInfo = {
        ...(entityInfo || {}),
        ...workspace,
        tenant: session.tenant || entityInfo?.tenant || null,
        slug: demoTenantSlug || entityInfo?.slug || null,
        tenant_slug: demoTenantSlug,
        nombre_empresa: workspace.title || session.tenant?.nombre || entityInfo?.nombre_empresa || "Chatboc",
        tipo_chat: nextTipo,
        rubro: backendRubro || rubro || entityInfo?.rubro || null,
        rubro_clave: backendRubro || rubro || entityInfo?.rubro_clave || null,
        default_menu: primaryDefaultMenu,
        quick_menu: primaryQuickMenu,
        rubro_context: workspace.rubro_context || null,
        onboarding: {
          ...(entityInfo?.onboarding || {}),
          mode: "demo_session",
        },
        ui_hints: entityInfo?.ui_hints || null,
        chat_bootstrap: workspace.chat_bootstrap || session.chat_bootstrap || null,
        widget_onboarding: session.widget_onboarding || null,
        experience_blueprint: workspace.experience_blueprint || entityInfo?.experience_blueprint || null,
        first_visit: workspace.first_visit || entityInfo?.first_visit || null,
        sample_conversations: workspace.sample_conversations || entityInfo?.sample_conversations || [],
        trust_signals: workspace.trust_signals || entityInfo?.trust_signals || [],
        lead_capture: workspace.lead_capture || entityInfo?.lead_capture || null,
        media_capabilities: workspace.media_capabilities || entityInfo?.media_capabilities || null,
        conversion_ctas: workspace.conversion_ctas || entityInfo?.conversion_ctas || null,
        animation_tokens: workspace.animation_tokens || entityInfo?.animation_tokens || null,
        empty_states: workspace.empty_states || entityInfo?.empty_states || null,
        rubro_tools:
          workspace.rubro_tools ||
          workspace.business_tools ||
          workspace.operational_tools ||
          workspace.tools ||
          workspace.toolkit ||
          null,
      };
      setEntityInfo(nextInfo);
      setActiveDemoTenantSlug(demoTenantSlug);
      setSelectedRubro(backendRubro ?? extractRubroKey(rubro) ?? null);
      setResolvedTipoChat(nextTipo);
      setChatPanelResetKey((current) => current + 1);
    } catch (error) {
      setPlatformSelectionError(
        getErrorMessage(error, "No pudimos iniciar esta demo real. Reintentá en unos minutos."),
      );
    } finally {
      setPlatformSelectionLoadingId(null);
    }
  }, [entityInfo, platformSelectionLoadingId]);

  const [viewport, setViewport] = useState({
    width: typeof window !== "undefined" ? window.innerWidth : 0,
    height: typeof window !== "undefined" ? window.innerHeight : 0,
  });

  useEffect(() => {
    const onResize = () =>
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (mode !== "standalone" || typeof document === "undefined") return;
    const shouldLockPage = isOpen && isMobileView;
    document.documentElement.classList.toggle("chatboc-widget-open", shouldLockPage);
    document.body.classList.toggle("chatboc-widget-open", shouldLockPage);
    return () => {
      document.documentElement.classList.remove("chatboc-widget-open");
      document.body.classList.remove("chatboc-widget-open");
    };
  }, [isOpen, isMobileView, mode]);

  const finalOpenWidth = useMemo(() => {
    const desired = readCssPixelValue(openWidth);
    if (mode === "iframe") {
      if (desired === null) return openWidth;
      if (viewport.width >= 320) {
        return `${Math.min(desired, viewport.width)}px`;
      }
      return `${desired}px`;
    }
    if (isMobileView) {
      return "100dvw";
    }
    const max = viewport.width - (initialPosition.right || 0) - 16;
    return desired !== null && viewport.width
      ? `${Math.min(desired, max)}px`
      : openWidth;
  }, [isMobileView, mode, openWidth, viewport.width, initialPosition.right]);

  const finalOpenHeight = useMemo(() => {
    // Determine the desired height
    const desired = readCssPixelValue(openHeight);
    const heightToUse = desired ?? 680;

    if (mode === 'iframe') {
      if (desired === null) return openHeight;
      if (viewport.height >= 360) {
        return `${Math.min(heightToUse, viewport.height)}px`;
      }
      return `${heightToUse}px`;
    }

    if (isMobileView) {
      return "calc(100dvh - max(4.5rem, env(safe-area-inset-top)) - 0.75rem)";
    }

    // In Standalone mode (Landing page), use aggressive height
    const max = viewport.height - (initialPosition.bottom || 0) - 16;

    // Ensure it doesn't exceed 90vh (increased from 85vh) to allow more vertical space
    const maxHeightVh = viewport.height * 0.90;
    const effectiveMax = Math.min(max, maxHeightVh);

    // If "chatito chiquito" issue persists, ensure we default to a reasonable minimum if openHeight is invalid
    // If calculating against viewport, make sure we at least respect the requested height if viewport is weirdly small (unless mobile)
    // UPDATE: To solve "chatito chiquito", we prioritize the larger size if space permits.
    const finalHeight = viewport.height ? Math.min(heightToUse, effectiveMax) : heightToUse;

    return `${finalHeight}px`;
  }, [openHeight, viewport.height, initialPosition.bottom, mode, isMobileView]);

  const finalClosedWidth = closedWidth;
  const finalClosedHeight = closedHeight;
  const isTabletView = viewport.width >= 640 && viewport.width < 1024;
  const closedOffsetBottom = isMobileView ? 16 : isTabletView ? 20 : initialPosition.bottom;
  const closedOffsetRight = isMobileView ? 16 : isTabletView ? 20 : initialPosition.right;
  const launcherSize = isMobileView ? "56px" : isTabletView ? "60px" : finalClosedWidth;
  const launcherHeight = isMobileView ? "56px" : isTabletView ? "60px" : finalClosedHeight;
  const avoidsPortalBottomNavigation =
    mode === "standalone" &&
    !isOpen &&
    viewport.width > 0 &&
    viewport.width < MOBILE_PORTAL_NAV_BREAKPOINT_PX &&
    isUserPortalSurfacePath(location.pathname);

  const commonPanelStyles = cn("chat-root bg-card border shadow-lg", "flex flex-col overflow-hidden");
  const commonButtonStyles = cn(
    "chatboc-toggle-btn rounded-full flex items-center justify-center",
    "transition-transform duration-200 ease-out",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
  );

  const launcherAssetSrc = CHATBOC_WIDGET_STATIC;

  useEffect(() => {
    setLauncherImageSrc(launcherAssetSrc);
  }, [launcherAssetSrc]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreference = () => setPrefersReducedMotion(mediaQuery.matches);
    syncPreference();
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", syncPreference);
      return () => mediaQuery.removeEventListener("change", syncPreference);
    }
    mediaQuery.addListener(syncPreference);
    return () => mediaQuery.removeListener(syncPreference);
  }, []);

  const sendStateMessageToParent = useCallback(
    (open: boolean) => {
      if (mode === "iframe" && typeof window !== "undefined" && window.parent !== window && widgetId) {
        const dims = open
          ? { width: finalOpenWidth, height: finalOpenHeight }
          : { width: launcherSize, height: launcherHeight };

        window.parent.postMessage(
          { type: "chatboc-state-change", widgetId, dimensions: dims, isOpen: open },
          "*"
        );
      }
    },
    [mode, widgetId, finalOpenWidth, finalOpenHeight, launcherSize, launcherHeight]
  );

  useEffect(() => {
    if (mode === "iframe" && typeof window !== "undefined" && window.parent !== window && widgetId) {
      window.parent.postMessage({ type: "chatboc-ready", widgetId }, "*");
    }
  }, [mode, widgetId]);

  useEffect(() => {
    sendStateMessageToParent(isOpen);
    if (isOpen) {
      setShowProactiveBubble(false);
      if (proactiveMessageTimeoutRef.current) clearTimeout(proactiveMessageTimeoutRef.current);
      if (hideProactiveBubbleTimeoutRef.current) clearTimeout(hideProactiveBubbleTimeoutRef.current);
    }
  }, [isOpen, sendStateMessageToParent]);

  useEffect(() => {
    if (isOpen) {
      sendStateMessageToParent(true);
    }
  }, [viewport, isOpen, sendStateMessageToParent]);

  useEffect(() => {
    if (isOpen || mode === 'standalone' || proactiveMessages.length === 0) {
      if (proactiveMessageTimeoutRef.current) clearTimeout(proactiveMessageTimeoutRef.current);
      if (hideProactiveBubbleTimeoutRef.current) clearTimeout(hideProactiveBubbleTimeoutRef.current);
      setShowProactiveBubble(false);
      return;
    }
    if (proactiveMessageTimeoutRef.current) clearTimeout(proactiveMessageTimeoutRef.current);
    if (hideProactiveBubbleTimeoutRef.current) clearTimeout(hideProactiveBubbleTimeoutRef.current);

    const alreadyShownProactive = safeLocalStorage.getItem("proactive_bubble_session_shown") === "1";
    if (alreadyShownProactive) return;

    proactiveMessageTimeoutRef.current = setTimeout(() => {
      const nextMessage = proactiveMessages[proactiveCycle % proactiveMessages.length];
      if (!nextMessage) return;
      setProactiveMessage(nextMessage);
      setShowProactiveBubble(true);

      safeLocalStorage.setItem("proactive_bubble_session_shown", "1");

      hideProactiveBubbleTimeoutRef.current = setTimeout(() => {
        setShowProactiveBubble(false);
        setProactiveCycle(prev => prev + 1);
      }, 7000);

    }, 10000);

    return () => {
      if (proactiveMessageTimeoutRef.current) clearTimeout(proactiveMessageTimeoutRef.current);
      if (hideProactiveBubbleTimeoutRef.current) clearTimeout(hideProactiveBubbleTimeoutRef.current);
    };
  }, [isOpen, proactiveCycle, mode, proactiveMessages]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = event.data as unknown;

      // Ignore extension/background noise (e.g. MetaMask inpage bridge chatter)
      if (data && typeof data === 'object') {
        const target = String((data as Record<string, unknown>).target || '');
        if (target === 'inpage' || target === 'contentscript' || target.startsWith('metamask-')) {
          return;
        }
      }

      // In iframe mode only accept messages from parent window.
      if (mode === 'iframe' && window.parent !== window && event.source !== window.parent) {
        return;
      }

      if (!data) return;

      // Only process known message shapes; ignore unknown payloads early.
      const isObjectPayload = typeof data === 'object';
      const type = isObjectPayload ? (data as Record<string, unknown>).type : data;
      if (
        type !== 'OPEN_CHAT' &&
        type !== 'OPEN_CHAT_WITH_CONTEXT' &&
        type !== 'TOGGLE_CHAT' &&
        type !== 'SET_VIEW' &&
        data !== 'OPEN_CHAT'
      ) {
        return;
      }

      // Allow generic OPEN_CHAT even if widgetId doesn't match perfectly if it's a global signal
      if (data === "OPEN_CHAT" || (isObjectPayload && (data as Record<string, unknown>).type === "OPEN_CHAT")) {
          setIsOpen(true);
          return;
      }

      if (isObjectPayload && (data as Record<string, unknown>).type === "OPEN_CHAT_WITH_CONTEXT") {
          const payload = data as Record<string, unknown>;
          const tenantSlug = payload.tenantSlug;
          const tipoChat = payload.tipoChat;
          const context = payload.context;
          console.log("ChatWidget: Received context override", payload);

          if (typeof tenantSlug === 'string' && tenantSlug.trim()) {
              setContextOverride((prev: any) => ({ ...prev, tenantSlug: tenantSlug.trim() }));
          } else if (Object.prototype.hasOwnProperty.call(payload, 'tenantSlug')) {
              setContextOverride((prev: any) => {
                if (!prev?.tenantSlug) return prev;
                const { tenantSlug: _tenantSlug, ...rest } = prev;
                return Object.keys(rest).length ? rest : null;
              });
          }
          if (tipoChat === 'municipio' || tipoChat === 'pyme') {
              setResolvedTipoChat(tipoChat);
          }
          if (context && typeof context === 'object') {
              try {
                  safeLocalStorage.setItem('chatboc_public_chat_context', JSON.stringify({
                      ...(context as Record<string, unknown>),
                      tenantSlug: typeof tenantSlug === 'string' ? tenantSlug.trim() : undefined,
                      tipoChat: tipoChat === 'municipio' || tipoChat === 'pyme' ? tipoChat : undefined,
                      updatedAt: new Date().toISOString(),
                  }));
              } catch (storageError) {
                  console.warn('ChatWidget: No se pudo persistir el contexto público del chat', storageError);
              }
          }

          setIsOpen(true);
          return;
      }

      if (!isObjectPayload) return;

      const payload = data as Record<string, unknown>;

      if (payload.widgetId !== widgetId) return;

      if (payload.type === "TOGGLE_CHAT") {
        setIsOpen(Boolean(payload.isOpen));
      } else if (payload.type === "SET_VIEW") {
        const v = payload.view;
        if (typeof v === "string" && ['chat', 'register', 'login', 'user', 'info'].includes(v)) {
          setView(v as any);
        }
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [widgetId, mode]);

  useEffect(() => {
    if (!ctaMessage || isOpen || showProactiveBubble) {
      setShowCta(false);
      return;
    }
    if (safeLocalStorage.getItem("cta_seen") === "1") return;
    const delay = setTimeout(() => {
      setShowCta(true);
      const hide = setTimeout(() => setShowCta(false), 8000);
      safeLocalStorage.setItem("cta_seen", "1");
      return () => clearTimeout(hide);
    }, 2500);
    return () => clearTimeout(delay);
  }, [ctaMessage, isOpen, showProactiveBubble]);


  useEffect(() => {
    if (entityInfo?.default_open && !isOpen && !safeLocalStorage.getItem('widget_manually_closed')) {
        setIsOpen(true);
    }
  }, [entityInfo, isOpen]);

  useEffect(() => {
    async function fetchEntityProfile() {
      if (resolvedTenantSlug) {
        setProfileLoading(true);
        setProfileError(null);
        try {
          if (resolvedTenantSlug) {
             try {
                const rawPublicConfig = await tenantService.getPublicWidgetConfig(resolvedTenantSlug);
                const publicConfigBase =
                  rawPublicConfig && typeof rawPublicConfig === 'object'
                    ? (rawPublicConfig as Record<string, any>)
                    : {};
                const publicConfig: Record<string, any> = {
                  ...publicConfigBase,
                  cta_messages: Array.isArray((rawPublicConfig as any)?.cta_messages) ? (rawPublicConfig as any).cta_messages : [],
                  theme: (rawPublicConfig as any)?.theme && typeof (rawPublicConfig as any).theme === 'object' ? (rawPublicConfig as any).theme : {},
                  features: (rawPublicConfig as any)?.features && typeof (rawPublicConfig as any).features === 'object' ? (rawPublicConfig as any).features : {},
                };
                const inferredTipoChat = (() => {
                    if (publicConfig.tipo_chat === 'municipio' || publicConfig.tipo_chat === 'pyme') return publicConfig.tipo_chat;
                    if (publicConfig.type === 'municipio' || publicConfig.type === 'pyme') return publicConfig.type;
                    if (publicConfig.tipo === 'municipio' || publicConfig.tipo === 'pyme') return publicConfig.tipo;
                    if (typeof publicConfig.es_publico === 'boolean') return publicConfig.es_publico ? 'municipio' : 'pyme';
                    const rubroCandidate = publicConfig.rubro || publicConfig.rubro_publico || publicConfig.public_rubro;
                    if (rubroCandidate) return esRubroPublico(rubroCandidate) ? 'municipio' : 'pyme';
                    return tipoChat || 'pyme';
                })();

                const experienceBlueprint =
                  publicConfig.experience_blueprint ||
                  publicConfig.builder_config?.experience_blueprint ||
                  publicConfig.widget?.experience_blueprint ||
                  publicConfig.widget?.builder_config?.experience_blueprint ||
                  null;
                const publicConfigActionMenu = mergeActionMenus(
                  readWorkspaceActionMenu(publicConfig, inferredTipoChat, publicConfig.rubro || publicConfig.rubro_slug),
                  readWorkspaceActionMenu(publicConfig.builder_config, inferredTipoChat, publicConfig.rubro || publicConfig.rubro_slug),
                  readWorkspaceActionMenu(publicConfig.widget, inferredTipoChat, publicConfig.rubro || publicConfig.rubro_slug),
                  readWorkspaceActionMenu(publicConfig.widget?.builder_config, inferredTipoChat, publicConfig.rubro || publicConfig.rubro_slug),
                  publicConfig.onboarding?.quick_menu,
                  publicConfig.builder_config?.quick_menu,
                  publicConfig.widget?.quick_menu,
                  publicConfig.widget?.builder_config?.quick_menu,
                );
                const info = {
                    ...publicConfig,
                    // Priority Merge: Props > Backend Config
                    nombre_empresa: welcomeTitle || publicConfig.tenant_name || publicConfig.name || publicConfig.nombre,
                    logo_url: headerLogoUrl || customLauncherLogoUrl || publicConfig.logo_url || publicConfig.avatar_url,
                    cta_messages: ctaMessage ? [{ text: ctaMessage }] : (Array.isArray(publicConfig.cta_messages) ? publicConfig.cta_messages : []),
                    theme_config: publicConfig.theme_config || {},
                    default_open: (typeof defaultOpen === 'boolean') ? defaultOpen : publicConfig.default_open,
                    slug: resolvedTenantSlug,
                    tipo_chat: inferredTipoChat,
                    quick_menu: publicConfigActionMenu,
                    education:
                      publicConfig.education ||
                      publicConfig.builder_config?.education ||
                      publicConfig.widget?.education ||
                      publicConfig.widget?.builder_config?.education ||
                      null,
                    experience_blueprint: experienceBlueprint,
                    first_visit:
                      publicConfig.first_visit ||
                      publicConfig.builder_config?.first_visit ||
                      publicConfig.widget?.first_visit ||
                      publicConfig.widget?.builder_config?.first_visit ||
                      experienceBlueprint?.first_visit ||
                      null,
                    sample_conversations:
                      publicConfig.sample_conversations ||
                      publicConfig.builder_config?.sample_conversations ||
                      publicConfig.widget?.sample_conversations ||
                      publicConfig.widget?.builder_config?.sample_conversations ||
                      publicConfig.chat_seed?.sample_conversations ||
                      publicConfig.widget?.chat_seed?.sample_conversations ||
                      experienceBlueprint?.sample_conversations ||
                      [],
                    trust_signals:
                      publicConfig.trust_signals ||
                      publicConfig.builder_config?.trust_signals ||
                      publicConfig.widget?.trust_signals ||
                      publicConfig.widget?.builder_config?.trust_signals ||
                      experienceBlueprint?.trust_signals ||
                      [],
                    lead_capture:
                      publicConfig.lead_capture ||
                      publicConfig.builder_config?.lead_capture ||
                      publicConfig.widget?.lead_capture ||
                      publicConfig.widget?.builder_config?.lead_capture ||
                      experienceBlueprint?.lead_capture ||
                      null,
                    media_capabilities:
                      publicConfig.media_capabilities ||
                      publicConfig.builder_config?.media_capabilities ||
                      publicConfig.widget?.media_capabilities ||
                      publicConfig.widget?.builder_config?.media_capabilities ||
                      experienceBlueprint?.media_capabilities ||
                      null,
                    conversion_ctas:
                      publicConfig.conversion_ctas ||
                      publicConfig.builder_config?.conversion_ctas ||
                      publicConfig.widget?.conversion_ctas ||
                      publicConfig.widget?.builder_config?.conversion_ctas ||
                      experienceBlueprint?.conversion_ctas ||
                      null,
                    animation_tokens:
                      publicConfig.animation_tokens ||
                      publicConfig.builder_config?.animation_tokens ||
                      publicConfig.widget?.animation_tokens ||
                      publicConfig.widget?.builder_config?.animation_tokens ||
                      experienceBlueprint?.animation_tokens ||
                      null,
                    empty_states:
                      publicConfig.empty_states ||
                      publicConfig.builder_config?.empty_states ||
                      publicConfig.widget?.empty_states ||
                      publicConfig.widget?.builder_config?.empty_states ||
                      experienceBlueprint?.empty_states ||
                      null,
                };

                if (!ownerToken && !publicConfig.widget_token && !publicConfig.entity_token) {
                  console.warn("ChatWidget: widget-config sin token explícito; se usará tenant_slug como contexto público.");
                }

                setEntityInfo(info);
                setWidgetUx(resolveWidgetUxConfig(publicConfig, inferredTipoChat));
                if (info.tipo_chat) {
                    setResolvedTipoChat(info.tipo_chat === 'municipio' ? 'municipio' : 'pyme');
                }
             } catch (err) {
                console.warn("Failed to fetch public widget config; trying ownerToken profile if available", err);

                  // If the public config is unavailable, keep the widget in a degraded no-content state.
                  const is500 = (err as any)?.status === 500 || (err as any)?.statusCode === 500;

                  if (is500 || !ownerToken) {
                     applyWidgetFallbackProfile();
                  } else if (ownerToken) {
                     const data = await apiFetch<any>("/perfil", {
                      entityToken: ownerToken,
                      isWidgetRequest: true,
                    });
                    if (data && typeof data.esPublico === "boolean") {
                      setResolvedTipoChat(data.esPublico ? "municipio" : "pyme");
                    } else if (data && data.tipo_chat) {
                      setResolvedTipoChat(data.tipo_chat === "municipio" ? "municipio" : "pyme");
                    }
                    setEntityInfo(data);
                  } else {
                      applyWidgetFallbackProfile();
                  }
             }
          } else if (ownerToken) {
             const data = await apiFetch<any>("/perfil", {
              entityToken: ownerToken,
              isWidgetRequest: true,
            });
            if (data && typeof data.esPublico === "boolean") {
              setResolvedTipoChat(data.esPublico ? "municipio" : "pyme");
            } else if (data && data.tipo_chat) {
              setResolvedTipoChat(data.tipo_chat === "municipio" ? "municipio" : "pyme");
            }
            setEntityInfo(data);
          }
        } catch (e) {
          console.error("ChatWidget: Error al obtener el perfil de la entidad:", e);
          applyWidgetFallbackProfile();
        } finally {
          setProfileLoading(false);
        }
        return;
      }

      if (!ownerToken) {
        const rawPlatformConfig = await tenantService.getPlatformWidgetConfig().catch((error) => {
          console.warn("ChatWidget: no se pudo cargar widget-config plataforma.", error);
          return null;
        });
        const publicConfig: any = normalizePlatformWidgetConfig(rawPlatformConfig);
        if (!publicConfig) {
          applyWidgetFallbackProfile();
          setProfileLoading(false);
          return;
        }
        const platformTenant = publicConfig.tenant || {};
        const platformActionMenu = mergeActionMenus(
          readWorkspaceActionMenu(publicConfig, "pyme", publicConfig.rubro || publicConfig.rubro_slug),
          readWorkspaceActionMenu(publicConfig.builder_config, "pyme", publicConfig.rubro || publicConfig.rubro_slug),
          readWorkspaceActionMenu(publicConfig.widget, "pyme", publicConfig.rubro || publicConfig.rubro_slug),
          readWorkspaceActionMenu(publicConfig.widget?.builder_config, "pyme", publicConfig.rubro || publicConfig.rubro_slug),
          publicConfig.onboarding?.quick_menu,
        );
        setEntityInfo({
          ...publicConfig,
          nombre_empresa: welcomeTitle || publicConfig.tenant_name || platformTenant.nombre || publicConfig.name || publicConfig.nombre || "Chatboc",
          logo_url: headerLogoUrl || customLauncherLogoUrl || publicConfig.logo_url || publicConfig.avatar_url || getChatbocBotAvatar(isDarkMode),
          cta_messages: ctaMessage ? [{ text: ctaMessage }] : (Array.isArray(publicConfig.cta_messages) ? publicConfig.cta_messages : []),
          theme_config: publicConfig.theme_config || {},
          default_open: (typeof defaultOpen === 'boolean') ? defaultOpen : publicConfig.default_open,
          slug: platformTenant.slug || publicConfig.slug || "chatboc-platform",
          tipo_chat: "pyme",
          quick_menu: platformActionMenu,
          onboarding: publicConfig.onboarding || null,
          ui_hints: publicConfig.ui_hints || null,
          realtime: publicConfig.realtime || publicConfig.widget?.realtime || null,
          support_channels: publicConfig.support_channels || publicConfig.widget?.support_channels || null,
          media_capabilities: publicConfig.media_capabilities || publicConfig.builder_config?.media_capabilities || publicConfig.widget?.media_capabilities || null,
          conversion_ctas: publicConfig.conversion_ctas || publicConfig.builder_config?.conversion_ctas || publicConfig.widget?.conversion_ctas || null,
          animation_tokens: publicConfig.animation_tokens || publicConfig.builder_config?.animation_tokens || publicConfig.widget?.animation_tokens || null,
          empty_states: publicConfig.empty_states || publicConfig.builder_config?.empty_states || publicConfig.widget?.empty_states || null,
        });
        setWidgetUx(resolveWidgetUxConfig(publicConfig, "pyme"));
        setResolvedTipoChat("pyme");
        setProfileLoading(false);
        return;
        console.log("ChatWidget: No hay ownerToken, se asume configuración por defecto.");
        setProfileLoading(false);
        return;
      }

      setProfileLoading(true);
      setProfileError(null);
      console.log("ChatWidget: Intentando obtener perfil con token:", ownerToken);

      try {
        const data = await apiFetch<any>("/perfil", {
          entityToken: ownerToken,
          isWidgetRequest: true,
        });
        console.log("ChatWidget: Perfil recibido:", data);
        if (data && typeof data.esPublico === "boolean") {
          setResolvedTipoChat(data.esPublico ? "municipio" : "pyme");
        } else if (data && data.tipo_chat) {
          setResolvedTipoChat(data.tipo_chat === "municipio" ? "municipio" : "pyme");
        }
        setEntityInfo(data);
      } catch (e) {
        console.error("ChatWidget: Error al obtener el perfil de la entidad:", e);
        applyWidgetFallbackProfile();
      } finally {
        setProfileLoading(false);
      }
    }
    fetchEntityProfile();
  }, [ownerToken, resolvedTenantSlug]);

  useEffect(() => {
    let isActive = true;
    const loadCatalogInfo = async () => {
      const isDemoSession = entityInfo?.onboarding?.mode === "demo_session";
      const isPlatformTenant = chatTenantSlug === "chatboc-platform";
      if (!chatTenantSlug || isDemoSession || isPlatformTenant) {
        setCatalogInfo(null);
        return;
      }
      try {
        const catalog = await apiClient.publicGetCatalog(chatTenantSlug);
        if (isActive) {
          setCatalogInfo(catalog);
        }
      } catch (error) {
        console.warn("Failed to load catalog info", error);
        if (isActive) {
          setCatalogInfo(null);
        }
      }
    };
    loadCatalogInfo();
    return () => {
      isActive = false;
    };
  }, [chatTenantSlug, entityInfo?.onboarding?.mode]);

  useEffect(() => {
    let isActive = true;
    const tenantSlug = sanitizeTenantSlug(chatTenantSlug);
    const widgetToken = resolveWidgetTokenForTenant(resolvedOwnerToken, tenantSlug);
    const isPlatformTenant = tenantSlug === "chatboc-platform";
    const isDemoSession = entityInfo?.onboarding?.mode === "demo_session";

      if (isDemoSession || ((!tenantSlug || isPlatformTenant) && !widgetToken)) {
        setWidgetCommerceSession(null);
        setWidgetCommerceHistory(null);
        setWidgetCommerceCart(null);
        return;
      }

    const request = {
      tenantSlug: tenantSlug && !isPlatformTenant ? tenantSlug : null,
      widgetToken,
      chatSessionId: getOrCreateChatSessionId(),
      anonId: getOrCreateAnonId(),
    };

    const loadCommerceSession = (activeRequest: typeof request, retried = false): Promise<void> =>
      getWidgetCommerceSession(activeRequest)
      .then((session) => {
        if (!isActive) return;
        if (!responseMatchesTenant(session, tenantSlug)) {
          if (!retried && activeRequest.widgetToken) {
            clearCachedWidgetToken();
            return loadCommerceSession({ ...activeRequest, widgetToken: null }, true);
          }
          setWidgetCommerceSession(null);
          setWidgetCommerceHistory(null);
          setWidgetCommerceCart(null);
          return;
        }
        if (session?.session?.chat_session_id) {
          persistChatSessionId(session.session.chat_session_id);
        }
        setWidgetCommerceSession(session);
      });

    loadCommerceSession(request)
      .catch(() => {
        if (!isActive) return;
        setWidgetCommerceSession(null);
        setWidgetCommerceHistory(null);
        setWidgetCommerceCart(null);
      });

    return () => {
      isActive = false;
    };
  }, [chatTenantSlug, entityInfo?.onboarding?.mode, resolvedOwnerToken]);

  useEffect(() => {
    let isActive = true;
    const isDemoSession = entityInfo?.onboarding?.mode === "demo_session";
    if (isDemoSession) {
      setWidgetCommerceHistory(null);
      return () => {
        isActive = false;
      };
    }
    const historyEndpoint = readFirstString(
      widgetCommerceSession?.portal?.history_endpoint,
      widgetCommerceSession?.history?.history_endpoint,
      widgetCommerceSession?.history?.endpoint,
    );
    const tenantSlug = sanitizeTenantSlug(commerceTenantSlug);
    const widgetToken = resolveWidgetTokenForTenant(resolvedOwnerToken, tenantSlug);

    if (!historyEndpoint && !tenantSlug && !widgetToken) {
      setWidgetCommerceHistory(null);
      return;
    }

    const historyRequest = {
      tenantSlug,
      widgetToken,
      chatSessionId: getOrCreateChatSessionId(),
      anonId: getOrCreateAnonId(),
      widgetSessionToken: widgetCommerceSession?.session?.widget_session_token || null,
    };
    const loadTenantHistory = (activeRequest: typeof historyRequest, retried = false): Promise<void> =>
      getWidgetTenantHistory(historyEndpoint || null, activeRequest)
      .then((history) => {
        if (isActive) {
          if (!responseMatchesTenant(history, tenantSlug)) {
            if (!retried && activeRequest.widgetToken) {
              clearCachedWidgetToken();
              return loadTenantHistory({ ...activeRequest, widgetToken: null }, true);
            }
            setWidgetCommerceHistory(null);
            return;
          }
          if (history?.session?.chat_session_id) {
            persistChatSessionId(history.session.chat_session_id);
          }
          setWidgetCommerceHistory(history);
        }
      });

    loadTenantHistory(historyRequest)
      .catch(() => {
        if (isActive) setWidgetCommerceHistory(null);
      });

    return () => {
      isActive = false;
    };
  }, [
    commerceTenantSlug,
    resolvedOwnerToken,
    widgetCommerceSession?.history?.endpoint,
    widgetCommerceSession?.history?.history_endpoint,
    widgetCommerceSession?.portal?.history_endpoint,
    widgetCommerceSession?.session?.widget_session_token,
    entityInfo?.onboarding?.mode,
  ]);

  useEffect(() => {
    let isActive = true;
    const isDemoSession = entityInfo?.onboarding?.mode === "demo_session";
    if (isDemoSession) {
      setWidgetCommerceCart(null);
      return () => {
        isActive = false;
      };
    }
    const cartEndpoint = readFirstString(
      widgetCommerceSession?.cart?.summary_endpoint,
      widgetCommerceSession?.cart?.items_endpoint,
      widgetCommerceSession?.cart?.legacy_endpoint,
      widgetCommerceSession?.cart?.endpoint,
    );
    const tenantSlug = sanitizeTenantSlug(commerceTenantSlug);
    const widgetToken = resolveWidgetTokenForTenant(resolvedOwnerToken, tenantSlug);

    if (!cartEndpoint && !tenantSlug && !widgetToken) {
      setWidgetCommerceCart(null);
      return;
    }

    const cartRequest = {
      tenantSlug,
      widgetToken,
      chatSessionId: getOrCreateChatSessionId(),
      anonId: getOrCreateAnonId(),
      widgetSessionToken: widgetCommerceSession?.session?.widget_session_token || null,
    };
    const loadCartSnapshot = (activeRequest: typeof cartRequest, retried = false): Promise<void> =>
      getWidgetCartSnapshot(cartEndpoint || null, activeRequest)
      .then((cart) => {
        if (isActive) {
          if (!responseMatchesTenant(cart, tenantSlug)) {
            if (!retried && activeRequest.widgetToken) {
              clearCachedWidgetToken();
              return loadCartSnapshot({ ...activeRequest, widgetToken: null }, true);
            }
            setWidgetCommerceCart(null);
            return;
          }
          if (cart?.session?.chat_session_id) {
            persistChatSessionId(cart.session.chat_session_id);
          }
          setWidgetCommerceCart(cart);
        }
      });

    loadCartSnapshot(cartRequest)
      .catch(() => {
        if (isActive) setWidgetCommerceCart(null);
      });

    return () => {
      isActive = false;
    };
  }, [
    commerceTenantSlug,
    resolvedOwnerToken,
    widgetCommerceSession?.cart?.endpoint,
    widgetCommerceSession?.cart?.items_endpoint,
    widgetCommerceSession?.cart?.legacy_endpoint,
    widgetCommerceSession?.cart?.summary_endpoint,
    widgetCommerceSession?.session?.widget_session_token,
    entityInfo?.onboarding?.mode,
  ]);

  useEffect(() => {
    if (!isProfileLoading) return;
    const timeout = setTimeout(() => {
      if (isProfileLoading) {
        applyWidgetFallbackProfile();
        setProfileLoading(false);
      }
    }, 10000);
    return () => clearTimeout(timeout);
  }, [isProfileLoading, applyWidgetFallbackProfile]);

  const containerStyle: React.CSSProperties = useMemo(() => {
    if (mode === "standalone") {
      if (isOpen && isMobileView) {
        return {
          left: 0,
          right: 0,
          top: "auto",
          bottom: 0,
          width: finalOpenWidth,
          height: finalOpenHeight,
          maxWidth: "100dvw",
          maxHeight: "calc(100dvh - max(4.75rem, env(safe-area-inset-top)))",
          zIndex: 999999,
          transition: "opacity 0.18s ease",
          transform: "none",
        };
      }

      const shouldHideClosedLauncher = isMobileView && !isOpen && hideClosedLauncherForHeroPreview;
      const baseStyle: React.CSSProperties = {
        right: isMobileView
          ? `calc(env(safe-area-inset-right) + ${closedOffsetRight}px)`
          : `${closedOffsetRight}px`,
        bottom: resolveStandaloneLauncherBottom({
          pathname: location.pathname,
          viewportWidth: viewport.width,
          isMobileView,
          closedOffsetBottom,
        }),
        width: isOpen ? finalOpenWidth : launcherSize,
        height: isOpen ? finalOpenHeight : launcherHeight,
        zIndex: 999999,
        opacity: shouldHideClosedLauncher ? 0 : 1,
        pointerEvents: shouldHideClosedLauncher ? "none" : undefined,
        transition: 'width 0.3s ease, height 0.3s ease, bottom 0.3s ease, right 0.3s ease, opacity 0.18s ease, transform 0.18s ease',
        // FORCE NONE ON MOBILE TO PREVENT BACKEND INJECTION ISSUES
        transform: isMobileView
          ? shouldHideClosedLauncher
            ? "translateY(10px) scale(0.92)"
            : "none"
          : undefined
      };

      // Specifically override if backend sends scale via other means, though 'style' prop usually wins over external CSS classes unless !important
      // But if backend injects inline style via JS, we need to ensure this React render wins.

      return baseStyle;
    }
    if (mode === "preview") {
      return {
        width: '100%',
        height: '100%',
        position: 'absolute',
        top: 0,
        left: 0,
        overflow: 'hidden',
        zIndex: 10
      };
    }
    if (mode === "iframe") {
      const width = isOpen ? finalOpenWidth : launcherSize;
      const height = isOpen ? finalOpenHeight : launcherHeight;
      return {
        position: "relative",
        width,
        height,
        minWidth: width,
        minHeight: height,
        maxWidth: "100dvw",
        maxHeight: "100dvh",
        overflow: "hidden",
        transition: "width 0.24s ease, height 0.24s ease, opacity 0.18s ease",
      };
    }
    return {};
  }, [mode, isOpen, finalOpenWidth, finalOpenHeight, launcherSize, launcherHeight, isMobileView, closedOffsetBottom, closedOffsetRight, hideClosedLauncherForHeroPreview, location.pathname, viewport.width]);

  const panelAnimation = prefersReducedMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.12 },
      }
    : {
        initial: { opacity: 0, scale: 0.95, y: 20, originY: 1 },
        animate: { opacity: 1, scale: 1, y: 0, originY: 1 },
        exit: { opacity: 0, scale: 0.95, y: 20, originY: 1 },
        transition: { type: "spring", stiffness: 350, damping: 30 },
      };

  const motionScale = prefersReducedMotion
    ? 1
    : widgetUx.motionLevel === 'pro'
      ? 1
      : widgetUx.motionLevel === 'minimal'
        ? 0.5
        : 0.75;
  const enableHeavyEffects = widgetUx.motionLevel !== 'low' && !isMobileView && !prefersReducedMotion;

  const launcherPalette = useMemo(() => {
    const primary = primaryColor || widgetUx.gradientEnd || "hsl(var(--primary))";
    const accent = accentColor || widgetUx.gradientStart || "hsl(var(--secondary))";
    return { primary, accent };
  }, [primaryColor, accentColor, widgetUx.gradientEnd, widgetUx.gradientStart]);

  const presetVisualProfile = useMemo(() => {
    const preset = (widgetUx.preset || '').toLowerCase();
    if (preset.includes('civic')) {
      return {
        closedShadowDark: "0 16px 40px rgba(15,23,42,0.55), 0 0 0 2px rgba(148,163,184,0.35)",
        closedShadowLight: "0 14px 34px rgba(15,23,42,0.22), 0 0 0 2px rgba(203,213,225,0.75)",
        panelGradient: 'linear-gradient(155deg, color-mix(in oklab, white 88%, transparent), color-mix(in oklab, #dbeafe 24%, transparent))',
      };
    }
    if (preset.includes('commerce') || preset.includes('neon')) {
      return {
        closedShadowDark: "0 18px 42px rgba(91,33,182,0.6), 0 0 0 2px rgba(244,114,182,0.28)",
        closedShadowLight: "0 16px 36px rgba(168,85,247,0.28), 0 0 0 2px rgba(244,114,182,0.35)",
        panelGradient: 'linear-gradient(155deg, color-mix(in oklab, white 86%, transparent), color-mix(in oklab, #fae8ff 26%, transparent))',
      };
    }
    return {
      closedShadowDark: "0 16px 44px rgba(15,23,42,0.65), 0 0 0 2px rgba(255,255,255,0.12)",
      closedShadowLight: "0 14px 34px rgba(15,23,42,0.26), 0 0 0 2px rgba(255,255,255,0.6)",
      panelGradient: 'linear-gradient(155deg, color-mix(in oklab, white 84%, transparent), color-mix(in oklab, hsl(var(--card)) 90%, transparent))',
    };
  }, [widgetUx.preset]);

  const buttonAnimation = prefersReducedMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.12 },
      }
    : {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.18 * motionScale, ease: "easeOut" },
      };

  useEffect(() => {
    if (mode === 'iframe' && typeof window !== 'undefined') {
      const dimensions = isOpen
        ? { width: finalOpenWidth, height: finalOpenHeight }
        : { width: launcherSize, height: launcherHeight };
      window.parent.postMessage({
        type: 'CHATBOC_RESIZE',
        widgetId,
        dimensions,
        isOpen: isOpen
      }, '*');
    }
  }, [finalOpenHeight, finalOpenWidth, isOpen, launcherHeight, launcherSize, mode, widgetId]);

  // MOVED: duplicateInstance check is now at the end to prevent Hook Violation
  if (duplicateInstance) {
    return null;
  }

  if (mode === "standalone" || mode === "iframe" || mode === "preview") {
    return (
      <div
        ref={widgetContainerRef}
        data-testid="chat-widget"
        data-mode={mode}
        data-default-open={defaultOpen}
        data-widget-id={widgetId}
        data-owner-token={ownerToken}
        data-tipo-chat={tipoChat}
        data-initial-rubro={initialRubro}
        data-widget-preset={widgetUx.preset}
        data-motion-level={widgetUx.motionLevel}
        data-glassmorphism={String(widgetUx.glassmorphism)}
        data-logo-ring={String(widgetUx.logoRing)}
        data-gradient-start={widgetUx.gradientStart}
        data-gradient-end={widgetUx.gradientEnd}
        data-typing-animation={widgetUx.typingAnimation}
        data-bubble-animation={widgetUx.bubbleAnimation}
        data-launcher-animation={widgetUx.launcherAnimation}
        data-message-enter-animation={widgetUx.messageEnterAnimation}
        data-logo-badge-style={widgetUx.logoBadgeStyle}
        data-cursor-trail={String(widgetUx.cursorTrail)}
        data-ambient-particles={String(widgetUx.ambientParticles)}
        data-support-live-chat={String(Boolean(supportChannels?.live_chat?.realtime && realtimeConfig.socketEnabled))}
        data-support-whatsapp={String(
          Boolean(supportChannels?.whatsapp?.enabled && supportChannels?.whatsapp?.realtime_bridge),
        )}
        data-realtime-model={realtimeConfig.model || ''}
        data-realtime-fallback-model={realtimeConfig.fallbackModel || ''}
        data-realtime-voice={realtimeConfig.voice || ''}
        data-realtime-transport={realtimeConfig.transport || ''}
        data-realtime-profile={realtimeConfig.profile || ''}
        data-realtime-voice-enabled={String(Boolean(realtimeConfig.voiceEnabled))}
        data-realtime-video-enabled={String(Boolean(realtimeConfig.videoEnabled))}
        data-realtime-live-video-analysis={String(Boolean(realtimeConfig.liveVideoAnalysis))}
        data-avatar-enabled={String(Boolean(realtimeConfig.avatarEnabled))}
        data-avatar-contract-version={realtimeConfig.avatarContractVersion || ''}
        data-avatar-type={realtimeConfig.avatarType || 'robot'}
        data-avatar-persona={realtimeConfig.avatarPersona || ''}
        data-avatar-display-name={realtimeConfig.avatarDisplayName || ''}
        data-avatar-state-source={realtimeConfig.avatarStateSource || ''}
        data-realtime-voice-label={realtimeConfig.voiceLabel || ''}
        data-realtime-video-label={realtimeConfig.videoLabel || ''}
        data-avoids-portal-bottom-nav={String(avoidsPortalBottomNavigation)}
        className={cn(
          "chatboc-container flex flex-col",
          mode === "standalone"
            ? "fixed z-[999999] items-end justify-end"
            : "w-full h-full"
        )}
        style={containerStyle}
        onMouseMove={(event) => {
          if (!widgetUx.cursorTrail || !enableHeavyEffects) return;
          const rect = widgetContainerRef.current?.getBoundingClientRect();
          if (!rect) return;
          setCursorTrailPoint({ x: event.clientX - rect.left, y: event.clientY - rect.top });
        }}
      >
        {widgetUx.cursorTrail && enableHeavyEffects && cursorTrailPoint ? (
          <motion.span
            aria-hidden
            className="pointer-events-none absolute z-10 h-20 w-20 rounded-full"
            style={{
              left: cursorTrailPoint.x - 40,
              top: cursorTrailPoint.y - 40,
              background: `radial-gradient(circle, ${launcherPalette.accent}40 0%, transparent 70%)`,
              filter: 'blur(8px)',
            }}
            animate={{ opacity: [0.25, 0.45, 0.25] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          />
        ) : null}

        {widgetUx.ambientParticles && enableHeavyEffects ? (
          <div className="pointer-events-none absolute inset-0 overflow-hidden z-[1]">
            {[0, 1, 2, 3].map((particle) => (
              <motion.span
                key={`ambient-${particle}`}
                className="absolute h-2 w-2 rounded-full bg-primary/35"
                style={{ left: `${18 + particle * 19}%`, top: `${22 + (particle % 2) * 28}%` }}
                animate={{ y: [-4, 8, -4], opacity: [0.15, 0.5, 0.15] }}
                transition={{ duration: 3 + particle * 0.7, repeat: Infinity, ease: 'easeInOut' }}
              />
            ))}
          </div>
        ) : null}

        {isOpen && a11yPrefs.dyslexia && <ReadingRuler />}
        {isProfileLoading && isOpen ? (
          <div className="h-full min-h-0 w-full overflow-hidden rounded-2xl border border-border/60 bg-card text-card-foreground shadow-xl">
            {isOpen ? (
              <div className="flex h-full min-h-0 flex-col">
                <div className="flex h-16 shrink-0 items-center gap-3 border-b border-border/60 px-4">
                  <div className="h-10 w-10 rounded-full bg-primary/15" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-3 w-28 rounded bg-muted" />
                    <div className="h-2 w-40 max-w-full rounded bg-muted/70" />
                  </div>
                </div>
                <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Cargando asistente Chatboc</p>
                    <p className="mt-1 text-xs text-muted-foreground">Preparando mensajes, menu y accesibilidad.</p>
                  </div>
                </div>
                <div className="h-20 shrink-0 border-t border-border/60 bg-card/95 p-3">
                  <div className="h-11 rounded-[22px] border border-border/70 bg-background" />
                </div>
              </div>
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-full">
                <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              </div>
            )}
          </div>
        ) : profileError && isOpen ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-center p-4 bg-card rounded-2xl">
            <p className="text-destructive font-semibold">Error</p>
            <p className="text-sm text-muted-foreground">{profileError}</p>
          </div>
        ) : (
          <SafeAnimatePresence mode="wait" initial={false}>
            {isOpen ? (
            <motion.div
              ref={openPanelRef}
              key="chatboc-panel-open"
              className={cn(commonPanelStyles, "w-full h-full shadow-xl")}
              role="dialog"
              aria-modal="true"
              aria-label="Chatboc asistente virtual"
              tabIndex={-1}
              onKeyDown={handleOpenPanelKeyDown}
              style={{
                  borderRadius: isMobileView
                    ? "24px 24px 0 0"
                    : (borderRadius !== undefined ? `${borderRadius}px` : "16px"),
                  background: chatBackground || (widgetUx.glassmorphism
                    ? presetVisualProfile.panelGradient
                    : "hsl(var(--card))"),
                  backdropFilter: widgetUx.glassmorphism ? 'blur(10px) saturate(120%)' : undefined,
              }}
              {...panelAnimation}
            >
              {(view === "register" || view === "login" || view === "user" || view === "info") && (
                <Suspense
                  fallback={
                    <div className="w-full h-14 flex items-center justify-center border-b border-border/40">
                      <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  }
                >
                  <ChatHeader
                    onClose={toggleChat}
                    onBack={() => setView("chat")}
                    showProfile={false}
                    muted={muted}
                    onToggleSound={toggleMuted}
                    onCart={shouldExposeCommerceControls ? openCart : undefined}
                    cartCount={shouldExposeCommerceControls ? effectiveCartCount : 0}
                    logoUrl={headerLogoUrl || customLauncherLogoUrl || entityInfo?.logo_url || getChatbocBotAvatar(isDarkMode)}
                    title={headerTitle}
                    subtitle={headerSubtitle}
                    logoAnimation={logoAnimation}
                    onA11yChange={setA11yPrefs}
                    accessibilityHints={effectiveUiHints?.accessibility ?? null}
                    supportChannels={supportChannels}
                  />
                </Suspense>
              )}
              {view === "register" || view === "login" || view === "user" || view === "info" ? (
                <Suspense
                  fallback={
                    <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-card rounded-2xl px-6 text-center">
                      <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-sm font-semibold text-foreground">Cargando panel</p>
                    </div>
                  }
                >
                  {view === "register" ? <ChatUserRegisterPanel onSuccess={handleAuthSuccess} onShowLogin={() => setView("login")} entityToken={resolvedOwnerToken ?? undefined} />
                    : view === "login" ? <ChatUserLoginPanel onSuccess={handleAuthSuccess} onShowRegister={() => setView("register")} entityToken={resolvedOwnerToken ?? undefined} />
                    : view === "user" ? <ChatUserPanel onClose={() => setView("chat")} />
                    : <EntityInfoPanel info={entityInfo} onClose={() => setView("chat")} />}
                </Suspense>
              ) : (
                <Suspense
                  fallback={
                    <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-card rounded-2xl px-6 text-center">
                      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-sm font-semibold text-foreground">Cargando conversacion</p>
                    </div>
                  }
                >
                  <ChatPanel
                    key={`chat-panel-${chatPanelResetKey}`}
                    variant="legacy-widget"
                    mode={mode}
                    widgetId={widgetId}
                    entityToken={resolvedOwnerToken ?? undefined}
                    quickMenu={entityInfo?.quick_menu}
                    defaultMenu={
                      entityInfo?.default_menu ||
                      entityInfo?.widget_onboarding?.default_menu ||
                      chatBootstrap?.default_menu ||
                      null
                    }
                    onboarding={entityInfo?.onboarding ?? null}
                    uiHints={effectiveUiHints}
                    commerceSession={shouldExposeCommerceControls ? widgetCommerceSession : null}
                    commerceHistory={shouldExposeCommerceControls ? widgetCommerceHistory : null}
                    chatBootstrap={chatBootstrap}
                    rubroTools={
                      entityInfo?.rubro_tools ||
                      entityInfo?.business_tools ||
                      entityInfo?.operational_tools ||
                      entityInfo?.tools ||
                      entityInfo?.toolkit ||
                      null
                    }
                    onOpenCatalog={shouldExposeCommerceControls ? () => openCart("catalog") : undefined}
                    onOpenPortal={openPortal}
                    onPlatformSelection={handlePlatformSelection}
                    platformSelectionLoadingId={platformSelectionLoadingId}
                    platformSelectionError={platformSelectionError}
                    leadCapture={entityInfo?.lead_capture ?? entityInfo?.experience_blueprint?.lead_capture ?? null}
                    mediaCapabilities={entityInfo?.media_capabilities ?? entityInfo?.experience_blueprint?.media_capabilities ?? null}
                    conversionCtas={entityInfo?.conversion_ctas ?? entityInfo?.experience_blueprint?.conversion_ctas ?? null}
                    animationTokens={entityInfo?.animation_tokens ?? null}
                    emptyStates={entityInfo?.empty_states ?? entityInfo?.experience_blueprint?.empty_states ?? undefined}
                    experienceBlueprint={entityInfo?.experience_blueprint ?? {
                      first_visit: entityInfo?.first_visit ?? null,
                      sample_conversations: entityInfo?.sample_conversations ?? [],
                      trust_signals: entityInfo?.trust_signals ?? [],
                      lead_capture: entityInfo?.lead_capture ?? null,
                      media_capabilities: entityInfo?.media_capabilities ?? null,
                      conversion_ctas: entityInfo?.conversion_ctas ?? null,
                      animation_tokens: entityInfo?.animation_tokens ?? null,
                      empty_states: entityInfo?.empty_states ?? undefined,
                    }}
                    tenantSlug={chatTenantSlug}
                    openWidth={finalOpenWidth}
                    openHeight={finalOpenHeight}
                    onClose={toggleChat}
                    tipoChat={resolvedTipoChat}
                    onRequireAuth={() => setView("register")}
                    onShowLogin={() => setView("login")}
                    onShowRegister={() => setView("register")}
                    onOpenUserPanel={openUserPanel}
                    muted={muted}
                    onToggleSound={toggleMuted}
                    onCart={shouldExposeCommerceControls ? openCart : undefined}
                    cartCount={shouldExposeCommerceControls ? effectiveCartCount : 0}
                    selectedRubro={selectedRubro ?? entityDefaultRubro}
                    onRubroSelect={handleRubroSelect}
                    catalogCard={shouldExposeCommerceControls ? catalogCard : undefined}
                    headerLogoUrl={headerLogoUrl || customLauncherLogoUrl || entityInfo?.logo_url || getChatbocBotAvatar(isDarkMode)}
                    welcomeTitle={headerTitle}
                    welcomeSubtitle={headerSubtitle}
                    logoAnimation={logoAnimation}
                    typingAnimation={widgetUx.typingAnimation}
                    bubbleAnimation={widgetUx.bubbleAnimation}
                    messageEnterAnimation={widgetUx.messageEnterAnimation}
                    logoBadgeStyle={widgetUx.logoBadgeStyle}
                    supportChannels={supportChannels}
                    realtimeConfig={realtimeConfig}
                    realtimeVoice={realtimeVoice}
                    onA11yChange={setA11yPrefs}
                    a11yPrefs={a11yPrefs}
                  />
                </Suspense>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="chatboc-panel-closed"
              className="relative w-full h-full"
            >
              <Suspense fallback={null}>
                  <ProactiveBubble
                    message={proactiveMessage || ""}
                    onClick={handleProactiveClick}
                    visible={showProactiveBubble && !showCta}
                  />
              </Suspense>
              {showCta && ctaMessage && !showProactiveBubble && (
                <motion.div
                  key="chatboc-cta"
                  className="absolute right-0 text-sm bg-background border rounded-lg shadow-lg px-3 py-2 dark:bg-slate-800 dark:border-slate-700"
                  style={{ bottom: "calc(100% + 8px)" }}
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                >
                  {ctaMessage}
                </motion.div>
              )}
              {showCatalogCta && !showProactiveBubble && !showCta && (
                <motion.button
                  type="button"
                  className="absolute right-0 text-sm bg-background border rounded-lg shadow-lg px-3 py-2 dark:bg-slate-800 dark:border-slate-700"
                  style={{ bottom: "calc(100% + 8px)" }}
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                  onClick={() => {
                    if (catalogLinks?.view_url) {
                      window.open(catalogLinks.view_url, "_blank");
                    }
                  }}
                >
                  {catalogCtaLabel}
                </motion.button>
              )}
              <motion.button
                ref={launcherButtonRef}
                key="chatboc-toggle-btn"
                className={cn(
                  commonButtonStyles,
                  "chatboc-agent-launcher group relative w-full h-full overflow-hidden border border-white/35"
                )}
                style={{
                  borderRadius: "50%",
                  boxShadow: isDarkMode
                    ? "0 18px 42px rgba(2, 6, 23, 0.62), 0 0 0 1px rgba(125,176,255,0.24)"
                    : "0 16px 34px rgba(15, 43, 110, 0.26), 0 0 0 1px rgba(255,255,255,0.76)",
                }}
                {...buttonAnimation}
                whileHover={{ scale: 1 }}
                whileTap={{ scale: 1 }}
                onClick={toggleChat}
                aria-label="Abrir chat"
                title="Abrir asistente IA"
              >
                <img
                  src={launcherImageSrc}
                  alt=""
                  aria-hidden="true"
                  loading="eager"
                  decoding="async"
                  className="h-full w-full object-contain drop-shadow-[0_8px_18px_rgba(0,35,110,0.28)]"
                  onError={() =>
                    setLauncherImageSrc(
                      launcherImageSrc === CHATBOC_WIDGET_STATIC
                          ? CHATBOC_WIDGET_PNG_FALLBACK
                          : launcherImageSrc === CHATBOC_WIDGET_PNG_FALLBACK
                            ? CHATBOC_WIDGET_FALLBACK
                          : customLauncherLogoUrl || entityInfo?.logo_url || getChatbocBotAvatar(isDarkMode),
                    )
                  }
                />
                {!isMobileView && !isOpen ? (
                  <span className="pointer-events-none absolute -top-9 right-1/2 translate-x-1/2 rounded-full border border-border/70 bg-background/95 px-3 py-1 text-[11px] font-semibold tracking-wide text-foreground/85 opacity-0 shadow-sm transition-opacity duration-200 group-hover:opacity-100">
                    Asistente IA
                  </span>
                ) : null}
              </motion.button>
            </motion.div>
            )}
          </SafeAnimatePresence>
        )}
      </div>
    );
  }

  return null;
};

export default ChatWidgetInner;
