import "../index.css";
import { createRoot } from 'react-dom/client';
import React, { useEffect, useState } from "react";
import ChatWidget from "../components/chat/ChatWidget";
import { GoogleOAuthProvider } from "@react-oauth/google";
import ErrorBoundary from '../components/ErrorBoundary';
import { MemoryRouter } from "react-router-dom";
import { getChatbocConfig } from "@/utils/config";
import { hexToHsl } from "@/utils/color";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import { activateWidgetMode, deactivateWidgetMode } from "@/utils/widgetMode";

const DEFAULTS = {
  openWidth: "460px",
  openHeight: "680px",
  closedWidth: "96px",
  closedHeight: "96px",
  bottom: 20,
  right: 20,
};

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
if (!GOOGLE_CLIENT_ID) {
  console.warn(
    'VITE_GOOGLE_CLIENT_ID is missing. Google OAuth login will fail until this variable is set. See README.md for setup instructions.'
  );
}

import { apiFetch } from "@/services/apiService";

const Iframe = () => {
  const [widgetParams, setWidgetParams] = useState<any | null>(null);
  const [entityToken, setEntityToken] = useState<string | null>(null);
  const [tipoChat, setTipoChat] = useState<'pyme' | 'municipio' | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    activateWidgetMode();
    return () => {
      deactivateWidgetMode();
    };
  }, []);

  useEffect(() => {
    const cfg = getChatbocConfig();
    const urlParams = new URLSearchParams(window.location.search);

    const primaryColorHex = urlParams.get("primaryColor") || cfg.primaryColor || "#007aff";
    document.documentElement.style.setProperty("--primary", hexToHsl(primaryColorHex));
    const accentColorHex = urlParams.get("accentColor") || cfg.accentColor || "";
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

    const widgetId = urlParams.get("widgetId") || "chatboc-iframe-unknown";
    const view = urlParams.get("view") || 'chat';
    const defaultOpenParam = urlParams.get("defaultOpen");
    const defaultOpen =
      typeof defaultOpenParam === 'string'
        ? defaultOpenParam === 'true'
        : cfg.defaultOpen;
    const openWidth = urlParams.get("openWidth") || cfg.width || DEFAULTS.openWidth;
    const openHeight = urlParams.get("openHeight") || cfg.height || DEFAULTS.openHeight;
    const closedWidth = urlParams.get("closedWidth") || cfg.closedWidth || DEFAULTS.closedWidth;
    const closedHeight = urlParams.get("closedHeight") || cfg.closedHeight || DEFAULTS.closedHeight;
    const bottomParam = urlParams.get("bottom") || cfg.bottom || String(DEFAULTS.bottom);
    const rightParam = urlParams.get("right") || cfg.right || String(DEFAULTS.right);
    const bottomValue = Number.parseInt(bottomParam, 10);
    const rightValue = Number.parseInt(rightParam, 10);
    const logoUrl = urlParams.get("logoUrl") || cfg.logoUrl || '';
    const headerLogoUrl = urlParams.get("headerLogoUrl") || cfg.headerLogoUrl || '';
    const logoAnimation = urlParams.get("logoAnimation") || cfg.logoAnimation || '';
    const welcomeTitle = urlParams.get("welcomeTitle") || cfg.welcomeTitle || '';
    const welcomeSubtitle = urlParams.get("welcomeSubtitle") || cfg.welcomeSubtitle || '';

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
    };

    if (typeof window !== 'undefined') {
      (window as any).CHATBOC_CONFIG = mergedConfig;
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (entityToken && !tipoChat) {
      const fetchTokenInfo = async () => {
        try {
          setIsLoading(true);
          const info = await apiFetch<{ tipo_chat: 'pyme' | 'municipio' }>('/auth/token-info');
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

  const ChatWidgetComponent = () => (
    <ChatWidget
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
    />
  );

  // Si no hay Google Client ID, no renderizar el Provider para evitar que crashee.
  if (!GOOGLE_CLIENT_ID) {
    return (
      <MemoryRouter>
        <ChatWidgetComponent />
      </MemoryRouter>
    );
  }

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <MemoryRouter>
        <ChatWidgetComponent />
      </MemoryRouter>
    </GoogleOAuthProvider>
  );
};

export default Iframe;

const container = document.getElementById('root')!;
createRoot(container).render(
    <ErrorBoundary>
        <Iframe />
    </ErrorBoundary>
);
