import React, { useEffect, useState } from "react";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import ChatWidget from "../components/chat/ChatWidget";
import { Toaster } from "@/components/ui/sonner";

const Iframe = () => {
  const [widgetParams, setWidgetParams] = useState({
    defaultOpen: false,
    widgetId: "chatboc-iframe-unknown",
    token: null as string | null,
    initialIframeWidth: null as string | null,
    initialIframeHeight: null as string | null,
    openWidth: "370px" as string | null,
    openHeight: "540px" as string | null,
    closedWidth: "88px" as string | null,
    closedHeight: "88px" as string | null,
    theme: "light",
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const openParam = params.get("defaultOpen");
      const idParam = params.get("widgetId");
      const tokenParam = params.get("token");
      const initialWidthParam = params.get("initialWidth");
      const initialHeightParam = params.get("initialHeight");
      const openWidthParam = params.get("openWidth") || "370px";
      const openHeightParam = params.get("openHeight") || "540px";
      const closedWidthParam = params.get("closedWidth") || "88px";
      const closedHeightParam = params.get("closedHeight") || "88px";
      const themeParam = params.get("theme");

      setWidgetParams({
        defaultOpen: openParam === "true",
        widgetId: idParam || "chatboc-iframe-unknown",
        token: tokenParam,
        initialIframeWidth: initialWidthParam,
        initialIframeHeight: initialHeightParam,
        openWidth: openWidthParam,
        openHeight: openHeightParam,
        closedWidth: closedWidthParam,
        closedHeight: closedHeightParam,
        theme: themeParam === "dark" || themeParam === "light" ? themeParam : "light",
      });

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
    }
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.style.background = "var(--background)";
      document.body.style.background = "var(--background)";
      document.body.style.margin = "0";
      document.body.style.padding = "0";
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
      document.body.style.height = "100%";
      document.documentElement.style.height = "100%";
      document.body.style.width = "100%";
      document.documentElement.style.width = "100%";
    }
  }, []);

  if (!widgetParams.token) {
    return <div>Cargando Chatboc...</div>;
  }

  return (
    <div
      style={{ width: "100%", height: "100%", background: "var(--background)", margin: 0, padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}
      className="relative"
    >
      <ChatWidget
        mode="iframe"
        defaultOpen={widgetParams.defaultOpen}
        widgetId={widgetParams.widgetId}
        authToken={widgetParams.token}
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
