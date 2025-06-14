// src/pages/Iframe.tsx

import React, { useEffect, useState, Suspense } from "react";

// Asegúrate de que la ruta a tu componente sea la correcta
const ChatWidget = React.lazy(() => import("../components/chat/ChatWidget")); 

const Iframe = () => {
  // Solo nos importan los parámetros de configuración, no de tamaño
  const [tokenFromUrl, setTokenFromUrl] = useState<string | null>(null);
  const [widgetId, setWidgetId] = useState("chatboc-iframe-unknown");
  const [defaultOpen, setDefaultOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tokenParam = params.get("token");
      const idParam = params.get("widgetId");
      const openParam = params.get("defaultOpen");

      if (tokenParam) setTokenFromUrl(tokenParam); 
      if (idParam) setWidgetId(idParam);
      setDefaultOpen(openParam === "true");
    }
  }, []);

  // Este efecto es el más importante para eliminar el fondo blanco.
  // Se asegura de que todo el documento dentro del iframe sea transparente.
  useEffect(() => {
    if (typeof document !== "undefined") {
      const transparentStyles = {
        background: 'transparent',
        width: '100%',
        height: '100%',
        margin: '0',
        padding: '0',
        overflow: 'hidden'
      };
      Object.assign(document.documentElement.style, transparentStyles);
      Object.assign(document.body.style, transparentStyles);

      // Aplicar también al div raíz de tu aplicación React/Next
      const rootEl = document.getElementById("root") || document.getElementById("__next") || document.getElementById("app");
      if (rootEl) {
        Object.assign(rootEl.style, transparentStyles);
      }
    }
  }, []);

  // Tu lógica de tema oscuro (la dejamos como está, es una buena función)
  useEffect(() => {
    try {
      if (localStorage.theme === "dark" || (!("theme" in localStorage) && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
        document.documentElement.classList.add("dark");
      }
    } catch (e) { /* ignorar */ }
  }, []);

  return (
    <div style={{ width: "100%", height: "100%", background: "transparent" }}>
      <Suspense fallback={null}> {/* Un fallback nulo es mejor para que no haya parpadeos */}
        <ChatWidget 
          authToken={tokenFromUrl}
          widgetId={widgetId}
          defaultOpen={defaultOpen}
        />
      </Suspense>
    </div>
  );
};

export default Iframe;