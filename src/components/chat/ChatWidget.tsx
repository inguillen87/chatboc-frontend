// src/components/chat/ChatWidget.tsx (VERSIÓN FINAL Y OPTIMIZADA)

import React, { useState, useEffect, useCallback, Suspense } from "react";
import ChatbocLogoAnimated from "./ChatbocLogoAnimated";
import { getCurrentTipoChat } from "@/utils/tipoChat";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { MessageCircle, X } from "lucide-react"; 
import { cn } from "@/lib/utils";
import { safeLocalStorage } from "@/utils/safeLocalStorage"; 

const ChatRegisterPanel = React.lazy(() => import("./ChatRegisterPanel"));
import ChatHeader from "./ChatHeader"; 
const ChatPanel = React.lazy(() => import("./ChatPanel")); 

interface ChatWidgetProps {
  mode?: "standalone" | "iframe" | "script";
  initialPosition?: { bottom: number; right: number }; // Solo para modo standalone
  defaultOpen?: boolean;
  widgetId?: string;
  entityToken?: string; // Propiedad para el token de la entidad
  openWidth?: string;
  openHeight?: string;
  closedWidth?: string;
  closedHeight?: string;
  tipoChat?: "pyme" | "municipio";
}

const ChatWidget: React.FC<ChatWidgetProps> = ({
  mode = "standalone",
  defaultOpen = false,
  widgetId = "chatboc-widget-iframe",
  entityToken, 
  openWidth = "370px",
  openHeight = "540px",
  closedWidth = "88px", 
  closedHeight = "88px",
  tipoChat = getCurrentTipoChat(),
  initialPosition = { bottom: 32, right: 32 }, // Mantener para standalone
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [view, setView] = useState<'chat' | 'register'>('chat');

  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;

  // Las dimensiones finales provienen directamente de las props, ya que widget.js las controla.
  const finalOpenWidth = openWidth;
  const finalOpenHeight = openHeight;
  const finalClosedWidth = closedWidth;
  const finalClosedHeight = closedHeight;

  // Clases comunes para el panel y el botón (para posicionamiento absoluto dentro del contenedor)
  const commonPanelAndButtonAbsoluteClasses = cn(
    "absolute bottom-0 right-0", // Posicionamiento absoluto en la esquina inferior derecha
  );

  const commonPanelStyles = cn(
    "bg-card border shadow-lg", // Estilos de la tarjeta
    "flex flex-col overflow-hidden",
    "transition-all duration-300 ease-in-out",
  );

  const commonButtonStyles = cn(
    "rounded-full flex items-center justify-center",
    "bg-primary text-primary-foreground hover:bg-primary/90",
    "shadow-lg transition-all duration-300 ease-in-out",
  );

  // Avisar a parent (iframe) para redimensionar si hace falta
  const sendStateMessageToParent = useCallback(
    (open: boolean) => {
      if (
        mode === "iframe" &&
        typeof window !== "undefined" &&
        window.parent !== window &&
        widgetId
      ) {
        const dims = open
          ? { width: finalOpenWidth, height: finalOpenHeight }
          : { width: finalClosedWidth, height: finalClosedHeight };
        window.parent.postMessage(
          { type: "chatboc-state-change", widgetId, dimensions: dims, isOpen: open },
          "*" 
        );
      }
    },
    [mode, widgetId, finalOpenWidth, finalOpenHeight, finalClosedWidth, finalClosedHeight]
  );

  useEffect(() => {
    sendStateMessageToParent(isOpen);
  }, [isOpen, sendStateMessageToParent]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === "TOGGLE_CHAT" && event.data.widgetId === widgetId) {
        setIsOpen(event.data.isOpen);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [widgetId]);

  const toggleChat = () => setIsOpen((open) => !open);

  useEffect(() => {
    if (mode === "iframe" && entityToken) {
      safeLocalStorage.setItem("entityToken", entityToken);
    } else if (mode === "iframe" && !entityToken) {
      safeLocalStorage.removeItem("entityToken");
    }
  }, [mode, entityToken]);

  // Renderizado principal del ChatWidget
  if (mode === "standalone") {
    // Modo standalone (tu app principal, no el iframe incrustado)
    // Se posiciona fijo en la pantalla.
    return (
      <div
        className={cn(
          "chatboc-container-standalone",
          "fixed z-[999999]", // Sigue fixed para standalone
          isOpen ? "pointer-events-auto" : "pointer-events-none",
        )}
        style={{
          bottom: `calc(${initialPosition.bottom}px + env(safe-area-inset-bottom))`,
          right: `calc(${initialPosition.right}px + env(safe-area-inset-right))`,
          left: "auto",
          top: "auto",
          width: isMobile ? "96vw" : finalOpenWidth,
          height: isMobile ? "96vh" : finalOpenHeight,
          minWidth: "320px",
          minHeight: "64px",
          maxWidth: "98vw",
          maxHeight: "98vh",
          borderRadius: isOpen ? "24px" : "50%", // Redondez para standalone
          opacity: isOpen ? 1 : 0,
          scale: isOpen ? 1 : 0.85,
          transformOrigin: "bottom right",
        }}
      >
        <Suspense fallback={null}>
          <motion.div
            className={cn(commonPanelAndButtonAbsoluteClasses, commonPanelStyles, "w-full h-full")} // w-full h-full para llenar el contenedor fijo
            style={{ borderRadius: isOpen ? "24px" : "50%" }} // Asegurar el borde para standalone
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
          >
            {isOpen && (
              <>
                <ChatHeader onClose={toggleChat} />
                {view === "register" ? (
                  <ChatRegisterPanel onSuccess={() => setView("chat")} />
                ) : (
                  <ChatPanel
                    mode={mode}
                    widgetId={widgetId}
                    entityToken={entityToken}
                    openWidth={finalOpenWidth}
                    openHeight={finalOpenHeight}
                    onClose={toggleChat}
                    tipoChat={tipoChat}
                    onRequireAuth={() => setView("register")}
                  />
                )}
              </>
            )}
          </motion.div>
          {!isOpen && (
            <Button
              className={cn(commonButtonStyles, "w-[88px] h-[88px]")} // Tamaño fijo para el botón standalone
              style={{
                position: "absolute", // Posicionar el botón absoluto dentro del contenedor standalone
                bottom: "0px",
                right: "0px",
                borderRadius: "50%",
                background: "var(--primary)",
              }}
              onClick={toggleChat}
              aria-label="Abrir chat"
            >
              <motion.span
                animate={{ y: [0, -10, 0] }}
                transition={{ repeat: Infinity, duration: 0.8, repeatDelay: 4 }}
              >
                <ChatbocLogoAnimated size={isMobile ? 42 : 62} blinking />
              </motion.span>
            </Button>
          )}
        </Suspense>
      </div>
    );
  }

  // Modo iframe (este es el que se usa cuando el widget se incrusta en otras páginas)
  // Este div NO debe ser fixed. Su padre (el iframe) ya es fixed.
  // Este div ocupará el 100% del iframe.
  return (
    <div
      className={cn(
        "relative w-full h-full", // Este div ocupa el 100% del iframe y es el contenedor relativo
        "flex flex-col items-end justify-end", // Alinea el botón/panel a la esquina inferior derecha
      )}
    >
      <Suspense fallback={null}>
        {/* Panel del chat, se posiciona de forma absoluta dentro del div raíz de ChatWidget */}
        <motion.div
          className={cn(
            commonPanelAndButtonAbsoluteClasses, // absolute bottom-0 right-0
            commonPanelStyles, // bg-card border shadow-2xl etc.
            isOpen ? "pointer-events-auto" : "pointer-events-none" // Control de eventos
          )}
          style={{
            width: finalOpenWidth, 
            height: finalOpenHeight, 
            borderRadius: "16px", // Mantener el borde del panel del chat
            opacity: isOpen ? 1 : 0, // Controlar la opacidad
            scale: isOpen ? 1 : 0.95, // Controlar la escala
            transformOrigin: "bottom right", // Origen de la transformación
          }}
          initial={{ opacity: 0, scale: 0.95 }} // Ajustado initial scale para iframe
          animate={{ opacity: isOpen ? 1 : 0, scale: isOpen ? 1 : 0.95 }} // Ajustado animate scale para iframe
          exit={{ opacity: 0, scale: 0.95 }} // Ajustado exit scale para iframe
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
        >
          {/* Renderiza el contenido del panel solo si está abierto */}
          {isOpen && ( 
            <>
              <ChatHeader onClose={toggleChat} />
              {view === "register" ? (
                <ChatRegisterPanel onSuccess={() => setView("chat")} />
              ) : (
                <ChatPanel
                  mode={mode}
                  widgetId={widgetId}
                  entityToken={entityToken} 
                  openWidth={finalOpenWidth} 
                  openHeight={finalOpenHeight}
                  onClose={toggleChat}
                  tipoChat={tipoChat}
                  onRequireAuth={() => setView("register")}
                />
              )}
            </>
          )}
        </motion.div>

        {/* Botón flotante para abrir/cerrar el chat (en modo iframe) */}
        <Button
          className={cn(
            commonButtonStyles, // rounded-full flex items-center justify-center, bg-primary, etc.
            commonPanelAndButtonAbsoluteClasses, // absolute bottom-0 right-0
            isOpen ? "opacity-0 scale-0 pointer-events-none" : "opacity-100 scale-100 pointer-events-auto"
          )}
          onClick={toggleChat}
          aria-label={isOpen ? "Cerrar chat" : "Abrir chat"}
          style={{
             width: finalClosedWidth, 
             height: finalClosedHeight, 
             background: "var(--primary)",
             opacity: isOpen ? 0 : 1,
             scale: isOpen ? 0 : 1,
          }}
        >
          {isOpen ? <X className="h-8 w-8" /> : <MessageCircle className="h-8 w-8" />} 
          {!isOpen && <ChatbocLogoAnimated size={parseInt(finalClosedWidth, 10) * 0.7} />} 
        </Button>
      </Suspense>
    </div>
  );
};

export default ChatWidget;