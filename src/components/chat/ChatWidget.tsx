import React, { useState, useEffect, useCallback, Suspense } from "react";
import ChatbocLogoAnimated from "./ChatbocLogoAnimated";

const ChatPanel = React.lazy(() => import("./ChatPanel"));

const CIRCLE_SIZE = 88;
const CARD_WIDTH = 370;
const CARD_HEIGHT = 540;

<<<<<<< 6yu7ac-codex/hacer-widget-de-chatbot-robusto-y-libre-de-errores-de-cors-y
=======
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

>>>>>>> main
const ChatWidget = ({
  mode = "standalone",
  initialPosition = { bottom: 30, right: 30 },
  defaultOpen = false,
  widgetId = "chatboc-widget-iframe",
  authToken,
  initialIframeWidth,
  initialIframeHeight,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [openWidth, setOpenWidth] = useState<number>(CARD_WIDTH);
  const [openHeight, setOpenHeight] = useState<number>(CARD_HEIGHT);

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

  const openDims = { width: `${openWidth}px`, height: `${openHeight}px` };
  const closedDims = { width: `${CIRCLE_SIZE}px`, height: `${CIRCLE_SIZE}px` };

  const sendResizeMessage = useCallback(
    (open: boolean) => {
      if (mode !== "iframe" || typeof window === "undefined") return;
      const dims = open ? openDims : closedDims;
      window.parent.postMessage(
        { type: "chatboc-resize", widgetId, dimensions: dims, isOpen: open },
        "*",
      );
    },
    [mode, widgetId, openDims, closedDims],
  );

  useEffect(() => {
    sendResizeMessage(isOpen);
  }, [isOpen, sendResizeMessage]);
<<<<<<< 6yu7ac-codex/hacer-widget-de-chatbot-robusto-y-libre-de-errores-de-cors-y

=======
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
  const [smile, setSmile] = useState(false);
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
  const [direccionGuardada, setDireccionGuardada] = useState<string | null>(null);
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
    typeof window === "undefined" ? null : safeLocalStorage.getItem("authToken");
  const anonId = getOrCreateAnonId();
  const finalAuthToken =
    mode === "iframe" ? propAuthToken : getAuthTokenFromLocalStorage();
  const esAnonimo = !finalAuthToken;

  const fetchTicket = useCallback(async () => {
    if (!activeTicketId) return;
    try {
      const authHeaders = esAnonimo
        ? { 'Anon-Id': anonId }
        : finalAuthToken
          ? { Authorization: `Bearer ${finalAuthToken}` }
          : {};
      const data = await apiFetch<{
        direccion?: string | null;
        latitud?: number | null;
        longitud?: number | null;
        municipio_nombre?: string | null;
      }>(`/tickets/municipio/${activeTicketId}`, { headers: authHeaders });
      setTicketLocation(data);
    } catch (e) {
      console.error('Error al refrescar ticket:', e);
    }
  }, [activeTicketId, esAnonimo, anonId, finalAuthToken]);

  const handleShareGps = useCallback(() => {
    if (!activeTicketId || !navigator.geolocation) return;
    try {
      navigator.geolocation.getCurrentPosition(async (pos) => {
      const coords = { latitud: pos.coords.latitude, longitud: pos.coords.longitude };
      try {
        const authHeaders = esAnonimo
          ? { "Anon-Id": anonId }
          : finalAuthToken
            ? { Authorization: `Bearer ${finalAuthToken}` }
            : {};
        await apiFetch(`/tickets/chat/${activeTicketId}/ubicacion`, {
          method: "POST",
          headers: authHeaders,
          body: coords,
        });
        await apiFetch(`/tickets/municipio/${activeTicketId}/ubicacion`, {
          method: "PUT",
          headers: authHeaders,
          body: coords,
        });
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
          const coords = { latitud: pos.coords.latitude, longitud: pos.coords.longitude };
          try {
            const authHeaders = esAnonimo
              ? { "Anon-Id": anonId }
              : finalAuthToken
                ? { Authorization: `Bearer ${finalAuthToken}` }
                : {};
            await apiFetch(`/tickets/chat/${activeTicketId}/ubicacion`, {
          method: "POST",
          headers: authHeaders,
              body: coords,
            });
            await apiFetch(`/tickets/municipio/${activeTicketId}/ubicacion`, {
          method: "PUT",
          headers: authHeaders,
          body: coords,
            });
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
  }, [activeTicketId]);

  // Sonrisa animada
  useEffect(() => {
    if (!isOpen) {
      const timer = setInterval(() => {
        setSmile(true);
        setTimeout(() => setSmile(false), 900);
      }, 2700);
      return () => clearInterval(timer);
    }
  }, [isOpen]);

  // Detectar si el bot pide dirección
  function shouldShowAutocomplete(messages: Message[], contexto: any) {
    const lastBotMsg = [...messages].reverse().find((m) => m.isBot && m.text);
    if (!lastBotMsg) return false;
    const contenido = (lastBotMsg.text || "").toLowerCase();
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
    const contenido = (lastBotMsg.text || "").toLowerCase();
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
    const autocomplete = shouldShowAutocomplete(messages, contexto) || forzarDireccion;
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
        const authHeaders = esAnonimo
          ? { "Anon-Id": anonId }
          : finalAuthToken
            ? { Authorization: `Bearer ${finalAuthToken}` }
            : {};
        const data = await apiFetch<{ estado_chat: string; mensajes: any[] }>(
          `/tickets/chat/${activeTicketId}/mensajes`,
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
      if (esperandoDireccion) {
        setEsperandoDireccion(false);
        setForzarDireccion(false);
        safeLocalStorage.setItem("ultima_direccion", text);
        setDireccionGuardada(text);
        if (activeTicketId) {
          try {
            const authHeaders = esAnonimo
              ? { "Anon-Id": anonId }
              : finalAuthToken
                ? { Authorization: `Bearer ${finalAuthToken}` }
                : {};
            await apiFetch(`/tickets/chat/${activeTicketId}/ubicacion`, {
              method: "POST",
              headers: authHeaders,
              body: { direccion: text },
            });
            await apiFetch(`/tickets/municipio/${activeTicketId}/ubicacion`, {
              method: "PUT",
              headers: authHeaders,
              body: { direccion: text },
            });
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
          await apiFetch(
            `/tickets/chat/${activeTicketId}/responder_ciudadano`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(esAnonimo
                  ? { "Anon-Id": anonId }
                  : { Authorization: `Bearer ${finalAuthToken}` }),
              },
              body: { comentario: text },
            },
          );
        } else {
          const payload: any = { pregunta: text, contexto_previo: contexto };
          if (esAnonimo && mode === "standalone" && rubroSeleccionado)
            payload.rubro = rubroSeleccionado;
          if (esAnonimo) payload.anon_id = anonId; // Para endpoint que lo soporte
          const data = await apiFetch("/ask", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(esAnonimo
                ? { "Anon-Id": anonId }
                : { Authorization: `Bearer ${finalAuthToken}` }),
            },
            body: payload,
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
      } catch (error) {
        const msg =
          error instanceof Error
            ? `⚠️ Error: ${error.message}`
            : "⚠️ No se pudo conectar con el servidor.";
        setMessages((prev) => [
          ...prev,
          { id: Date.now(), text: msg, isBot: true, timestamp: new Date() },
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
    if (isOpen) {
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
    }
  }, [isOpen, esAnonimo, mode, rubroSeleccionado, messages.length]);

  // Scroll automático
  useEffect(() => {
    const container = chatContainerRef.current;
    if (container) {
      const atBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight < 100;
      if (atBottom) {
        container.scrollTop = container.scrollHeight;
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [messages, isTyping, ticketLocation]);

  // --- BURBUJA FLOTANTE ---
>>>>>>> main
  if (!isOpen) {
    return (
      <div
        className="fixed shadow-xl z-[999999] flex items-center justify-center transition-all duration-300 cursor-pointer"
        style={{
          bottom: initialPosition.bottom,
          right: initialPosition.right,
          width: closedDims.width,
          height: closedDims.height,
          borderRadius: "50%",
          background: "transparent",
        }}
        onClick={() => setIsOpen(true)}
        aria-label="Abrir chat"
      >
        <ChatbocLogoAnimated size={62} />
      </div>
    );
  }

  return (
    <Suspense fallback={null}>
      <ChatPanel
        mode={mode}
        initialPosition={initialPosition}
        widgetId={widgetId}
        authToken={authToken}
        initialIframeWidth={initialIframeWidth}
        initialIframeHeight={initialIframeHeight}
        onClose={() => setIsOpen(false)}
        openWidth={openWidth}
        openHeight={openHeight}
      />
    </Suspense>
  );
};

export default ChatWidget;
