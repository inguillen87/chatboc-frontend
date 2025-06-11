import React, { useState, useRef, useEffect, useCallback } from "react";
import ChatbocLogoAnimated from "./ChatbocLogoAnimated";
import ChatHeader from "./ChatHeader";
import ChatMessage from "./ChatMessage";
import TypingIndicator from "./TypingIndicator";
import ChatInput from "./ChatInput";
import { Message } from "@/types/chat";
import { apiFetch } from "@/utils/api";

const CIRCLE_SIZE = 88;
const CARD_WIDTH = 370;
const CARD_HEIGHT = 540;

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

  // --- N1: NUEVOS ESTADOS Y REFS PARA EL CHAT EN VIVO ---
  const [activeTicketId, setActiveTicketId] = useState<number | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const ultimoMensajeIdRef = useRef<number>(0);
  // ----------------------------------------------------

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const widgetContainerRef = useRef<HTMLDivElement>(null);

  // Efecto de la sonrisa (sin cambios)
  useEffect(() => {
    if (!isOpen) {
      const timer = setInterval(() => {
        setSmile(true);
        setTimeout(() => setSmile(false), 900);
      }, 2700);
      return () => clearInterval(timer);
    }
  }, [isOpen]);

  // Helpers de tokens (sin cambios)
  const getAuthTokenFromLocalStorage = () =>
    typeof window === "undefined" ? null : localStorage.getItem("authToken");
  const getAnonToken = () => {
    if (typeof window === "undefined") return "anon-ssr";
    let token = localStorage.getItem("anon_token");
    if (!token) {
      token = `anon-${Math.random().toString(36).substring(2, 12)}`;
      localStorage.setItem("anon_token", token);
    }
    return token;
  };

  const finalAuthToken =
    mode === "iframe" ? propAuthToken : getAuthTokenFromLocalStorage();
  const esAnonimo = !finalAuthToken;

  // Lógica de apertura y mensaje de bienvenida (sin cambios)
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

  // Scroll al final (sin cambios)
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
    if (messagesEndRef.current) {
      (messagesEndRef.current as any).scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isTyping]);
  
  // Cargar rubros (sin cambios)
  const cargarRubros = async () => { /* ...código sin cambios... */ };

  // --- N2: NUEVO USEEFFECT PARA POLLING DE MENSAJES EN VIVO ---
  useEffect(() => {
    const fetchNewMessages = async () => {
      if (!activeTicketId) return;
      try {
        const data = await apiFetch<{ estado_chat: string; mensajes: any[] }>(
          `/tickets/chat/${activeTicketId}/mensajes?ultimo_mensaje_id=${ultimoMensajeIdRef.current}`
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
  }, [activeTicketId]);
  // -----------------------------------------------------------------

  // --- N3: `handleSendMessage` MODIFICADO PARA SER EL ORQUESTADOR ---
  const handleSendMessage = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      
      // Mantenemos la validación original de selección de rubro
      if (esAnonimo && mode === "standalone" && !rubroSeleccionado) {
        setMessages((prev) => [
          ...prev, { id: Date.now(), text: "🛈 Por favor, seleccioná primero un rubro.", isBot: true, timestamp: new Date() },
        ]);
        return;
      }
      
      const userMessage = { id: Date.now(), text, isBot: false, timestamp: new Date() };
      setMessages((prev) => [...prev, userMessage]);
      setIsTyping(true);

      try {
        if (activeTicketId) {
          // **CASO 1: YA ESTAMOS EN UN CHAT EN VIVO**
          await apiFetch(`/tickets/chat/${activeTicketId}/responder_ciudadano`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${finalAuthToken || getAnonToken()}` },
            body: { comentario: text },
          });
        } else {
          // **CASO 2: AÚN NO HAY CHAT, HABLAMOS CON EL BOT (Lógica original)**
          const payload: any = { pregunta: text, contexto_previo: contexto };
          if (esAnonimo && mode === "standalone" && rubroSeleccionado) {
            payload.rubro = rubroSeleccionado;
          }

          const data = await apiFetch("/ask", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${finalAuthToken || getAnonToken()}` },
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

          // **LA MAGIA: Transición de Bot a Chat en Vivo**
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
    [contexto, rubroSeleccionado, preguntasUsadas, esAnonimo, mode, finalAuthToken, activeTicketId]
  );
  // -----------------------------------------------------------------


  // --- Render: burbuja flotante (con tu logo animado) ---
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

  // --- Card/chat abierto ---
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
        {/* Mensajes y lógica */}
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
          </>
        )}
      </div>
      {/* INPUT */}
      {!esperandoRubro && (
        <div className="bg-gray-100 dark:bg-[#1d2433] px-3 py-2">
          <ChatInput onSendMessage={handleSendMessage} isTyping={isTyping} />
        </div>
      )}
    </div>
  );
};

export default ChatWidget;
