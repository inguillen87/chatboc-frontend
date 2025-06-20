import React, { useState, useRef, useEffect, useCallback } from "react";
import ChatMessage from "./ChatMessage";
import TypingIndicator from "./TypingIndicator";
import ChatInput from "./ChatInput";
import AddressAutocomplete from "@/components/ui/AddressAutocomplete";
import TicketMap from "@/components/TicketMap";
import { Message } from "@/types/chat";
import { apiFetch } from "@/utils/api";
import { useUser } from "@/hooks/useUser";
import { parseRubro, esRubroPublico, getAskEndpoint } from "@/utils/chatEndpoints";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import getOrCreateAnonId from "@/utils/anonId";
import { parseChatResponse } from "@/utils/parseChatResponse";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getCurrentTipoChat } from "@/utils/tipoChat";

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

const PENDING_TICKET_KEY = 'pending_ticket_id';

interface ChatPanelProps {
  mode?: "standalone" | "iframe" | "script";
  widgetId?: string;
  entityToken?: string;
  initialIframeWidth?: string;
  initialIframeHeight?: string;
  onClose?: () => void;
  openWidth?: string;
  openHeight?: string;
  tipoChat?: "pyme" | "municipio";
  onRequireAuth?: () => void;
}

const ChatPanel = ({
  mode = "standalone",
  widgetId = "chatboc-widget-iframe",
  entityToken: propEntityToken,
  initialIframeWidth,
  initialIframeHeight,
  onClose,
  openWidth,
  openHeight,
  tipoChat = getCurrentTipoChat(),
  onRequireAuth,
}: ChatPanelProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [preguntasUsadas, setPreguntasUsadas] = useState(0);
  const [rubroSeleccionado, setRubroSeleccionado] = useState<string | null>(
    () => (typeof window !== "undefined" ? safeLocalStorage.getItem("rubroSeleccionado")?.toLowerCase() || null : null)
  );
  const [rubrosDisponibles, setRubrosDisponibles] = useState([]);
  const [esperandoRubro, setEsperandoRubro] = useState(false);
  const [cargandoRubros, setCargandoRubros] = useState(false);
  const [contexto, setContexto] = useState({});
  const [activeTicketId, setActiveTicketId] = useState<number | null>(() => {
    if (typeof window === 'undefined') return null;
    const stored = safeLocalStorage.getItem(PENDING_TICKET_KEY);
    return stored ? Number(stored) : null;
  });
  const [ticketLocation, setTicketLocation] = useState<{ direccion?: string | null; latitud?: number | null; longitud?: number | null; municipio_nombre?: string | null } | null>(null);
  const [pollingErrorShown, setPollingErrorShown] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const [esperandoDireccion, setEsperandoDireccion] = useState(false);
  const [forzarDireccion, setForzarDireccion] = useState(false);
  const [direccionGuardada, setDireccionGuardada] = useState<string | null>(null);
  const [showCierre, setShowCierre] = useState<{ show: boolean; text: string } | null>(null);

  useEffect(() => {
    if (activeTicketId) {
      safeLocalStorage.removeItem(PENDING_TICKET_KEY);
    }
  }, [activeTicketId]);

  useEffect(() => {
    const stored = safeLocalStorage.getItem("ultima_direccion");
    if (stored) setDireccionGuardada(stored);
  }, []);

  const getAuthTokenFromLocalStorage = () =>
    typeof window === "undefined" ? null : safeLocalStorage.getItem("authToken");
  const anonId = getOrCreateAnonId();
  const finalAuthToken = getAuthTokenFromLocalStorage();

  // Persistimos el token de la entidad para enviarlo en todas las requests
  useEffect(() => {
    if (mode === "iframe" && propEntityToken) {
      safeLocalStorage.setItem("entityToken", propEntityToken);
    }
  }, [mode, propEntityToken]);
  const esAnonimo = !finalAuthToken;
  const { user, refreshUser, loading } = useUser();

  useEffect(() => {
    if (!esAnonimo && (!user || !user.rubro) && !loading) {
      refreshUser();
    }
  }, [esAnonimo, user, refreshUser, loading]);
  const storedUser = typeof window !== "undefined" ? JSON.parse(safeLocalStorage.getItem("user") || "null") : null;

  const rubroActual = parseRubro(rubroSeleccionado) || parseRubro(user?.rubro) || parseRubro(storedUser?.rubro) || null;
  const rubroNormalizado = rubroActual;
  const isMunicipioRubro = esRubroPublico(rubroNormalizado || undefined);
const tipoChatActual: "pyme" | "municipio" =
  (tipoChat && (tipoChat === "municipio" || tipoChat === "pyme"))
    ? tipoChat
    : (rubroNormalizado && isMunicipioRubro ? "municipio" : "pyme");

  const fetchTicket = useCallback(async () => {
    if (!activeTicketId) return;
    try {
      const authHeaders = finalAuthToken ? { Authorization: `Bearer ${finalAuthToken}` } : {};
      const data = await apiFetch<{ direccion?: string | null; latitud?: number | string | null; longitud?: number | string | null; municipio_nombre?: string | null }>(`/tickets/municipio/${activeTicketId}`, { headers: authHeaders, skipAuth: !finalAuthToken, sendAnonId: esAnonimo, sendEntityToken: true });
      const normalized = {
        ...data,
        latitud: data.latitud != null ? Number(data.latitud) : null,
        longitud: data.longitud != null ? Number(data.longitud) : null,
      };
      setTicketLocation(normalized);
    } catch (e) {
      console.error("Error al refrescar ticket:", e);
    }
  }, [activeTicketId, esAnonimo, anonId, finalAuthToken]);

  const handleShareGps = useCallback(() => {
    if (esAnonimo) {
      if (activeTicketId) {
        safeLocalStorage.setItem(PENDING_TICKET_KEY, String(activeTicketId));
      }
      onRequireAuth && onRequireAuth();
      return;
    }
    if (!activeTicketId || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords = { latitud: pos.coords.latitude, longitud: pos.coords.longitude };
        try {
          const authHeaders = finalAuthToken ? { Authorization: `Bearer ${finalAuthToken}` } : {};
          await apiFetch(`/tickets/chat/${activeTicketId}/ubicacion`, { method: "PUT", headers: authHeaders, body: coords, skipAuth: !finalAuthToken, sendAnonId: esAnonimo, sendEntityToken: true });
          await apiFetch(`/tickets/municipio/${activeTicketId}/ubicacion`, { method: "PUT", headers: authHeaders, body: coords, skipAuth: !finalAuthToken, sendAnonId: esAnonimo, sendEntityToken: true });
          setForzarDireccion(false);
          fetchTicket();
        } catch (e) {
          console.error("Error al enviar ubicación", e);
        }
      },
      () => {
        setForzarDireccion(true);
        setEsperandoDireccion(true);
        setMessages((prev) => [...prev, { id: Date.now(), text: "No pudimos acceder a tu ubicación por GPS. Ingresá la dirección manualmente para continuar.", isBot: true, timestamp: new Date() }]);
      }
    );
  }, [activeTicketId, fetchTicket, esAnonimo, onRequireAuth, finalAuthToken]);

  useEffect(() => { fetchTicket(); }, [activeTicketId, fetchTicket]);

  useEffect(() => {
    if (!activeTicketId) return;
    if (esAnonimo) {
      safeLocalStorage.setItem(PENDING_TICKET_KEY, String(activeTicketId));
      onRequireAuth && onRequireAuth();
      return;
    }
    if (navigator.geolocation) {
      try {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const coords = { latitud: pos.coords.latitude, longitud: pos.coords.longitude };
            try {
              const authHeaders = finalAuthToken ? { Authorization: `Bearer ${finalAuthToken}` } : {};
              await apiFetch(`/tickets/chat/${activeTicketId}/ubicacion`, { method: "PUT", headers: authHeaders, body: coords, skipAuth: !finalAuthToken, sendAnonId: esAnonimo, sendEntityToken: true });
              await apiFetch(`/tickets/municipio/${activeTicketId}/ubicacion`, { method: "PUT", headers: authHeaders, body: coords, skipAuth: !finalAuthToken, sendAnonId: esAnonimo, sendEntityToken: true });
              fetchTicket();
            } catch (e) {
              console.error("Error al enviar ubicación", e);
            }
          },
          () => {
            setForzarDireccion(true);
            setEsperandoDireccion(true);
            setMessages((prev) => [...prev, { id: Date.now(), text: "No pudimos acceder a tu ubicación por GPS. Ingresá la dirección manualmente para continuar.", isBot: true, timestamp: new Date() }]);
          }
        );
      } catch {
        setForzarDireccion(true);
      }
    } else {
      setForzarDireccion(true);
    }
  }, [activeTicketId, fetchTicket, finalAuthToken, esAnonimo, anonId, onRequireAuth]);

  function shouldShowAutocomplete(messages: Message[], contexto: any) {
    const lastBotMsg = [...messages].reverse().find((m) => m.isBot && m.text);
    if (!lastBotMsg) return false;
    const contenido = typeof lastBotMsg.text === "string" ? lastBotMsg.text.toLowerCase() : "";
    if (FRASES_DIRECCION.some((frase) => contenido.includes(frase))) return true;
    if (contexto && contexto.contexto_municipio && (contexto.contexto_municipio.estado_conversacion === "ESPERANDO_DIRECCION_RECLAMO" || contexto.contexto_municipio.estado_conversacion === 4)) return true;
    return false;
  }

  function checkCierreExito(messages: Message[]) {
    const lastBotMsg = [...messages].reverse().find((m) => m.isBot && m.text);
    if (!lastBotMsg) return null;
    const contenido = typeof lastBotMsg.text === "string" ? lastBotMsg.text.toLowerCase() : "";
    if (FRASES_EXITO.some((frase) => contenido.includes(frase))) {
      const match = contenido.match(/ticket \*\*m-(\d+)/i);
      if (match) {
        return { show: true, text: `✅ ¡Listo! Tu ticket fue generado exitosamente. Número: M-${match[1]}.\nUn agente municipal te va a contactar para seguimiento.` };
      }
      return { show: true, text: lastBotMsg.text };
    }
    return null;
  }

  useEffect(() => {
    const autocomplete = shouldShowAutocomplete(messages, contexto) || forzarDireccion;
    setEsperandoDireccion(autocomplete);
    if (!autocomplete) setShowCierre(checkCierreExito(messages));
    else setShowCierre(null);
  }, [messages, contexto, forzarDireccion]);

  const cargarRubros = async () => {
    setCargandoRubros(true);
    setRubrosDisponibles([]);
    try {
      const data = await apiFetch("/rubros/", { skipAuth: true, sendEntityToken: true });
      setRubrosDisponibles(Array.isArray(data) ? data : []);
    } catch {
      setRubrosDisponibles([]);
    } finally {
      setCargandoRubros(false);
    }
  };

  useEffect(() => {
    if (!activeTicketId) return;
    let intervalId: NodeJS.Timeout | undefined;
    const fetchAllMessages = async () => {
      try {
        const authHeaders = finalAuthToken ? { Authorization: `Bearer ${finalAuthToken}` } : {};
        const data = await apiFetch<{ estado_chat: string; mensajes: any[] }>(`/tickets/chat/${activeTicketId}/mensajes`, { headers: authHeaders, sendAnonId: esAnonimo, sendEntityToken: true });
        if (data.mensajes) {
          const nuevosMensajes: Message[] = data.mensajes.map((msg) => ({ id: msg.id, text: msg.texto, isBot: msg.es_admin, timestamp: new Date(msg.fecha) }));
          setMessages(nuevosMensajes);
          if (data.mensajes.length > 0) ultimoMensajeIdRef.current = data.mensajes[data.mensajes.length - 1].id;
        }
        await fetchTicket();
        if (data.estado_chat === "resuelto" || data.estado_chat === "cerrado") {
          if (intervalId) clearInterval(intervalId);
          setMessages((prev) => [...prev, { id: Date.now(), text: "Un agente ha finalizado esta conversación.", isBot: true, timestamp: new Date() }]);
        }
      } catch (error) {
        console.error("Error durante el polling:", error);
        if (!pollingErrorShown) {
          setMessages((prev) => [...prev, { id: Date.now(), text: "⚠️ Servicio no disponible.", isBot: true, timestamp: new Date() }]);
          setPollingErrorShown(true);
        }
      }
    };
    fetchAllMessages();
    intervalId = setInterval(fetchAllMessages, 10000);
    return () => { if (intervalId) clearInterval(intervalId); };
  }, [activeTicketId, esAnonimo, anonId, finalAuthToken, pollingErrorShown, fetchTicket]);

  const handleSendMessage = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      if (esAnonimo && mode === "standalone" && !rubroSeleccionado) {
        setMessages((prev) => [...prev, { id: Date.now(), text: "🛈 Por favor, seleccioná primero un rubro.", isBot: true, timestamp: new Date() }]);
        return;
      }
      if (!esAnonimo) {
        if (loading) {
          setMessages((prev) => [...prev, { id: Date.now(), text: "⏳ Cargando tu perfil, intentá nuevamente...", isBot: true, timestamp: new Date() }]);
          return;
        }
        if (!rubroNormalizado) {
          setMessages((prev) => [...prev, { id: Date.now(), text: "🛈 Definí tu rubro en el perfil antes de usar el chat.", isBot: true, timestamp: new Date() }]);
          return;
        }
      }
      if (esperandoDireccion) {
        setEsperandoDireccion(false);
        setForzarDireccion(false);
        safeLocalStorage.setItem("ultima_direccion", text);
        setDireccionGuardada(text);
        if (activeTicketId) {
          try {
            const authHeaders = finalAuthToken ? { Authorization: `Bearer ${finalAuthToken}` } : {};
          await apiFetch(`/tickets/chat/${activeTicketId}/ubicacion`, { method: "PUT", headers: authHeaders, body: { direccion: text }, skipAuth: !finalAuthToken, sendAnonId: esAnonimo, sendEntityToken: true });
          await apiFetch(`/tickets/municipio/${activeTicketId}/ubicacion`, { method: "PUT", headers: authHeaders, body: { direccion: text }, skipAuth: !finalAuthToken, sendAnonId: esAnonimo, sendEntityToken: true });
            fetchTicket();
          } catch (e) {
            console.error("Error al enviar dirección", e);
          }
        }
      }
      setShowCierre(null);

      const userMessage = { id: Date.now(), text, isBot: false, timestamp: new Date() };
      setMessages((prev) => [...prev, userMessage]);
      setIsTyping(true);
      try {
        if (activeTicketId) {
          const authHeaders = finalAuthToken ? { Authorization: `Bearer ${finalAuthToken}` } : {};
          await apiFetch(`/tickets/chat/${activeTicketId}/responder_ciudadano`, { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders }, body: { comentario: text }, skipAuth: !finalAuthToken, sendAnonId: esAnonimo, sendEntityToken: true });
        } else {
          const endpoint = getAskEndpoint({ tipoChat: tipoChatActual, rubro: rubroNormalizado || undefined });
          const payload: Record<string, any> = { pregunta: text, contexto_previo: contexto };
          const data = await apiFetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", ...(finalAuthToken ? { Authorization: `Bearer ${finalAuthToken}` } : {}) }, body: payload, skipAuth: !finalAuthToken, sendEntityToken: true });
          setContexto(data.contexto_actualizado || {});
          const { text: respuestaText, botones } = parseChatResponse(data);
          setMessages((prev) => [...prev, { id: Date.now(), text: respuestaText || "No pude procesar tu solicitud.", isBot: true, timestamp: new Date(), botones }]);
          if (esAnonimo && mode === "standalone") setPreguntasUsadas((prev) => prev + 1);
          if (data.ticket_id) {
            if (esAnonimo) {
              safeLocalStorage.setItem(PENDING_TICKET_KEY, String(data.ticket_id));
              onRequireAuth && onRequireAuth();
            } else {
              setActiveTicketId(data.ticket_id);
              ultimoMensajeIdRef.current = 0;
            }
          }
        }
      } catch (error: any) {
        let errorMsg = "⚠️ No se pudo conectar con el servidor.";
        if (error?.body?.error) errorMsg = error.body.error;
        else if (error?.message) errorMsg = error.message;
        setMessages((prev) => [...prev, { id: Date.now(), text: errorMsg, isBot: true, timestamp: new Date() }]);
      } finally {
        setIsTyping(false);
      }
    }, [contexto, rubroSeleccionado, preguntasUsadas, esAnonimo, mode, finalAuthToken, activeTicketId, esperandoDireccion, anonId, rubroNormalizado, tipoChatActual, fetchTicket, onRequireAuth, loading]);

  useEffect(() => {
    if (esAnonimo && mode === "standalone" && !rubroSeleccionado) {
      setEsperandoRubro(true); cargarRubros();
    } else if (!esAnonimo || rubroSeleccionado) {
      setEsperandoRubro(false);
      if (messages.length === 0) {
        setMessages([{ id: Date.now(), text: "¡Hola! Soy Chatboc. ¿En qué puedo ayudarte hoy?", isBot: true, timestamp: new Date() }]);
      }
    }
  }, [esAnonimo, mode, rubroSeleccionado, messages.length]);

  useEffect(() => {
    const container = chatContainerRef.current;
    if (container) {
      const atBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
      if (atBottom) {
        container.scrollTop = container.scrollHeight;
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [messages, isTyping, ticketLocation]);

 return (
  <div className="flex flex-col w-full h-full min-w-0 min-h-0 bg-card text-card-foreground overflow-hidden rounded-3xl">
    <ScrollArea ref={chatContainerRef} className="flex-1 p-4 min-h-0 min-w-0">
      <div className="flex flex-col gap-3 min-h-full min-w-0">
          {/* Selección de rubro */}
          {esperandoRubro ? (
            <div className="text-center w-full">
              <h2 className="text-green-500 mb-2">👋 ¡Bienvenido!</h2>
              <div className="text-gray-500 dark:text-gray-300 mb-2">¿De qué rubro es tu negocio?</div>
              {cargandoRubros ? (
                <div className="text-gray-400 my-5">Cargando rubros...</div>
              ) : rubrosDisponibles.length === 0 ? (
                <div className="text-red-500 my-5">
                  No se pudieron cargar los rubros. <br />
                  <button onClick={cargarRubros} className="mt-2 underline text-blue-600 dark:text-blue-400 hover:text-blue-800" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>Reintentar</button>
                </div>
              ) : (
                <div className="flex flex-wrap justify-center gap-2">
                  {rubrosDisponibles.map((rubro: any) => (
                    <button key={rubro.id} onClick={() => {
                      safeLocalStorage.setItem('rubroSeleccionado', rubro.nombre);
                      setRubroSeleccionado(rubro.nombre);
                      setEsperandoRubro(false);
                      setMessages([{ id: Date.now(), text: `¡Hola! Soy Chatboc, tu asistente para ${rubro.nombre.toLowerCase()}. ¿En qué puedo ayudarte hoy?`, isBot: true, timestamp: new Date() }]);
                    }} className="px-4 py-2 rounded-2xl font-semibold bg-blue-500 text-white hover:bg-blue-600 transition">{rubro.nombre}</button>
                  ))}
                </div>
              )}
            </div>
          ) : esperandoDireccion ? (
            // Solicitud de dirección
            <div className="flex flex-col items-center py-8 px-2 gap-4">
              <div className="text-primary text-base font-semibold mb-2">Indicá la dirección exacta (autocompleta con Google)</div>
              <AddressAutocomplete
                onSelect={(addr) => { handleSendMessage(addr); safeLocalStorage.setItem('ultima_direccion', addr); setDireccionGuardada(addr); setEsperandoDireccion(false); }}
                autoFocus
                value={direccionGuardada ? { label: direccionGuardada, value: direccionGuardada } : undefined}
                onChange={(opt) => setDireccionGuardada(opt ? (typeof opt.value === 'string' ? opt.value : opt.value?.description ?? null) : null)}
                persistKey="ultima_direccion"
                placeholder="Ej: Av. Principal 123"
              />
              <button onClick={handleShareGps} className="text-primary underline text-sm" type="button">Compartir ubicación por GPS</button>
              <div className="text-xs text-muted-foreground mt-2">Escribí y seleccioná tu dirección para continuar el trámite.</div>
            </div>
          ) : (
            // Mensajes y lógica central del chat
            <>
              {messages.map(
                (msg) =>
                  typeof msg.text === "string" && (
                    <ChatMessage key={msg.id} message={msg} isTyping={isTyping} onButtonClick={handleSendMessage} tipoChat={tipoChatActual} />
                  )
              )}
              {isTyping && <TypingIndicator />}
              {ticketLocation && <TicketMap ticket={{ ...ticketLocation, tipo: 'municipio' }} />}
              <div ref={messagesEndRef} />
              {showCierre && showCierre.show && <div className="my-3 p-3 rounded-lg bg-green-100 text-green-800 text-center font-bold shadow">{showCierre.text}</div>}
            </>
          )}
        </div>
      </ScrollArea>
      {/* Input abajo: solo cuando corresponde */}
       {!esperandoRubro && !esperandoDireccion && (!showCierre || !showCierre.show) && (
      <div className="bg-card px-3 py-2 border-t min-w-0">
        <ChatInput onSendMessage={handleSendMessage} isTyping={isTyping} />
        </div>
      )}
    </div>
  );
};

export default ChatPanel;