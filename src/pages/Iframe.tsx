// src/pages/Iframe.tsx

import React, { useEffect, useState, Suspense } from "react";

// Ajusta la ruta si tu estructura es distinta
const ChatWidget = React.lazy(() => import("@/components/chat/ChatWidget")); 

const Iframe = () => {
  const [defaultOpen, setDefaultOpen] = useState(false);
  const [widgetId, setWidgetId] = useState("chatboc-iframe-unknown");
  const [tokenFromUrl, setTokenFromUrl] = useState<string | null>(null); // <<<<<<<<<<<<<< NUEVO: Estado para almacenar el token de la URL

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const openParam = params.get("defaultOpen");
      const idParam = params.get("widgetId");
      const tokenParam = params.get("token"); // <<<<<<<<<<<<<< LEER EL TOKEN DE LA URL

      if (openParam === "true") setDefaultOpen(true);
      if (idParam) setWidgetId(idParam);
      if (tokenParam) setTokenFromUrl(tokenParam); // <<<<<<<<<<<<<< ALMACENAR EL TOKEN EN EL ESTADO
    }
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.body.style.margin = "0";
      document.body.style.padding = "0";
      document.body.style.height = "100vh";
      document.body.style.width = "100vw";
      document.body.style.overflow = "hidden";
      // Para Next.js, Vite o CRA
      const rootEl = document.getElementById("root") || document.getElementById("__next") || document.getElementById("app");
      if (rootEl) {
        rootEl.style.height = "100%";
        rootEl.style.width = "100%";
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
        {/* <<<<<<<<<<<<<< PASAR authToken COMO PROP AL CHATWIDGET >>>>>>>>>>>>>> */}
        <ChatWidget 
          mode="iframe" 
          defaultOpen={defaultOpen} 
          widgetId={widgetId} 
          authToken={tokenFromUrl} // <<<<<<<<<<<<<< ESTA ES LA LÍNEA CLAVE
        />
      </Suspense>
    </div>
  );
};

export default Iframe;