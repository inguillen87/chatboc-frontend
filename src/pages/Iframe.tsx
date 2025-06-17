// src/pages/Iframe.tsx

import React, { useEffect, useState } from "react";
import { safeLocalStorage } from "@/utils/safeLocalStorage";

// Importa directamente para evitar problemas con React.lazy en algunos entornos
import ChatWidget from "../components/chat/ChatWidget";
import ErrorBoundary from "../components/ErrorBoundary";

const Iframe = () => {
  const [defaultOpen, setDefaultOpen] = useState(false);
  const [widgetId, setWidgetId] = useState("chatboc-iframe-unknown");
  const [tokenFromUrl, setTokenFromUrl] = useState<string | null>(null);
  const [initialIframeWidth, setInitialIframeWidth] = useState<string | null>(null);
  const [initialIframeHeight, setInitialIframeHeight] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const openParam = params.get("defaultOpen");
      const idParam = params.get("widgetId");
      const tokenParam = params.get("token");
      const widthParam = params.get("initialWidth");
      const heightParam = params.get("initialHeight");
      const themeParam = params.get("theme");

      setDefaultOpen(openParam === "true");
      if (idParam) setWidgetId(idParam);
      if (tokenParam) setTokenFromUrl(tokenParam);
      if (widthParam) setInitialIframeWidth(widthParam);
      if (heightParam) setInitialIframeHeight(heightParam);

      // Tema: Si viene en URL, setea y guarda en localStorage para próximas veces
      if (themeParam === "dark" || themeParam === "light") {
        document.documentElement.classList.remove("dark", "light");
        document.documentElement.classList.add(themeParam);
        safeLocalStorage.setItem("theme", themeParam);
      } else {
        // Si no viene por URL, usá localStorage o el sistema
        const storedTheme = safeLocalStorage.getItem("theme");
        if (storedTheme === "dark" || storedTheme === "light") {
          document.documentElement.classList.remove("dark", "light");
          document.documentElement.classList.add(storedTheme);
        } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
        }
      }
    }
  }, []);

  // Seteamos fondos acordes al tema sin romper el overflow ni el scroll
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.style.background = "var(--background)";
      document.body.style.background = "var(--background)";
      document.body.style.margin = "0";
      document.body.style.padding = "0";
      // NO tocar overflow, NO tocar height/width acá
    }
  }, []);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "var(--background)",
        margin: 0,
        padding: 0,
        overflow: "visible", // permite que el contenido crezca si hace falta
        display: "flex",
        flexDirection: "column",
      }}
    >
      <ErrorBoundary fallbackMessage="⚠️ Servicio no disponible.">
        <ChatWidget
          mode="iframe"
          defaultOpen={defaultOpen}
          widgetId={widgetId}
          authToken={tokenFromUrl}
          initialIframeWidth={initialIframeWidth}
          initialIframeHeight={initialIframeHeight}
        />
      </ErrorBoundary>
      {console.log("ChatWidget montado!")}
    </div>
  );
};

export default Iframe;
