import React, { useEffect, useMemo, useState } from "react";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { MemoryRouter, useInRouterContext } from "react-router-dom";
import { TenantProvider } from "@/context/TenantContext";
import { getChatbocConfig } from "@/utils/config";
import { hexToHsl } from "@/utils/color";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import { GOOGLE_CLIENT_ID } from '@/env';
import { apiFetch } from '@/utils/api';
import { ensureBackendRuntimeReady } from '@/utils/backendBootstrapGate';

// Dynamically import ChatWidget only when rendering to prevent TDZ cycles
const ChatWidgetComponent = React.lazy(() => import("@/components/chat/ChatWidget"));

const DEFAULTS = {
  openWidth: "460px",
  openHeight: "680px",
  closedWidth: "96px",
  closedHeight: "96px",
  bottom: 20,
  right: 20,
};

type TipoChat = 'pyme' | 'municipio';

type IframeWidgetParams = {
  defaultOpen: boolean;
  widgetId: string;
  view: 'chat' | 'register' | 'login' | 'user' | 'info';
  openWidth: string;
  openHeight: string;
  closedWidth: string;
  closedHeight: string;
  ctaMessage?: string;
  rubro?: string;
  endpoint?: TipoChat;
  bottom: number;
  right: number;
  primaryColor: string;
  accentColor: string;
  logoUrl: string;
  headerLogoUrl: string;
  logoAnimation: string;
  welcomeTitle: string;
  welcomeSubtitle: string;
  userMsgColor: string;
  chatBackground: string;
  borderRadius?: number;
  fontFamily: string;
  tenantSlug?: string;
  entityToken: string | null;
};

type PublicWidgetConfig = Record<string, unknown>;

const readFirstString = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
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

const normalizeCssLength = (value: unknown, fallback: string) => {
  const raw = readFirstString(value);
  if (!raw) return fallback;
  return /^-?\d+(?:\.\d+)?$/.test(raw) ? `${raw}px` : raw;
};

const readFiniteInteger = (value: unknown, fallback: number) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const readTipoChat = (value: unknown): TipoChat | null =>
  value === 'pyme' || value === 'municipio' ? value : null;

const readView = (value: unknown): IframeWidgetParams['view'] => {
  if (
    value === 'chat' ||
    value === 'register' ||
    value === 'login' ||
    value === 'user' ||
    value === 'info'
  ) {
    return value;
  }
  return 'chat';
};

const resolveWidgetParams = (
  cfg: ReturnType<typeof getChatbocConfig>,
  urlParams: URLSearchParams,
  fetchedConfig: PublicWidgetConfig = {},
): IframeWidgetParams => {
  const tenantSlug = readFirstString(
    urlParams.get("tenant"),
    urlParams.get("tenantSlug"),
    fetchedConfig.slug,
    (fetchedConfig.tenant as Record<string, unknown> | undefined)?.slug,
    (fetchedConfig.tenant as Record<string, unknown> | undefined)?.tenant_slug,
  ) || undefined;
  const endpointFromUrl = readTipoChat(urlParams.get("endpoint")) || readTipoChat(urlParams.get("tipo_chat"));
  const endpointFromFetched =
    readTipoChat(fetchedConfig.tipo_chat) ||
    readTipoChat(fetchedConfig.endpoint);
  const endpointFromConfig = readTipoChat(cfg.endpoint);
  const endpoint = endpointFromUrl || endpointFromFetched || endpointFromConfig || undefined;
  const defaultOpen = readOptionalBoolean(
    urlParams.get("defaultOpen"),
    readOptionalBoolean(fetchedConfig.default_open ?? fetchedConfig.defaultOpen, Boolean(cfg.defaultOpen)),
  );
  const rawEntityToken = readFirstString(
    urlParams.get("entityToken"),
    urlParams.get("ownerToken"),
    fetchedConfig.entityToken,
    fetchedConfig.entity_token,
    fetchedConfig.widgetToken,
    fetchedConfig.widget_token,
    fetchedConfig.owner_token,
    fetchedConfig.token,
    cfg.entityToken,
  );
  const bottom = readFiniteInteger(
    readFirstString(urlParams.get("bottom"), fetchedConfig.offset_bottom, fetchedConfig.bottom, cfg.bottom),
    DEFAULTS.bottom,
  );
  const right = readFiniteInteger(
    readFirstString(urlParams.get("right"), fetchedConfig.offset_right, fetchedConfig.right, cfg.right),
    DEFAULTS.right,
  );
  const borderRadiusRaw = readFirstString(urlParams.get("borderRadius"), fetchedConfig.border_radius, fetchedConfig.borderRadius);
  const parsedBorderRadius = Number.parseInt(borderRadiusRaw, 10);

  return {
    defaultOpen,
    widgetId: readFirstString(urlParams.get("widgetId"), fetchedConfig.widget_id, fetchedConfig.widgetId) || "chatboc-iframe-unknown",
    view: readView(readFirstString(urlParams.get("view"), fetchedConfig.view)),
    openWidth: normalizeCssLength(readFirstString(urlParams.get("openWidth"), fetchedConfig.open_width, fetchedConfig.openWidth, cfg.width), DEFAULTS.openWidth),
    openHeight: normalizeCssLength(readFirstString(urlParams.get("openHeight"), fetchedConfig.open_height, fetchedConfig.openHeight, cfg.height), DEFAULTS.openHeight),
    closedWidth: normalizeCssLength(readFirstString(urlParams.get("closedWidth"), fetchedConfig.closed_width, fetchedConfig.closedWidth, cfg.closedWidth), DEFAULTS.closedWidth),
    closedHeight: normalizeCssLength(readFirstString(urlParams.get("closedHeight"), fetchedConfig.closed_height, fetchedConfig.closedHeight, cfg.closedHeight), DEFAULTS.closedHeight),
    ctaMessage: readFirstString(urlParams.get("ctaMessage"), fetchedConfig.cta_message, fetchedConfig.ctaMessage) || undefined,
    rubro: readFirstString(urlParams.get("rubro"), fetchedConfig.rubro) || undefined,
    endpoint,
    bottom,
    right,
    primaryColor: readFirstString(urlParams.get("primaryColor"), fetchedConfig.primary_color, fetchedConfig.primaryColor, cfg.primaryColor) || "#007aff",
    accentColor: readFirstString(urlParams.get("accentColor"), fetchedConfig.secondary_color, fetchedConfig.accentColor, cfg.accentColor),
    logoUrl: readFirstString(urlParams.get("logoUrl"), fetchedConfig.logo_url, fetchedConfig.logoUrl, cfg.logoUrl),
    headerLogoUrl: readFirstString(urlParams.get("headerLogoUrl"), fetchedConfig.header_logo_url, fetchedConfig.headerLogoUrl, cfg.headerLogoUrl),
    logoAnimation: readFirstString(urlParams.get("logoAnimation"), fetchedConfig.logo_animation, fetchedConfig.logoAnimation, cfg.logoAnimation),
    welcomeTitle: readFirstString(urlParams.get("welcomeTitle"), fetchedConfig.welcome_title, fetchedConfig.welcomeTitle, cfg.welcomeTitle),
    welcomeSubtitle: readFirstString(urlParams.get("welcomeSubtitle"), fetchedConfig.welcome_subtitle, fetchedConfig.welcomeSubtitle, cfg.welcomeSubtitle),
    userMsgColor: readFirstString(urlParams.get("userMsgColor"), fetchedConfig.user_msg_color, fetchedConfig.userMsgColor, cfg.userMsgColor),
    chatBackground: readFirstString(urlParams.get("chatBackground"), fetchedConfig.chat_background, fetchedConfig.chatBackground, cfg.chatBackground),
    borderRadius: Number.isFinite(parsedBorderRadius) ? parsedBorderRadius : undefined,
    fontFamily: readFirstString(urlParams.get("fontFamily"), fetchedConfig.font_family, fetchedConfig.fontFamily, cfg.fontFamily),
    tenantSlug,
    entityToken: rawEntityToken || null,
  };
};

const getInitialWidgetParams = () => {
  if (typeof window === 'undefined') return null;
  return resolveWidgetParams(getChatbocConfig(), new URLSearchParams(window.location.search));
};

const getIframeDimensions = (params: IframeWidgetParams) => (
  params.defaultOpen
    ? { width: params.openWidth, height: params.openHeight }
    : { width: params.closedWidth, height: params.closedHeight }
);

const getIframeShellStyle = (params: IframeWidgetParams): React.CSSProperties => {
  const dimensions = getIframeDimensions(params);
  const width = params.defaultOpen ? `min(100dvw, ${dimensions.width})` : dimensions.width;
  const height = params.defaultOpen ? `min(100dvh, ${dimensions.height})` : dimensions.height;
  return {
    width,
    height,
    minWidth: width,
    minHeight: height,
    maxWidth: "100dvw",
    maxHeight: "100dvh",
    overflow: "hidden",
    display: "flex",
    background: "transparent",
  };
};

const postIframeState = (params: IframeWidgetParams) => {
  if (typeof window === 'undefined' || window.parent === window) return;
  const dimensions = getIframeDimensions(params);
  const style = {
    width: dimensions.width,
    height: dimensions.height,
    bottom: `${params.bottom}px`,
    right: `${params.right}px`,
    borderRadius: params.defaultOpen ? `${params.borderRadius ?? 16}px` : "999px",
    boxShadow: params.defaultOpen ? "0 24px 70px rgba(15,23,42,0.22)" : "0 14px 34px rgba(15,23,42,0.22)",
    transition: "width 0.24s ease, height 0.24s ease, opacity 0.18s ease",
  };

  window.parent.postMessage({ type: "chatboc-ready", widgetId: params.widgetId }, "*");
  window.parent.postMessage({ type: "chatboc-state-change", widgetId: params.widgetId, dimensions, isOpen: params.defaultOpen }, "*");
  window.parent.postMessage({ type: "CHATBOC_RESIZE_CONTAINER", widgetId: params.widgetId, dimensions, style, isOpen: params.defaultOpen }, "*");
  window.parent.postMessage({ type: "CHATBOC_RESIZE", widgetId: params.widgetId, dimensions, isOpen: params.defaultOpen }, "*");
};

const IframeFallback = ({ params }: { params: IframeWidgetParams }) => (
  <div
    data-testid="chatboc-iframe-fallback"
    className={
      params.defaultOpen
        ? "flex h-full w-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-card text-card-foreground shadow-xl"
        : "flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-card text-primary shadow-lg"
    }
  >
    {params.defaultOpen ? (
      <>
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-border/60 px-4">
          <div className="h-10 w-10 rounded-full bg-primary/15" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3 w-28 rounded bg-muted" />
            <div className="h-2 w-40 max-w-full rounded bg-muted/70" />
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <div>
            <p className="text-sm font-semibold text-foreground">Cargando asistente Chatboc</p>
            <p className="mt-1 text-xs text-muted-foreground">Preparando el chat y las opciones del menu.</p>
          </div>
        </div>
        <div className="h-20 shrink-0 border-t border-border/60 bg-card/95 p-3">
          <div className="h-11 rounded-[22px] border border-border/70 bg-background" />
        </div>
      </>
    ) : (
      <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    )}
    <span className="sr-only">Cargando Chatboc</span>
  </div>
);

const IframePage = () => {
  const initialWidgetParams = useMemo(() => getInitialWidgetParams(), []);
  const [widgetParams, setWidgetParams] = useState<IframeWidgetParams | null>(initialWidgetParams);
  const [entityToken, setEntityToken] = useState<string | null>(initialWidgetParams?.entityToken ?? null);
  const [tipoChat, setTipoChat] = useState<TipoChat | null>(initialWidgetParams?.endpoint ?? null);
  const [isLoading, setIsLoading] = useState(() => !initialWidgetParams);
  const isInRouter = useInRouterContext();

  useEffect(() => {
    // Add iframe-mode class for transparent background
    document.documentElement.classList.add('iframe-mode');
    document.body.classList.add('iframe-mode');
    const styleTargets = [
      document.documentElement,
      document.body,
      document.getElementById("root"),
      document.getElementById("__next"),
      document.getElementById("app"),
    ].filter((node): node is HTMLElement => Boolean(node));
    const previousStyles = styleTargets.map((node) => ({
      node,
      height: node.style.height,
      minHeight: node.style.minHeight,
      overflow: node.style.overflow,
      paddingBottom: node.style.paddingBottom,
    }));
    styleTargets.forEach((node) => {
      node.style.height = "100%";
      node.style.minHeight = "0";
      node.style.overflow = "hidden";
    });
    document.body.style.paddingBottom = "0";

    return () => {
      document.documentElement.classList.remove('iframe-mode');
      document.body.classList.remove('iframe-mode');
      previousStyles.forEach(({ node, height, minHeight, overflow, paddingBottom }) => {
        node.style.height = height;
        node.style.minHeight = minHeight;
        node.style.overflow = overflow;
        node.style.paddingBottom = paddingBottom;
      });
    };
  }, []);

  useEffect(() => {
    const initializeWidget = async () => {
      const cfg = getChatbocConfig();
      const urlParams = new URLSearchParams(window.location.search);
      const immediateParams = resolveWidgetParams(cfg, urlParams);
      setWidgetParams(immediateParams);
      setEntityToken(immediateParams.entityToken);
      setTipoChat(immediateParams.endpoint ?? null);
      postIframeState(immediateParams);
      setIsLoading(true);

      // Extract tenant slug from URL or data attribute passed
      const tenantSlug = immediateParams.tenantSlug;

      let fetchedConfig: PublicWidgetConfig = {};
      if (tenantSlug) {
        try {
          await ensureBackendRuntimeReady();
          const response = await fetch(`/api/public/tenants/${tenantSlug}/widget-config`, {
            credentials: "omit",
            headers: {
              Accept: "application/json",
            },
          });
          if (!response.ok) {
            throw new Error(`Failed to load widget config (${response.status})`);
          }
          const publicConfig = await response.json();
          fetchedConfig = publicConfig || {};
        } catch (e) {
          console.warn("Could not fetch tenant widget config", e);
        }
      }

      const resolvedParams = resolveWidgetParams(cfg, urlParams, fetchedConfig);
      document.documentElement.style.setProperty("--primary", hexToHsl(resolvedParams.primaryColor));
      if (resolvedParams.accentColor) {
        document.documentElement.style.setProperty("--accent", hexToHsl(resolvedParams.accentColor));
      }

      if (resolvedParams.entityToken) {
        setEntityToken(resolvedParams.entityToken);
        safeLocalStorage.setItem("entityToken", resolvedParams.entityToken);
      } else {
        setEntityToken(null);
        safeLocalStorage.removeItem("entityToken");
      }

      if (resolvedParams.endpoint) {
        setTipoChat(resolvedParams.endpoint);
      }

      setWidgetParams(resolvedParams);
      postIframeState(resolvedParams);

      const mergedConfig = {
        ...cfg,
        endpoint: resolvedParams.endpoint || cfg.endpoint || 'pyme',
        entityToken: resolvedParams.entityToken || '',
        defaultOpen: resolvedParams.defaultOpen,
        width: resolvedParams.openWidth,
        height: resolvedParams.openHeight,
        closedWidth: resolvedParams.closedWidth,
        closedHeight: resolvedParams.closedHeight,
        bottom: `${resolvedParams.bottom}px`,
        right: `${resolvedParams.right}px`,
        primaryColor: resolvedParams.primaryColor,
        accentColor: resolvedParams.accentColor,
        logoUrl: resolvedParams.logoUrl,
        headerLogoUrl: resolvedParams.headerLogoUrl,
        logoAnimation: resolvedParams.logoAnimation,
        welcomeTitle: resolvedParams.welcomeTitle,
        welcomeSubtitle: resolvedParams.welcomeSubtitle,
        userMsgColor: resolvedParams.userMsgColor,
        chatBackground: resolvedParams.chatBackground,
        borderRadius: resolvedParams.borderRadius,
        fontFamily: resolvedParams.fontFamily,
        tenantSlug: resolvedParams.tenantSlug,
      };

      if (typeof window !== 'undefined') {
        (window as any).CHATBOC_CONFIG = mergedConfig;
      }

      setIsLoading(false);
    };

    initializeWidget();
  }, []);

  useEffect(() => {
    if (!widgetParams) return;
    postIframeState(widgetParams);
  }, [widgetParams]);

  useEffect(() => {
    if (entityToken && !tipoChat) {
      const fetchTokenInfo = async () => {
        try {
          const info = await apiFetch<{ tipo_chat: 'pyme' | 'municipio' }>(
            '/auth/token-info',
            {
              isWidgetRequest: true,
              sendAnonId: true,
              omitCredentials: true,
            }
          );
          setTipoChat(info.tipo_chat);
        } catch (error) {
          console.error("Error fetching token info:", error);
          // Fallback to pyme if API fails to avoid breaking the widget
          setTipoChat('pyme');
        } finally {
          setIsLoading(false);
        }
      };
      fetchTokenInfo();
    }
  }, [entityToken, tipoChat]);

  const shellStyle = useMemo(
    () => widgetParams ? getIframeShellStyle(widgetParams) : undefined,
    [widgetParams],
  );

  if (!widgetParams || !shellStyle) return null;

  const initialEntry =
    typeof window !== 'undefined'
      ? `${window.location.pathname}${window.location.search}`
      : '/';

  const widgetTree = (
    <TenantProvider>
       <React.Suspense fallback={<IframeFallback params={widgetParams} />}>
        <ChatWidgetComponent
          mode="iframe"
          ownerToken={entityToken || undefined}
          defaultOpen={widgetParams.defaultOpen}
          widgetId={widgetParams.widgetId}
          tipoChat={tipoChat || undefined}
          openWidth={widgetParams.openWidth}
          openHeight={widgetParams.openHeight}
          closedWidth={widgetParams.closedWidth}
          closedHeight={widgetParams.closedHeight}
          initialPosition={{ bottom: widgetParams.bottom, right: widgetParams.right }}
          ctaMessage={widgetParams.ctaMessage}
          initialView={widgetParams.view}
          initialRubro={widgetParams.rubro}
          customLauncherLogoUrl={widgetParams.logoUrl}
          logoAnimation={widgetParams.logoAnimation}
          headerLogoUrl={widgetParams.headerLogoUrl}
          welcomeTitle={widgetParams.welcomeTitle}
          welcomeSubtitle={widgetParams.welcomeSubtitle}
          tenantSlug={widgetParams.tenantSlug}
          primaryColor={widgetParams.primaryColor}
          accentColor={widgetParams.accentColor}
          userMsgColor={widgetParams.userMsgColor}
          chatBackground={widgetParams.chatBackground}
          borderRadius={widgetParams.borderRadius}
          fontFamily={widgetParams.fontFamily}
        />
      </React.Suspense>
    </TenantProvider>
  );

  const maybeWrappedInRouter = isInRouter ? (
    widgetTree
  ) : (
    <MemoryRouter initialEntries={[initialEntry]}>{widgetTree}</MemoryRouter>
  );

  // If no Google Client ID, skip the Provider to avoid crashes.
  if (!GOOGLE_CLIENT_ID) {
    return (
      <div style={shellStyle} aria-busy={isLoading}>
        {maybeWrappedInRouter}
      </div>
    );
  }

  return (
    <div style={shellStyle} aria-busy={isLoading}>
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        {maybeWrappedInRouter}
      </GoogleOAuthProvider>
    </div>
  );
};

export default IframePage;
