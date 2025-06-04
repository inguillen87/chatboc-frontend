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

  // Estilos para asegurar que el body del iframe no tenga márgenes/paddings
  // y que el contenido pueda ocupar el 100% del alto/ancho.
  useEffect(() => {
    if (typeof document !== "undefined") {
        document.body.style.margin = "0";
        document.body.style.padding = "0";
        document.body.style.height = "100vh";
        document.body.style.width = "100vw";
        document.body.style.overflow = "hidden"; // Evitar scrollbars en el body del iframe
        const rootEl = document.getElementById("root") || document.getElementById("__next"); // O tu ID raíz
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
      display: "flex", // Para asegurar que ChatWidget (si es flex también) se comporte bien
      flexDirection: "column"
    }}>
      <Suspense fallback={
        <div style={{display: "flex", alignItems:"center", justifyContent:"center", width:"100%", height:"100%", fontFamily:"Arial, sans-serif", fontSize:"12px", color:"#555"}}>
          Cargando Interfaz... 
        </div>
      }>
        <ChatWidget widgetId={widgetId} />
      </Suspense>
    </div>
  );
};

export default Iframe;