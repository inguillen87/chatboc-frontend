// src/pages/Iframe.tsx (VERSIÓN FINAL Y CORREGIDA)

import React, { useEffect, useState } from "react";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import ChatWidget from "../components/chat/ChatWidget";
import { Toaster } from "@/components/ui/sonner"; 

// Loader visual elegante (se mantiene igual)
function Loader() {
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        minHeight: "320px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--background, #f8fafc)",
        fontFamily: "Inter, Arial, sans-serif",
        fontWeight: 500,
        color: "#666",
        fontSize: "1.1rem",
        letterSpacing: "0.02em",
      }}
    >
      <div className="flex flex-col items-center gap-2">
        <img
          src="/favicon/favicon-48x48.png"
          alt="Chatboc"
          width={48}
          height={48}
          style={{ filter: "drop-shadow(0 2px 10px #2c82ef44)", marginBottom: 4 }}
        />
        <span>Cargando Chatboc...</span>
      </div>
    </div>
  );
}

const Iframe = () => {
  const [widgetParams, setWidgetParams] = useState({
    defaultOpen: false,
    widgetId: "chatboc-iframe-unknown",
    token: null as string | null, // Este es el entityToken que viene de la URL
    initialIframeWidth: null as string | null,
    initialIframeHeight: null as string | null,
    openWidth: null as string | null,
    openHeight: null as string | null,
    closedWidth: null as string | null,
    closedHeight: null as string | null,
    theme: "light",
    tipoChat: "pyme" as "pyme" | "municipio",
  });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const openParam = params.get("defaultOpen");
      const idParam = params.get("widgetId");
      const tokenParam = params.get("token");
      const initialWidthParam = params.get("initialWidth");
      const initialHeightParam = params.get("initialHeight");
      const openWidthParam = params.get("openWidth");
      const openHeightParam = params.get("openHeight");
      const closedWidthParam = params.get("closedWidth");
      const closedHeightParam = params.get("closedHeight");
      const themeParam = params.get("theme");
      const tipoChatParam = params.get("tipo_chat");

      setWidgetParams({
        defaultOpen: openParam === "true",
        widgetId: idParam || "chatboc-iframe-unknown",
        token: tokenParam,
        initialIframeWidth: initialWidthParam,
        initialIframeHeight: initialHeightParam,
        openWidth: openWidthParam,
        openHeight: openHeightParam,
        closedWidth: closedWidthParam,
        closedHeight: closedHeightParam,
        theme: themeParam === "dark" || themeParam === "light" ? themeParam : "light",
        tipoChat: tipoChatParam === "municipio" ? "municipio" : "pyme",
      });

      if (themeParam === "dark" || themeParam === "light") {
        document.documentElement.classList.remove("dark", "light");
        document.documentElement.classList.add(themeParam);
        safeLocalStorage.setItem("theme", themeParam);
      } else {
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

      document.documentElement.style.background = "var(--background, #f8fafc)";
      document.body.style.background = "var(--background, #f8fafc)";
      document.body.style.margin = "0";
      document.body.style.padding = "0";
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
      document.body.style.height = "100%";
      document.documentElement.style.height = "100%";
      document.body.style.width = "100%";
      document.documentElement.style.width = "100%";
      document.body.style.paddingTop = "env(safe-area-inset-top)";
      document.body.style.paddingBottom = "env(safe-area-inset-bottom)";
      setReady(true);
    }
  }, []);

  if (!widgetParams.token) return <Loader />;

  return (
    <div
      style={{
        width: "100%", 
        height: "100%", 
        minHeight: "320px", 
        background: "var(--background, #f8fafc)",
        margin: 0,
        padding: 0,
        overflow: "hidden",
        position: "relative", 
      }}
      className="relative" 
    >
      <ChatWidget
        mode="iframe"
        defaultOpen={widgetParams.defaultOpen}
        widgetId={widgetParams.widgetId}
        entityToken={widgetParams.token} 
        tipoChat={widgetParams.tipoChat}
        openWidth={widgetParams.openWidth}
        openHeight={widgetParams.openHeight}
        closedWidth={widgetParams.closedWidth}
        closedHeight={widgetParams.closedHeight}
      />
      <Toaster /> 
      {console.log("ChatWidget montado!")}
    </div>
  );
};

export default Iframe;