// src/pages/Iframe.tsx

import React, { useEffect, useState, Suspense } from "react";

const ChatWidget = React.lazy(() => import("@/components/chat/ChatWidget")); 

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
      
      if (openParam === "true") setDefaultOpen(true);
      if (idParam) setWidgetId(idParam);
      if (tokenParam) setTokenFromUrl(tokenParam); 
      if (widthParam) setInitialIframeWidth(widthParam); 
      if (heightParam) setInitialIframeHeight(heightParam); 
    }
  }, []);

  // <<<<<<<<<<<<<< MODIFICACIÓN CRÍTICA: Asegurar 100% de alto en html y body dentro del iframe >>>>>>>>>>>>>>
  useEffect(() => {
    if (typeof document !== "undefined") {
      // Forzar html, body y el #root (o __next) a ocupar el 100% del iframe.
      // Esto es crucial para que los elementos internos de React se estiren.
      document.documentElement.style.width = "100%"; 
      document.documentElement.style.height = "100%"; 
      document.body.style.margin = "0";
      document.body.style.padding = "0";
      document.body.style.width = "100%"; 
      document.body.style.height = "100%"; 
      document.body.style.overflow = "hidden"; // El scroll lo manejará el div interno del ChatWidget
      
      // Asegurar que el body sea un contenedor flex para que el ChatWidget se estire
      document.body.style.display = "flex";
      document.body.style.flexDirection = "column";

      const rootEl = document.getElementById("root") || document.getElementById("__next") || document.getElementById("app");
      if (rootEl) {
        rootEl.style.height = "100%";
        rootEl.style.width = "100%";
        rootEl.style.display = "flex"; // Asegurar flex para rootEl
        rootEl.style.flexDirection = "column"; 
        rootEl.style.overflow = "hidden";
      }
    }
  }, []);
  // <<<<<<<<<<<<<< FIN MODIFICACIÓN >>>>>>>>>>>>>>

  return (
    // Este div ahora solo necesita asegurar que ocupa el 100% de su padre (body)
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
      </Suspense>
    </div>
  );
};

export default Iframe;