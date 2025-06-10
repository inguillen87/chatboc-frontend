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

  // <<<<<<<<<<<<<< MODIFICADO: Asegurar 100% de alto en html y body >>>>>>>>>>>>>>
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.style.height = "100%"; // <<<<<<<<<<<<<< NUEVO: Aplicar 100% a html
      document.body.style.margin = "0";
      document.body.style.padding = "0";
      document.body.style.height = "100%"; // <<<<<<<<<<<<<< Cambiado a 100%
      document.body.style.width = "100%"; // <<<<<<<<<<<<<< Cambiado a 100%
      document.body.style.overflow = "hidden"; // Mantiene el overflow oculto en el body
      
      const rootEl = document.getElementById("root") || document.getElementById("__next") || document.getElementById("app");
      if (rootEl) {
        rootEl.style.height = "100%";
        rootEl.style.width = "100%";
        rootEl.style.overflow = "hidden";
      }
    }
  }, []);
  // <<<<<<<<<<<<<< FIN MODIFICACIÓN >>>>>>>>>>>>>>

  return (
    <div style={{
      width: "100%",
      height: "100%",
      background: "transparent",
      margin: 0,
      padding: 0,
      display: "flex", // Añadimos flexbox para que ChatWidget se estire
      flexDirection: "column" // Aseguramos que los hijos se organicen verticalmente
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