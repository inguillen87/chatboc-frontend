// src/pages/Iframe.tsx

import React, { useEffect, useState } from "react";
import { safeLocalStorage } from "@/utils/safeLocalStorage";

// Importa directamente para evitar problemas con React.lazy en algunos entornos
import ChatWidget from "../components/chat/ChatWidget";

// Importamos Toaster que sí existe en tu proyecto según los archivos que me enviaste
import { Toaster } from "@/components/ui/sonner"; 

const Iframe = () => {
  const [widgetParams, setWidgetParams] = useState({
    defaultOpen: false,
    widgetId: "chatboc-iframe-unknown",
    token: null as string | null,
    // Se mantienen los nombres originales para initialWidth/Height para compatibilidad
    initialIframeWidth: null as string | null,
    initialIframeHeight: null as string | null,
    // ¡NUEVAS PROPS NECESARIAS! Capturamos las dimensiones que widget.js envía.
    openWidth: null as string | null,
    openHeight: null as string | null,
    closedWidth: null as string | null,
    closedHeight: null as string | null,
    theme: "light", // Añadimos 'theme' para pasarla a ChatWidget si fuera necesario, aunque ya la manejas aquí
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const openParam = params.get("defaultOpen");
      const idParam = params.get("widgetId");
      const tokenParam = params.get("token");
      
      // Capturamos todas las dimensiones que widget.js envía por URL
      const initialWidthParam = params.get("initialWidth");
      const initialHeightParam = params.get("initialHeight");
      const openWidthParam = params.get("openWidth");
      const openHeightParam = params.get("openHeight");
      const closedWidthParam = params.get("closedWidth");
      const closedHeightParam = params.get("closedHeight");
      const themeParam = params.get("theme");


      setWidgetParams({
        defaultOpen: openParam === "true",
        widgetId: idParam || "chatboc-iframe-unknown",
        token: tokenParam,
        initialIframeWidth: initialWidthParam,
        initialIframeHeight: initialHeightParam,
        openWidth: openWidthParam,     // ¡NUEVO!
        openHeight: openHeightParam,   // ¡NUEVO!
        closedWidth: closedWidthParam, // ¡NUEVO!
        closedHeight: closedHeightParam, // ¡NUEVO!
        theme: themeParam === "dark" || themeParam === "light" ? themeParam : "light", // Captura el tema
      });

      // Lógica de tema: Si viene en URL, setea y guarda en localStorage para próximas veces
      if (themeParam === "dark" || themeParam === "light") {
        document.documentElement.classList.remove("dark", "light");
        document.documentElement.classList.add(themeParam);
        safeLocalStorage.setItem("theme", themeParam);
      } else {
        // Si no viene por URL, usá localStorage o el sistema
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

  // Seteamos fondos acordes al tema sin romper el overflow ni el scroll
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.style.background = "var(--background)";
      document.body.style.background = "var(--background)";
      document.body.style.margin = "0";
      document.body.style.padding = "0";
      // ¡CORRECCIÓN CLAVE! Aseguramos que el body del iframe no tenga scroll propio
      document.body.style.overflow = "hidden"; 
    }
  }, []);

  // Puedes renderizar un loading state si widgetParams.token aún no está seteado
  if (!widgetParams.token) {
    return <div>Cargando Chatboc...</div>; // O un spinner
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "var(--background)",
        margin: 0,
        padding: 0,
        // ¡CORRECCIÓN CLAVE! Este div debe tener overflow: hidden para contener el widget
        overflow: "hidden", 
        display: "flex",
        flexDirection: "column",
      }}
      className="relative" // Añadimos 'relative' para que ChatWidget pueda posicionarse 'absolute'
    >
      <ChatWidget
        mode="iframe"
        defaultOpen={widgetParams.defaultOpen}
        widgetId={widgetParams.widgetId}
        authToken={widgetParams.token}
        initialIframeWidth={widgetParams.initialIframeWidth}
        initialIframeHeight={widgetParams.initialIframeHeight}
        // ¡NUEVAS PROPS PASADAS A CHATWIDGET!
        openWidth={widgetParams.openWidth}
        openHeight={widgetParams.openHeight}
        closedWidth={widgetParams.closedWidth}
        closedHeight={widgetParams.closedHeight}
        // Puedes pasar el tema si ChatWidget lo necesita, aunque ya se aplica globalmente en html
        // theme={widgetParams.theme} 
      />
      <Toaster /> {/* Colocado dentro del div principal, fuera del ChatWidget si no lo necesitas dentro */}
      {console.log("ChatWidget montado!")}
    </div>
  );
};

export default Iframe;