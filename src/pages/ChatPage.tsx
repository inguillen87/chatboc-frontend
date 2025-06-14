// src/pages/ChatPage.tsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Message } from "@/types/chat";
import ChatMessage from "@/components/chat/ChatMessage";
import ChatInput from "@/components/chat/ChatInput";
import TypingIndicator from "@/components/chat/TypingIndicator";
import Navbar from "@/components/layout/Navbar";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "@/utils/api";
import GooglePlacesAutocomplete from "react-google-autocomplete";

// Frases para detectar pedido de dirección
const FRASES_DIRECCION = [
  "indicame la dirección", "necesito la dirección", "ingresa la dirección",
  "especificá la dirección", "decime la dirección", "dirección exacta",
  "¿cuál es la dirección?", "por favor indique la dirección", "por favor ingrese su dirección", "dirección completa"
];
const FRASES_EXITO = [
  "Tu reclamo fue generado", "¡Muchas gracias por tu calificación!",
  "Dejaré el ticket abierto", "El curso de seguridad vial es online",
  "He abierto una sala de chat directa", "Tu número de chat es", "ticket **M-"
];

function shouldShowAutocomplete(messages: Message[], contexto: any) {
  const lastBotMsg = [...messages].reverse().find(m => m.isBot && m.text);
  if (!lastBotMsg) return false;
  const contenido = (lastBotMsg.text || "").toLowerCase();
  if (FRASES_DIRECCION.some(frase => contenido.includes(frase))) return true;
  if (
    contexto &&
    contexto.contexto_municipio &&
    (
      contexto.contexto_municipio.estado_conversacion === "ESPERANDO_DIRECCION_RECLAMO" ||
      contexto.contexto_municipio.estado_conversacion === 4
    )
  ) {
    return true;
  }
  return false;
}

function checkCierreExito(messages: Message[]) {
  const lastBotMsg = [...messages].reverse().find(m => m.isBot && m.text);
  if (!lastBotMsg) return null;
  const contenido = (lastBotMsg.text || "").toLowerCase();
  if (FRASES_EXITO.some(frase => contenido.includes(frase))) {
    // Detectar número de ticket
    const match = contenido.match(/ticket \*\*m-(\d+)/i);
    if (match) {
      return {
        show: true,
        text: `✅ ¡Listo! Tu ticket fue generado exitosamente. Número: M-${match[1]}.\nUn agente municipal te va a contactar para seguimiento.`
      };
    }
    return { show: true, text: lastBotMsg.text };
  }
  return null;
}

// Mobile detection
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

const Maps_API_KEY = import.meta.env.VITE_Maps_API_KEY;

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

  // Estado de input dirección / cierre éxito
  const [esperandoDireccion, setEsperandoDireccion] = useState(false);
  const [showCierre, setShowCierre] = useState<{ show: boolean, text: string } | null>(null);

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

  // Scroll y cierre UX
  useEffect(() => {
    setEsperandoDireccion(shouldShowAutocomplete(messages, contexto));
    if (!shouldShowAutocomplete(messages, contexto)) {
      setShowCierre(checkCierreExito(messages));
    } else {
      setShowCierre(null);
    }
    const timer = setTimeout(() => scrollToBottom(), 150);
    return () => clearTimeout(timer);
  }, [messages, isTyping, scrollToBottom, contexto]);

  // Maneja envío de mensaje O dirección seleccionada
  const handleSend = useCallback(async (text: string) => {
    if (!text.trim()) return;

    if (esperandoDireccion) setEsperandoDireccion(false);
    setShowCierre(null);

    const userMessage: Message = { id: Date.now(), text, isBot: false, timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setIsTyping(true);

    try {
      // --- LÓGICA CONDICIONAL ---
      if (activeTicketId) {
        // Caso: chat en vivo
        await apiFetch(`/tickets/chat/${activeTicketId}/responder_ciudadano`, {
          method: "POST",
          body: { comentario: text },
        });
      } else {
        // Caso: todavía con el bot
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

        if (data.ticket_id) {
          setActiveTicketId(data.ticket_id);
          ultimoMensajeIdRef.current = 0;
        }
      }
    } catch (error) {
      setMessages(prev => [...prev, { id: Date.now(), text: "⚠️ No se pudo conectar con el servidor.", isBot: true, timestamp: new Date() }]);
    } finally {
      setIsTyping(false);
    }
  }, [contexto, activeTicketId, esperandoDireccion]);

  // Polling para chat en vivo
  useEffect(() => {
    const fetchNewMessages = async () => {
      if (!activeTicketId) return;
      try {
        const data = await apiFetch<{ estado_chat: string; mensajes: any[] }>(
          `/tickets/chat/${activeTicketId}/mensajes?ultimo_mensaje_id=${ultimoMensajeIdRef.current}`
        );
        if (data.mensajes && data.mensajes.length > 0) {
          const nuevosMensajes: Message[] = data.mensajes.map(msg => ({
            id: msg.id,
            text: msg.texto,
            isBot: msg.es_admin,
            timestamp: new Date(msg.fecha),
          }));
          setMessages(prev => [...prev, ...nuevosMensajes]);
          ultimoMensajeIdRef.current = data.mensajes[data.mensajes.length - 1].id;
        }
        if (data.estado_chat === 'resuelto' || data.estado_chat === 'cerrado') {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
          }
          setMessages(prev => [...prev, { id: Date.now(), text: "Un agente ha finalizado esta conversación.", isBot: true, timestamp: new Date() }]);
        }
      } catch (error) {
        console.error("Error durante el polling:", error);
      }
    };
    if (activeTicketId) {
      fetchNewMessages();
      pollingIntervalRef.current = setInterval(fetchNewMessages, 5000);
    }
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [activeTicketId]);

  return (
    <div className="min-h-screen flex flex-col bg-background dark:bg-gradient-to-b dark:from-[#0d1014] dark:to-[#161b22] text-foreground">
      <Navbar />

      <main className={`
        flex-grow flex flex-col items-center justify-center
        pt-3 sm:pt-10 pb-2 sm:pb-6
        transition-all
      `}>
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
                  <ChatMessage message={msg} isTyping={isTyping} onButtonClick={handleSend} />
                </motion.div>
              ))}
            </AnimatePresence>
            {isTyping && <TypingIndicator />}
            <div ref={chatEndRef} />
            {/* Mensaje de cierre SIEMPRE si corresponde */}
            {showCierre && showCierre.show && (
              <div className="my-3 p-3 rounded-lg bg-green-100 text-green-800 text-center font-bold shadow">
                {showCierre.text}
              </div>
            )}
          </div>

          {/* Autocomplete o Input según el estado */}
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
            {esperandoDireccion && Maps_API_KEY ? (
              <div>
                <GooglePlacesAutocomplete
                  apiKey={Maps_API_KEY}
                  autocompletionRequest={{
                    componentRestrictions: { country: "ar" },
                    types: ['address'],
                  }}
                  onPlaceSelected={(place) => {
                    if (place?.formatted_address) {
                      handleSend(place.formatted_address);
                    }
                  }}
                  className="w-full rounded-md border border-input bg-input px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary h-12 placeholder:text-muted-foreground"
                  placeholder="Ej: Av. San Martín 123, Junín, Mendoza"
                />
                <div className="text-xs mt-2 text-muted-foreground">
                  Escribí o seleccioná tu dirección para el reclamo.
                </div>
              </div>
            ) : (!showCierre || !showCierre.show) ? (
              <ChatInput onSendMessage={handleSend} />
            ) : null}
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default ChatPage;
