import "../index.css";
import { createRoot } from 'react-dom/client';
import React, { useEffect, useState } from "react";
import ChatWidget from "../components/chat/ChatWidget";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import ErrorBoundary from '../components/ErrorBoundary';
import { MemoryRouter } from "react-router-dom";

const DEFAULTS = {
  openWidth: "460px",
  openHeight: "680px",
  closedWidth: "96px",
  closedHeight: "96px",
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
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl =
      urlParams.get("token") || urlParams.get("entityToken");
    const storedToken = safeLocalStorage.getItem("entityToken");
    const currentToken = tokenFromUrl || storedToken;
    const rawEndpoint = urlParams.get("endpoint") || urlParams.get("tipo_chat");
    const endpointParam =
      rawEndpoint === 'pyme' || rawEndpoint === 'municipio'
        ? (rawEndpoint as 'pyme' | 'municipio')
        : null;

    if (tokenFromUrl && tokenFromUrl !== storedToken) {
      safeLocalStorage.setItem("entityToken", tokenFromUrl);
      console.log(
        "Chatboc Iframe: entityToken guardado en localStorage desde URL:",
        tokenFromUrl
      );
    }

    if (currentToken) {
      setEntityToken(currentToken);
    } else {
      console.warn('Chatboc Iframe: No se encontró token en la URL ni en localStorage.');
      setIsLoading(false);
    }

    setWidgetParams({
      defaultOpen: urlParams.get("defaultOpen") === "true",
      widgetId: urlParams.get("widgetId") || "chatboc-iframe-unknown",
      view: urlParams.get("view") || 'chat',
      openWidth: urlParams.get("openWidth") || DEFAULTS.openWidth,
      openHeight: urlParams.get("openHeight") || DEFAULTS.openHeight,
      closedWidth: urlParams.get("closedWidth") || DEFAULTS.closedWidth,
      closedHeight: urlParams.get("closedHeight") || DEFAULTS.closedHeight,
      ctaMessage: urlParams.get("ctaMessage") || undefined,
      rubro: urlParams.get("rubro") || undefined,
      endpoint: endpointParam || undefined,
    });

    if (endpointParam) {
      setTipoChat(endpointParam);
      setIsLoading(false);
    }
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

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <MemoryRouter>
        <ChatWidget
          mode="iframe"
          entityToken={entityToken}
          defaultOpen={widgetParams.defaultOpen}
          widgetId={widgetParams.widgetId}
          tipoChat={tipoChat || undefined}
          openWidth={widgetParams.openWidth}
          openHeight={widgetParams.openHeight}
          closedWidth={widgetParams.closedWidth}
          closedHeight={widgetParams.closedHeight}
          ctaMessage={widgetParams.ctaMessage}
          initialView={widgetParams.view}
          initialRubro={widgetParams.rubro}
        />
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
