import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import ChatHeader from "./ChatHeader";
import ChatMessage from "./ChatMessage";
import TypingIndicator from "./TypingIndicator";
import ChatInput from "./ChatInput";
import AddressAutocomplete from "@/components/ui/AddressAutocomplete";
import TicketMap from "@/components/TicketMap";
import { Message } from "@/types/chat";
import { apiFetch } from "@/utils/api";
import { useUser } from "@/hooks/useUser";
import { getAskEndpoint, esRubroPublico } from "@/utils/chatEndpoints";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import { getCurrentTipoChat } from "@/utils/chatEndpoints"; // o la ruta real donde la tengas

const CARD_WIDTH = 370;
const CARD_HEIGHT = 540;

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

// --- FUNCION PARA GENERAR/PERSISTIR anon_id ---
function getOrCreateAnonId() {
  if (typeof window === "undefined") return null;
  try {
    let anonId = safeLocalStorage.getItem("anon_id");
    if (!anonId) {
      if (window.crypto && window.crypto.randomUUID) {
        anonId = window.crypto.randomUUID();
      } else {
        anonId = `anon-${Math.random().toString(36).substr(2, 9)}-${Date.now()}`;
      }
      safeLocalStorage.setItem("anon_id", anonId);
    }
    return anonId;
  } catch {
    return `anon-${Math.random().toString(36).substr(2, 9)}-${Date.now()}`;
  }
}

interface ChatPanelProps {
  mode?: "standalone" | "iframe" | "script";
  initialPosition?: { bottom: number; right: number };
  draggable?: boolean;
  widgetId?: string;
  authToken?: string;
  initialIframeWidth?: string;
  initialIframeHeight?: string;
  onClose?: () => void;
  openWidth?: number;
  openHeight?: number;
  tipoChat?: "pyme" | "municipio";
}

const ChatPanel = ({
  mode = "standalone",
  initialPosition = { bottom: 30, right: 30 },
  draggable = true,
  widgetId = "chatboc-widget-iframe",
  authToken: propAuthToken,
  initialIframeWidth,
  initialIframeHeight,
  onClose,
  openWidth: propOpenWidth,
  openHeight: propOpenHeight,
  tipoChat = getCurrentTipoChat(),
}: ChatPanelProps) => {
  const openWidthInitial = propOpenWidth ?? CARD_WIDTH;
  const openHeightInitial = propOpenHeight ?? CARD_HEIGHT;
  const [openWidth, setOpenWidth] = useState<number>(openWidthInitial);
  const [openHeight, setOpenHeight] = useState<number>(openHeightInitial);
  const openDims = { width: `${openWidth}px`, height: `${openHeight}px` };

  // Ajustar dimensiones cuando se usa como iframe sin widget.js
  useEffect(() => {
    if (mode === "iframe") {
      const width = initialIframeWidth
        ? parseInt(initialIframeWidth as string, 10)
        : typeof window !== "undefined"
          ? Math.min(window.innerWidth, CARD_WIDTH)
          : CARD_WIDTH;
      const height = initialIframeHeight
        ? parseInt(initialIframeHeight as string, 10)
        : typeof window !== "undefined"
          ? Math.min(window.innerHeight, CARD_HEIGHT)
          : CARD_HEIGHT;
      setOpenWidth(width);
      setOpenHeight(height);
    }
  }, [mode, initialIframeWidth, initialIframeHeight]);

  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [preguntasUsadas, setPreguntasUsadas] = useState(0);
  const [rubroSeleccionado, setRubroSeleccionado] = useState<string | null>(
    null,
  );
  const [rubrosDisponibles, setRubrosDisponibles] = useState([]);
  const [esperandoRubro, setEsperandoRubro] = useState(false);
  const [cargandoRubros, setCargandoRubros] = useState(false);
  const [contexto, setContexto] = useState({});
  const [activeTicketId, setActiveTicketId] = useState<number | null>(null);
  const [ticketLocation, setTicketLocation] = useState<{
    direccion?: string | null;
    latitud?: number | null;
    longitud?: number | null;
    municipio_nombre?: string | null;
  } | null>(null);
  const [pollingErrorShown, setPollingErrorShown] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const ultimoMensajeIdRef = useRef<number>(0);

  // Para Google Autocomplete
  const [esperandoDireccion, setEsperandoDireccion] = useState(false);
  const [forzarDireccion, setForzarDireccion] = useState(false);
  const [direccionGuardada, setDireccionGuardada] = useState<string | null>(
    null,
  );
  // Mensaje de cierre final
  const [showCierre, setShowCierre] = useState<{
    show: boolean;
    text: string;
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const widgetContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = safeLocalStorage.getItem("ultima_direccion");
    if (stored) {
      setDireccionGuardada(stored);
    }
  }, []);

  // Token helpers
  const getAuthTokenFromLocalStorage = () =>
    typeof window === "undefined"
      ? null
      : safeLocalStorage.getItem("authToken");
  const anonId = getOrCreateAnonId();
  const finalAuthToken =
    mode === "iframe" ? propAuthToken : getAuthTokenFromLocalStorage();
  const esAnonimo = !finalAuthToken;

  const { user, refreshUser, loading } = useUser();

  useEffect(() => {
    if (!esAnonimo && (!user || !user.rubro) && !loading) {
      refreshUser();
    }
  }, [esAnonimo, user, refreshUser, loading]);
  const storedUser =
    typeof window !== "undefined"
      ? JSON.parse(safeLocalStorage.getItem("user") || "null")
      : null;
  const rubroActual =
    rubroSeleccionado ||
    user?.rubro ||
    storedUser?.rubro?.clave ||
    storedUser?.rubro?.nombre ||
    (typeof storedUser?.rubro === "string" ? storedUser.rubro : null);
  const rubroNormalizado =
    typeof rubroActual === "string" ? rubroActual.toLowerCase() : null;
  const isMunicipioRubro = esRubroPublico(rubroNormalizado || undefined);
  const tipoChatActual: "pyme" | "municipio" = isMunicipioRubro
    ? "municipio"
    : rubroNormalizado
      ? "pyme"
      : getCurrentTipoChat();

  const fetchTicket = useCallback(async () => {
    if (!activeTicketId) return;
    try {
      const authHeaders = finalAuthToken
        ? { Authorization: `Bearer ${finalAuthToken}` }
        : {};
      const anonQuery = esAnonimo ? `?anon_id=${anonId}` : "";
      const data = await apiFetch<{
        direccion?: string | null;
        latitud?: number | string | null;
        longitud?: number | string | null;
        municipio_nombre?: string | null;
      }>(`/tickets/municipio/${activeTicketId}${anonQuery}`, {
        headers: authHeaders,
        skipAuth: !finalAuthToken,
      });
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
      setTicketLocation(normalized);
    } catch (e) {
      console.error("Error al refrescar ticket:", e);
    }
  }, [activeTicketId, esAnonimo, anonId, finalAuthToken]);

  const handleShareGps = useCallback(() => {
    if (!activeTicketId || !navigator.geolocation) return;
    try {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const coords = {
          latitud: pos.coords.latitude,
          longitud: pos.coords.longitude,
        };
        try {
          const authHeaders = finalAuthToken
            ? { Authorization: `Bearer ${finalAuthToken}` }
            : {};
          const anonQuery = esAnonimo ? `?anon_id=${anonId}` : "";
          await apiFetch(
            `/tickets/chat/${activeTicketId}/ubicacion${anonQuery}`,
            {
              method: "PUT",
              headers: authHeaders,
              body: coords,
              skipAuth: !finalAuthToken,
            },
          );
          await apiFetch(
            `/tickets/municipio/${activeTicketId}/ubicacion${anonQuery}`,
            {
              method: "PUT",
              headers: authHeaders,
              body: coords,
              skipAuth: !finalAuthToken,
            },
          );
          setForzarDireccion(false);
          fetchTicket();
        } catch (e) {
          console.error("Error al enviar ubicación", e);
        }
      });
    } catch {
      /* ignore */
    }
  }, [activeTicketId, fetchTicket]);

  useEffect(() => {
    fetchTicket();
  }, [activeTicketId, fetchTicket]);

  // Solicitar GPS automáticamente al iniciar chat en vivo
  useEffect(() => {
    if (!activeTicketId) return;
    if (navigator.geolocation) {
      try {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const coords = {
              latitud: pos.coords.latitude,
              longitud: pos.coords.longitude,
            };
            try {
              const authHeaders = finalAuthToken
                ? { Authorization: `Bearer ${finalAuthToken}` }
                : {};
              const anonQuery = esAnonimo ? `?anon_id=${anonId}` : "";
              await apiFetch(
                `/tickets/chat/${activeTicketId}/ubicacion${anonQuery}`,
                {
                  method: "PUT",
                  headers: authHeaders,
                  body: coords,
                  skipAuth: !finalAuthToken,
                },
              );
              await apiFetch(
                `/tickets/municipio/${activeTicketId}/ubicacion${anonQuery}`,
                {
                  method: "PUT",
                  headers: authHeaders,
                  body: coords,
                  skipAuth: !finalAuthToken,
                },
              );
              // Actualizar información del ticket con las nuevas coordenadas
              fetchTicket();
            } catch (e) {
              console.error("Error al enviar ubicación", e);
            }
          },
          () => setForzarDireccion(true),
        );
      } catch {
        setForzarDireccion(true);
      }
    } else {
      setForzarDireccion(true);
    }
  }, [activeTicketId, fetchTicket, finalAuthToken, esAnonimo, anonId]);

  // Detectar si el bot pide dirección
  function shouldShowAutocomplete(messages: Message[], contexto: any) {
    const lastBotMsg = [...messages].reverse().find((m) => m.isBot && m.text);
    if (!lastBotMsg) return false;
    const contenido =
      typeof lastBotMsg.text === "string" ? lastBotMsg.text.toLowerCase() : "";
    if (FRASES_DIRECCION.some((frase) => contenido.includes(frase)))
      return true;
    if (
      contexto &&
      contexto.contexto_municipio &&
      (contexto.contexto_municipio.estado_conversacion ===
        "ESPERANDO_DIRECCION_RECLAMO" ||
        contexto.contexto_municipio.estado_conversacion === 4)
    )
      return true;
    return false;
  }

  // Mostrar cierre éxito si el mensaje lo amerita (nunca dejar el chat muerto)
  function checkCierreExito(messages: Message[]) {
    const lastBotMsg = [...messages].reverse().find((m) => m.isBot && m.text);
    if (!lastBotMsg) return null;
    const contenido =
      typeof lastBotMsg.text === "string" ? lastBotMsg.text.toLowerCase() : "";
    if (FRASES_EXITO.some((frase) => contenido.includes(frase))) {
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

  // --- AUTO-TOGGLE del autocomplete según mensaje del bot ---
  useEffect(() => {
    const autocomplete =
      shouldShowAutocomplete(messages, contexto) || forzarDireccion;
    setEsperandoDireccion(autocomplete);
    if (!autocomplete) setShowCierre(checkCierreExito(messages));
    else setShowCierre(null);
  }, [messages, contexto, forzarDireccion]);

  // Cargar rubros
  const cargarRubros = async () => {
    setCargandoRubros(true);
    setRubrosDisponibles([]);
    try {
      const data = await apiFetch("/rubros/", { skipAuth: true });
      setRubrosDisponibles(Array.isArray(data) ? data : []);
    } catch (e) {
      setRubrosDisponibles([]);
    } finally {
      setCargandoRubros(false);
    }
  };

  // Polling de chat en vivo (manda siempre anon_id si es anónimo)
  useEffect(() => {
    if (!activeTicketId) return;
    let intervalId;
    const fetchAllMessages = async () => {
      try {
        const authHeaders = finalAuthToken
          ? { Authorization: `Bearer ${finalAuthToken}` }
          : {};
        const anonQuery = esAnonimo ? `?anon_id=${anonId}` : "";
        const data = await apiFetch<{ estado_chat: string; mensajes: any[] }>(
          `/tickets/chat/${activeTicketId}/mensajes${anonQuery}`,
          { headers: authHeaders },
        );
        if (data.mensajes) {
          const nuevosMensajes: Message[] = data.mensajes.map((msg) => ({
            id: msg.id,
            text: msg.texto,
            isBot: msg.es_admin,
            timestamp: new Date(msg.fecha),
          }));
          setMessages(nuevosMensajes); // <-- REEMPLAZA la lista
          if (data.mensajes.length > 0)
            ultimoMensajeIdRef.current =
              data.mensajes[data.mensajes.length - 1].id;
        }
        await fetchTicket();
        if (data.estado_chat === "resuelto" || data.estado_chat === "cerrado") {
          if (intervalId) clearInterval(intervalId);
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
      } catch (error) {
        console.error("Error durante el polling:", error);
        if (!pollingErrorShown) {
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now(),
              text: "⚠️ Servicio no disponible.",
              isBot: true,
              timestamp: new Date(),
            },
          ]);
          setPollingErrorShown(true);
        }
      }
    };
    fetchAllMessages();
    intervalId = setInterval(fetchAllMessages, 10000);
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [activeTicketId, esAnonimo, anonId, finalAuthToken]);

  // --- handleSendMessage ---
  const handleSendMessage = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      if (esAnonimo && mode === "standalone" && !rubroSeleccionado) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now(),
            text: "🛈 Por favor, seleccioná primero un rubro.",
            isBot: true,
            timestamp: new Date(),
          },
        ]);
        return;
      }
      if (!esAnonimo) {
        if (loading) {
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now(),
              text: "⏳ Cargando tu perfil, intentá nuevamente...",
              isBot: true,
              timestamp: new Date(),
            },
          ]);
          return;
        }
        if (!rubroNormalizado) {
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now(),
              text: "🛈 Definí tu rubro en el perfil antes de usar el chat.",
              isBot: true,
              timestamp: new Date(),
            },
          ]);
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
            const authHeaders = finalAuthToken
              ? { Authorization: `Bearer ${finalAuthToken}` }
              : {};
            const anonQuery = esAnonimo ? `?anon_id=${anonId}` : "";
              await apiFetch(
                `/tickets/chat/${activeTicketId}/ubicacion${anonQuery}`,
                {
                  method: "PUT",
                  headers: authHeaders,
                  body: { direccion: text },
                  skipAuth: !finalAuthToken,
                },
              );
              await apiFetch(
                `/tickets/municipio/${activeTicketId}/ubicacion${anonQuery}`,
                {
                  method: "PUT",
                  headers: authHeaders,
                  body: { direccion: text },
                  skipAuth: !finalAuthToken,
                },
              );
            fetchTicket();
          } catch (e) {
            console.error("Error al enviar dirección", e);
          }
        }
      }
      setShowCierre(null);

      const userMessage = {
        id: Date.now(),
        text,
        isBot: false,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setIsTyping(true);

      try {
        if (activeTicketId) {
          const authHeaders = finalAuthToken
            ? { Authorization: `Bearer ${finalAuthToken}` }
            : {};
          const anonQuery = esAnonimo ? `?anon_id=${anonId}` : "";
          await apiFetch(
            `/tickets/chat/${activeTicketId}/responder_ciudadano${anonQuery}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json", ...authHeaders },
              body: { comentario: text },
              skipAuth: !finalAuthToken,
            },
          );
        } else {
          const rubroParaEndpoint = rubroNormalizado;
          const payload: Record<string, any> = {
            pregunta: text,
            contexto_previo: contexto,
          };


          const esPublico = esRubroPublico(rubroParaEndpoint || undefined);
          console.log(
            "Voy a pedir a endpoint:",
            endpoint,
            "rubro:",
            rubroParaEndpoint,
            "tipoChat:",
            adjustedTipo,
            "esPublico:",
            esPublico,
          );

          const data = await apiFetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(finalAuthToken
                ? { Authorization: `Bearer ${finalAuthToken}` }
                : {}),
            },
            body: payload,
            skipAuth: !finalAuthToken,
          });
          setContexto(data.contexto_actualizado || {});
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now(),
              text: data.respuesta || "No pude procesar tu solicitud.",
              isBot: true,
              timestamp: new Date(),
              botones: data.botones || [],
            },
          ]);
          if (esAnonimo && mode === "standalone")
            setPreguntasUsadas((prev) => prev + 1);
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
    [
      contexto,
      rubroSeleccionado,
      preguntasUsadas,
      esAnonimo,
      mode,
      finalAuthToken,
      activeTicketId,
      esperandoDireccion,
      anonId,
    ],
  );

  // Bienvenida y rubro
  useEffect(() => {
    if (esAnonimo && mode === "standalone" && !rubroSeleccionado) {
      setEsperandoRubro(true);
      cargarRubros();
    } else if (!esAnonimo || rubroSeleccionado) {
      setEsperandoRubro(false);
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
    }
  }, [esAnonimo, mode, rubroSeleccionado, messages.length]);

  // Scroll automático
  useEffect(() => {
    const container = chatContainerRef.current;
    if (container) {
      const atBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight <
        100;
      if (atBottom) {
        container.scrollTop = container.scrollHeight;
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [messages, isTyping, ticketLocation]);

  // --- CARD: CHAT ABIERTO ---
  return (
    <motion.div
      ref={widgetContainerRef}
      className={`
      fixed z-[999999]
      flex flex-col overflow-hidden
      shadow-2xl border
      bg-card text-card-foreground
      border-border
      transition-all duration-300
    `}
      style={{
        bottom: initialPosition.bottom,
        right: initialPosition.right,
        width: mode === "iframe" ? openDims.width : `${CARD_WIDTH}px`,
        height: mode === "iframe" ? openDims.height : `${CARD_HEIGHT}px`,
        borderRadius: 24,
      }}
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 20 }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
    >
      <ChatHeader onClose={onClose} />

      <div
        ref={chatContainerRef}
        className={`
          flex-1 flex flex-col gap-3 overflow-y-auto overflow-x-hidden
          px-4 pt-4 pb-2
          text-card-foreground
          bg-card
        `}
      >
        {esperandoRubro ? (
          <div className="text-center w-full">
            <h2 className="text-green-500 mb-2">👋 ¡Bienvenido!</h2>
            <div className="text-gray-500 dark:text-gray-300 mb-2">
              ¿De qué rubro es tu negocio?
            </div>
            {cargandoRubros ? (
              <div className="text-gray-400 my-5">Cargando rubros...</div>
            ) : rubrosDisponibles.length === 0 ? (
              <div className="text-red-500 my-5">
                No se pudieron cargar los rubros. <br />
                <button
                  onClick={cargarRubros}
                  className="mt-2 underline text-blue-600 dark:text-blue-400 hover:text-blue-800"
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Reintentar
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap justify-center gap-2">
                {rubrosDisponibles.map((rubro) => (
                  <button
                    key={rubro.id}
                    onClick={() => {
                      safeLocalStorage.setItem(
                        "rubroSeleccionado",
                        rubro.nombre,
                      );
                      setRubroSeleccionado(rubro.nombre);
                      setEsperandoRubro(false);
                      setMessages([
                        {
                          id: Date.now(),
                          text: `¡Hola! Soy Chatboc, tu asistente para ${rubro.nombre.toLowerCase()}. ¿En qué puedo ayudarte hoy?`,
                          isBot: true,
                          timestamp: new Date(),
                        },
                      ]);
                    }}
                    className="px-4 py-2 rounded-2xl font-semibold bg-blue-500 text-white hover:bg-blue-600 transition"
                  >
                    {rubro.nombre}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : esperandoDireccion ? (
          <div className="flex flex-col items-center py-8 px-2 gap-4">
            <div className="text-primary text-base font-semibold mb-2">
              Indicá la dirección exacta (autocompleta con Google)
            </div>
            <AddressAutocomplete
              onSelect={(addr) => {
                handleSendMessage(addr);
                safeLocalStorage.setItem("ultima_direccion", addr);
                setDireccionGuardada(addr);
                setEsperandoDireccion(false);
              }}
              autoFocus
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
                      : (opt.value?.description ?? null)
                    : null,
                )
              }
              persistKey="ultima_direccion"
              placeholder="Ej: Av. Principal 123"
            />
            <button
              onClick={handleShareGps}
              className="text-primary underline text-sm"
              type="button"
            >
              Compartir ubicación por GPS
            </button>
            <div className="text-xs text-muted-foreground mt-2">
              Escribí y seleccioná tu dirección para continuar el trámite.
            </div>
          </div>
        ) : (
          <>
            {messages.map(
              (msg) =>
                typeof msg.text === "string" && (
                  <ChatMessage
                    key={msg.id}
                    message={msg}
                    isTyping={isTyping}
                    onButtonClick={handleSendMessage}
                    tipoChat={tipoChatActual}
                  />
                ),
            )}
            {isTyping && <TypingIndicator />}
            {ticketLocation && (
              <TicketMap ticket={{ ...ticketLocation, tipo: "municipio" }} />
            )}
            <div ref={messagesEndRef} />
            {/* Mensaje de cierre SIEMPRE si corresponde */}
            {showCierre && showCierre.show && (
              <div className="my-3 p-3 rounded-lg bg-green-100 text-green-800 text-center font-bold shadow">
                {showCierre.text}
              </div>
            )}
          </>
        )}
      </div>

      {/* --- INPUT SÓLO SI NO SE ESPERA RUBRO NI DIRECCIÓN NI CIERRE --- */}
      {!esperandoRubro &&
        !esperandoDireccion &&
        (!showCierre || !showCierre.show) && (
          <div className="bg-card px-3 py-2">
            <ChatInput onSendMessage={handleSendMessage} isTyping={isTyping} />
          </div>
        )}
    </motion.div>
  );
};

export default ChatPanel;
