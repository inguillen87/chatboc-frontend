import React, { useState, useEffect, useRef, useCallback } from "react";
import { Message } from "@/types/chat";
import ChatMessage from "@/components/chat/ChatMessage";
import ChatInput from "@/components/chat/ChatInput";
import TypingIndicator from "@/components/chat/TypingIndicator";
import Navbar from "@/components/layout/Navbar";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch, getErrorMessage } from "@/utils/api";
import { getAskEndpoint, esRubroPublico, parseRubro } from "@/utils/chatEndpoints";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import { useUser } from "@/hooks/useUser";
import { parseChatResponse } from "@/utils/parseChatResponse";
import AddressAutocomplete from "@/components/ui/AddressAutocomplete";
import TicketMap from "@/components/TicketMap";
import getOrCreateAnonId from "@/utils/anonId";
import { toast } from "@/components/ui/use-toast";
import { requestLocation } from "@/utils/geolocation";

// Utilidad para mobile
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

const FRASES_DIRECCION = [
  "indicame la dirección", "necesito la dirección", "ingresa la dirección",
  "especificá la dirección", "decime la dirección", "dirección exacta",
  "¿cuál es la dirección?", "por favor indique la dirección",
  "por favor ingrese su dirección", "dirección completa"
];
const FRASES_EXITO = [
  "Tu reclamo fue generado", "¡Muchas gracias por tu calificación!", "Dejaré el ticket abierto",
  "El curso de seguridad vial es online", "He abierto una sala de chat directa",
  "Tu número de chat es", "ticket **M-",
];

const ChatPage = () => {
  // Estados básicos
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [contexto, setContexto] = useState({});
  const [esperandoDireccion, setEsperandoDireccion] = useState(false);
  const [forzarDireccion, setForzarDireccion] = useState(false);
  const [direccionGuardada, setDireccionGuardada] = useState<string | null>(null);
  const [showCierre, setShowCierre] = useState<{ show: boolean; text: string } | null>(null);
  const [activeTicketId, setActiveTicketId] = useState<number | null>(null);
  const [ticketInfo, setTicketInfo] = useState<any>(null);

  const chatMessagesContainerRef = useRef<HTMLDivElement>(null);
  const lastQueryRef = useRef<string | null>(null);
  const ultimoMensajeIdRef = useRef<number>(0);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Usuario / rubro / anon
  const { user, refreshUser, loading } = useUser();
  const authToken = safeLocalStorage.getItem("authToken");
  const isAnonimo = !authToken;
  const anonId = getOrCreateAnonId();

  // Rubro normalizado: logueado, storage, o demo
  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const demoRubroNameParam = urlParams?.get('rubroName');
  const demoRubroIdParam = urlParams?.get('rubroId');
  const rubroFromUser = user?.rubro ? parseRubro(user.rubro) : null;
  const rubroFromStorage = typeof window !== 'undefined'
    ? (() => {
      const stored = safeLocalStorage.getItem('rubroSeleccionado');
      return stored ? parseRubro(stored) : null;
    })()
    : null;
  const rubroNormalizado = (isAnonimo && demoRubroNameParam)
    ? parseRubro(demoRubroNameParam)
    : rubroFromUser || rubroFromStorage;

  // Tipo chat actual
  const tipoChat: "pyme" | "municipio" = esRubroPublico(rubroNormalizado) ? "municipio" : "pyme";

  const isMobile = useIsMobile();

  // Mensaje de bienvenida + dirección de storage
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
        id: Date.now(),
        text: "¡Hola! Soy Chatboc. ¿En qué puedo ayudarte hoy?",
        isBot: true,
        timestamp: new Date(),
        query: undefined,
      }]);
    }
    const stored = safeLocalStorage.getItem("ultima_direccion");
    if (stored) setDireccionGuardada(stored);
  }, []);

  // Refresca usuario si es necesario
  useEffect(() => {
    if (!isAnonimo && (!user || !user.rubro) && !loading) {
      refreshUser();
    }
  }, [isAnonimo, user, refreshUser, loading]);

  // Scroll automático
  const scrollToBottom = useCallback(() => {
    const container = chatMessagesContainerRef.current;
    if (container) {
      const atBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight < 100;
      if (atBottom) container.scrollTop = container.scrollHeight;
    }
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => scrollToBottom(), 150);
    return () => clearTimeout(timer);
  }, [messages, isTyping, scrollToBottom]);

  // Dirección/autocomplete/cierre
  useEffect(() => {
    const lastBotMsg = [...messages].reverse().find((m) => m.isBot && m.text);
    const needsAddress = lastBotMsg &&
      FRASES_DIRECCION.some((frase) => (lastBotMsg.text as string).toLowerCase().includes(frase)) || forzarDireccion;
    setEsperandoDireccion(Boolean(needsAddress));
    if (!needsAddress) {
      // Éxito: mostrar mensaje de cierre si corresponde
      const contenido = lastBotMsg && typeof lastBotMsg.text === "string" ? lastBotMsg.text.toLowerCase() : "";
      const exito = FRASES_EXITO.some(f => contenido.includes(f));
      if (exito) {
        const match = contenido.match(/ticket \*\*m-(\d+)/i);
        setShowCierre({
          show: true,
          text: match
            ? `✅ ¡Listo! Tu ticket fue generado exitosamente. Número: M-${match[1]}.\nUn agente municipal te va a contactar para seguimiento.`
            : lastBotMsg.text as string
        });
      } else setShowCierre(null);
    } else setShowCierre(null);
  }, [messages, forzarDireccion]);

  // --- Ticket info (mapa) ---
  const fetchTicketInfo = useCallback(async () => {
    if (!activeTicketId) return;
    try {
      const data = await apiFetch<any>(
        `/tickets/municipio/${activeTicketId}`,
        { sendAnonId: isAnonimo }
      );
      setTicketInfo({
        ...data,
        latitud: data.latitud != null ? Number(data.latitud) : null,
        longitud: data.longitud != null ? Number(data.longitud) : null,
      });
    } catch { /* ignore */ }
  }, [activeTicketId, isAnonimo]);
  useEffect(() => { fetchTicketInfo(); }, [activeTicketId, fetchTicketInfo]);

  // --- GPS/ubicación ---
  const handleShareGps = useCallback(() => {
    if (!activeTicketId) {
      toast({ title: "Ubicación no disponible", description: "El ticket no está activo.", variant: "destructive", duration: 3000 });
      return;
    }
    if (tipoChat === "municipio") {
      requestLocation({ enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }).then(async (coords) => {
        if (!coords) {
          setForzarDireccion(true);
          setEsperandoDireccion(true);
          setMessages((prev) => [...prev, {
            id: Date.now(),
            text: 'No pudimos acceder a tu ubicación por GPS. Verificá los permisos y que estés usando una conexión segura (https). Ingresá la dirección manualmente para continuar.',
            isBot: true, timestamp: new Date(), query: undefined
          }]);
          return;
        }
        try {
          await apiFetch(`/tickets/chat/${activeTicketId}/ubicacion`, { method: 'PUT', body: coords, sendAnonId: isAnonimo });
          await apiFetch(`/tickets/municipio/${activeTicketId}/ubicacion`, { method: 'PUT', body: coords, sendAnonId: isAnonimo });
          setForzarDireccion(false);
          fetchTicketInfo();
          toast({ title: "Ubicación enviada", description: "Tu ubicación ha sido compartida con el agente.", duration: 3000 });
        } catch {
          toast({ title: "Error al enviar ubicación", description: "Hubo un problema al enviar tu ubicación.", variant: "destructive", duration: 3000 });
        }
      });
    }
  }, [activeTicketId, fetchTicketInfo, tipoChat, isAnonimo]);

  // Polling live chat (tickets)
  useEffect(() => {
    const fetchNewMessages = async () => {
      if (!activeTicketId) return;
      try {
        const base = `/tickets/chat/${activeTicketId}/mensajes`;
        const query = `?ultimo_mensaje_id=${ultimoMensajeIdRef.current}`;
        const data = await apiFetch<{ estado_chat: string; mensajes: any[] }>(
          `${base}${query}`, { sendAnonId: isAnonimo }
        );
        if (data.mensajes && data.mensajes.length > 0) {
          const nuevosMensajes: Message[] = data.mensajes.map((msg) => ({
            id: msg.id, text: msg.texto, isBot: msg.es_admin, timestamp: new Date(msg.fecha), query: undefined,
          }));
          setMessages((prev) => [...prev, ...nuevosMensajes]);
          ultimoMensajeIdRef.current = data.mensajes[data.mensajes.length - 1].id;
        }
        if (["resuelto", "cerrado"].includes(data.estado_chat)) {
          if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
          setMessages((prev) => [...prev, {
            id: Date.now(),
            text: "Un agente ha finalizado esta conversación.",
            isBot: true, timestamp: new Date(), query: undefined,
          }]);
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
    return () => { if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current); };
  }, [activeTicketId, fetchTicketInfo, isAnonimo]);

  // ---- ENVÍO de mensaje ----
  const handleSend = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      // Dirección
      if (esperandoDireccion) {
        setEsperandoDireccion(false);
        setForzarDireccion(false);
        safeLocalStorage.setItem("ultima_direccion", text);
        setDireccionGuardada(text);
        if (activeTicketId) {
          try {
            await apiFetch(`/tickets/chat/${activeTicketId}/ubicacion`, { method: 'PUT', body: { direccion: text }, sendAnonId: isAnonimo });
            await apiFetch(`/tickets/municipio/${activeTicketId}/ubicacion`, { method: 'PUT', body: { direccion: text }, sendAnonId: isAnonimo });
            fetchTicketInfo();
            toast({ title: "Dirección enviada", duration: 2000 });
          } catch {
            toast({ title: "Error enviando dirección", variant: "destructive" });
          }
        }
      }
      setShowCierre(null);

      // Mensaje usuario
      setMessages((prev) => [...prev, {
        id: Date.now(), text, isBot: false, timestamp: new Date(),
      }]);
      lastQueryRef.current = text;
      setIsTyping(true);

      try {
        if (activeTicketId) {
          await apiFetch(`/tickets/chat/${activeTicketId}/responder_ciudadano`, {
            method: "POST",
            body: { comentario: text },
            sendAnonId: isAnonimo
          });
        } else {
          const payload: Record<string, any> = {
            pregunta: text,
            contexto_previo: contexto,
          };
          let rubroClave: string | undefined = undefined;
          if (tipoChat === 'pyme') {
            rubroClave = rubroNormalizado;
          } else if (tipoChat === 'municipio') {
            rubroClave = "municipios";
          }
          if (rubroClave) payload.rubro_clave = rubroClave;
          payload.tipo_chat = tipoChat;
          if (isAnonimo && anonId) payload.anon_id = anonId;
          const endpoint = getAskEndpoint({ tipoChat, rubro: rubroClave });

          const data = await apiFetch<any>(endpoint, {
            method: "POST",
            body: payload,
            skipAuth: !authToken,
            sendEntityToken: true,
          });

          setContexto(data.contexto_actualizado || {});

          const { text: respuestaText, botones } = parseChatResponse(data);

          setMessages((prev) => [...prev, {
            id: Date.now(),
            text: respuestaText || "⚠️ No se pudo generar una respuesta.",
            isBot: true,
            timestamp: new Date(),
            botones,
            query: lastQueryRef.current || undefined,
          }]);
          lastQueryRef.current = null;

          if (data.ticket_id) {
            setActiveTicketId(data.ticket_id);
            ultimoMensajeIdRef.current = 0;
          }
          if (!isAnonimo) await refreshUser();
        }
      } catch (error: any) {
        const errorMsg = getErrorMessage(
          error,
          '⚠️ No se pudo conectar con el servidor.'
        );
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now(),
            text: errorMsg,
            isBot: true,
            timestamp: new Date(),
            query: undefined,
          },
        ]);
        toast({
          title: 'Error de comunicación',
          description: errorMsg,
          variant: 'destructive',
          duration: 5000,
        });
      } finally {
        setIsTyping(false);
      }
    },
    [esperandoDireccion, activeTicketId, isAnonimo, anonId, contexto, tipoChat, rubroNormalizado, authToken, fetchTicketInfo, refreshUser]
  );

  const handleFileUploaded = useCallback((data: any) => {
    if (data?.url) handleSend(data.url);
  }, [handleSend]);

  // Render
  const isTicketLocationValid =
    !!ticketInfo &&
    typeof ticketInfo.latitud === "number" &&
    typeof ticketInfo.longitud === "number" &&
    !isNaN(ticketInfo.latitud) &&
    !isNaN(ticketInfo.longitud) &&
    tipoChat === "municipio";

  return (
    <div className="min-h-screen flex flex-col bg-background dark:bg-gradient-to-b dark:from-[#0d1014] dark:to-[#161b22] text-foreground">
      <Navbar />
      <main className="flex-grow flex flex-col items-center justify-center pt-3 sm:pt-10 pb-2 sm:pb-6 transition-all">
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
                    query={msg.query}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
            {isTyping && <TypingIndicator />}
            {isTicketLocationValid && <TicketMap ticket={{ ...ticketInfo, tipo: 'municipio' }} />}
            {showCierre && showCierre.show && (
              <div className="my-3 p-3 rounded-lg bg-green-100 text-green-800 text-center font-bold shadow">
                {showCierre.text}
              </div>
            )}
          </div>
          {/* Input / Autocomplete según caso */}
          <div className="bg-card px-3 py-2 border-t min-w-0">
            {esperandoDireccion ? (
              <div>
                <AddressAutocomplete
                  onSelect={handleSend}
                  autoFocus
                  placeholder="Ej: Av. Principal 123"
                  value={direccionGuardada ? { label: direccionGuardada, value: direccionGuardada } : undefined}
                  onChange={(opt) =>
                    setDireccionGuardada(
                      opt
                        ? typeof opt.value === "string"
                          ? opt.value
                          : opt.value?.description ?? null
                        : null
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
              <ChatInput
                onSendMessage={handleSend}
                isTyping={isTyping}
                onFileUploaded={handleFileUploaded}
              />
            ) : null}
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default ChatPage;
