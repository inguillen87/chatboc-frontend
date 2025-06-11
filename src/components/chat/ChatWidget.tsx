import React, { useState, useRef, useEffect, useCallback } from "react";
import ChatHeader from "./ChatHeader";
import ChatMessage from "./ChatMessage";
import TypingIndicator from "./TypingIndicator";
import ChatInput from "./ChatInput";
import { Message } from "@/types/chat";
import { apiFetch } from "@/utils/api";
import { useIsMobile } from "@/hooks/use-mobile";

const CIRCLE_SIZE = 82;
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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const widgetContainerRef = useRef<HTMLDivElement>(null);

  // ANIMACIÓN SONRISA cada 3 seg cuando está cerrado
  useEffect(() => {
    if (!isOpen) {
      const timer = setInterval(() => {
        setSmile(true);
        setTimeout(() => setSmile(false), 900);
      }, 2700);
      return () => clearInterval(timer);
    }
  }, [isOpen]);

  // Helpers tokens
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
    // eslint-disable-next-line
  }, [isOpen, esAnonimo, mode, rubroSeleccionado, messages.length]);

  // Scroll al final
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
    if (messagesEndRef.current) {
      (messagesEndRef.current as any).scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isTyping]);

  const cargarRubros = async () => {
    setCargandoRubros(true);
    try {
      const data = await apiFetch("/rubros/");
      setRubrosDisponibles(Array.isArray(data) ? data : data.rubros || []);
    } catch {
      setRubrosDisponibles([]);
    } finally {
      setCargandoRubros(false);
    }
  };

  const handleSendMessage = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      if (esAnonimo && mode === "standalone" && !rubroSeleccionado) {
        setMessages((prev) => [
          ...prev,
          { id: Date.now(), text: "🛈 Por favor, seleccioná primero un rubro.", isBot: true, timestamp: new Date() },
        ]);
        return;
      }
      const userMessage = { id: Date.now(), text, isBot: false, timestamp: new Date() };
      setMessages((prev) => [...prev, userMessage]);
      setIsTyping(true);

      const payload: any = { pregunta: text, contexto_previo: contexto };
      if (esAnonimo && mode === "standalone" && rubroSeleccionado) payload.rubro = rubroSeleccionado;

      try {
        const data = await apiFetch("/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${finalAuthToken || getAnonToken()}` },
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
        if (esAnonimo && mode === "standalone") setPreguntasUsadas((prev) => prev + 1);
      } catch (error) {
        const msg = error instanceof Error ? `⚠️ Error: ${error.message}` : "⚠️ No se pudo conectar con el servidor.";
        setMessages((prev) => [
          ...prev,
          { id: Date.now(), text: msg, isBot: true, timestamp: new Date() },
        ]);
      } finally {
        setIsTyping(false);
      }
    },
    [contexto, rubroSeleccionado, preguntasUsadas, esAnonimo, mode, finalAuthToken]
  );

  // --- Render: burbuja flotante grande (con tu logo animado) ---
  if (!isOpen) {
    return (
      <div
        ref={widgetContainerRef}
        className={`
          fixed
          flex items-center justify-center
          cursor-pointer
          z-[999999]
          transition-all duration-300
          bottom-6 right-6
          w-[${CIRCLE_SIZE}px] h-[${CIRCLE_SIZE}px]
          rounded-full
          bg-white dark:bg-[#181f2a]
          shadow-xl
        `}
        onClick={() => setIsOpen(true)}
        aria-label="Abrir chat"
      >
        {/* LOGO PNG animado */}
        <img
          src="/favicon/favicon-512x512.png"
          alt="Chatboc"
          className={`w-14 h-14 rounded-full shadow-lg border-2 border-blue-500 object-contain transition-all duration-300 ${smile ? "animate-pulse-subtle" : ""}`}
        />
      </div>
    );
  }

  // --- Card/chat abierto ---
  return (
    <div
      ref={widgetContainerRef}
      className={`
        fixed z-[999999]
        bottom-6 right-6
        w-[${CARD_WIDTH}px] h-[${CARD_HEIGHT}px]
        rounded-3xl shadow-2xl border border-border
        flex flex-col overflow-hidden bg-card transition-all
        duration-300
      `}
    >
      <ChatHeader onClose={() => setIsOpen(false)} />
      <div
        ref={chatContainerRef}
        className={`
          flex-1 flex flex-col gap-3 overflow-y-auto overflow-x-hidden
          p-5 bg-card text-foreground
        `}
      >
        {/* Mensajes y lógica */}
        {esperandoRubro ? (
          <div className="text-center w-full">
            <h2 className="text-lg font-semibold text-green-500 mb-2">👋 ¡Bienvenido!</h2>
            <div className="text-sm text-muted-foreground mb-3">¿De qué rubro es tu negocio?</div>
            {cargandoRubros ? (
              <div className="text-muted-foreground my-5">Cargando rubros...</div>
            ) : rubrosDisponibles.length === 0 ? (
              <div className="text-red-500 my-5">
                No se pudieron cargar los rubros. <br />
                <button
                  onClick={cargarRubros}
                  className="mt-2 underline text-primary"
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
                    className="px-4 py-2 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow"
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
        <div className="p-3 bg-muted border-t border-border">
          <ChatInput onSendMessage={handleSendMessage} isTyping={isTyping} />
        </div>
      )}
    </div>
  );
};

export default ChatWidget;
