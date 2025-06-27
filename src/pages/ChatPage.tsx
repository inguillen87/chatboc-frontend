import React, { useState, useEffect, useRef, useCallback } from "react";
import { Message } from "@/types/chat"; // Asegúrate de que Message tenga los nuevos campos
import ChatMessage from "@/components/chat/ChatMessage";
import ChatInput from "@/components/chat/ChatInput";
import TypingIndicator from "@/components/chat/TypingIndicator";
import Navbar from "@/components/layout/Navbar";
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

// --- NUEVA INTERFAZ PARA EL PAYLOAD DE ENVÍO DE MENSAJES (COMO EN useChatLogic.ts) ---
interface SendPayload {
  text: string;
  es_foto?: boolean;
  archivo_url?: string;
  es_ubicacion?: boolean;
  ubicacion_usuario?: { lat: number; lon: number; }; // Asegúrate de que las claves sean 'lat' y 'lon'
  action?: string;
}
// ---------------------------------------------------------------------------------

// Utilidad para mobile (sin cambios)
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

  const welcomeRef = useRef(false);

  // Mensaje de bienvenida + dirección de storage
  useEffect(() => {
    if (!welcomeRef.current && messages.length === 0) {
      setMessages([{ id: Date.now(), text: "¡Hola! Soy Chatboc. ¿En qué puedo ayudarte hoy?", isBot: true, timestamp: new Date(), query: undefined }]);
      welcomeRef.current = true;
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
        { sendAnonId: isAnonimo, sendEntityToken: true }
      );
      setTicketInfo({
        ...data,
        latitud: data.latitud != null ? Number(data.latitud) : null,
        longitud: data.longitud != null ? Number(data.longitud) : null,
      });
    } catch (error) { 
        console.error("Error fetching ticket info:", error);
    }
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
          // Asegúrate de enviar lat y lon
          await apiFetch(`/tickets/chat/${activeTicketId}/ubicacion`, { method: 'PUT', body: { lat: coords.latitud, lon: coords.longitud }, sendAnonId: isAnonimo, sendEntityToken: true });
          await apiFetch(`/tickets/municipio/${activeTicketId}/ubicacion`, { method: 'PUT', body: { lat: coords.latitud, lon: coords.longitud }, sendAnonId: isAnonimo, sendEntityToken: true });
          setForzarDireccion(false);
          fetchTicketInfo();
          toast({ title: "Ubicación enviada", description: "Tu ubicación ha sido compartida con el agente.", duration: 3000 });
        } catch (error) {
          console.error("Error al enviar ubicación:", error);
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
          `${base}${query}`, { sendAnonId: isAnonimo, sendEntityToken: true }
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
  // MODIFICADO: handleSend ahora acepta un SendPayload
  const handleSend = useCallback(
    async (payload: SendPayload) => { // <-- MODIFICADO
      // Asegurarse de que el texto del payload no esté vacío, a menos que sea una acción o adjunto
      if (!payload.text.trim() && !payload.archivo_url && !payload.ubicacion_usuario && !payload.action) return;
      
      const userMessageText = payload.text.trim(); // Acceder al texto desde el payload

      // Dirección
      if (esperandoDireccion) {
        setEsperandoDireccion(false);
        setForzarDireccion(false);
        safeLocalStorage.setItem("ultima_direccion", userMessageText); // Usar userMessageText
        setDireccionGuardada(userMessageText); // Usar userMessageText
        if (activeTicketId) {
          try {
            await apiFetch(`/tickets/chat/${activeTicketId}/ubicacion`, { method: 'PUT', body: { direccion: userMessageText }, sendAnonId: isAnonimo, sendEntityToken: true }); // Usar userMessageText
            await apiFetch(`/tickets/municipio/${activeTicketId}/ubicacion`, { method: 'PUT', body: { direccion: userMessageText }, sendAnonId: isAnonimo, sendEntityToken: true }); // Usar userMessageText
            fetchTicketInfo();
            toast({ title: "Dirección enviada", duration: 2000 });
          } catch (error) { // Capturar error
            console.error("Error enviando dirección:", error);
            toast({ title: "Error enviando dirección", variant: "destructive" });
          }
        }
        // No enviar el mensaje del usuario aquí, ya se manejará abajo con el payload completo
        // y se evita duplicidad si se comparte ubicación/foto
      }
      setShowCierre(null);

      // Mensaje usuario (ahora usa el payload.text)
      setMessages((prev) => [...prev, {
        id: Date.now(), text: userMessageText, isBot: false, timestamp: new Date(), // Usar userMessageText
      }]);
      lastQueryRef.current = userMessageText; // Usar userMessageText
      setIsTyping(true);

      try {
        if (activeTicketId) {
          // Si hay un ticket activo (chat en vivo), enviar como comentario
          await apiFetch(`/tickets/chat/${activeTicketId}/responder_ciudadano`, {
            method: "POST",
            body: {
                comentario: userMessageText, // Usar userMessageText
                ...(payload.es_foto && { foto_url: payload.archivo_url }),
                ...(payload.es_ubicacion && { ubicacion: payload.ubicacion_usuario }),
            },
            sendAnonId: isAnonimo,
            sendEntityToken: true,
          });
        } else {
          const requestPayload: Record<string, any> = { // Renombrado para evitar conflicto con el 'payload' de la función
            pregunta: userMessageText, // Usar userMessageText
            contexto_previo: contexto,
            // Incluir datos de adjunto si están presentes
            ...(payload.es_foto && { es_foto: true, archivo_url: payload.archivo_url }),
            ...(payload.es_ubicacion && { es_ubicacion: true, ubicacion_usuario: payload.ubicacion_usuario }),
            // Incluir acción de botón si está presente
            ...(payload.action && { action: payload.action }),
          };
          let rubroClave: string | undefined = undefined;
          if (tipoChat === 'pyme') {
            rubroClave = rubroNormalizado;
          } else if (tipoChat === 'municipio') {
            rubroClave = "municipios";
          }
          if (rubroClave) requestPayload.rubro_clave = rubroClave;
          requestPayload.tipo_chat = tipoChat;
          if (isAnonimo && anonId) requestPayload.anon_id = anonId;
          const endpoint = getAskEndpoint({ tipoChat, rubro: rubroClave });

          const data = await apiFetch<any>(endpoint, {
            method: "POST",
            body: requestPayload, // Usar el nuevo requestPayload
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
            mediaUrl: data.media_url, // Asegúrate de asignar esto desde la respuesta
            locationData: data.location_data, // Asegúrate de asignar esto desde la respuesta
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
    // Añadir todas las dependencias necesarias de useCallback
    [esperandoDireccion, activeTicketId, isAnonimo, anonId, contexto, tipoChat, rubroNormalizado, authToken, fetchTicketInfo, refreshUser]
  );

  // handleFileUploaded ahora espera el objeto 'data' del AdjuntarArchivo
  const handleFileUploaded = useCallback((data: { url: string; }) => {
    if (data?.url) {
        handleSend({ text: "Archivo adjunto", es_foto: true, archivo_url: data.url }); // Enviar como SendPayload
    }
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
    <div className="min-h-screen flex flex-col w-full bg-gradient-to-br from-[#0d223a] to-[#151a26] text-foreground">
      <Navbar />
      <main className="flex-grow flex flex-col items-center justify-center pt-3 sm:pt-10 pb-2 sm:pb-6 transition-all">
        <div
          className={`
            w-full ${isMobile ? "h-[100svh]" : "h-[83vh]"}
            flex flex-col
            relative
            overflow-hidden
            transition-all
          `}
        >
          <div
            ref={chatMessagesContainerRef}
            className={`
              flex-1 overflow-y-auto
              p-2 sm:p-4 space-y-3
              custom-scroll
              scrollbar-thin scrollbar-thumb-[#90caf9] scrollbar-track-transparent
              transition-all
            `}
            style={{ minHeight: 0 }}
          >
            {messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                message={msg}
                isTyping={isTyping}
                onButtonClick={handleSend} // Pasa handleSend, que ahora acepta SendPayload
                tipoChat={tipoChat}
                query={msg.query}
              />
            ))}
            {isTyping && <TypingIndicator />}
            {isTicketLocationValid && <TicketMap ticket={{ ...ticketInfo, tipo: 'municipio' }} />}
            {showCierre && showCierre.show && (
              <div className="my-3 p-3 rounded-lg bg-green-100 text-green-800 text-center font-bold shadow">
                {showCierre.text}
              </div>
            )}
          </div>
          {/* Input / Autocomplete según caso */}
          <div className="bg-transparent px-3 py-2 border-t min-w-0">
            {esperandoDireccion ? (
              <div>
                <AddressAutocomplete
                  onSelect={(addressText: string) => handleSend({ text: addressText })} // MODIFICADO: Envía SendPayload
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
                {direccionGuardada && (
                  <TicketMap ticket={{ direccion: direccionGuardada }} />
                )}
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
                onSendMessage={handleSend} // Pasa handleSend, que ahora acepta SendPayload
                isTyping={isTyping}
                onFileUploaded={handleFileUploaded} // Pasa el nuevo handleFileUploaded
              />
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
};


export default ChatPage;