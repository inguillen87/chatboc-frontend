// src/components/chat/ChatWidgetInner.tsx

import React, { Suspense, useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useDarkMode } from "@/hooks/useDarkMode";
import ChatbocLogoAnimated from "./ChatbocLogoAnimated";
import { getCurrentTipoChat } from "@/utils/tipoChat";
import { cn } from "@/lib/utils";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import { extractRubroKey } from "@/utils/rubros";
import { trackWidgetEvent } from "@/utils/widgetTelemetry";
import { getOrCreateAnonId } from "@/utils/anonIdGenerator";
import { motion, AnimatePresence } from "framer-motion";
import type { AnimatePresenceProps } from "framer-motion";
import { useUser } from "@/hooks/useUser";
import { apiFetch, getErrorMessage } from "@/utils/api";
import ReadingRuler from "./ReadingRuler";
import type { Prefs } from "./AccessibilityToggle";
import { useCartCount } from "@/hooks/useCartCount";
import { buildTenantNavigationUrl, TENANT_ROUTE_PREFIXES } from "@/utils/tenantPaths"; // Fixed import
import { useTenant } from "@/context/TenantContext";
import { toast } from "sonner";
import { tenantService } from "@/services/tenantService";
import { ChatWidgetProps } from "./types";
import { MOCK_TENANT_INFO, MOCK_JUNIN_TENANT_INFO } from "@/data/mockTenantData";
import { hexToHsl, getContrastColorHsl } from "@/utils/color";
import { apiClient } from "@/api/client";
import { esRubroPublico } from "@/utils/chatEndpoints";
import { getChatbocBotAvatar } from "@/utils/brandAssets";

// Use constants from new file
import { TENANT_PLACEHOLDER_SLUGS } from "@/constants/tenant";

// Alias for backward compatibility if needed locally, though direct usage is preferred
const PLACEHOLDER_SLUGS_SET = TENANT_PLACEHOLDER_SLUGS;

const LS_KEY = "chatboc_accessibility";

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


function SafeAnimatePresence({ children = null, ...rest }: AnimatePresenceProps = { children: null }) {
  return <AnimatePresence {...rest}>{children}</AnimatePresence>;
}

const ChatHeader = React.lazy(() => import("./ChatHeader"));
const ChatPanel = React.lazy(() => import("./ChatPanel"));
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

    return trimmed;
  } catch (e) {
    console.warn("Error sanitizing tenant slug", e);
    return null;
  }
}

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

    const segments = host.split(".");
    if (segments.length < 2) return null;

    const candidate = segments[0];
    if (!candidate || ["www", "app", "panel"].includes(candidate.toLowerCase())) return null;
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
  openWidth = "480px",
  openHeight = "750px",
  closedWidth = "100px",
  closedHeight = "100px",
  tipoChat,
  initialPosition = { bottom: 32, right: 32 },
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
  const DEFAULT_WIDGET_UX = {
    preset: 'premium',
    motionLevel: 'balanced',
    glassmorphism: true,
    logoRing: true,
    gradientStart: '#0f172a',
    gradientEnd: '#007aff',
    typingAnimation: 'wave-dots',
    bubbleAnimation: 'soft-rise',
    launcherAnimation: 'pulse-glow',
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
      launcherAnimation: normalizeUxString(attrs['data-launcher-animation'] ?? ux.launcher_animation, DEFAULT_WIDGET_UX.launcherAnimation),
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
  const [contextOverride, setContextOverride] = useState<any>(null);
  const [resolvedTipoChat, setResolvedTipoChat] = useState<'pyme' | 'municipio'>(() => {
    return tipoChat || getCurrentTipoChat();
  });
  const [entityInfo, setEntityInfo] = useState<any | null>(null);
  const [isProfileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [requireCatalogAuth, setRequireCatalogAuth] = useState(false);
  const [catalogInfo, setCatalogInfo] = useState<any | null>(null);

  const [duplicateInstance, setDuplicateInstance] = useState(false);
  const resolvedOwnerToken = useMemo(() => {
    if (ownerToken) return ownerToken;
    return (
      entityInfo?.owner_token ||
      entityInfo?.entity_token ||
      entityInfo?.widget_token ||
      entityInfo?.token ||
      null
    );
  }, [entityInfo, ownerToken]);

  const [isMobileView, setIsMobileView] = useState(
    typeof window !== "undefined" && window.innerWidth < 640
  );

  const { tenant, currentSlug } = useTenant();
  const storedTenantSlug = useMemo(
    () => sanitizeTenantSlug(safeLocalStorage.getItem("tenantSlug")),
    [],
  );

  const isEmbedded = mode !== "standalone";
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

  const resolvedTenantSlug = useMemo(() => {
    const candidates = [
      contextOverride?.tenantSlug,
      explicitTenantSlug,
      tenantSlugFromEntity,
      tenantSlugFromLocation,
      tenantSlugFromScripts,
      tenantSlugFromSubdomain,
      storedTenantSlug,
      currentSlug,
      tenant?.slug,
    ];

    // Explicitly check global config if available
    if (typeof window !== "undefined") {
        const cfg = (window as any).CHATBOC_CONFIG || {};
        candidates.push(cfg.tenant, cfg.tenantSlug, cfg.tenant_slug);
    }

    for (const candidate of candidates) {
      const sanitized = sanitizeTenantSlug(candidate);
      if (sanitized) return sanitized;
    }

    return null;
  }, [
    contextOverride,
    explicitTenantSlug,
    currentSlug,
    tenant?.slug,
    storedTenantSlug,
    tenantSlugFromEntity,
    tenantSlugFromLocation,
    tenantSlugFromScripts,
    tenantSlugFromSubdomain,
  ]);

  useEffect(() => {
    const sanitized = sanitizeTenantSlug(resolvedTenantSlug);
    if (sanitized) {
      safeLocalStorage.setItem("tenantSlug", sanitized);
    }
  }, [resolvedTenantSlug]);

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
    const target = (mode === 'iframe' && mode !== 'preview') ? root : widgetContainerRef.current;

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
    if (typeof window !== "undefined" && window.AudioContext && window.AudioContext.state === "suspended") {
      window.AudioContext.resume();
    }

    setIsOpen((prevIsOpen) => {
      const nextIsOpen = !prevIsOpen;
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
  const [pendingRedirect, setPendingRedirect] = useState<"cart" | "market" | null>(null);
  const cartCount = useCartCount();
  const entityDefaultRubro = useMemo(() => {
    if (!entityInfo) return null;

    const info: any = entityInfo;
    const rawRubro =
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
  const [a11yPrefs, setA11yPrefs] = useState<Prefs>(() => {
    try {
      return (
        JSON.parse(safeLocalStorage.getItem(LS_KEY) || "") || {
          dyslexia: false,
          simplified: true,
        }
      );
    } catch {
      return { dyslexia: false, simplified: true };
    }
  });

  useEffect(() => {
    const handleStorage = () => {
      try {
        const p = JSON.parse(safeLocalStorage.getItem(LS_KEY) || "") || {
          dyslexia: false,
          simplified: true,
        };
        setA11yPrefs(p);
      } catch {
        /* ignore */
      }
    };
    if (typeof window !== "undefined") {
      window.addEventListener("storage", handleStorage);
      return () => window.removeEventListener("storage", handleStorage);
    }
  }, []);

  const lastOwnerTokenRef = useRef<string | null | undefined>(ownerToken);

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
      const slug = resolvedTenantSlug ?? storedTenant;

      if (!slug) {
        toast.error("No hay un tenant configurado para el carrito.");
        return;
      }

      if (target === "market" || target === "catalog") {
        const destination = buildMarketCartUrl(slug, tenant?.public_base_url ?? null);
        if (!destination) {
          toast.error("No pudimos abrir el catálogo público.");
          return;
        }
        window.open(destination, "_blank");
        return;
      }

      const basePath = "/cart";

      const preferredUrl = tenant?.public_cart_url ?? user?.publicCartUrl ?? null;

      const authToken = authTokenState ?? safeLocalStorage.getItem("authToken") ?? safeLocalStorage.getItem("chatAuthToken");
      const requiresAuth = target === "cart" || requireCatalogAuth;
      const hasSession = Boolean(authToken && user);

      if (requiresAuth && !hasSession) {
        setPendingRedirect(target === "market" ? "market" : "cart");
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
      buildMarketCartUrl,
      resolvedTenantSlug,
      tenant,
      user,
    ]
  );

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
    setView("chat");
  }, [openCart, pendingRedirect]);

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

  const finalOpenWidth = useMemo(() => {
    const desired = parseInt(openWidth, 10);
    const max = viewport.width - (initialPosition.right || 0) - 16;
    return !isNaN(desired) && viewport.width
      ? `${Math.min(desired, max)}px`
      : openWidth;
  }, [openWidth, viewport.width, initialPosition.right]);

  const finalOpenHeight = useMemo(() => {
    // Determine the desired height
    const desired = parseInt(openHeight, 10);
    const heightToUse = isNaN(desired) ? 750 : desired;

    if (mode === 'iframe') {
        // Even in iframe mode, we should respect the viewport height to avoid scrolling issues in the host
        // However, the iframe itself is resized by the host script.
        // We just return the desired height so the host knows how big to make the iframe.
        // But if the viewport is small (mobile), we want to be full screen or max-height.
        if (typeof window !== 'undefined' && window.innerHeight) {
            // Cap at window height to be safe
             return `${Math.min(heightToUse, window.innerHeight)}px`;
        }
        return `${heightToUse}px`;
    }

    // In Standalone mode (Landing page), use aggressive height
    const max = viewport.height - (initialPosition.bottom || 0) - 16;

    // Ensure it doesn't exceed 90vh (increased from 85vh) to allow more vertical space
    const maxHeightVh = viewport.height * 0.90;
    const effectiveMax = Math.min(max, maxHeightVh);

    // If "chatito chiquito" issue persists, ensure we default to a reasonable minimum if openHeight is invalid
    // If calculating against viewport, make sure we at least respect the requested height if viewport is weirdly small (unless mobile)
    // UPDATE: To solve "chatito chiquito", we prioritize the larger size if space permits.
    const finalHeight = (viewport.height && !isMobileView) ? Math.min(heightToUse, effectiveMax) : (isMobileView ? viewport.height : heightToUse);

    return `${finalHeight}px`;
  }, [openHeight, viewport.height, initialPosition.bottom, mode, isMobileView]);

  const finalClosedWidth = closedWidth;
  const finalClosedHeight = closedHeight;
  const logoSizeFactor = 0.62;
  const closedWidthPx = parseInt(finalClosedWidth.replace('px', ''), 10);
  const calculatedLogoSize = Math.floor(closedWidthPx * logoSizeFactor);

  const commonPanelStyles = cn("chat-root bg-card border shadow-lg", "flex flex-col overflow-hidden");
  const commonButtonStyles = cn(
    "rounded-full flex items-center justify-center",
    "shadow-lg"
  );

  const sendStateMessageToParent = useCallback(
    (open: boolean) => {
      if (mode === "iframe" && mode !== "preview" && typeof window !== "undefined" && window.parent !== window && widgetId) {
        const dims = open
          ? { width: openWidth, height: openHeight }
          : { width: finalClosedWidth, height: finalClosedHeight };

        window.parent.postMessage(
          { type: "chatboc-state-change", widgetId, dimensions: dims, isOpen: open },
          "*"
        );
      }
    },
    [mode, widgetId, openWidth, openHeight, finalClosedWidth, finalClosedHeight]
  );

  useEffect(() => {
    if (mode === "iframe" && mode !== "preview" && typeof window !== "undefined" && window.parent !== window && widgetId) {
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
          }
          if (tipoChat === 'municipio' || tipoChat === 'pyme') {
              setResolvedTipoChat(tipoChat);
          }
          // Note: Passing 'context' deeper into ChatPanel might require more piping,
          // but updating tenantSlug/tipoChat solves the 403 error.

          void context;

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
        if (['chat', 'register', 'login', 'user', 'info'].includes(v)) {
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
                const publicConfig = await tenantService.getPublicWidgetConfig(resolvedTenantSlug);
                const inferredTipoChat = (() => {
                    if (publicConfig.tipo_chat === 'municipio' || publicConfig.tipo_chat === 'pyme') return publicConfig.tipo_chat;
                    if (publicConfig.type === 'municipio' || publicConfig.type === 'pyme') return publicConfig.type;
                    if (publicConfig.tipo === 'municipio' || publicConfig.tipo === 'pyme') return publicConfig.tipo;
                    if (typeof publicConfig.es_publico === 'boolean') return publicConfig.es_publico ? 'municipio' : 'pyme';
                    const rubroCandidate = publicConfig.rubro || publicConfig.rubro_publico || publicConfig.public_rubro;
                    if (rubroCandidate) return esRubroPublico(rubroCandidate) ? 'municipio' : 'pyme';
                    return tipoChat || 'pyme';
                })();

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
                };

                setEntityInfo(info);
                setWidgetUx(resolveWidgetUxConfig(publicConfig, inferredTipoChat));
                if (info.tipo_chat) {
                    setResolvedTipoChat(info.tipo_chat === 'municipio' ? 'municipio' : 'pyme');
                }
             } catch (err) {
                console.warn("Failed to fetch public widget config, falling back to ownerToken if available", err);

                  // Handle 500/404 explicitly by falling back to mock data if no ownerToken OR if ownerToken fails
                  const is500 = (err as any)?.status === 500 || (err as any)?.statusCode === 500;

                  if (is500 || !ownerToken) {
                     // Force load mock data to prevent white screen
                     const mockData = resolvedTenantSlug.includes('junin') ? MOCK_JUNIN_TENANT_INFO : MOCK_TENANT_INFO;

                     // Construct theme config from legacy mock 'tema' if needed
                     const themeConfig = mockData.theme_config || (mockData.tema ? {
                        mode: 'light',
                        light: {
                            primary: mockData.tema.primaryColor,
                            secondary: mockData.tema.secondaryColor,
                            background: '#ffffff',
                            foreground: '#0f172a',
                        },
                        dark: {
                            primary: mockData.tema.primaryColor,
                            secondary: mockData.tema.secondaryColor,
                             background: '#020617',
                            foreground: '#f8fafc',
                        }
                     } : undefined);

                     const info = {
                        ...mockData,
                        // Branding Priority: Props > Mock
                        nombre_empresa: welcomeTitle || mockData.nombre,
                        // Ensure logo_url reflects props if provided
                        logo_url: headerLogoUrl || customLauncherLogoUrl || mockData.logo_url,

                        // Ensure CTA messages from props are used if available
                        cta_messages: ctaMessage ? [{ text: ctaMessage }] : mockData.cta_messages,

                        theme_config: themeConfig,
                        default_open: (typeof defaultOpen === 'boolean') ? defaultOpen : mockData.default_open,
                        slug: resolvedTenantSlug,
                        tipo_chat: tipoChat || (mockData.tipo === 'municipio' ? 'municipio' : 'pyme')
                     };

                     setEntityInfo(info);
                     setWidgetUx({
                       ...DEFAULT_WIDGET_UX,
                       preset: info.tipo_chat === 'municipio' ? 'civic-premium' : 'commerce-neon',
                     });
                     if (info.tipo_chat) {
                         setResolvedTipoChat(info.tipo_chat === 'municipio' ? 'municipio' : 'pyme');
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
                  } else {
                      setProfileError("No se pudo cargar la configuración.");
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
          setEntityInfo(null);
        } finally {
          setProfileLoading(false);
        }
        return;
      }

      if (ownerToken === undefined) {
        setProfileLoading(false);
        return;
      }
      if (!ownerToken) {
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
        setEntityInfo(null);
        setProfileError(getErrorMessage(e, "No se pudo cargar la configuración del widget."));
      } finally {
        setProfileLoading(false);
      }
    }
    fetchEntityProfile();
  }, [ownerToken, resolvedTenantSlug]);

  useEffect(() => {
    let isActive = true;
    const loadCatalogInfo = async () => {
      if (!resolvedTenantSlug) {
        setCatalogInfo(null);
        return;
      }
      try {
        const catalog = await apiClient.publicGetCatalog(resolvedTenantSlug);
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
  }, [resolvedTenantSlug]);

  useEffect(() => {
    if (!isProfileLoading) return;
    const timeout = setTimeout(() => {
      if (isProfileLoading) {
        setProfileError("No se pudo cargar la configuración del widget.");
        setProfileLoading(false);
      }
    }, 10000);
    return () => clearTimeout(timeout);
  }, [isProfileLoading]);

  const containerStyle: React.CSSProperties = useMemo(() => {
    if (mode === "standalone") {
      const baseStyle = {
        bottom: `${initialPosition.bottom}px`,
        right: `${initialPosition.right}px`,
        width: isOpen ? finalOpenWidth : finalClosedWidth,
        height: isOpen ? finalOpenHeight : finalClosedHeight,
        zIndex: 999999,
        transition: 'width 0.3s ease, height 0.3s ease, bottom 0.3s ease, right 0.3s ease',
        // FORCE NONE ON MOBILE TO PREVENT BACKEND INJECTION ISSUES
        transform: isMobileView ? 'none' : undefined
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
    return {};
  }, [mode, initialPosition.bottom, initialPosition.right, isOpen, finalOpenWidth, finalOpenHeight, finalClosedWidth, finalClosedHeight, isMobileView]);

  const panelAnimation = {
    initial: { opacity: 0, scale: 0.95, y: 20, originY: 1 },
    animate: { opacity: 1, scale: 1, y: 0, originY: 1 },
    exit: { opacity: 0, scale: 0.95, y: 20, originY: 1 },
    transition: { type: "spring", stiffness: 350, damping: 30 },
  };

  const motionScale = widgetUx.motionLevel === 'pro' ? 1 : widgetUx.motionLevel === 'minimal' ? 0.5 : 0.75;
  const enableHeavyEffects = widgetUx.motionLevel !== 'low' && !isMobileView;

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

  const buttonAnimation = {
    initial: { scale: 0, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    exit: { scale: 0, opacity: 0 },
    transition: { type: "spring", stiffness: 300, damping: 20 / motionScale },
  };

  const iconAnimation = {
    open: { rotate: 180, scale: 0.8 },
    closed: { rotate: 0, scale: 1 },
  };

  const openSpring = { type: "spring", stiffness: 200, damping: 20 / motionScale };

  useEffect(() => {
    if (mode === 'iframe' && typeof window !== 'undefined') {
      window.parent.postMessage({
        type: 'CHATBOC_RESIZE',
        isOpen: isOpen
      }, '*');
    }
  }, [isOpen, mode]);

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
        data-support-live-chat={String(Boolean(supportChannels?.live_chat?.realtime))}
        data-support-whatsapp={String(
          Boolean(supportChannels?.whatsapp?.enabled && supportChannels?.whatsapp?.realtime_bridge),
        )}
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
        {isProfileLoading ? (
          <div className="w-full h-full flex items-center justify-center bg-card rounded-2xl">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : profileError ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-center p-4 bg-card rounded-2xl">
            <p className="text-destructive font-semibold">Error</p>
            <p className="text-sm text-muted-foreground">{profileError}</p>
          </div>
        ) : (
          <SafeAnimatePresence mode="wait" initial={false}>
            {isOpen ? (
            <motion.div
              key="chatboc-panel-open"
              className={cn(commonPanelStyles, "w-full h-full shadow-xl")}
              style={{
                  borderRadius: isMobileView ? "0" : (borderRadius !== undefined ? `${borderRadius}px` : "16px"),
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
                    onCart={openCart}
                    cartCount={cartCount}
                    logoUrl={headerLogoUrl || customLauncherLogoUrl || entityInfo?.logo_url || getChatbocBotAvatar(isDarkMode)}
                    title={headerTitle}
                    subtitle={headerSubtitle}
                    logoAnimation={logoAnimation}
                    onA11yChange={setA11yPrefs}
                    supportChannels={supportChannels}
                  />
                </Suspense>
              )}
              {view === "register" || view === "login" || view === "user" || view === "info" ? (
                <Suspense
                  fallback={
                    <div className="w-full h-full flex items-center justify-center bg-card rounded-2xl">
                      <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
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
                    <div className="w-full h-full flex items-center justify-center bg-card rounded-2xl">
                      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  }
                >
                  <ChatPanel
                    mode={mode}
                    widgetId={widgetId}
                    entityToken={resolvedOwnerToken ?? undefined}
                    tenantSlug={resolvedTenantSlug}
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
                    onCart={openCart}
                    cartCount={cartCount}
                    selectedRubro={selectedRubro ?? entityDefaultRubro}
                    onRubroSelect={handleRubroSelect}
                    catalogCard={catalogCard}
                    headerLogoUrl={headerLogoUrl || customLauncherLogoUrl || entityInfo?.logo_url || getChatbocBotAvatar(isDarkMode)}
                    welcomeTitle={headerTitle}
                    welcomeSubtitle={headerSubtitle}
                    logoAnimation={logoAnimation}
                    typingAnimation={widgetUx.typingAnimation}
                    bubbleAnimation={widgetUx.bubbleAnimation}
                    messageEnterAnimation={widgetUx.messageEnterAnimation}
                    logoBadgeStyle={widgetUx.logoBadgeStyle}
                    supportChannels={supportChannels}
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
                key="chatboc-toggle-btn"
                className={cn(
                  commonButtonStyles,
                  "group relative w-full h-full border-none"
                )}
                style={{
                  borderRadius: "50%",
                  background: `radial-gradient(circle at 30% 30%, ${launcherPalette.accent}, ${launcherPalette.primary})`,
                  color: "var(--primary-foreground, #ffffff)",
                  boxShadow: isDarkMode
                    ? presetVisualProfile.closedShadowDark
                    : presetVisualProfile.closedShadowLight,
                }}
                {...buttonAnimation}
                whileHover={{
                  scale: widgetUx.launcherAnimation.includes('pulse') ? 1.1 : 1.08,
                  rotate: widgetUx.launcherAnimation.includes('orbit') ? 3 : 0,
                  transition: { type: "spring", stiffness: 420, damping: 18 / motionScale },
                }}
                whileTap={{ scale: 0.95 }}
                onClick={toggleChat}
                aria-label="Abrir chat"
              >
                {widgetUx.logoRing && widgetUx.motionLevel !== 'minimal' ? (
                  <motion.span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 rounded-full"
                    style={{
                      background: `conic-gradient(from 0deg, ${launcherPalette.primary}, ${launcherPalette.accent}, ${launcherPalette.primary})`,
                      filter: "blur(10px)",
                      opacity: isOpen ? 0.45 : 0.75,
                    }}
                    animate={{ rotate: 360 }}
                    transition={{ duration: widgetUx.motionLevel === 'pro' ? 5 : 8, repeat: Infinity, ease: "linear" }}
                  />
                ) : null}
                {widgetUx.motionLevel !== 'minimal' ? (
                  <motion.span
                    aria-hidden
                    className="pointer-events-none absolute inset-[6px] rounded-full"
                    style={{
                      background: 'linear-gradient(145deg, rgba(255,255,255,0.36), rgba(255,255,255,0.04))',
                      mixBlendMode: 'screen',
                    }}
                    animate={{ opacity: [0.35, 0.65, 0.35] }}
                    transition={{ duration: widgetUx.motionLevel === 'pro' ? 2 : 3.2, repeat: Infinity, ease: 'easeInOut' }}
                  />
                ) : null}
                <span className="absolute inset-[4px] rounded-full bg-background/90 backdrop-blur-sm" />
                <motion.div
                  className="relative z-10"
                  variants={iconAnimation}
                  animate={isOpen ? "open" : "closed"}
                  transition={openSpring}
                >
                  <ChatbocLogoAnimated
                    src={entityInfo?.logo_url || customLauncherLogoUrl || getChatbocBotAvatar(isDarkMode)}
                    size={calculatedLogoSize}
                    blinking={!isOpen}
                    floating={!isOpen}
                    pulsing={!isOpen}
                    animation={logoAnimation}
                  />
                </motion.div>
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
