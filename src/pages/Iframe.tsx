// src/pages/Iframe.tsx

import React, { useEffect, useState } from "react";
import ChatWidget from "../components/chat/ChatWidget";

// NO pongas Loader ni Toaster, ni fondo, ni nada más.

const DEFAULTS = {
  openWidth: "370px",
  openHeight: "540px",
  closedWidth: "88px",
  closedHeight: "88px",
};

const Iframe = () => {
  const [widgetParams, setWidgetParams] = useState({
    defaultOpen: false,
    widgetId: "chatboc-iframe-unknown",
    token: null as string | null,
    openWidth: DEFAULTS.openWidth,
    openHeight: DEFAULTS.openHeight,
    closedWidth: DEFAULTS.closedWidth,
    closedHeight: DEFAULTS.closedHeight,
    tipoChat: "pyme" as "pyme" | "municipio",
  });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      setWidgetParams({
        defaultOpen: params.get("defaultOpen") === "true",
        widgetId: params.get("widgetId") || "chatboc-iframe-unknown",
        token: params.get("token"),
        openWidth: params.get("openWidth") || DEFAULTS.openWidth,
        openHeight: params.get("openHeight") || DEFAULTS.openHeight,
        closedWidth: params.get("closedWidth") || DEFAULTS.closedWidth,
        closedHeight: params.get("closedHeight") || DEFAULTS.closedHeight,
        tipoChat: params.get("tipo_chat") === "municipio" ? "municipio" : "pyme",
      });
      setReady(true);
    }
  }, []);

  // Mientras no está listo o no hay token, no muestres nada
  if (!ready || !widgetParams.token) return null;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        minWidth: "64px",
        minHeight: "64px",
        background: "transparent",
        margin: 0,
        padding: 0,
        overflow: "visible",
        position: "relative",
      }}
    >
      <ChatWidget
        mode="iframe"
        defaultOpen={widgetParams.defaultOpen}
        widgetId={widgetParams.widgetId}
        entityToken={widgetParams.token}
        tipoChat={widgetParams.tipoChat}
        openWidth={widgetParams.openWidth}
        openHeight={widgetParams.openHeight}
        closedWidth={widgetParams.closedWidth}
        closedHeight={widgetParams.closedHeight}
      />
    </div>
  );
};

export default Iframe;
