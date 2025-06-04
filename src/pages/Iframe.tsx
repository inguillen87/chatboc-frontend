import React, { useEffect, useState, Suspense } from "react";

// Carga diferida para ChatWidget si es un componente pesado
const ChatWidget = React.lazy(() => import("@/components/chat/ChatWidget")); // Ajusta la ruta

const Iframe = () => {
  const [defaultOpen, setDefaultOpen] = useState(false);
  const [widgetId, setWidgetId] = useState("chatboc-widget-iframe"); // ID por defecto

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const openParam = params.get("defaultOpen");
      const idParam = params.get("widgetId");

      if (openParam === "true") {
        setDefaultOpen(true);
      }
      if (idParam) {
        setWidgetId(idParam);
      }
    }
  }, []);

  return (
    <div style={{
      width: "100%", 
      height: "100%",
      background: "transparent", // Iframe es transparente, ChatWidget da el color
      margin: 0,
      padding: 0,
      overflow: "hidden", 
    }}>
      <Suspense fallback={<div style={{display: "flex", alignItems:"center", justifyContent:"center", width:"100%", height:"100%", fontFamily:"sans-serif", fontSize:"12px", color:"#555"}}>Cargando Interfaz...</div>}>
        <ChatWidget defaultOpen={defaultOpen} widgetId={widgetId} />
      </Suspense>
    </div>
  );
};

export default Iframe;