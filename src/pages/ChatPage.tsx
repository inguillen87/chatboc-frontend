// src/pages/ChatPage.tsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Message } from "@/types/chat";
import ChatMessage from "@/components/chat/ChatMessage";
import ChatInput from "@/components/chat/ChatInput";
import TypingIndicator from "@/components/chat/TypingIndicator";
import Navbar from "@/components/layout/Navbar";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "@/utils/api";

// Hook para mobile detection (sin cambios)
function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < breakpoint : false
  );
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [breakpoint]);
  return isMobile;
}

const ChatPage = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatMessagesContainerRef = useRef<HTMLDivElement>(null);

  const [contexto, setContexto] = useState({});

  const isMobile = useIsMobile();
  
  const scrollToBottom = useCallback(() => {
    if (chatMessagesContainerRef.current) {
      chatMessagesContainerRef.current.scrollTop = chatMessagesContainerRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    if (messages.length === 0) { 
      setMessages([
        { id: Date.now(), text: "¡Hola! Soy Chatboc. ¿En qué puedo ayudarte hoy?", isBot: true, timestamp: new Date() },
      ]);
    }
  }, []); 

  useEffect(() => {
    const timer = setTimeout(() => scrollToBottom(), 150);
    return () => clearTimeout(timer);
  }, [messages, isTyping, scrollToBottom]);

  const handleSend = useCallback(async (text: string) => {
    if (!text.trim()) return;

    const userMessage: Message = { id: Date.now(), text, isBot: false, timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setIsTyping(true);

    // No necesitas setTimeout aquí si scrolltobottom se llama después de setMessages,
    // y el useEffect de scroll ya lo maneja.

    const payload = {
      pregunta: text,
      contexto_previo: contexto 
    };

    try {
      const data = await apiFetch<any>("/ask", {
        method: "POST",
        body: payload,
      });

      setContexto(data.contexto_actualizado || {});

      const botMessage: Message = {
        id: Date.now(),
        text: data?.respuesta || "⚠️ No se pudo generar una respuesta.",
        isBot: true,
        timestamp: new Date(),
        botones: data?.botones || [] 
      };
      setMessages(prev => [...prev, botMessage]);

    } catch (error) {
      setMessages(prev => [...prev, { id: Date.now(), text: "⚠️ No se pudo conectar con el servidor.", isBot: true, timestamp: new Date() }]);
    } finally {
      setIsTyping(false);
    }
  }, [contexto]);

  // <<<<<<<<<<<<<< ELIMINAR O COMENTAR ESTE LISTENER DE CustomEvent >>>>>>>>>>>>>>
  // Porque ChatButtons ahora llama directamente a onButtonClick, no emite un CustomEvent
  /*
  useEffect(() => {
    const handleButtonSendMessage = (event: Event) => {
      const customEvent = event as CustomEvent<string>;
      if (customEvent.detail) {
        handleSend(customEvent.detail);
      }
    };
    window.addEventListener('sendChatMessage', handleButtonSendMessage);
    return () => {
      window.removeEventListener('sendChatMessage', handleButtonSendMessage);
    };
  }, [handleSend]);
  */

  // <<<<<<<<<<<<<< ELIMINAR O COMENTAR ESTA FUNCIÓN Y SU onClick EN EL DIV >>>>>>>>>>>>>>
  // Porque los botones ahora se manejan a través de props y ChatButtons
  /*
  const handleDynamicButtonClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'BUTTON') {
      const onclickAttribute = target.getAttribute('onclick');
      if (onclickAttribute && onclickAttribute.includes('enviarMensajeAsistente')) {
        const match = onclickAttribute.match(/enviarMensajeAsistente\('(.+?)'\)/);
        if (match && match[1]) {
          const payload = match[1];
          handleSend(payload);
        }
      }
    }
  };
  */

  return (
    <div className="min-h-screen flex flex-col bg-background dark:bg-gradient-to-b dark:from-[#0d1014] dark:to-[#161b22] text-foreground">
      <Navbar />

      <main
        className={`
          flex-grow flex flex-col items-center justify-center
          pt-3 sm:pt-10 pb-2 sm:pb-6
          transition-all
        `}
      >
        <motion.div
          layout
          className={`
            w-full max-w-[99vw] ${isMobile ? "h-[100svh]" : "sm:w-[480px] h-[83vh]"}
            flex flex-col
            rounded-none sm:rounded-3xl 
            border-0 sm:border border-border
            shadow-none sm:shadow-2xl
            bg-card dark:bg-[#20232b]/95
            backdrop-blur-0 sm:backdrop-blur-xl
            relative
            overflow-hidden
            transition-all
          `}
          style={{
            boxShadow: isMobile ? undefined : "0 8px 64px 0 rgba(30,40,90,0.10)",
          }}
        >
          {/* Mensajes */}
          <div
            // onClick={handleDynamicButtonClick} // <<<<<<<<<<<<<< COMENTAR O REMOVER ESTO
            ref={chatMessagesContainerRef}
            className={`
              flex-1 overflow-y-auto
              p-2 sm:p-4 space-y-3
              custom-scroll
              scrollbar-thin scrollbar-thumb-[#90caf9] scrollbar-track-transparent
              bg-background dark:bg-[#22262b]
              transition-all
            `}
            style={{ minHeight: 0 }}
          >
            <AnimatePresence>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 14 }}
                  transition={{ duration: 0.18 }}
                >
                  {/* Pasa onButtonClick a ChatMessage aquí también */}
                  <ChatMessage message={msg} isTyping={isTyping} onButtonClick={handleSend} /> 
                </motion.div>
              ))}
            </AnimatePresence>
            {isTyping && <TypingIndicator />}
            <div ref={chatEndRef} />
          </div>

          {/* Input siempre visible abajo */}
          <div
            className={`
              bg-gradient-to-t from-background via-card/60 to-transparent dark:from-card dark:via-card/80
              border-t border-border
              p-2 sm:p-4
              flex-shrink-0
              sticky bottom-0
              z-20
              shadow-inner
              backdrop-blur
            `}
          >
            <ChatInput onSendMessage={handleSend} />
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default ChatPage;