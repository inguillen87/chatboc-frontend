import './index.css';
import { createRoot } from 'react-dom/client';
import React, { useEffect, useState } from "react";
import ChatWidget from "../components/chat/ChatWidget";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import ErrorBoundary from '../components/ErrorBoundary';

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

const Iframe = () => {
  const [params, setParams] = useState<any>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const tokenFromUrl = urlParams.get("token");

      if (tokenFromUrl) {
        safeLocalStorage.setItem('entityToken', tokenFromUrl);
        console.log('Chatboc Iframe: entityToken guardado en localStorage desde URL:', tokenFromUrl);
      } else {
        console.warn('Chatboc Iframe: No se encontró token en la URL del iframe. localStorage no actualizado.');
        // Opcional: limpiar el token si no viene en la URL, para evitar usar uno antiguo.
        // safeLocalStorage.removeItem('entityToken');
      }

      setParams({
        defaultOpen: urlParams.get("defaultOpen") === "true",
        widgetId: urlParams.get("widgetId") || "chatboc-iframe-unknown",
        token: tokenFromUrl, // Usar la variable ya leída
        view: urlParams.get("view") || 'chat',
        openWidth: urlParams.get("openWidth") || DEFAULTS.openWidth,
        openHeight: urlParams.get("openHeight") || DEFAULTS.openHeight,
        closedWidth: urlParams.get("closedWidth") || DEFAULTS.closedWidth,
        closedHeight: urlParams.get("closedHeight") || DEFAULTS.closedHeight,
        tipoChat:
          urlParams.get("tipo_chat") === "municipio" ? "municipio" : "pyme",
        ctaMessage: urlParams.get("ctaMessage") || undefined,
        rubro: urlParams.get("rubro") || undefined,
      });
    }
  }, []);

  if (!params || !params.token) return null;
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <ChatWidget
        mode="iframe"
        defaultOpen={params.defaultOpen}
        widgetId={params.widgetId}
        entityToken={params.token}
        tipoChat={params.tipoChat}
        openWidth={params.openWidth}
        openHeight={params.openHeight}
        closedWidth={params.closedWidth}
        closedHeight={params.closedHeight}
        ctaMessage={params.ctaMessage}
        initialView={params.view}
        initialRubro={params.rubro}
      />
    </GoogleOAuthProvider>
  );
};

const container = document.getElementById('root')!;
createRoot(container).render(
    <ErrorBoundary>
        <Iframe />
    </ErrorBoundary>
);
