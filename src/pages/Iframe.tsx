// src/pages/Iframe.tsx

import React, { useEffect, useState, Suspense } from "react";

// Si usás Vite y no tenés el alias '@', cambialo a la ruta relativa real:
const ChatWidget = React.lazy(() => import("../components/chat/ChatWidget")); 

const Iframe = () => {
  const [defaultOpen, setDefaultOpen] = useState(false);
  const [widgetId, setWidgetId] = useState("chatboc-iframe-unknown");
  const [tokenFromUrl, setTokenFromUrl] = useState<string | null>(null);
  const [initialIframeWidth, setInitialIframeWidth] = useState<string | null>(null);
  const [initialIframeHeight, setInitialIframeHeight] = useState<string | null>(null);

  // ----------- SETEO DE PARAMS, TEMA Y DIMENSIONES ----------- //
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      setDefaultOpen(params.get("defaultOpen") === "true");
      if (params.get("widgetId")) setWidgetId(params.get("widgetId")!);
      if (params.get("token")) setTokenFromUrl(params.get("token"));
      if (params.get("initialWidth")) setInitialIframeWidth(params.get("initialWidth"));
      if (params.get("initialHeight")) setInitialIframeHeight(params.get("initialHeight"));

      // Tema (dark/light)
      const themeParam = params.get("theme");
      if (themeParam === "dark" || themeParam === "light") {
        document.documentElement.classList.remove("dark", "light");
        document.documentElement.classList.add(themeParam);
        localStorage.setItem("theme", themeParam);
      } else {
        const storedTheme = localStorage.getItem("theme");
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

  // ----------- FUERZO HTML/BODY/ROOT 100% Y TRANSPARENT ----------- //
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.style.width = "100%";
      document.documentElement.style.height = "100%";
      document.documentElement.style.background = "transparent";
      document.body.style.background = "transparent";
      document.body.style.margin = "0";
      document.body.style.padding = "0";
      document.body.style.width = "100%";
      document.body.style.height = "100%";
      document.body.style.overflow = "hidden";
      document.body.style.display = "flex";
      document.body.style.flexDirection = "column";
      const rootEl =
        document.getElementById("root") ||
        document.getElementById("__next") ||
        document.getElementById("app");
      if (rootEl) {
        rootEl.style.height = "100%";
        rootEl.style.width = "100%";
        rootEl.style.display = "flex";
        rootEl.style.flexDirection = "column";
        rootEl.style.overflow = "hidden";
        rootEl.style.background = "transparent";
      }
    }
  }, []);

  // ----------- RENDER ----------- //
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "transparent",
        margin: 0,
        padding: 0,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Suspense
        fallback={
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              height: "100%",
              fontFamily: "Arial, sans-serif",
              fontSize: "12px",
              color: "#555",
            }}
          >
            Cargando Chatboc...
          </div>
        }
      >
        <ChatWidget
          mode="iframe"
          defaultOpen={defaultOpen}
          widgetId={widgetId}
          authToken={tokenFromUrl}
          initialIframeWidth={initialIframeWidth}
          initialIframeHeight={initialIframeHeight}
        />
        {console.log("ChatWidget montado!")}
      </Suspense>
    </div>
  );
};

export default Iframe;
