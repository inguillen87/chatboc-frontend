import React, { useEffect, useState, Suspense } from "react";

// Ajusta la ruta a tu componente ChatWidget
const ChatWidget = React.lazy(() => import("@/components/chat/ChatWidget")); 

const Iframe = () => {
  const [widgetId, setWidgetId] = useState("chatboc-iframe-unknown");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const idParam = params.get("widgetId"); // widget.js pasa este parámetro
      if (idParam) {
        setWidgetId(idParam);
      }
    }
  }, []);

  return (
    <div style={{
      width: "100%", 
      height: "100%",
      background: "transparent", // El iframe es transparente, ChatWidget.tsx pone el fondo
      margin: 0,
      padding: 0,
      overflow: "hidden", 
    }}>
      <Suspense fallback={
        <div style={{display: "flex", alignItems:"center", justifyContent:"center", width:"100%", height:"100%", fontFamily:"sans-serif", fontSize:"12px", color:"#555"}}>
          {/* Puedes poner un loader más estilizado aquí si lo deseas */}
          Cargando Chat... 
        </div>
      }>
        <ChatWidget widgetId={widgetId} />
      </Suspense>
    </div>
  );
};

export default Iframe;