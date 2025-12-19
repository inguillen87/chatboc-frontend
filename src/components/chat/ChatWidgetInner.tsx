import React, { Suspense, useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useDarkMode } from "@/hooks/useDarkMode";
import ChatbocLogoAnimated from "./ChatbocLogoAnimated";
import { getCurrentTipoChat } from "@/utils/tipoChat";
import { cn } from "@/lib/utils";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import { extractRubroKey } from "@/utils/rubros";
import { getOrCreateAnonId } from "@/utils/anonIdGenerator";
import { motion, AnimatePresence } from "framer-motion";
import type { AnimatePresenceProps } from "framer-motion";
import { useUser } from "@/hooks/useUser";
import { apiFetch, getErrorMessage } from "@/utils/api";
import { playOpenSound, playProactiveSound } from "@/utils/sounds";
import ReadingRuler from "./ReadingRuler";
import type { Prefs } from "./AccessibilityToggle";
import { useCartCount } from "@/hooks/useCartCount";
import { buildTenantNavigationUrl } from "@/utils/tenantPaths";
import { useTenant } from "@/context/TenantContext";
import { toast } from "sonner";
import { tenantService } from "@/services/tenantService";
import { ChatWidgetProps } from "./types";
import { MOCK_TENANT_INFO, MOCK_JUNIN_TENANT_INFO } from "@/data/mockTenantData";
import { hexToHsl, getContrastColorHsl } from "@/utils/color";

// LOCAL_PLACEHOLDER_SLUGS is used to prevent the widget from treating reserved paths as tenant slugs.
// We also alias it to PLACEHOLDER_SLUGS_SET just in case some stale build/import relies on that name.
const LOCAL_PLACEHOLDER_SLUGS = new Set([
  'iframe',
  'embed',
  'widget',
  'cart',
  'productos',
  'checkout',
  'checkout-productos',
  'perfil',
  'user',
  'login',
  'register',
  'portal',
  'pedidos',
  'reclamos',
  'encuestas',
  'tickets',
  'opinar',
  'integracion',
  'documentacion',
  'faqs',
  'legal',
  'chat',
  'chatpos',
  'chatcrm',
  'admin',
  'dashboard',
  'analytics',
  'settings',
  'config',
  'api',
  "public",
  "auth",
  "portal",
  "admin",
  "pwa",
  "static",
  "assets",
  "default"
]);
const PLACEHOLDER_SLUGS_SET = LOCAL_PLACEHOLDER_SLUGS;

const PROACTIVE_MESSAGES = [
  "¿Necesitas ayuda?",
  "¿Querés hacer una sugerencia?",
  "¿Tenés un reclamo?",
  "¿Tenés consultas? ¡Preguntame!",
];

const LANDING_PROACTIVE_MESSAGES = [
  "¡Hola! 👋 ¿Querés probar una demo interactiva?",
  "Probá nuestro asistente inteligente gratis 🤖",
  "Descubrí cómo automatizar tus ventas 🚀",
  "¿Hablamos? Estoy acá para ayudarte 😊"
];

const LS_KEY = "chatboc_accessibility";

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

    if (LOCAL_PLACEHOLDER_SLUGS.has(lowered)) return null;

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
  openWidth = "460px",
  openHeight = "680px",
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
}: ChatWidgetProps) {
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
  const [resolvedTipoChat, setResolvedTipoChat] = useState<'pyme' | 'municipio'>(() => {
    return tipoChat || getCurrentTipoChat();
  });
  const [entityInfo, setEntityInfo] = useState<any | null>(null);
  const [isProfileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [requireCatalogAuth, setRequireCatalogAuth] = useState(false);

  const [duplicateInstance, setDuplicateInstance] = useState(false);

  const [isMobileView, setIsMobileView] = useState(
    typeof window !== "undefined" && window.innerWidth < 640
  );

  const { tenant, currentSlug } = useTenant();
  const storedTenantSlug = useMemo(
    () => sanitizeTenantSlug(safeLocalStorage.getItem("tenantSlug")),
    [],
  );

  const isEmbedded = mode !== "standalone";
  const isLandingPage = typeof window !== 'undefined' && window.location.pathname === '/';

  useEffect(() => {
    if (typeof window === "undefined") return;
    const globalAny = window as any;
    if (typeof globalAny._t !== "function") {
      globalAny._t = (value: any) => value;
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if ((window as any).__chatbocWidgetMounted) {
      setDuplicateInstance(true);
      return;
    }

    (window as any).__chatbocWidgetMounted = true;

    return () => {
      delete (window as any).__chatbocWidgetMounted;
    };
  }, []);

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
      if (segments[0] === 't' && segments[1]) {
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
    const shouldScopeToContainer = mode === 'standalone' || mode === 'script';
    const target = shouldScopeToContainer ? widgetContainerRef.current : root;

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


  }, [entityInfo, primaryColor, accentColor, mode]);

  // Proactive Bubble Logic
  useEffect(() => {
    let messages = PROACTIVE_MESSAGES;
    const isLanding = typeof window !== 'undefined' && window.location.pathname === '/';

    // Priority: Backend Config > Landing Page Defaults > Generic Defaults
    let backendMessages = entityInfo?.cta_messages;

    if (!backendMessages && entityInfo?.interaction?.cta_messages) {
      backendMessages = entityInfo.interaction.cta_messages;
    }

    if (backendMessages && Array.isArray(backendMessages) && backendMessages.length > 0) {
        messages = backendMessages.map((msg: any) => typeof msg === 'string' ? msg : msg.text || msg.message || "");
        messages = messages.filter(m => m.trim().length > 0);
    } else if (isLanding) {
        messages = LANDING_PROACTIVE_MESSAGES;
    }

    if (messages.length === 0) return;

    // Initial Force Show
    const shouldForceShow = isLanding || (entityInfo?.force_proactive === true);
    if (shouldForceShow && !safeLocalStorage.getItem('proactive_bubble_shown_v2')) {
       const timer = setTimeout(() => {
           if (!isOpen) {
             setProactiveMessage(messages[0]);
             setShowProactiveBubble(true);
             if (!muted) playProactiveSound();
           }
           safeLocalStorage.setItem('proactive_bubble_shown_v2', '1');
       }, 3000);
       return () => clearTimeout(timer);
    }

    // Cycling Logic
    const hasCustomMessages = !!(backendMessages && backendMessages.length > 0);
    const intervalTime = hasCustomMessages ? 6000 : 20000;

    const cycleTimer = setInterval(() => {
        if (isOpen) return;

        if (hasCustomMessages) {
            const nextIdx = (proactiveCycle + 1) % messages.length;
            setProactiveMessage(messages[nextIdx]);
            setProactiveCycle(nextIdx);

            if (!showProactiveBubble) {
                setShowProactiveBubble(true);
                if (!muted) playProactiveSound();
            }
        } else {
            if (showProactiveBubble) return;

            if (isLanding) {
                const nextIdx = (proactiveCycle + 1) % messages.length;
                setProactiveMessage(messages[nextIdx]);
                setShowProactiveBubble(true);
                if (!muted) playProactiveSound();
                setProactiveCycle(nextIdx);

                setTimeout(() => {
                    setShowProactiveBubble(false);
                }, 6000);
            }
        }
    }, intervalTime);

    return () => clearInterval(cycleTimer);
  }, [isOpen, showProactiveBubble, proactiveCycle, muted, entityInfo]);

  const toggleChat = useCallback(() => {
    if (typeof window !== "undefined" && window.AudioContext && window.AudioContext.state === "suspended") {
      window.AudioContext.resume();
    }

    setIsOpen((prevIsOpen) => {
      const nextIsOpen = !prevIsOpen;
      if (!nextIsOpen) {
          safeLocalStorage.setItem('widget_manually_closed', '1');
      }
      if (nextIsOpen && !muted) {
        playOpenSound();
      }
      if (nextIsOpen) {
        setShowProactiveBubble(false);
        if (proactiveMessageTimeoutRef.current) clearTimeout(proactiveMessageTimeoutRef.current);
        if (hideProactiveBubbleTimeoutRef.current) clearTimeout(hideProactiveBubbleTimeoutRef.current);
      }
      return nextIsOpen;
    });
  }, [isOpen, muted]);

  const handleProactiveClick = useCallback(() => {
      let backendMessages = entityInfo?.cta_messages || entityInfo?.interaction?.cta_messages;
      if (backendMessages && Array.isArray(backendMessages) && backendMessages.length > 0) {
          const currentMsgObj = backendMessages[proactiveCycle % backendMessages.length];
          if (currentMsgObj && typeof currentMsgObj === 'object' && currentMsgObj.action) {
              setIsOpen(true);
              safeLocalStorage.setItem('pending_widget_action', JSON.stringify({
                  action: currentMsgObj.action,
                  payload: currentMsgObj.payload,
                  text: currentMsgObj.text || currentMsgObj.message
              }));
              return;
          }
      }

      toggleChat();
  }, [toggleChat, entityInfo, proactiveCycle]);

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
    const heightToUse = isNaN(desired) ? 680 : desired;

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

    const max = viewport.height - (initialPosition.bottom || 0) - 16;

    // Ensure it doesn't exceed 85vh to prevent going off-screen (top)
    const maxHeightVh = viewport.height * 0.85;
    const effectiveMax = Math.min(max, maxHeightVh);

    // If "chatito chiquito" issue persists, ensure we default to a reasonable minimum if openHeight is invalid
    // If calculating against viewport, make sure we at least respect the requested height if viewport is weirdly small (unless mobile)
    const finalHeight = (viewport.height && !isMobileView) ? Math.min(heightToUse, effectiveMax) : (isMobileView ? viewport.height : heightToUse);

    return `${finalHeight}px`;
  }, [openHeight, viewport.height, initialPosition.bottom, mode, isMobileView]);

  const finalClosedWidth = closedWidth;
  const finalClosedHeight = closedHeight;
  const logoSizeFactor = 0.62;
  const closedWidthPx = parseInt(finalClosedWidth.replace('px', ''), 10);
  const calculatedLogoSize = Math.floor(closedWidthPx * logoSizeFactor);

  const commonPanelStyles = cn("chat-root bg-card border shadow-lg", "flex flex-col overflow-hidden"); // bg-card is fine here as container, internal panel handles bg-background now.
  const commonButtonStyles = cn(
    "rounded-full flex items-center justify-center",
    "bg-primary text-primary-foreground hover:bg-primary/90",
    "shadow-lg"
  );

  const sendStateMessageToParent = useCallback(
    (open: boolean) => {
      if (mode === "iframe" && typeof window !== "undefined" && window.parent !== window && widgetId) {
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
    if (isOpen || mode === 'standalone') {
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
      const nextMessage = PROACTIVE_MESSAGES[proactiveCycle % PROACTIVE_MESSAGES.length];
      setProactiveMessage(nextMessage);
      setShowProactiveBubble(true);
      if (!muted) playProactiveSound();
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
  }, [isOpen, muted, proactiveCycle, mode]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data || event.data.widgetId !== widgetId) return;
      if (event.data.type === "TOGGLE_CHAT") {
        setIsOpen(event.data.isOpen);
      } else if (event.data.type === "SET_VIEW") {
        const v = event.data.view;
        if (['chat', 'register', 'login', 'user', 'info'].includes(v)) {
          setView(v as any);
        }
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [widgetId]);

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
                const info = {
                    ...publicConfig,
                    // Priority Merge: Props > Backend Config
                    nombre_empresa: welcomeTitle || publicConfig.tenant_name || publicConfig.name || publicConfig.nombre,
                    logo_url: headerLogoUrl || customLauncherLogoUrl || publicConfig.logo_url || publicConfig.avatar_url,
                    cta_messages: ctaMessage ? [{ text: ctaMessage }] : publicConfig.cta_messages,
                    theme_config: publicConfig.theme_config,
                    default_open: (typeof defaultOpen === 'boolean') ? defaultOpen : publicConfig.default_open,
                    slug: resolvedTenantSlug,
                    tipo_chat: publicConfig.tipo_chat || (publicConfig.type === 'municipio' ? 'municipio' : 'pyme')
                };

                setEntityInfo(info);
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
      return {
        bottom: `${initialPosition.bottom}px`,
        right: `${initialPosition.right}px`,
        zIndex: 999999,
        transition: 'width 0.3s ease, height 0.3s ease, bottom 0.3s ease, right 0.3s ease',
      };
    }
    return {};
  }, [mode, initialPosition.bottom, initialPosition.right]);

  const panelAnimation = {
    initial: { opacity: 0, scale: 0.95, y: 20, originY: 1 },
    animate: { opacity: 1, scale: 1, y: 0, originY: 1 },
    exit: { opacity: 0, scale: 0.95, y: 20, originY: 1 },
    transition: { type: "spring", stiffness: 350, damping: 30 },
  };

  const buttonAnimation = {
    initial: { scale: 0, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    exit: { scale: 0, opacity: 0 },
    transition: { type: "spring", stiffness: 300, damping: 20 },
  };

  const iconAnimation = {
    open: { rotate: 180, scale: 0.8 },
    closed: { rotate: 0, scale: 1 },
  };

  const openSpring = { type: "spring", stiffness: 200, damping: 20 };

  // MOVED: duplicateInstance check is now at the end to prevent Hook Violation
  if (duplicateInstance) {
    return null;
  }

  if (mode === "standalone" || mode === "iframe") {
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
        className={cn(
          "chatboc-container flex flex-col",
          mode === "standalone"
            ? "fixed z-[999999] items-end justify-end"
            : "w-full h-full"
        )}
        style={containerStyle}
      >
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
              style={{ borderRadius: isMobileView ? "0" : "16px", background: "hsl(var(--card))" }}
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
                    logoUrl={headerLogoUrl || customLauncherLogoUrl || entityInfo?.logo_url || (isDarkMode ? '/chatbocar.png' : '/chatbocar2.png')}
                    title={headerTitle}
                    subtitle={headerSubtitle}
                    logoAnimation={logoAnimation}
                    onA11yChange={setA11yPrefs}
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
                  {view === "register" ? <ChatUserRegisterPanel onSuccess={handleAuthSuccess} onShowLogin={() => setView("login")} entityToken={ownerToken} />
                    : view === "login" ? <ChatUserLoginPanel onSuccess={handleAuthSuccess} onShowRegister={() => setView("register")} entityToken={ownerToken} />
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
                    entityToken={ownerToken}
                    tenantSlug={(isLandingPage && resolvedTenantSlug === 'municipio') ? null : resolvedTenantSlug}
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
                    headerLogoUrl={headerLogoUrl || customLauncherLogoUrl || entityInfo?.logo_url || (isDarkMode ? '/chatbocar.png' : '/chatbocar2.png')}
                    welcomeTitle={headerTitle}
                    welcomeSubtitle={headerSubtitle}
                    logoAnimation={logoAnimation}
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
              <motion.button
                key="chatboc-toggle-btn"
                className={cn(
                  commonButtonStyles,
                  "w-full h-full border-none shadow-xl"
                )}
                style={{
                  borderRadius: "50%",
                  background: "var(--primary, #2563eb)",
                  boxShadow: "0 6px 24px 0 rgba(0,0,0,0.15)",
                }}
                {...buttonAnimation}
                whileHover={{ scale: 1.1, transition: { type: "spring", stiffness: 400, damping: 15 } }}
                whileTap={{ scale: 0.95 }}
                onClick={toggleChat}
                aria-label="Abrir chat"
              >
                <motion.div
                  variants={iconAnimation}
                  animate={isOpen ? "open" : "closed"}
                  transition={openSpring}
                >
                  <ChatbocLogoAnimated
                    src={entityInfo?.logo_url || customLauncherLogoUrl || (isDarkMode ? '/chatbocar.png' : '/chatbocar2.png')}
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
