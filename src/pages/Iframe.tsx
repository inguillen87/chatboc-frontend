import React, { useEffect, useState } from "react";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import ChatWidget from "../components/chat/ChatWidget";
import { Toaster } from "@/components/ui/sonner";

// Loader visual elegante
function Loader() {
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        minHeight: "320px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--background, #f8fafc)",
        fontFamily: "Inter, Arial, sans-serif",
        fontWeight: 500,
        color: "#666",
        fontSize: "1.1rem",
        letterSpacing: "0.02em",
      }}
    >
      <div className="flex flex-col items-center gap-2">
        <img
          src="/favicon/favicon-48x48.png"
          alt="Chatboc"
          width={48}
          height={48}
          style={{ filter: "drop-shadow(0 2px 10px #2c82ef44)", marginBottom: 4 }}
        />
        <span>Cargando Chatboc...</span>
      </div>
    </div>
  );
}

const Iframe = () => {
  const [widgetParams, setWidgetParams] = useState({
    defaultOpen: false,
    widgetId: "chatboc-iframe-unknown",
    token: null as string | null,
    initialIframeWidth: null as string | null,
    initialIframeHeight: null as string | null,
    openWidth: null as string | null,
    openHeight: null as string | null,
    closedWidth: null as string | null,
    closedHeight: null as string | null,
    theme: "light",
    tipoChat: "pyme" as "pyme" | "municipio",
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      // Parámetros por URL
      const params = new URLSearchParams(window.location.search);
      setWidgetParams({
        defaultOpen: params.get("defaultOpen") === "true",
        widgetId: params.get("widgetId") || "chatboc-iframe-unknown",
        token: params.get("token"),
        initialIframeWidth: params.get("initialWidth"),
        initialIframeHeight: params.get("initialHeight"),
        openWidth: params.get("openWidth"),
        openHeight: params.get("openHeight"),
        closedWidth: params.get("closedWidth"),
        closedHeight: params.get("closedHeight"),
        theme: ["dark", "light"].includes(params.get("theme") || "") ? params.get("theme")! : "light",
        tipoChat: params.get("tipo_chat") === "municipio" ? "municipio" : "pyme",
      });

      // Forzar estilos base SÓLIDOS para aislar el widget (esto es CLAVE)
      document.documentElement.style.background = "var(--background, #f8fafc)";
      document.body.style.background = "var(--background, #f8fafc)";
      document.body.style.margin = "0";
      document.body.style.padding = "0";
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
      document.body.style.height = "100%";
      document.documentElement.style.height = "100%";
      document.body.style.width = "100%";
      document.documentElement.style.width = "100%";
      // Safe area para iPhone notch
      document.body.style.paddingTop = "env(safe-area-inset-top)";
      document.body.style.paddingBottom = "env(safe-area-inset-bottom)";
    }
  }, []);

  // Loader mientras no hay token
  if (!widgetParams.token) return <Loader />;

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        minHeight: "320px",
        minWidth: "320px",
        maxWidth: "100vw",
        maxHeight: "100vh",
        background: "var(--background, #f8fafc)",
        margin: 0,
        padding: 0,
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        boxSizing: "border-box"
      }}
      className="w-screen h-screen min-h-[320px] min-w-[320px] bg-card m-0 p-0 overflow-hidden flex items-center justify-center relative"
    >
      <ChatWidget
        mode="iframe"
        defaultOpen={widgetParams.defaultOpen}
        widgetId={widgetParams.widgetId}
        entityToken={widgetParams.token}
        tipoChat={widgetParams.tipoChat}
        initialIframeWidth={widgetParams.initialIframeWidth}
        initialIframeHeight={widgetParams.initialIframeHeight}
        openWidth={widgetParams.openWidth}
        openHeight={widgetParams.openHeight}
        closedWidth={widgetParams.closedWidth}
        closedHeight={widgetParams.closedHeight}
      />
      <Toaster />
    </div>
  );
};

export default Iframe;
