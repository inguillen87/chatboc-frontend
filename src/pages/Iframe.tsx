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

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const openParam = params.get("defaultOpen");
      const idParam = params.get("widgetId");
      const tokenParam = params.get("token");
      const widthParam = params.get("initialWidth");
      const heightParam = params.get("initialHeight");

      setDefaultOpen(openParam === "true");
      if (idParam) setWidgetId(idParam);
      if (tokenParam) setTokenFromUrl(tokenParam); 
      if (widthParam) setInitialIframeWidth(widthParam); 
      if (heightParam) setInitialIframeHeight(heightParam);
    }
  }, []);

  // Aplicar tema oscuro igual que en el sitio principal
  useEffect(() => {
    try {
      if (
        localStorage.theme === "dark" ||
        (!("theme" in localStorage) &&
          window.matchMedia("(prefers-color-scheme: dark)").matches)
      ) {
        document.documentElement.classList.add("dark");
      }
    } catch (e) {
      /* ignorar errores de acceso a storage */
    }
  }, []);

  // Forzar que el html/body/root ocupen el 100% del iframe
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.style.width = "100%"; 
      document.documentElement.style.height = "100%"; 
      document.body.style.margin = "0";
      document.body.style.padding = "0";
      document.body.style.width = "100%"; 
      document.body.style.height = "100%"; 
      document.body.style.overflow = "hidden";
      document.body.style.display = "flex";
      document.body.style.flexDirection = "column";

      const rootEl = document.getElementById("root") || document.getElementById("__next") || document.getElementById("app");
      if (rootEl) {
        rootEl.style.height = "100%";
        rootEl.style.width = "100%";
        rootEl.style.display = "flex";
        rootEl.style.flexDirection = "column"; 
        rootEl.style.overflow = "hidden";
      }
    }
  }, []);

  return (
    <div style={{
      width: "100%",
      height: "100%",
      background: "transparent",
      margin: 0,
      padding: 0,
      overflow: "hidden", 
      display: "flex", 
      flexDirection: "column"
    }}>
      <Suspense fallback={
        <div style={{display: "flex", alignItems:"center", justifyContent:"center", width:"100%", height:"100%", fontFamily:"Arial, sans-serif", fontSize:"12px", color:"#555"}}>
          Cargando Chatboc...
        </div>
      }>
        <ChatWidget 
          mode="iframe" 
          defaultOpen={defaultOpen} 
          widgetId={widgetId} 
          authToken={tokenFromUrl}
          initialIframeWidth={initialIframeWidth} 
          initialIframeHeight={initialIframeHeight}
        />
        {console.log("ChatWidget montado!")} {/* Log para depurar */}
      </Suspense>
    </div>
  );
};

export default Iframe;
