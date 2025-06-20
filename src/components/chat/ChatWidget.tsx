import React, { useState, useEffect, useCallback, Suspense } from "react";
import ChatbocLogoAnimated from "./ChatbocLogoAnimated";
import { getCurrentTipoChat } from "@/utils/tipoChat";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { MessageCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import ChatHeader from "./ChatHeader";

const ChatRegisterPanel = React.lazy(() => import("./ChatRegisterPanel"));
const ChatPanel = React.lazy(() => import("./ChatPanel"));

interface ChatWidgetProps {
  mode?: "standalone" | "iframe" | "script";
  initialPosition?: { bottom: number; right: number };
  defaultOpen?: boolean;
  widgetId?: string;
  authToken?: string;
  openWidth?: string | null;
  openHeight?: string | null;
  closedWidth?: string | null;
  closedHeight?: string | null;
  tipoChat?: "pyme" | "municipio";
}

const ChatWidget: React.FC<ChatWidgetProps> = ({
  mode = "standalone",
  defaultOpen = false,
  widgetId = "chatboc-widget-iframe",
  authToken,
  openWidth: propOpenWidth = "370px",
  openHeight: propOpenHeight = "540px",
  closedWidth: propClosedWidth = "88px",
  closedHeight: propClosedHeight = "88px",
  tipoChat = getCurrentTipoChat(),
}) => {
  const openWidth = propOpenWidth ?? "370px";
  const openHeight = propOpenHeight ?? "540px";
  const closedWidth = propClosedWidth ?? "88px";
  const closedHeight = propClosedHeight ?? "88px";
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [view, setView] = useState<'chat' | 'register'>('chat');

  // Notifica al parent cuando cambia el estado si está en iframe
  const sendStateMessageToParent = useCallback(
    (open: boolean) => {
      if (mode === "iframe" && typeof window !== "undefined" && window.parent !== window && widgetId) {
        const dims = open ? { width: openWidth, height: openHeight } : { width: closedWidth, height: closedHeight };
        window.parent.postMessage({ type: "chatboc-state-change", widgetId, dimensions: dims, isOpen: open }, "*");
      }
    },
    [mode, widgetId, openWidth, openHeight, closedWidth, closedHeight]
  );

  useEffect(() => {
    sendStateMessageToParent(isOpen);
  }, [isOpen, sendStateMessageToParent]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === "TOGGLE_CHAT" && event.data.widgetId === widgetId) {
        const newIsOpen = event.data.isOpen;
        if (newIsOpen !== isOpen) setIsOpen(newIsOpen);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [widgetId, isOpen]);

  const toggleChat = () => setIsOpen(!isOpen);

  // Lógica para mobile: usa 98vw y 80vh en pantallas chicas
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
  const widgetWidth = isMobile ? "98vw" : openWidth;
  const widgetHeight = isMobile ? "80vh" : openHeight;
  const bubbleSize = isMobile ? "64px" : closedWidth;

  return (
    <div className="z-[999999]">
      {/* Chat abierto */}
      <Suspense fallback={null}>
        <motion.div
          className={cn(
            "chatboc-panel-wrapper",
            "fixed",
            "bottom-6 right-6",
            "bg-card border shadow-2xl rounded-2xl",
            "flex flex-col overflow-hidden",
            "transition-all duration-300",
            isOpen
              ? "opacity-100 scale-100 pointer-events-auto"
              : "opacity-0 scale-95 pointer-events-none"
          )}
          style={{
            width: widgetWidth,
            height: widgetHeight,
            minWidth: "300px",
            maxWidth: "98vw",
            maxHeight: "98vh",
            zIndex: 999999
          }}
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={isOpen ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.9, y: 20 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
        >
          {isOpen && (
            <>
              <ChatHeader onClose={toggleChat} />
              {view === 'register' ? (
                <ChatRegisterPanel onSuccess={() => setView('chat')} />
              ) : (
                <ChatPanel
                  mode={mode}
                  widgetId={widgetId}
                  authToken={authToken}
                  openWidth={openWidth}
                  openHeight={openHeight}
                  onClose={toggleChat}
                  tipoChat={tipoChat}
                  onRequireAuth={() => setView('register')}
                />
              )}
            </>
          )}
        </motion.div>

        {/* Botón flotante */}
        <Button
          className={cn(
            "chatboc-toggle-button",
            "fixed bottom-6 right-6",
            "rounded-full flex items-center justify-center",
            "bg-primary text-primary-foreground hover:bg-primary/90",
            "shadow-lg transition-all duration-300",
            isOpen ? "opacity-0 scale-0 pointer-events-none" : "opacity-100 scale-100 pointer-events-auto"
          )}
          style={{
            width: bubbleSize,
            height: bubbleSize,
            zIndex: 999999
          }}
          onClick={toggleChat}
          aria-label={isOpen ? "Cerrar chat" : "Abrir chat"}
        >
          {isOpen ? <X className="h-8 w-8" /> : <MessageCircle className="h-8 w-8" />}
          {!isOpen && <ChatbocLogoAnimated size={parseInt(bubbleSize, 10) * 0.7} />}
        </Button>
      </Suspense>
    </div>
  );
};

export default ChatWidget;
