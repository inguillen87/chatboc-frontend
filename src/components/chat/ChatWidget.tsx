import React, { useState, useEffect, useCallback, Suspense } from "react";
import ChatbocLogoAnimated from "./ChatbocLogoAnimated";
import { getCurrentTipoChat } from "@/utils/tipoChat";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { safeLocalStorage } from "@/utils/safeLocalStorage";

const ChatRegisterPanel = React.lazy(() => import("./ChatRegisterPanel"));
import ChatHeader from "./ChatHeader";
const ChatPanel = React.lazy(() => import("./ChatPanel"));

interface ChatWidgetProps {
  mode?: "standalone" | "iframe" | "script";
  initialPosition?: { bottom: number; right: number };
  defaultOpen?: boolean;
  widgetId?: string;
  entityToken?: string;
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
  initialPosition = { bottom: 32, right: 32 },
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [view, setView] = useState<'chat' | 'register'>('chat');

  // Responsive real
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;

  // Siempre definí primero los tamaños finales
  const finalOpenWidth = openWidth || "370px";
  const finalOpenHeight = openHeight || "540px";
  const finalClosedWidth = closedWidth || "88px";
  const finalClosedHeight = closedHeight || "88px";

  // Helpers para tamaño
  const computeWidth = (open: boolean) =>
    open
      ? mode === "iframe"
        ? finalOpenWidth
        : isMobile
        ? "96vw"
        : finalOpenWidth
      : isMobile && mode !== "iframe"
      ? "64px"
      : finalClosedWidth;

  const computeHeight = (open: boolean) =>
    open
      ? mode === "iframe"
        ? finalOpenHeight
        : isMobile
        ? "96vh"
        : finalOpenHeight
      : isMobile && mode !== "iframe"
      ? "64px"
      : finalClosedHeight;

  const widgetWidth = computeWidth(isOpen);
  const widgetHeight = computeHeight(isOpen);
  const initialWidgetWidth = computeWidth(defaultOpen);
  const initialWidgetHeight = computeHeight(defaultOpen);

  // Posicionamiento del botón flotante (fuera de iframe)
  const buttonPosition =
    mode === "iframe"
      ? {
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }
      : {
          position: "fixed" as const,
          bottom: `calc(${initialPosition.bottom}px + env(safe-area-inset-bottom))`,
          right: `calc(${initialPosition.right}px + env(safe-area-inset-right))`,
          left: "auto",
          top: "auto",
        };

  // Permite avisar a parent (iframe) para redimensionar si hace falta
  const sendStateMessageToParent = useCallback(
    (open: boolean) => {
      if (
        mode === "iframe" &&
        typeof window !== "undefined" &&
        window.parent !== window &&
        widgetId
      ) {
        const dims = open
          ? { width: widgetWidth, height: widgetHeight }
          : { width: finalClosedWidth, height: finalClosedHeight };
        window.parent.postMessage(
          { type: "chatboc-state-change", widgetId, dimensions: dims, isOpen: open },
          "*"
        );
      }
    },
    [mode, widgetId, widgetWidth, widgetHeight, finalClosedWidth, finalClosedHeight]
  );

  useEffect(() => {
    sendStateMessageToParent(isOpen);
  }, [isOpen, sendStateMessageToParent]);

  // Permite toggle externo (ej: desde el host)
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
    if (entityToken) {
      safeLocalStorage.setItem("entityToken", entityToken);
    }
  }, [entityToken]);

  return (
    <div>
      <Suspense fallback={null}>
        {/* Panel principal */}
        <motion.div
          className={cn(
            "chatboc-panel-wrapper",
            "bg-card border shadow-2xl",
            "flex flex-col overflow-hidden",
            "transition-all duration-300",
            "fixed z-[999999]",
            isOpen ? "pointer-events-auto" : "pointer-events-none"
          )}
          style={{
            ...(mode === "iframe"
              ? {
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                }
              : {
                  bottom: `calc(${initialPosition.bottom}px + env(safe-area-inset-bottom))`,
                  right: `calc(${initialPosition.right}px + env(safe-area-inset-right))`,
                  left: "auto",
                  top: "auto",
                  transform: "none",
                }),
            width: widgetWidth,
            height: widgetHeight,
            minWidth: isOpen ? "320px" : finalClosedWidth,
            minHeight: isOpen ? "64px" : finalClosedHeight,
            maxWidth: "98vw",
            maxHeight: "98vh",
            borderRadius: isOpen ? "24px" : "50%",
            opacity: isOpen ? 1 : 0,
            scale: isOpen ? 1 : 0.85,
            transformOrigin: mode === "iframe" ? "center" : "bottom right",
          }}
          initial={{
            width: initialWidgetWidth,
            height: initialWidgetHeight,
            borderRadius: defaultOpen ? "24px" : "50%",
            opacity: defaultOpen ? 1 : 0,
            scale: defaultOpen ? 1 : 0.7,
          }}
          animate={{
            width: widgetWidth,
            height: widgetHeight,
            borderRadius: isOpen ? "24px" : "50%",
            opacity: isOpen ? 1 : 0,
            scale: isOpen ? 1 : 0.85,
          }}
          exit={{
            opacity: 0,
            scale: 0.7,
            width: finalClosedWidth,
            height: finalClosedHeight,
            borderRadius: "50%",
          }}
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
                  openWidth={widgetWidth}
                  openHeight={widgetHeight}
                  onClose={toggleChat}
                  tipoChat={tipoChat}
                  onRequireAuth={() => setView("register")}
                />
              )}
            </>
          )}
        </motion.div>
        {/* Botón flotante */}
        {!isOpen && (
          <Button
            className={cn(
              "chatboc-toggle-button",
              "rounded-full flex items-center justify-center",
              "bg-primary text-primary-foreground hover:bg-primary/90",
              "shadow-lg transition-all duration-300",
              "opacity-100 scale-100 pointer-events-auto",
              "fixed z-[999999]"
            )}
            style={{
              ...buttonPosition,
              width: finalClosedWidth,
              height: finalClosedHeight,
              borderRadius: "50%",
              background: "var(--primary, #2260ff)",
              minWidth: isMobile ? "60px" : finalClosedWidth,
              minHeight: isMobile ? "60px" : finalClosedHeight,
            }}
            onClick={toggleChat}
            aria-label="Abrir chat"
          >
            <motion.span
              animate={{ y: [0, -10, 0] }}
              transition={{ repeat: Infinity, duration: 0.8, repeatDelay: 4 }}
            >
              <ChatbocLogoAnimated
                size={parseInt((isMobile ? "60" : finalClosedWidth).toString(), 10) * 0.7}
                blinking
              />
            </motion.span>
          </Button>
        )}
      </Suspense>
    </div>
  );
};

export default ChatWidget;
