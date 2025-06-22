// src/pages/Iframe.tsx

import React, { useEffect, useState } from "react";
import ChatWidget from "../components/chat/ChatWidget";

const DEFAULTS = {
  openWidth: "460px",
  openHeight: "680px",
  closedWidth: "96px",
  closedHeight: "96px",
};

const Iframe = () => {
  const [params, setParams] = useState<any>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      setParams({
        defaultOpen: urlParams.get("defaultOpen") === "true",
        widgetId: urlParams.get("widgetId") || "chatboc-iframe-unknown",
        token: urlParams.get("token"),
        openWidth: urlParams.get("openWidth") || DEFAULTS.openWidth,
        openHeight: urlParams.get("openHeight") || DEFAULTS.openHeight,
        closedWidth: urlParams.get("closedWidth") || DEFAULTS.closedWidth,
        closedHeight: urlParams.get("closedHeight") || DEFAULTS.closedHeight,
        tipoChat:
          urlParams.get("tipo_chat") === "municipio" ? "municipio" : "pyme",
      });
    }
  }, []);

  if (!params || !params.token) return null;
  return (
    <ChatWidget
      mode="iframe"
      defaultOpen={params.defaultOpen}
      widgetId={params.widgetId}
      entityToken={params.token}
      tipoChat={params.tipoChat}
      openWidth={params.openWidth}
      openHeight={params.openHeight}
      closedWidth={params.closedWidth}
      closedHeight={params.closedHeight}
    />
  );
};

export default Iframe;
