// src/pages/Iframe.tsx

import React, { useEffect, useState } from "react";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import ChatWidget from "../components/chat/ChatWidget";
import { ThemeProvider } from '../components/theme-provider'; // Asegúrate de tener este componente
import { Toaster } from '../components/ui/toaster'; // Asegúrate de tener este componente

const Iframe = () => {
  const [widgetParams, setWidgetParams] = useState({
    defaultOpen: false,
    widgetId: "chatboc-iframe-unknown",
    token: null as string | null,
    initialWidth: null as string | null,
    initialHeight: null as string | null,
    openWidth: null as string | null,
    openHeight: null as string | null,
    closedWidth: null as string | null,
    closedHeight: null as string | null,
    theme: "light", // Default theme
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const defaultOpenParam = params.get("defaultOpen") === "true";
      const widgetIdParam = params.get("widgetId");
      const tokenParam = params.get("token");
      
      // Captura todas las dimensiones que widget.js envía
      const initialWidthParam = params.get("initialWidth");
      const initialHeightParam = params.get("initialHeight");
      const openWidthParam = params.get("openWidth");
      const openHeightParam = params.get("openHeight");
      const closedWidthParam = params.get("closedWidth");
      const closedHeightParam = params.get("closedHeight");
      const themeParam = params.get("theme");

      setWidgetParams({
        defaultOpen: defaultOpenParam,
        widgetId: widgetIdParam || "chatboc-iframe-unknown",
        token: tokenParam,
        initialWidth: initialWidthParam,
        initialHeight: initialHeightParam,
        openWidth: openWidthParam,
        openHeight: openHeightParam,
        closedWidth: closedWidthParam,
        closedHeight: closedHeightParam,
        theme: themeParam === "dark" || themeParam === "light" ? themeParam : "light",
      });

      // Lógica de tema: aplicar desde URL, luego localStorage, luego preferencia del sistema
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
      // Seteamos fondos acordes al tema
      document.documentElement.style.background = "var(--background)";
      document.body.style.background = "var(--background)";
      document.body.style.margin = "0";
      document.body.style.padding = "0";
      // Asegura que el body no tenga scroll propio, el ChatPanel lo gestionará si es necesario
      document.body.style.overflow = "hidden"; 
    }
  }, []);

  // Puedes renderizar un loading state si initialParams aún no está seteado
  if (!widgetParams.token) {
    return <div>Cargando Chatboc...</div>; // O un spinner
  }

  return (
    // El ThemeProvider debe envolver todo para que los temas funcionen
    <ThemeProvider defaultTheme={widgetParams.theme} storageKey="vite-ui-theme">
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "var(--background)",
          margin: 0,
          padding: 0,
          overflow: "hidden", // Importante: el iframe padre ya maneja el recorte externo, pero este div debe contener
          display: "flex",
          flexDirection: "column",
          // Justify y Align items ya no son necesarios aquí si ChatWidget se posiciona a sí mismo
          // justify-content: flex-end;
          // align-items: flex-end;
        }}
        className="relative" // Agrega relative para posicionamiento absoluto de ChatWidget si lo necesita
      >
        <ChatWidget
          mode="iframe"
          defaultOpen={widgetParams.defaultOpen}
          widgetId={widgetParams.widgetId}
          authToken={widgetParams.token}
          // Pasamos TODAS las dimensiones al ChatWidget
          initialIframeWidth={widgetParams.initialWidth}
          initialIframeHeight={widgetParams.initialHeight}
          openWidth={widgetParams.openWidth}
          openHeight={widgetParams.openHeight}
          closedWidth={widgetParams.closedWidth}
          closedHeight={widgetParams.closedHeight}
        />
        {/* Usamos Toaster aquí para que las notificaciones aparezcan dentro del iframe */}
        <Toaster /> 
      </div>
    </ThemeProvider>
  );
};

export default Iframe;