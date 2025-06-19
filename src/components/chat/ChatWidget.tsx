import React, { useState, useEffect, useCallback, Suspense } from "react";
import ChatbocLogoAnimated from "./ChatbocLogoAnimated";
import { getCurrentTipoChat } from "@/utils/tipoChat";
import { motion } from "framer-motion";
import { Button } from '@/components/ui/button';
import { MessageCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  tipoChat?: 'pyme' | 'municipio';
}

const ChatWidget: React.FC<ChatWidgetProps> = ({
  mode = "standalone",
  initialPosition = { bottom: 30, right: 30 },
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

      <Suspense fallback={null}>
        <motion.div
          className={cn(
            "chatboc-panel-wrapper",
            "absolute bottom-0 right-0",
            "bg-card border shadow-2xl rounded-lg",
            "flex flex-col overflow-hidden",
            "transform transition-all duration-300 ease-in-out",
            isOpen ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-95 pointer-events-none"
          )}
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={isOpen ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.9, y: 20 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          style={{ width: openWidth, height: openHeight, borderRadius: "16px" }}
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
        <Button
          className={cn(
            "chatboc-toggle-button",

            isOpen ? "opacity-0 scale-0 pointer-events-none" : "opacity-100 scale-100 pointer-events-auto"
          )}
          onClick={toggleChat}
          aria-label={isOpen ? "Cerrar chat" : "Abrir chat"}
          style={{ width: closedWidth, height: closedHeight, background: 'var(--primary)' }}
        >
          {isOpen ? <X className="h-8 w-8" /> : <MessageCircle className="h-8 w-8" />}
          {!isOpen && <ChatbocLogoAnimated size={parseInt(closedWidth, 10) * 0.7} />}
        </Button>
      </Suspense>
    </div>
  );
};

export default ChatWidget;
