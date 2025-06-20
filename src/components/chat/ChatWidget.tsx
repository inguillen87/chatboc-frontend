import React, { useState, useEffect, useCallback, Suspense } from "react";
import ChatbocLogoAnimated from "./ChatbocLogoAnimated";
import { getCurrentTipoChat } from "@/utils/tipoChat";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { MessageCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

const ChatRegisterPanel = React.lazy(() => import("./ChatRegisterPanel"));
import ChatHeader from "./ChatHeader";
const ChatPanel = React.lazy(() => import("./ChatPanel"));

interface ChatWidgetProps {
  mode?: "standalone" | "iframe" | "script";
  initialPosition?: { bottom: number; right: number };
  defaultOpen?: boolean;
  widgetId?: string;
  authToken?: string;
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
  authToken,
  openWidth = "370px",
  openHeight = "540px",
  closedWidth = "88px",
  closedHeight = "88px",
  tipoChat = getCurrentTipoChat(),
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [view, setView] = useState<'chat' | 'register'>('chat');

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

  // Responsive: adapta tamaños en mobile
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
  const widgetWidth = isMobile ? "98vw" : openWidth;
  const widgetHeight = isMobile ? "80vh" : openHeight;
  const bubbleSize = isMobile ? "64px" : closedWidth;

  return (
    <div className="z-[999999]">
      <Suspense fallback={null}>
        {/* Chat abierto */}
        <motion.div
          className={cn(
            "chatboc-panel-wrapper",
            "fixed bottom-6 right-6", // <- LO ÚNICO FUNDAMENTAL para que nunca se rompa
            "bg-card border shadow-2xl rounded-lg",
            "flex flex-col overflow-hidden",
            "transform transition-all duration-300 ease-in-out",
            isOpen ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-95 pointer-events-none"
          )}
          style={{
            width: widgetWidth,
            height: widgetHeight,
            minWidth: "300px",
            maxWidth: "98vw",
            maxHeight: "98vh",
            zIndex: 999999,
            borderRadius: "16px"
          }}
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={isOpen ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.9, y: 20 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: "spring", stiffness: 240, damping: 18 }}
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

        {/* Botón flotante con burbuja animada */}
        <Button
          className={cn(
            "chatboc-toggle-button",
            "fixed bottom-6 right-6",
            "rounded-full flex items-center justify-center",
            "bg-primary text-primary-foreground hover:bg-primary/90",
            "shadow-lg transition-all duration-300 ease-in-out",
            isOpen ? "opacity-0 scale-0 pointer-events-none" : "opacity-100 scale-100 pointer-events-auto"
          )}
          onClick={toggleChat}
          aria-label={isOpen ? "Cerrar chat" : "Abrir chat"}
          style={{ width: bubbleSize, height: bubbleSize, background: 'var(--primary)', zIndex: 999999 }}
        >
          {isOpen ? <X className="h-8 w-8" /> : <MessageCircle className="h-8 w-8" />}
          {!isOpen && (
            <span className="animate-bounce">
              <ChatbocLogoAnimated size={parseInt(bubbleSize as string, 10) * 0.7} />
            </span>
          )}
        </Button>
      </Suspense>
    </div>
  );
};

export default ChatWidget;
