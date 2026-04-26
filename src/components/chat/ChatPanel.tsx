import React, {
  useEffect,
  useRef,
  useState,
  useMemo,
  useCallback,
  useImperativeHandle,
} from "react";
import { X, CheckCircle2, MessageSquare, Lightbulb, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PersonalDataForm } from "./PersonalDataForm";
import ChatInput, { ChatInputHandle } from "./ChatInput";
import ChatMessage from "./ChatMessage";
import TypingIndicator from "./TypingIndicator";
import UserTypingIndicator from "./UserTypingIndicator";
import { CatalogShareCard } from "./CatalogShareCard";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { Message, TipoChat } from "@/types/chat";
import {
  isAvailabilityNoticeDismissed,
  writeAvailabilityDismissed,
} from "@/utils/availabilityPersistence";
import { getAvailabilityInfo } from "@/hooks/useBusinessHours";
import { useChatLogic } from "@/hooks/useChatLogic";

interface ChatPanelProps {
  mode: "panel" | "widget";
  widgetId?: string;
  entityToken?: string;
  tenantSlug: string | null;
  onClose: () => void;
  tipoChat: TipoChat;
  onRequireAuth: () => void;
  onShowLogin: () => void;
  onShowRegister: () => void;
  onOpenUserPanel: () => void;
  muted?: boolean;
  onToggleSound?: () => void;
  onCart?: () => void;
  cartCount?: number;
  openWidth: string | number;
  openHeight: string | number;
  selectedRubro?: string | null;
  onRubroSelect?: (rubro: string | null) => void;
  catalogCard?: {
    bannerUrl?: string;
    viewUrl?: string;
    downloadUrl?: string;
    id?: string;
    description?: string;
  } | null;
  headerLogoUrl?: string;
  welcomeTitle?: string;
  welcomeSubtitle?: string;
  logoAnimation?: "spin" | "pulse" | "bounce" | "none";
  typingAnimation?: "dots" | "pulse" | "none";
  bubbleAnimation?: "slideUp" | "pop" | "fade" | "none";
  messageEnterAnimation?: "slideInRight" | "slideInLeft" | "pop" | "fade" | "none";
  logoBadgeStyle?: "dot" | "icon" | "none";
  supportChannels?: {
    whatsapp?: string;
    phone?: string;
    email?: string;
  };
  quickMenu?: { label: string; intent: string }[];
  realtimeConfig?: any;
  onA11yChange?: (prefs: any) => void;
  a11yPrefs?: any;
}

export const ChatPanel = React.forwardRef<unknown, ChatPanelProps>(
  (
    {
      mode,
      tenantSlug,
      tipoChat,
      onClose,
      openWidth,
      openHeight,
      catalogCard,
      headerLogoUrl,
      quickMenu,
      logoAnimation,
      typingAnimation,
      bubbleAnimation,
      messageEnterAnimation,
      logoBadgeStyle,
      a11yPrefs,
    },
    ref,
  ) => {
    const {
      messages,
      isTyping,
      handleSend,
      handleInternalAction,
      contexto,
      activeTicketId,
      sessionState,
      smartHint,
      setSmartHint,
      guidedFlow,
    } = useChatLogic({ tenantSlug, mode, tipoChat });

    const [userTyping, setUserTyping] = useState(false);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const chatInputHandleRef = useRef<ChatInputHandle>(null);

    const scrollToBottom = useCallback(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, []);

    useEffect(() => {
      scrollToBottom();
    }, [messages, isTyping, scrollToBottom]);

    const chatContentMaxWidthClass = mode === "panel" ? "max-w-4xl mx-auto" : "w-full";

    const showEmptyState = messages.length === 0;

    return (
      <div
        className="flex flex-col h-full w-full bg-background overflow-hidden relative"
        style={mode === "widget" ? { width: openWidth, height: openHeight } : {}}
      >
        <div className="flex items-center justify-between p-3 border-b bg-card shadow-sm z-10 shrink-0">
           <div className="flex items-center gap-2">
             {headerLogoUrl ? <img src={headerLogoUrl} className="w-8 h-8 rounded-full" alt="Logo" /> : <MessageSquare className="w-6 h-6 text-primary" />}
             <div>
                <h2 className="text-sm font-semibold leading-tight">{tenantSlug ? tenantSlug.replace(/-/g, ' ').toUpperCase() : 'Asistente'}</h2>
                <span className="text-[10px] text-emerald-600 flex items-center gap-1"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full inline-block animate-pulse"></span> En línea</span>
             </div>
           </div>
           {mode === "widget" && (
             <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={onClose}>
               <X className="w-4 h-4" />
             </Button>
           )}
        </div>

        <div
          ref={chatContainerRef}
          aria-live="polite"
          className={cn(
            chatContentMaxWidthClass,
            "flex-1 p-4 flex flex-col gap-4 overflow-y-auto scroll-smooth",
          )}
        >
          {showEmptyState ? (
             <div className="flex-1 flex flex-col justify-center items-center text-center p-6 mt-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-4">
                   <MessageSquare className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-semibold mb-2">¿En qué podemos ayudarte?</h3>
                <p className="text-sm text-muted-foreground mb-8 max-w-[260px]">
                   Seleccioná una opción rápida o escribí tu consulta abajo.
                </p>
                {quickMenu && quickMenu.length > 0 ? (
                  <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-sm">
                    {quickMenu.map((item, idx) => (
                      <Button
                        key={idx}
                        variant="outline"
                        className="justify-start h-auto py-3 px-4 text-left font-normal bg-card hover:bg-muted/50 transition-all active:scale-[0.98]"
                        onClick={() => handleSend({ text: item.label, action: item.intent, source: 'button' })}
                      >
                        <span className="truncate">{item.label}</span>
                      </Button>
                    ))}
                  </div>
                ) : (
                  <div className="w-full grid grid-cols-1 gap-2 max-w-xs">
                     <Button variant="outline" className="justify-start h-auto py-3 px-4" onClick={() => handleSend({ text: "Hacer un reclamo", action: "iniciar_reclamo", source: 'button' })}>
                       <MapPin className="w-4 h-4 mr-2 text-muted-foreground" /> Iniciar un reclamo
                     </Button>
                     <Button variant="outline" className="justify-start h-auto py-3 px-4" onClick={() => handleSend({ text: "Hablar con un asesor", action: "agente", source: 'button' })}>
                       <UserTypingIndicator /> <span className="ml-2">Hablar con un asesor</span>
                     </Button>
                  </div>
                )}
             </div>
          ) : (
             <>
               <div className="flex-1" />
               {messages.map((msg) => (
                 <ChatMessage
                   key={`${msg.id}-${a11yPrefs?.simplified ? "s" : "f"}`}
                   message={msg}
                   isTyping={isTyping}
                   onButtonClick={handleSend}
                   onInternalAction={handleInternalAction}
                   tipoChat={tipoChat}
                   botLogoUrl={headerLogoUrl}
                   logoAnimation={logoAnimation}
                   messageEnterAnimation={messageEnterAnimation}
                   bubbleAnimation={bubbleAnimation}
                   logoBadgeStyle={logoBadgeStyle}
                 />
               ))}
             </>
          )}

          {isTyping && (
            <TypingIndicator
              logoUrl={headerLogoUrl}
              logoAnimation={logoAnimation}
              text="Escribiendo..."
              typingAnimation={typingAnimation}
              logoBadgeStyle={logoBadgeStyle}
            />
          )}
          {userTyping && <UserTypingIndicator />}
          <div ref={messagesEndRef} className="h-1" />
        </div>


        <div className="w-full bg-background px-3 py-3 border-t shrink-0 z-20 shadow-[0_-4px_10px_rgba(0,0,0,0.02)]">
          <ChatInput
            ref={chatInputHandleRef}
            onSendMessage={handleSend}
            isTyping={isTyping}
            onTypingChange={setUserTyping}
            guidedFlow={guidedFlow}
          />
        </div>
      </div>
    );
  },
);

ChatPanel.displayName = "ChatPanel";
export default ChatPanel;
