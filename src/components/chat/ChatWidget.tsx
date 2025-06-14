import React, { useState, useRef, useEffect, useCallback } from "react";
import ChatbocLogoAnimated from "./ChatbocLogoAnimated";
import ChatHeader from "./ChatHeader";
import ChatMessage from "./ChatMessage";
import TypingIndicator from "./TypingIndicator";
import ChatInput from "./ChatInput";
import GooglePlacesAutocomplete from "react-google-autocomplete";
import { Message } from "@/types/chat";
import { apiFetch } from "@/utils/api";

const CIRCLE_SIZE = 88;
const CARD_WIDTH = 370;
const CARD_HEIGHT = 540;
const Maps_API_KEY = import.meta.env.VITE_Maps_API_KEY;

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

// --- FUNCION PARA GENERAR/PERSISTIR anon_id ---
function getOrCreateAnonId() {
  if (typeof window === "undefined") return null;
  let anonId = localStorage.getItem("anon_id");
  if (!anonId) {
    if (window.crypto && window.crypto.randomUUID) {
      anonId = window.crypto.randomUUID();
    } else {
      anonId = `anon-${Math.random().toString(36).substr(2, 9)}-${Date.now()}`;
    }
    localStorage.setItem("anon_id", anonId);
  }
  return anonId;
}

const ChatWidget = ({
  mode = "standalone",
  initialPosition = { bottom: 30, right: 30 },
  draggable = true,
  defaultOpen = false,
  widgetId = "chatboc-widget-iframe",
  authToken: propAuthToken,
  initialIframeWidth,
  initialIframeHeight,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [preguntasUsadas, setPreguntasUsadas] = useState(0);
  const [rubroSeleccionado, setRubroSeleccionado] = useState<string | null>(null);
  const [rubrosDisponibles, setRubrosDisponibles] = useState([]);
  const [esperandoRubro, setEsperandoRubro] = useState(false);
  const [cargandoRubros, setCargandoRubros] = useState(false);
  const [contexto, setContexto] = useState({});
  const [smile, setSmile] = useState(false);
  const [activeTicketId, setActiveTicketId] = useState<number | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const ultimoMensajeIdRef = useRef<number>(0);

  // Para Google Autocomplete
  const [esperandoDireccion, setEsperandoDireccion] = useState(false);
  // Mensaje de cierre final
  const [showCierre, setShowCierre] = useState<{ show: boolean, text: string } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const widgetContainerRef = useRef<HTMLDivElement>(null);

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

  // Token helpers
  const getAuthTokenFromLocalStorage = () =>
    typeof window === "undefined" ? null : localStorage.getItem("authToken");
  const anonId = getOrCreateAnonId();
  const finalAuthToken =
    mode === "iframe" ? propAuthToken : getAuthTokenFromLocalStorage();
  const esAnonimo = !finalAuthToken;

  // Detectar si el bot pide dirección
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
    ) return true;
    return false;
  }

  // Mostrar cierre éxito si el mensaje lo amerita (nunca dejar el chat muerto)
  function checkCierreExito(messages: Message[]) {
    const lastBotMsg = [...messages].reverse().find(m => m.isBot && m.text);
    if (!lastBotMsg) return null;
    const contenido = (lastBotMsg.text || "").toLowerCase();
    if (FRASES_EXITO.some(frase => contenido.includes(frase))) {
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

  // --- AUTO-TOGGLE del autocomplete según mensaje del bot ---
  useEffect(() => {
    const autocomplete = shouldShowAutocomplete(messages, contexto);
    setEsperandoDireccion(autocomplete);
    if (!autocomplete) setShowCierre(checkCierreExito(messages));
    else setShowCierre(null);
  }, [messages, contexto]);

  // Cargar rubros
  const cargarRubros = async () => {
    setCargandoRubros(true);
    setRubrosDisponibles([]);
    try {
      const data = await apiFetch("/rubros");
      setRubrosDisponibles(data);
    } catch (e) {
      setRubrosDisponibles([]);
    } finally {
      setCargandoRubros(false);
    }
  };

  // Polling de chat en vivo (manda siempre anon_id si es anónimo)
  useEffect(() => {
    const fetchNewMessages = async () => {
      if (!activeTicketId) return;
      try {
        const data = await apiFetch<{ estado_chat: string; mensajes: any[] }>(
          `/tickets/chat/${activeTicketId}/mensajes?ultimo_mensaje_id=${ultimoMensajeIdRef.current}`,
          {
            headers: esAnonimo ? { "Anon-Id": anonId } : { Authorization: `Bearer ${finalAuthToken}` }
          }
        );
        if (data.mensajes && data.mensajes.length > 0) {
          const nuevosMensajes: Message[] = data.mensajes.map(msg => ({
            id: msg.id, text: msg.texto, isBot: msg.es_admin, timestamp: new Date(msg.fecha)
          }));
          setMessages(prev => [...prev, ...nuevosMensajes]);
          ultimoMensajeIdRef.current = data.mensajes[data.mensajes.length - 1].id;
        }
        if (data.estado_chat === 'resuelto' || data.estado_chat === 'cerrado') {
          if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
          setMessages(prev => [...prev, { id: Date.now(), text: "Un agente ha finalizado esta conversación.", isBot: true, timestamp: new Date() }]);
        }
      } catch (error) { console.error("Error durante el polling:", error); }
    };
    if (activeTicketId) {
      fetchNewMessages();
      pollingIntervalRef.current = setInterval(fetchNewMessages, 5000);
    }
    return () => { if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current); };
  }, [activeTicketId, esAnonimo, anonId, finalAuthToken]);

  // --- handleSendMessage ---
  const handleSendMessage = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      if (esAnonimo && mode === "standalone" && !rubroSeleccionado) {
        setMessages((prev) => [
          ...prev, { id: Date.now(), text: "🛈 Por favor, seleccioná primero un rubro.", isBot: true, timestamp: new Date() },
        ]);
        return;
      }
      if (esperandoDireccion) setEsperandoDireccion(false);
      setShowCierre(null);

      const userMessage = { id: Date.now(), text, isBot: false, timestamp: new Date() };
      setMessages((prev) => [...prev, userMessage]);
      setIsTyping(true);

      try {
        if (activeTicketId) {
          await apiFetch(`/tickets/chat/${activeTicketId}/responder_ciudadano`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(esAnonimo ? { "Anon-Id": anonId } : { Authorization: `Bearer ${finalAuthToken}` })
            },
            body: { comentario: text },
          });
        } else {
          const payload: any = { pregunta: text, contexto_previo: contexto };
          if (esAnonimo && mode === "standalone" && rubroSeleccionado) payload.rubro = rubroSeleccionado;
          if (esAnonimo) payload.anon_id = anonId; // Para endpoint que lo soporte
          const data = await apiFetch("/ask", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(esAnonimo ? { "Anon-Id": anonId } : { Authorization: `Bearer ${finalAuthToken}` })
            },
            body: payload,
          });
          setContexto(data.contexto_actualizado || {});
          setMessages((prev) => [
            ...prev, {
              id: Date.now(),
              text: data.respuesta || "No pude procesar tu solicitud.",
              isBot: true,
              timestamp: new Date(),
              botones: data.botones || [],
            },
          ]);
          if (esAnonimo && mode === "standalone") setPreguntasUsadas((prev) => prev + 1);
          if (data.ticket_id) {
            setActiveTicketId(data.ticket_id);
            ultimoMensajeIdRef.current = 0;
          }
        }
      } catch (error) {
        const msg = error instanceof Error ? `⚠️ Error: ${error.message}` : "⚠️ No se pudo conectar con el servidor.";
        setMessages((prev) => [...prev, { id: Date.now(), text: msg, isBot: true, timestamp: new Date() }]);
      } finally {
        setIsTyping(false);
      }
    },
    [contexto, rubroSeleccionado, preguntasUsadas, esAnonimo, mode, finalAuthToken, activeTicketId, esperandoDireccion, anonId]
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
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
    if (messagesEndRef.current) {
      (messagesEndRef.current as any).scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isTyping]);

  // --- BURBUJA FLOTANTE ---
  if (!isOpen) {
    return (
      <div
        ref={widgetContainerRef}
        className={`
          fixed shadow-xl z-[999999]
          flex items-center justify-center
          transition-all duration-300
          cursor-pointer
          bg-white dark:bg-[#181f2a]
        `}
        style={{
          bottom: 30,
          right: 30,
          width: `${CIRCLE_SIZE}px`,
          height: `${CIRCLE_SIZE}px`,
          borderRadius: "50%",
        }}
        onClick={() => setIsOpen(true)}
        aria-label="Abrir chat"
      >
        <ChatbocLogoAnimated size={62} smiling={smile} movingEyes={smile} />
      </div>
    );
  }

  // --- CARD: CHAT ABIERTO ---
  return (
    <div
      ref={widgetContainerRef}
      className={`
        fixed z-[999999]
        flex flex-col overflow-hidden
        shadow-2xl border
        bg-white dark:bg-[#181f2a]
        border-gray-200 dark:border-[#353c47]
        transition-all duration-300
      `}
      style={{
        bottom: 30,
        right: 30,
        width: `${CARD_WIDTH}px`,
        height: `${CARD_HEIGHT}px`,
        borderRadius: 24,
      }}
    >
      <ChatHeader onClose={() => setIsOpen(false)} />

      <div
        ref={chatContainerRef}
        className={`
          flex-1 flex flex-col gap-3 overflow-y-auto overflow-x-hidden
          px-4 pt-4 pb-2
          text-gray-900 dark:text-gray-100
          bg-white dark:bg-[#181f2a]
        `}
      >
        {esperandoRubro ? (
          <div className="text-center w-full">
            <h2 className="text-green-500 mb-2">👋 ¡Bienvenido!</h2>
            <div className="text-gray-500 dark:text-gray-300 mb-2">¿De qué rubro es tu negocio?</div>
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
                    cursor: "pointer"
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
                      localStorage.setItem("rubroSeleccionado", rubro.nombre);
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
        ) : esperandoDireccion && Maps_API_KEY ? (
          <div className="flex flex-col items-center py-8 px-2 gap-4">
            <div className="text-primary text-base font-semibold mb-2">
              Indicá la dirección exacta (autocompleta con Google)
            </div>
            <GooglePlacesAutocomplete
              apiKey={Maps_API_KEY}
              autocompletionRequest={{
                componentRestrictions: { country: "ar" },
                types: ["address"],
              }}
              selectProps={{
                onChange: (option: any) => {
                  if (option && option.value) {
                    handleSendMessage(option.value);
                    setEsperandoDireccion(false);
                  }
                },
                placeholder: "Ej: Av. San Martín 123, Mendoza",
                isClearable: true,
                styles: {
                  control: (base: any) => ({
                    ...base,
                    backgroundColor: "#fff",
                    color: "#0e1421",
                    minHeight: "2.5rem",
                    borderRadius: "0.75rem",
                    fontSize: "1rem",
                  }),
                  singleValue: (base: any) => ({
                    ...base,
                    color: "#0e1421",
                  }),
                  input: (base: any) => ({
                    ...base,
                    color: "#0e1421",
                  }),
                }
              }}
            />
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
                  />
                )
            )}
            {isTyping && <TypingIndicator />}
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
      {!esperandoRubro && !esperandoDireccion && (!showCierre || !showCierre.show) && (
        <div className="bg-gray-100 dark:bg-[#1d2433] px-3 py-2">
          <ChatInput onSendMessage={handleSendMessage} isTyping={isTyping} />
        </div>
      )}
    </div>
  );
};

export default ChatWidget;
