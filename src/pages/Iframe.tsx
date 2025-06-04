import React, { useEffect, useState, Suspense } from "react";

// Ajusta la ruta a tu componente ChatWidget
const ChatWidget = React.lazy(() => import("@/components/chat/ChatWidget")); 

const Iframe = () => {
  const [defaultOpen, setDefaultOpen] = useState(false);
  const [widgetId, setWidgetId] = useState("chatboc-iframe-unknown");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      // Leer defaultOpen y widgetId de los parámetros de la URL del iframe
      const openParam = params.get("defaultOpen");
      const idParam = params.get("widgetId");

      if (openParam === "true") { // widget.js pasa "true" como string
        setDefaultOpen(true);
      }
      if (idParam) {
        setWidgetId(idParam);
      }
    }
  }, []);

  useEffect(() => { // Estilos para el body del iframe
    if (typeof document !== "undefined") {
        document.body.style.margin = "0";
        document.body.style.padding = "0";
        document.body.style.height = "100vh";
        document.body.style.width = "100vw";
        document.body.style.overflow = "hidden";
        const rootEl = document.getElementById("root") || document.getElementById("__next");
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
        <ChatWidget defaultOpen={defaultOpen} widgetId={widgetId} />
      </Suspense>
    </div>
  );
};

export default Iframe;