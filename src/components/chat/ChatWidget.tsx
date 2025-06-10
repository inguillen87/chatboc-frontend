// Archivo: ChatWidget.tsx (versión optimizada final sin errores)

import React, { useState, useRef, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import ChatMessage from "./ChatMessage";
import TypingIndicator from "./TypingIndicator";
import ChatInput from "./ChatInput";
import { Message } from "@/types/chat";
import { apiFetch } from "@/utils/api";
import { useIsMobile } from "@/hooks/use-mobile";

const WidgetChatHeader = ({ title = "Chatboc Asistente", showCloseButton = false, onClose, onMouseDownDrag, isDraggable }) => (
  <div
    className="flex items-center justify-between p-3 border-b border-border bg-card text-foreground select-none"
    style={{ cursor: isDraggable && onMouseDownDrag ? "move" : "default" }}
    onMouseDown={onMouseDownDrag}
    onTouchStart={onMouseDownDrag}
  >
    <div className="flex items-center pointer-events-none">
      <img src="/chatboc_logo_clean_transparent.png" alt="Chatboc" className="w-6 h-6 mr-2" />
      <span className="font-semibold text-sm text-primary">{title}</span>
    </div>
    <div className="flex items-center">
      <span className="text-green-500 text-xs font-semibold mr-2 pointer-events-none">• Online</span>
      {showCloseButton && (
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground focus:outline-none" aria-label="Cerrar o minimizar chat">
          <X size={20} />
        </button>
      )}
    </div>
  </div>
);

const getAuthToken = () => (typeof window === "undefined" ? null : localStorage.getItem("authToken"));
const getAnonToken = () => {
  if (typeof window === "undefined") return "anon-ssr";
  let token = localStorage.getItem("anon_token");
  if (!token) {
    token = `anon-${Math.random().toString(36).substring(2, 12)}`;
    localStorage.setItem("anon_token", token);
  }
  return token;
};

const ChatWidget = ({
  mode = "standalone",
  initialPosition = { bottom: 20, right: 20 },
  draggable = true,
  defaultOpen = false,
  widgetId = "chatboc-widget-iframe",
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

  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const widgetContainerRef = useRef(null);
  const dragStartPosRef = useRef(null);

  const [currentPos, setCurrentPos] = useState(
    mode === "standalone" ? { position: "fixed", ...initialPosition, zIndex: 99998 } : {}
  );
  const isMobile = useIsMobile();

  useEffect(() => {
    const esAnon = !getAuthToken();
    const rubroLS = localStorage.getItem("rubroSeleccionado");
    if (isOpen && esAnon && !rubroLS) {
      setEsperandoRubro(true);
      cargarRubros();
    } else if (rubroLS) {
      setRubroSeleccionado(rubroLS);
      setEsperandoRubro(false);
    }
  }, [isOpen]);

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

  const handleSendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;
    const authToken = getAuthToken();
    const finalToken = authToken || getAnonToken();
    const esAnonimo = !authToken;

    if (esAnonimo && !rubroSeleccionado) {
      setMessages(prev => [...prev, { id: Date.now(), text: "🛈 Por favor, seleccioná primero un rubro.", isBot: true, timestamp: new Date() }]);
      return;
    }

    const userMessage = { id: Date.now(), text, isBot: false, timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setIsTyping(true);

    const payload: any = { pregunta: text, contexto_previo: contexto };
    if (esAnonimo) payload.rubro = rubroSeleccionado;

    try {
      const data = await apiFetch("/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${finalToken}` },
        body: payload,
      });

      setContexto(data.contexto_actualizado || {});
      setMessages(prev => [...prev, {
        id: Date.now(),
        text: data.respuesta || "No pude procesar tu solicitud.",
        isBot: true,
        timestamp: new Date(),
        botones: data.botones || [],
      }]);
      if (esAnonimo) setPreguntasUsadas(prev => prev + 1);
    } catch (error) {
      const msg = error instanceof Error ? `⚠️ Error: ${error.message}` : "⚠️ No se pudo conectar con el servidor.";
      setMessages(prev => [...prev, { id: Date.now(), text: msg, isBot: true, timestamp: new Date() }]);
    } finally {
      setIsTyping(false);
    }
  }, [contexto, rubroSeleccionado, preguntasUsadas]);

  const toggleChat = () => setIsOpen(o => !o);

  const mainChatViewContent = (
    <>
      <WidgetChatHeader
        title="Chatboc Asistente"
        showCloseButton={true}
        onClose={toggleChat}
        isDraggable={mode === "standalone" && draggable && isOpen}
      />
      <div
        className="flex-1 overflow-y-auto overflow-x-hidden p-3 flex flex-col gap-3 bg-background text-foreground"
        ref={chatContainerRef}
      >
        {messages.map(msg => typeof msg.text === "string" && <ChatMessage key={msg.id} message={msg} />)}
        {isTyping && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>
      <ChatInput onSendMessage={handleSendMessage} />
    </>
  );

  return (
    <div ref={widgetContainerRef} style={currentPos} className="chatboc-standalone-widget">
      {!isOpen && (
        <button
          onClick={toggleChat}
          className="group w-16 h-16 rounded-full flex items-center justify-center border shadow-lg hover:shadow-xl transition-all duration-300 ease-in-out transform hover:scale-105 bg-card border-border"
          aria-label="Abrir chat"
        >
          <div className="relative">
            <img src="/chatboc_logo_clean_transparent.png" alt="Chatboc" className="w-8 h-8 rounded" style={{ padding: "2px" }} />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
          </div>
        </button>
      )}
      {isOpen && (
        <div
          className="w-80 md:w-96 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-slide-up bg-white border border-border dark:bg-gray-900"
          style={{ height: esperandoRubro ? "auto" : "500px", minHeight: esperandoRubro ? "240px" : "400px" }}
        >
          {esperandoRubro ? (
            <div
              className={`w-full flex flex-col items-center justify-center p-6 text-foreground border border-border rounded-3xl ${isMobile ? "bg-white shadow-2xl dark:bg-gray-900" : "bg-card"}`}
              style={{ minHeight: 240 }}
            >
              <h2 className="text-lg font-semibold mb-3 text-center text-primary">👋 ¡Bienvenido!</h2>
              <p className="mb-4 text-sm text-center text-muted-foreground">¿De qué rubro es tu negocio?</p>
              {cargandoRubros ? (
                <div className="text-center text-muted-foreground text-sm my-6">Cargando rubros...</div>
              ) : rubrosDisponibles.length === 0 ? (
                <div className="text-center text-destructive text-sm my-6">
                  No se pudieron cargar los rubros. <br />
                  <button
                    onClick={cargarRubros}
                    className="mt-2 underline text-primary hover:text-primary/80"
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
                      className="px-4 py-2 rounded-full text-sm shadow transition-all duration-200 ease-in-out font-semibold bg-blue-500/80 text-white hover:bg-blue-600 dark:bg-blue-800/80 dark:text-blue-100 dark:hover:bg-blue-700"
                    >
                      {rubro.nombre}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            mainChatViewContent
          )}
        </div>
      )}
    </div>
  );
};

export default ChatWidget;
