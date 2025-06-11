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
  const [activeTicketId, setActiveTicketId] = useState<number | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const ultimoMensajeIdRef = useRef<number>(0);
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

// En ChatPage.tsx, reemplaza tu función handleSend

const handleSend = useCallback(async (text: string) => {
    if (!text.trim()) return;

    const userMessage: Message = { id: Date.now(), text, isBot: false, timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setIsTyping(true);

    try {
        // --- LÓGICA CONDICIONAL ---
        if (activeTicketId) {
            // **CASO 1: YA ESTAMOS EN UN CHAT EN VIVO**
            // Simplemente enviamos el mensaje. El polling se encargará de mostrarlo.
            // NOTA: Necesitamos una nueva ruta en el backend para que el ciudadano responda.
            await apiFetch(`/tickets/chat/${activeTicketId}/responder_ciudadano`, { // <-- ¡NUEVA RUTA!
                method: "POST",
                body: { comentario: text },
            });
            // El mensaje del usuario ya se mostró, y su eco del servidor lo traerá el polling.
            // Por simplicidad, no lo mostraremos dos veces.

        } else {
            // **CASO 2: AÚN NO HAY CHAT EN VIVO, HABLAMOS CON EL BOT**
            const payload = { pregunta: text, contexto_previo: contexto };
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

            // **¡AQUÍ OCURRE LA MAGIA!**
            // Si la respuesta del bot incluye un ticket_id, significa que se escaló a un humano.
            if (data.ticket_id) {
                setActiveTicketId(data.ticket_id); // <-- ¡Activamos el modo polling!
                ultimoMensajeIdRef.current = 0; // Reseteamos el contador de mensajes
            }
        }
    } catch (error) {
        setMessages(prev => [...prev, { id: Date.now(), text: "⚠️ No se pudo conectar con el servidor.", isBot: true, timestamp: new Date() }]);
    } finally {
        setIsTyping(false);
    }
}, [contexto, activeTicketId]); // Agregamos activeTicketId a las dependencias

//UseEffect para manejasr mensajes en vivo

useEffect(() => {
    // Función para buscar nuevos mensajes
    const fetchNewMessages = async () => {
        if (!activeTicketId) return;

        try {
            // Llamamos a la API que construimos en el backend
            const data = await apiFetch<{ estado_chat: string; mensajes: any[] }>(
                `/tickets/chat/${activeTicketId}/mensajes?ultimo_mensaje_id=${ultimoMensajeIdRef.current}`
            );

            if (data.mensajes && data.mensajes.length > 0) {
                const nuevosMensajes: Message[] = data.mensajes.map(msg => ({
                    id: msg.id,
                    text: msg.texto,
                    isBot: msg.es_admin, // Los mensajes del agente se marcan como si fueran del "bot" para el estilo
                    timestamp: new Date(msg.fecha),
                }));

                setMessages(prev => [...prev, ...nuevosMensajes]);
                // Actualizamos la referencia al último ID recibido
                ultimoMensajeIdRef.current = data.mensajes[data.mensajes.length - 1].id;
            }

            // Si el agente cierra el chat, detenemos el polling
            if (data.estado_chat === 'resuelto' || data.estado_chat === 'cerrado') {
                if (pollingIntervalRef.current) {
                    clearInterval(pollingIntervalRef.current);
                }
                setMessages(prev => [...prev, { id: Date.now(), text: "Un agente ha finalizado esta conversación.", isBot: true, timestamp: new Date() }]);
            }
        } catch (error) {
            console.error("Error durante el polling:", error);
            // Opcional: podrías detener el polling si hay errores repetidos
        }
    };

    // Iniciar o detener el polling
    if (activeTicketId) {
        // Inicia el polling inmediatamente una vez, y luego cada 5 segundos
        fetchNewMessages(); 
        pollingIntervalRef.current = setInterval(fetchNewMessages, 5000);
    }

    // Función de limpieza: se ejecuta cuando el componente se desmonta o activeTicketId cambia
    return () => {
        if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
        }
    };
}, [activeTicketId]); // Este efecto depende únicamente del ID del ticket activo

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