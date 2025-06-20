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
    theme: "light",
    tipoChat: "pyme" as "pyme" | "municipio",
  });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const getParam = (key: string, fallback: string) =>
        params.get(key) || fallback;

      const themeParam = params.get("theme");
      const tipoChatParam = params.get("tipo_chat");

      setWidgetParams({
        defaultOpen: params.get("defaultOpen") === "true",
        widgetId: params.get("widgetId") || "chatboc-iframe-unknown",
        token: params.get("token"),
        openWidth: getParam("openWidth", DEFAULTS.openWidth),
        openHeight: getParam("openHeight", DEFAULTS.openHeight),
        closedWidth: getParam("closedWidth", DEFAULTS.closedWidth),
        closedHeight: getParam("closedHeight", DEFAULTS.closedHeight),
        theme: themeParam === "dark" || themeParam === "light" ? themeParam : "light",
        tipoChat: tipoChatParam === "municipio" ? "municipio" : "pyme",
      });

      // Tema
      if (themeParam === "dark" || themeParam === "light") {
        document.documentElement.classList.remove("dark", "light");
        document.documentElement.classList.add(themeParam);
        safeLocalStorage.setItem("theme", themeParam);
      } else {
        const storedTheme = safeLocalStorage.getItem("theme");
        if (storedTheme === "dark" || storedTheme === "light") {
          document.documentElement.classList.remove("dark", "light");
          document.documentElement.classList.add(storedTheme);
        } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
        }
      }

      setReady(true);
    }
  }, []);

  // Mientras no está listo o no hay token, mostramos Loader
  if (!ready || !widgetParams.token) return <Loader />;

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        minHeight: "320px",
        background: "var(--background, #f8fafc)",
        margin: 0,
        padding: 0,
        overflow: "hidden",
        position: "relative",
      }}
      className="relative"
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
      <Toaster />
      {/* DEBUG: descomentar si necesitás loggear */}
      {/* {console.log("ChatWidget montado!", widgetParams)} */}
    </div>
  );
};

export default Iframe;
