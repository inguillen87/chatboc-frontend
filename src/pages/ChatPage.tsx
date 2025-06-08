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
  const chatMessagesContainerRef = useRef<HTMLDivElement>(null); // Ref para el contenedor de mensajes

  const isMobile = useIsMobile();

  const path = typeof window !== "undefined" ? window.location.pathname : "";
  const isDemo = path.includes("demo");
  const user = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("user") || "null") : null;
  const token = isDemo ? "demo-token" : localStorage.getItem("authToken") || "demo-token";

  const getRubro = () => {
    if (user?.rubro) {
      if (typeof user.rubro === "object" && user.rubro.nombre) return user.rubro.nombre;
      if (typeof user.rubro === "string") return user.rubro;
    }
    return localStorage.getItem("rubroSeleccionado") || "";
  };

  // MODIFICADO: Lógica de scroll ajustada
  // Función de scroll optimizada para asegurar visibilidad del último mensaje
  const scrollToBottom = useCallback(() => {
    if (chatMessagesContainerRef.current) {
      // Intentamos scrollIntoView si el elemento final existe
      if (chatEndRef.current) {
        chatEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
      } else {
        // Si no, forzamos el scroll al final del contenedor
        chatMessagesContainerRef.current.scrollTop = chatMessagesContainerRef.current.scrollHeight;
      }
    }
  }, []);

  // MENSAJE INICIAL DEL BOT
  useEffect(() => {
    console.log("ChatPage: Inicializando mensajes del bot.");
    if (messages.length === 0) { // Solo inicializar si no hay mensajes
      setMessages([
        {
          id: 1,
          text: "¡Hola! Soy Chatboc. ¿En qué puedo ayudarte hoy?",
          isBot: true,
          timestamp: new Date(),
        },
      ]);
    }
    // No añadir scrollToBottom aquí para evitar el scroll inicial que oculta el primer mensaje.
    // El scroll inicial se manejará en el useEffect de abajo.
  }, [messages.length]);

  // Disparar scroll cuando los mensajes o el estado de 'typing' cambian
  useEffect(() => {
    // Retrasar un poco el scroll para permitir que las animaciones de Framer Motion se asienten
    // y el DOM calcule las alturas correctamente.
    const timer = setTimeout(() => {
      scrollToBottom();
    }, 150); // Aumentado el delay para mayor estabilidad
    return () => clearTimeout(timer);
  }, [messages, isTyping, scrollToBottom]); // Dependencia de scrollToBottom para useCallback

  const handleSend = async (text: string) => {
    if (!text.trim()) return;

    const userMessage: Message = {
      id: messages.length + 1,
      text,
      isBot: false,
      timestamp: new Date(),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setIsTyping(true);

    // Scroll inmediato al enviar para que el input no quede cubierto por el teclado virtual
    // o para asegurar que el nuevo mensaje del usuario sea visible al instante.
    // Un pequeño delay aquí es crucial si el mensaje tiene animaciones de entrada.
    setTimeout(() => scrollToBottom(), 50);

    try {
      const rubro = getRubro();

      const res = await fetch("https://api.chatboc.ar/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ question: text, rubro }),
      });

      const data = await res.json();

      const botMessage: Message = {
        id: updatedMessages.length + 1,
        text: data?.respuesta || "⚠️ No se pudo generar una respuesta.",
        isBot: true,
        timestamp: new Date(),
      };

      const newMessages = [...updatedMessages, botMessage];

      if (
        data?.fuente === "cohere" ||
        botMessage.text.toLowerCase().includes("no encontré") ||
        botMessage.text.toLowerCase().includes("no se pudo")
      ) {
        newMessages.push({
          id: newMessages.length + 1,
          text: "__cta__",
          isBot: true,
          timestamp: new Date(),
        });
      }

      setMessages(newMessages);
    } catch (error) {
      setMessages([
        ...updatedMessages,
        {
          id: updatedMessages.length + 1,
          text: "⚠️ No se pudo conectar con el servidor.",
          isBot: true,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsTyping(false);
      // El useEffect con delay ya se encarga del scroll final después de recibir la respuesta del bot
    }
  };

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
            onClick={handleDynamicButtonClick}
            ref={chatMessagesContainerRef} // Ref para el contenedor de mensajes
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
                  <ChatMessage message={msg} />
                </motion.div>
              ))}
            </AnimatePresence>
            {isTyping && <TypingIndicator />}
            <div ref={chatEndRef} />
          </div>

          {/* Input siempre visible abajo */}
          <div
            className={`
              bg-gradient-to-t from-background via-card/60 to-transparent dark:from-[#181e24] dark:via-[#23272e]/80
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