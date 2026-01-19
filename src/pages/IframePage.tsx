import React, { useEffect, useState } from "react";
import ChatWidgetComponent from "@/components/chat/ChatWidget";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { MemoryRouter, useInRouterContext } from "react-router-dom";
import { TenantProvider } from "@/context/TenantContext";
import { getChatbocConfig } from "@/utils/config";
import { hexToHsl } from "@/utils/color";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import { apiFetch } from "@/utils/api";
import { GOOGLE_CLIENT_ID } from '@/env';
import { tenantService } from '@/services/tenantService';

const DEFAULTS = {
  openWidth: "460px",
  openHeight: "680px",
  closedWidth: "96px",
  closedHeight: "96px",
  bottom: 20,
  right: 20,
};

const IframePage = () => {
  const [widgetParams, setWidgetParams] = useState<any | null>(null);
  const [entityToken, setEntityToken] = useState<string | null>(null);
  const [tipoChat, setTipoChat] = useState<'pyme' | 'municipio' | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tenantConfig, setTenantConfig] = useState<any | null>(null);
  const isInRouter = useInRouterContext();

  useEffect(() => {
    // Add iframe-mode class for transparent background
    document.documentElement.classList.add('iframe-mode');
    document.body.classList.add('iframe-mode');

    return () => {
      document.documentElement.classList.remove('iframe-mode');
      document.body.classList.remove('iframe-mode');
    };
  }, []);

  useEffect(() => {
    const initializeWidget = async () => {
      const cfg = getChatbocConfig();
      const urlParams = new URLSearchParams(window.location.search);

      // Extract tenant slug from URL or data attribute passed
      const tenantSlug = urlParams.get("tenant") || urlParams.get("tenantSlug");

      let fetchedConfig: any = {};
      if (tenantSlug) {
        try {
          const publicConfig = await tenantService.getPublicWidgetConfig(tenantSlug);
          fetchedConfig = publicConfig || {};
          setTenantConfig(fetchedConfig);

          // Handle Dark/Light mode from theme_config
          if (fetchedConfig.theme_config?.mode === 'dark') {
            document.documentElement.classList.add('dark');
          } else {
            // Ensure we don't persist dark mode if switching tenants or configs, though this runs once per iframe load
            document.documentElement.classList.remove('dark');
          }

        } catch (e) {
          console.warn("Could not fetch tenant widget config", e);
        }
      }

      // Priority: URL Param > Fetched Config > Local Config > Default
      const primaryColorHex = urlParams.get("primaryColor") || fetchedConfig.primary_color || cfg.primaryColor || "#007aff";
      document.documentElement.style.setProperty("--primary", hexToHsl(primaryColorHex));
      const accentColorHex = urlParams.get("accentColor") || fetchedConfig.secondary_color || cfg.accentColor || "";
      if (accentColorHex) {
        document.documentElement.style.setProperty("--accent", hexToHsl(accentColorHex));
      }

      const rawEntityToken =
        urlParams.get("entityToken") ||
        urlParams.get("ownerToken") ||
        cfg.entityToken ||
        '';
      if (rawEntityToken) {
        setEntityToken(rawEntityToken);
        safeLocalStorage.setItem("entityToken", rawEntityToken);
      } else {
        setEntityToken(null);
        safeLocalStorage.removeItem("entityToken");
      }

      const endpointFromUrl = urlParams.get("endpoint") || urlParams.get("tipo_chat");
      const configEndpoint =
        cfg.endpoint === 'pyme' || cfg.endpoint === 'municipio'
          ? (cfg.endpoint as 'pyme' | 'municipio')
          : null;
      const endpointParam =
        endpointFromUrl === 'pyme' || endpointFromUrl === 'municipio'
          ? (endpointFromUrl as 'pyme' | 'municipio')
          : null;
      const resolvedEndpoint = endpointParam || configEndpoint || null;
      if (resolvedEndpoint) {
        setTipoChat(resolvedEndpoint);
      }

      const widgetId = urlParams.get("widgetId") || fetchedConfig.widget_id || "chatboc-iframe-unknown";
      const view = urlParams.get("view") || 'chat';
      const defaultOpenParam = urlParams.get("defaultOpen");
      const defaultOpen =
        typeof defaultOpenParam === 'string'
          ? defaultOpenParam === 'true'
          : (fetchedConfig.default_open ?? cfg.defaultOpen);
      const openWidth = urlParams.get("openWidth") || fetchedConfig.open_width || cfg.width || DEFAULTS.openWidth;
      const openHeight = urlParams.get("openHeight") || fetchedConfig.open_height || cfg.height || DEFAULTS.openHeight;
      const closedWidth = urlParams.get("closedWidth") || fetchedConfig.closed_width || cfg.closedWidth || DEFAULTS.closedWidth;
      const closedHeight = urlParams.get("closedHeight") || fetchedConfig.closed_height || cfg.closedHeight || DEFAULTS.closedHeight;
      const bottomParam = urlParams.get("bottom") || fetchedConfig.offset_bottom || cfg.bottom || String(DEFAULTS.bottom);
      const rightParam = urlParams.get("right") || fetchedConfig.offset_right || cfg.right || String(DEFAULTS.right);
      const bottomValue = Number.parseInt(String(bottomParam), 10);
      const rightValue = Number.parseInt(String(rightParam), 10);
      const logoUrl = urlParams.get("logoUrl") || fetchedConfig.logo_url || cfg.logoUrl || '';
      const headerLogoUrl = urlParams.get("headerLogoUrl") || fetchedConfig.header_logo_url || cfg.headerLogoUrl || '';
      const logoAnimation = urlParams.get("logoAnimation") || fetchedConfig.logo_animation || cfg.logoAnimation || '';
      const welcomeTitle = urlParams.get("welcomeTitle") || fetchedConfig.welcome_title || cfg.welcomeTitle || '';
      const welcomeSubtitle = urlParams.get("welcomeSubtitle") || fetchedConfig.welcome_subtitle || cfg.welcomeSubtitle || '';

      setWidgetParams({
        defaultOpen,
        widgetId,
        view,
        openWidth,
        openHeight,
        closedWidth,
        closedHeight,
        ctaMessage: urlParams.get("ctaMessage") || undefined,
        rubro: urlParams.get("rubro") || undefined,
        endpoint: resolvedEndpoint || undefined,
        bottom: Number.isFinite(bottomValue) ? bottomValue : DEFAULTS.bottom,
        right: Number.isFinite(rightValue) ? rightValue : DEFAULTS.right,
        primaryColor: primaryColorHex,
        accentColor: accentColorHex,
        logoUrl,
        headerLogoUrl,
        logoAnimation,
        welcomeTitle,
        welcomeSubtitle,
        tenantSlug: tenantSlug,
      });

      const mergedConfig = {
        ...cfg,
        endpoint: resolvedEndpoint || cfg.endpoint || 'pyme',
        entityToken: rawEntityToken || '',
        defaultOpen,
        width: openWidth,
        height: openHeight,
        closedWidth,
        closedHeight,
        bottom: bottomParam,
        right: rightParam,
        primaryColor: primaryColorHex,
        accentColor: accentColorHex,
        logoUrl,
        headerLogoUrl,
        logoAnimation,
        welcomeTitle,
        welcomeSubtitle,
        tenantSlug,
      };

      if (typeof window !== 'undefined') {
        (window as any).CHATBOC_CONFIG = mergedConfig;
      }

      setIsLoading(false);
    };

    initializeWidget();
  }, []);

  useEffect(() => {
    if (entityToken && !tipoChat) {
      const fetchTokenInfo = async () => {
        try {
          setIsLoading(true);
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
          // Fallback a pyme si falla la API, para no romper el widget
          setTipoChat('pyme');
        } finally {
          setIsLoading(false);
        }
      };
      fetchTokenInfo();
    }
  }, [entityToken, tipoChat]);

  // Muestra un loader mientras se determina el tipo de chat
  if (isLoading || !widgetParams) {
    return null; // O un componente de carga más explícito
  }

  const initialEntry =
    typeof window !== 'undefined'
      ? `${window.location.pathname}${window.location.search}`
      : '/';

  const ChatWidgetRender = () => (
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
    />
  );

  const widgetTree = (
    <TenantProvider>
      <ChatWidgetRender />
    </TenantProvider>
  );

  const maybeWrappedInRouter = isInRouter ? (
    widgetTree
  ) : (
    <MemoryRouter initialEntries={[initialEntry]}>{widgetTree}</MemoryRouter>
  );

  // Si no hay Google Client ID, no renderizar el Provider para evitar que crashee.
  if (!GOOGLE_CLIENT_ID) {
    return maybeWrappedInRouter;
  }

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      {maybeWrappedInRouter}
    </GoogleOAuthProvider>
  );
};

export default IframePage;
