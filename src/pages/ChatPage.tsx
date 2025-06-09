import React, { useState, useEffect, useRef, useCallback } from "react";
import { Message } from "@/types/chat";
import ChatMessage from "@/components/chat/ChatMessage";
import ChatInput from "@/components/chat/ChatInput";
import TypingIndicator from "@/components/chat/TypingIndicator";
import Navbar from "@/components/layout/Navbar";
import { motion, AnimatePresence } from "framer-motion";

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

  // CAMBIO 1: AÑADIMOS UN ESTADO PARA GUARDAR LA "MOCHILA" (EL CONTEXTO)
  const [contexto, setContexto] = useState({});

  const isMobile = useIsMobile();

  const path = typeof window !== "undefined" ? window.location.pathname : "";
  const isDemo = path.includes("demo");
  const user = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("user") || "null") : null;
  const token = isDemo ? "demo-token" : (typeof window !== "undefined" ? localStorage.getItem("authToken") : null) || "demo-token";

  const getRubro = () => {
          console.log("Buscando rubro... Objeto de usuario encontrado:", user);

    if (user?.rubro) {
          console.log("Prioridad 1: Usando el rubro del perfil de usuario.");

      if (typeof user.rubro === "object" && user.rubro.nombre) return user.rubro.nombre;
      if (typeof user.rubro === "string") return user.rubro;
        console.log("Prioridad 2: Usando el rubro del localStorage (modo demo).");

      console.log("Buscando rubro... Objeto de usuario encontrado:", user);

    }
    return typeof window !== "undefined" ? localStorage.getItem("rubroSeleccionado") || "" : "";
  };

  const scrollToBottom = useCallback(() => {
    if (chatMessagesContainerRef.current) {
      chatMessagesContainerRef.current.scrollTop = chatMessagesContainerRef.current.scrollHeight;
    }
  }, []);
  
  // CAMBIO 2: LÓGICA DE ENVÍO COMPLETAMENTE ACTUALIZADA
  const handleSend = useCallback(async (text: string) => {
    if (!text.trim()) return;

    const userMessage: Message = { id: Date.now(), text, isBot: false, timestamp: new Date() };
    setMessages(prevMessages => [...prevMessages, userMessage]);
    setIsTyping(true);

    setTimeout(() => scrollToBottom(), 50);

    try {
      const rubro = getRubro();

      const payload = {
        question: text,
        rubro: rubro,
        contexto_previo: contexto
      };
    console.log('[ChatPage] Preparando para enviar a la API. Payload:', payload);

      const res = await fetch("https://api.chatboc.ar/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      setContexto(data.contexto_actualizado || {});

      const botMessage: Message = {
        id: Date.now(),
        text: data?.respuesta || "⚠️ No se pudo generar una respuesta.",
        isBot: true,
        timestamp: new Date(),
        botones: data?.botones || []
      };
      
      setMessages(prevMessages => [...prevMessages.filter(m => m.id !== userMessage.id), userMessage, botMessage]);

    } catch (error) {
        setMessages(prevMessages => [...prevMessages, { id: Date.now(), text: "⚠️ No se pudo conectar con el servidor.", isBot: true, timestamp: new Date() }]);
    } finally {
      setIsTyping(false);
    }
  }, [contexto, token, messages]);


useEffect(() => {
  const handleButtonSendMessage = (event: Event) => {
    const customEvent = event as CustomEvent<string>;
    if (customEvent.detail) {
      // ✅ DETECTIVE #2: ¿La página principal escucha el evento?
      console.log(`[ChatPage] Evento 'sendChatMessage' escuchado. Ejecutando handleSend con: "${customEvent.detail}"`);
      handleSend(customEvent.detail);
    }
  };
  window.addEventListener('sendChatMessage', handleButtonSendMessage);
  return () => {
    window.removeEventListener('sendChatMessage', handleButtonSendMessage);
  };
}, [handleSend]);


  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        { id: Date.now(), text: "¡Hola! Soy Chatboc. ¿En qué puedo ayudarte hoy?", isBot: true, timestamp: new Date() },
      ]);
    }
  }, []); // Se ejecuta solo una vez

  useEffect(() => {
    const timer = setTimeout(() => {
      scrollToBottom();
    }, 150);
    return () => clearTimeout(timer);
  }, [messages.length, isTyping, scrollToBottom]);


  // Esta función es para un caso de uso antiguo, la dejamos por si acaso pero los botones nuevos no la usan.
  const handleDynamicButtonClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'BUTTON' && target.hasAttribute('onclick')) {
        const onclickAttribute = target.getAttribute('onclick');
        if (onclickAttribute && onclickAttribute.includes('enviarMensajeAsistente')) {
            const match = onclickAttribute.match(/enviarMensajeAsistente\('(.+?)'\)/);
            if (match && match[1]) {
                handleSend(match[1]);
            }
        }
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background dark:bg-gradient-to-b dark:from-[#0d1014] dark:to-[#161b22] text-foreground">
      <Navbar />
      <main className="flex-grow flex flex-col items-center justify-center pt-3 sm:pt-10 pb-2 sm:pb-6 transition-all">
        <motion.div
          layout
          className={`w-full max-w-[99vw] ${isMobile ? "h-[100svh]" : "sm:w-[480px] h-[83vh]"} flex flex-col rounded-none sm:rounded-3xl border-0 sm:border border-border shadow-none sm:shadow-2xl bg-card dark:bg-[#20232b]/95 backdrop-blur-0 sm:backdrop-blur-xl relative overflow-hidden transition-all`}
          style={{ boxShadow: isMobile ? undefined : "0 8px 64px 0 rgba(30,40,90,0.10)" }}
        >
          <div
            onClick={handleDynamicButtonClick}
            ref={chatMessagesContainerRef}
            className="flex-1 overflow-y-auto p-2 sm:p-4 space-y-3 custom-scroll scrollbar-thin scrollbar-thumb-[#90caf9] scrollbar-track-transparent bg-background dark:bg-[#22262b] transition-all"
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
                  <ChatMessage message={msg} />
                </motion.div>
              ))}
            </AnimatePresence>
            {isTyping && <TypingIndicator />}
            <div ref={chatEndRef} />
          </div>
          <div className="bg-gradient-to-t from-background via-card/60 to-transparent dark:from-card dark:via-card/80 border-t border-border p-2 sm:p-4 flex-shrink-0 sticky bottom-0 z-20 shadow-inner backdrop-blur">
            <ChatInput onSendMessage={handleSend} />
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default ChatPage;