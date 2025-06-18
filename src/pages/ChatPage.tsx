// src/pages/ChatPage.tsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Message } from "@/types/chat";
import ChatMessage from "@/components/chat/ChatMessage";
import { APP_TARGET } from "@/config";
import ChatInput from "@/components/chat/ChatInput";
import TypingIndicator from "@/components/chat/TypingIndicator";
import Navbar from "@/components/layout/Navbar";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "@/utils/api";
import AddressAutocomplete from "@/components/ui/AddressAutocomplete";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import TicketMap from "@/components/TicketMap";

// Frases para detectar pedido de dirección
const FRASES_DIRECCION = [
  "indicame la dirección",
  "necesito la dirección",
  "ingresa la dirección",
  "especificá la dirección",
  "decime la dirección",
  "dirección exacta",
  "¿cuál es la dirección?",
  "por favor indique la dirección",
  "por favor ingrese su dirección",
  "dirección completa",
];
const FRASES_EXITO = [
  "Tu reclamo fue generado",
  "¡Muchas gracias por tu calificación!",
  "Dejaré el ticket abierto",
  "El curso de seguridad vial es online",
  "He abierto una sala de chat directa",
  "Tu número de chat es",
  "ticket **M-",
];

function shouldShowAutocomplete(messages: Message[], contexto: any) {
  const lastBotMsg = [...messages].reverse().find((m) => m.isBot && m.text);
  if (!lastBotMsg) return false;
  const contenido = (lastBotMsg.text || "").toLowerCase();
  if (FRASES_DIRECCION.some((frase) => contenido.includes(frase))) return true;
  if (
    contexto &&
    contexto.contexto_municipio &&
    (contexto.contexto_municipio.estado_conversacion ===
      "ESPERANDO_DIRECCION_RECLAMO" ||
      contexto.contexto_municipio.estado_conversacion === 4)
  ) {
    return true;
  }
  return false;
}

function checkCierreExito(messages: Message[]) {
  const lastBotMsg = [...messages].reverse().find((m) => m.isBot && m.text);
  if (!lastBotMsg) return null;
  const contenido = (lastBotMsg.text || "").toLowerCase();
  if (FRASES_EXITO.some((frase) => contenido.includes(frase))) {
    // Detectar número de ticket
    const match = contenido.match(/ticket \*\*m-(\d+)/i);
    if (match) {
      return {
        show: true,
        text: `✅ ¡Listo! Tu ticket fue generado exitosamente. Número: M-${match[1]}.\nUn agente municipal te va a contactar para seguimiento.`,
      };
    }
    return { show: true, text: lastBotMsg.text };
  }
  return null;
}

// Mobile detection
function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < breakpoint : false,
  );
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [breakpoint]);
  return isMobile;
}

// --- Generar/Persistir anon_id para usuarios no logueados ---
function getOrCreateAnonId() {
  if (typeof window === "undefined") return null;
  try {
    let anonId = safeLocalStorage.getItem("anon_id");
    if (!anonId) {
      anonId = window.crypto?.randomUUID?.() ||
        `anon-${Math.random().toString(36).slice(2, 9)}-${Date.now()}`;
      safeLocalStorage.setItem("anon_id", anonId);
    }
    return anonId;
  } catch {
    return `anon-${Math.random().toString(36).slice(2, 9)}-${Date.now()}`;
  }
}

const ChatPage = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatMessagesContainerRef = useRef<HTMLDivElement>(null);

  const tipoChatParam =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('tipo_chat')
      : null;
  const tipoChat: 'pyme' | 'municipio' =
    tipoChatParam === 'pyme' || tipoChatParam === 'municipio'
      ? (tipoChatParam as 'pyme' | 'municipio')
      : APP_TARGET;

const authToken = safeLocalStorage.getItem("authToken");
const anonId = getOrCreateAnonId();
const isAnonimo = !authToken;
const authHeaders: Record<string, string> = authToken
  ? { Authorization: `Bearer ${authToken}` }
  : {};
const anonParam = !authToken ? `anon_id=${anonId}` : '';
const queryPrefix = anonParam ? `?${anonParam}` : '';
const DEFAULT_RUBRO = tipoChat === "municipio" ? "municipios" : undefined;

  const [contexto, setContexto] = useState({});
  const [activeTicketId, setActiveTicketId] = useState<number | null>(null);
  const [ticketInfo, setTicketInfo] = useState<{
    direccion?: string | null;
    latitud?: number | null;
    longitud?: number | null;
    municipio_nombre?: string | null;
  } | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const ultimoMensajeIdRef = useRef<number>(0);
  const isMobile = useIsMobile();

  // Estado de input dirección / cierre éxito
  const [esperandoDireccion, setEsperandoDireccion] = useState(false);
  const [forzarDireccion, setForzarDireccion] = useState(false);
  const [direccionGuardada, setDireccionGuardada] = useState<string | null>(null);
  const [showCierre, setShowCierre] = useState<{
    show: boolean;
    text: string;
  } | null>(null);

  const fetchTicketInfo = useCallback(async () => {
    if (!activeTicketId) return;
    try {
      const data = await apiFetch<{
        direccion?: string | null;
        latitud?: number | string | null;
        longitud?: number | string | null;
        municipio_nombre?: string | null;
      }>(
        `/tickets/municipio/${activeTicketId}${queryPrefix}`,
        { headers: authHeaders },
      );
      const normalized = {
        ...data,
        latitud:
          data.latitud !== null && data.latitud !== undefined
            ? Number(data.latitud)
            : null,
        longitud:
          data.longitud !== null && data.longitud !== undefined
            ? Number(data.longitud)
            : null,
      };
      setTicketInfo(normalized);
    } catch (e) {
      console.error('Error al refrescar ticket:', e);
    }
  }, [activeTicketId, authHeaders]);

  useEffect(() => {
    fetchTicketInfo();
  }, [activeTicketId, fetchTicketInfo]);

  const scrollToBottom = useCallback(() => {
    const container = chatMessagesContainerRef.current;
    if (container) {
      const atBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight < 100;
      if (atBottom) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, []);

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: Date.now(),
          text: "¡Hola! Soy Chatboc. ¿En qué puedo ayudarte hoy?",
          isBot: true,
          timestamp: new Date(),
        },
      ]);
    }
    const stored = safeLocalStorage.getItem("ultima_direccion");
    if (stored) {
      setDireccionGuardada(stored);
    }
  }, []);

  // Scroll y cierre UX
  useEffect(() => {
    const needsAddress =
      shouldShowAutocomplete(messages, contexto) || forzarDireccion;
    setEsperandoDireccion(needsAddress);
    if (!needsAddress) {
      setShowCierre(checkCierreExito(messages));
    } else {
      setShowCierre(null);
    }
    const timer = setTimeout(() => scrollToBottom(), 150);
    return () => clearTimeout(timer);
  }, [messages, isTyping, scrollToBottom, contexto, forzarDireccion, ticketInfo]);

  const handleShareGps = useCallback(() => {
    if (!activeTicketId || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const coords = {
        latitud: pos.coords.latitude,
        longitud: pos.coords.longitude,
      };
      try {
        await apiFetch(
          `/tickets/chat/${activeTicketId}/ubicacion${queryPrefix}`,
          {
            method: 'POST',
            headers: authHeaders,
            body: coords,
          },
        );
        await apiFetch(
          `/tickets/municipio/${activeTicketId}/ubicacion${queryPrefix}`,
          {
            method: 'PUT',
            headers: authHeaders,
            body: coords,
          },
        );
        setForzarDireccion(false);
        fetchTicketInfo();
      } catch (e) {
        console.error('Error al enviar ubicación', e);
      }
    });
  }, [activeTicketId, fetchTicketInfo]);

  // Solicitar GPS automáticamente al iniciar chat en vivo
  useEffect(() => {
    if (!activeTicketId) return;
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const coords = {
            latitud: pos.coords.latitude,
            longitud: pos.coords.longitude,
          };
          try {
            await apiFetch(
              `/tickets/chat/${activeTicketId}/ubicacion${queryPrefix}`,
              {
                method: 'POST',
                headers: authHeaders,
                body: coords,
              },
            );
            await apiFetch(
              `/tickets/municipio/${activeTicketId}/ubicacion${queryPrefix}`,
              {
                method: 'PUT',
                headers: authHeaders,
                body: coords,
              },
            );
            // Refrescar los datos del ticket para mostrar la ubicación
            fetchTicketInfo();
          } catch (e) {
            console.error('Error al enviar ubicación', e);
          }
        },
        () => setForzarDireccion(true),
      );
    } else {
      setForzarDireccion(true);
    }
  }, [activeTicketId, authHeaders, fetchTicketInfo]);

  // Maneja envío de mensaje O dirección seleccionada
  const handleSend = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      if (esperandoDireccion) {
        setEsperandoDireccion(false);
        setForzarDireccion(false);
        safeLocalStorage.setItem("ultima_direccion", text);
        setDireccionGuardada(text);
        if (activeTicketId) {
          try {
            await apiFetch(
              `/tickets/chat/${activeTicketId}/ubicacion${queryPrefix}`,
              {
                method: 'POST',
                headers: authHeaders,
                body: { direccion: text },
              },
            );
            await apiFetch(
              `/tickets/municipio/${activeTicketId}/ubicacion${queryPrefix}`,
              {
                method: 'PUT',
                headers: authHeaders,
                body: { direccion: text },
              },
            );
            fetchTicketInfo();
          } catch (e) {
            console.error('Error al enviar dirección', e);
          }
        }
      }
      setShowCierre(null);

      const userMessage: Message = {
        id: Date.now(),
        text,
        isBot: false,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setIsTyping(true);

      const payload: Record<string, any> = {
        pregunta: text,
        contexto_previo: contexto,
        tipo_chat: tipoChat,
      };

      try {
        // --- LÓGICA CONDICIONAL ---
        if (activeTicketId) {
          // Caso: chat en vivo
          await apiFetch(
            `/tickets/chat/${activeTicketId}/responder_ciudadano${queryPrefix}`,
            {
              method: "POST",
              headers: authHeaders,
              body: { comentario: text },
            },
          );
        } else {
  // Caso: todavía con el bot

  const payload: any = {
    pregunta: text,
    contexto_previo: contexto,
    tipo_chat: tipoChat,
  };

  if (isAnonimo) {
    if (DEFAULT_RUBRO) payload.rubro = DEFAULT_RUBRO;
    payload.anon_id = anonId;
  }
  const data = await apiFetch<any>("/ask", {
    method: "POST",
    headers: authHeaders,
    body: payload,
  });

  setContexto(data.contexto_actualizado || {});

  const botMessage: Message = {
    id: Date.now(),
    text: data?.respuesta || "⚠️ No se pudo generar una respuesta.",
    isBot: true,
    timestamp: new Date(),
    botones: data?.botones || [],
  };
  setMessages((prev) => [...prev, botMessage]);

  if (data.ticket_id) {
    setActiveTicketId(data.ticket_id);
    ultimoMensajeIdRef.current = 0;
  }
}
      } catch (error: any) {
        let errorMsg = "⚠️ No se pudo conectar con el servidor.";
        if (error?.body?.error) {
          errorMsg = error.body.error;
        } else if (error?.message) {
          errorMsg = error.message;
        }
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now(),
            text: errorMsg,
            isBot: true,
            timestamp: new Date(),
          },
        ]);
      } finally {
        setIsTyping(false);
      }
    },
    [contexto, activeTicketId, esperandoDireccion],
  );

  // Polling para chat en vivo
  useEffect(() => {
    const fetchNewMessages = async () => {
      if (!activeTicketId) return;
      try {
        const base = `/tickets/chat/${activeTicketId}/mensajes`;
        const query = `${queryPrefix}${queryPrefix ? '&' : '?'}ultimo_mensaje_id=${ultimoMensajeIdRef.current}`;
        const data = await apiFetch<{ estado_chat: string; mensajes: any[] }>(
          `${base}${query}`,
          { headers: authHeaders },
        );
        if (data.mensajes && data.mensajes.length > 0) {
          const nuevosMensajes: Message[] = data.mensajes.map((msg) => ({
            id: msg.id,
            text: msg.texto,
            isBot: msg.es_admin,
            timestamp: new Date(msg.fecha),
          }));
          setMessages((prev) => [...prev, ...nuevosMensajes]);
          ultimoMensajeIdRef.current =
            data.mensajes[data.mensajes.length - 1].id;
        }
        if (data.estado_chat === "resuelto" || data.estado_chat === "cerrado") {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
          }
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now(),
              text: "Un agente ha finalizado esta conversación.",
              isBot: true,
              timestamp: new Date(),
            },
          ]);
        }
        await fetchTicketInfo();
      } catch (error) {
        console.error("Error durante el polling:", error);
      }
    };
    if (activeTicketId) {
      fetchNewMessages();
      pollingIntervalRef.current = setInterval(fetchNewMessages, 10000);
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
            boxShadow: isMobile
              ? undefined
              : "0 8px 64px 0 rgba(30,40,90,0.10)",
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
                  <ChatMessage
                    message={msg}
                    isTyping={isTyping}
                    onButtonClick={handleSend}
                    tipoChat={tipoChat}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
            {isTyping && <TypingIndicator />}
            {ticketInfo && <TicketMap ticket={{ ...ticketInfo, tipo: 'municipio' }} />}
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
            {esperandoDireccion ? (
              <div>
                <AddressAutocomplete
                  onSelect={(addr) => handleSend(addr)}
                  autoFocus
                  placeholder="Ej: Av. Principal 123"
                  value={
                    direccionGuardada
                      ? { label: direccionGuardada, value: direccionGuardada }
                      : undefined
                  }
                  onChange={(opt) =>
                    setDireccionGuardada(
                      opt
                        ? typeof opt.value === "string"
                          ? opt.value
                          : opt.value?.description ?? null
                        : null,
                    )
                  }
                  persistKey="ultima_direccion"
                />
                <button
                  onClick={handleShareGps}
                  className="mt-2 text-sm text-primary underline"
                  type="button"
                >
                  Compartir ubicación por GPS
                </button>
                <div className="text-xs mt-2 text-muted-foreground">
                  Escribí o seleccioná tu dirección para el reclamo.
                </div>
              </div>
            ) : !showCierre || !showCierre.show ? (
              <ChatInput onSendMessage={handleSend} />
            ) : null}
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default ChatPage;
