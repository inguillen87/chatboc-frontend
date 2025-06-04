import React, { useState, useRef, useEffect, CSSProperties } from "react";
import { X } from "lucide-react";
import ChatMessage from "./ChatMessage"; // Ajusta la ruta
import TypingIndicator from "./TypingIndicator"; // Ajusta la ruta
import ChatInput from "./ChatInput"; // Ajusta la ruta
import { Message } from "@/types/chat"; // Ajusta la ruta
import { apiFetch } from "@/utils/api"; // Ajusta la ruta

// --- Componente ChatHeader (integrado y adaptado) ---
interface ChatHeaderProps {
  title?: string;
  showCloseButton?: boolean;
  onClose?: () => void;
  onMouseDownDrag?: (e: React.MouseEvent | React.TouchEvent) => void;
  isDraggable?: boolean;
}
const ChatHeader: React.FC<ChatHeaderProps> = ({
  title = "Chatboc Asistente",
  showCloseButton = false,
  onClose,
  onMouseDownDrag,
  isDraggable,
}) => {
  const [prefersDarkHeader, setPrefersDarkHeader] = useState(
    typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setPrefersDarkHeader(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return (
    <div
      className="flex items-center justify-between p-3 border-b select-none"
      style={{
        borderBottomColor: prefersDarkHeader ? "#374151" : "#e5e7eb",
        cursor: isDraggable && onMouseDownDrag ? "move" : "default",
      }}
      onMouseDown={onMouseDownDrag}
      onTouchStart={onMouseDownDrag}
    >
      <div className="flex items-center pointer-events-none">
        <img src="/chatboc_logo_clean_transparent.png" alt="Chatboc" className="w-6 h-6 mr-2" />
        <span className="font-semibold text-sm">{title}</span>
      </div>
      <div className="flex items-center">
        <span style={{ fontSize: 12, fontWeight: 400, color: prefersDarkHeader ? "#90EE90" : "#24ba53", marginRight: showCloseButton ? '8px' : '0' }} className="pointer-events-none">
          &nbsp;• Online
        </span>
        {showCloseButton && onClose && (
          <button onClick={onClose} className="text-gray-600 dark:text-gray-300 hover:text-red-500 focus:outline-none" aria-label="Cerrar o minimizar chat">
            <X size={20} />
          </button>
        )}
      </div>
    </div>
  );
};

// --- Función getToken (Completa) ---
function getToken(): string {
  if (typeof window === "undefined") return "demo-anon-ssr";
  const params = new URLSearchParams(window.location.search);
  const urlToken = params.get("token");
  if (urlToken) return urlToken;
  const storedUserItem = localStorage.getItem("user");
  const user = storedUserItem ? JSON.parse(storedUserItem) : null;
  if (user && user.token && typeof user.token === 'string' && !user.token.startsWith("demo")) return user.token;
  let anonToken = localStorage.getItem("anon_token");
  if (!anonToken) {
    anonToken = `demo-anon-${Math.random().toString(36).substring(2, 10)}`;
    localStorage.setItem("anon_token", anonToken);
  }
  return anonToken;
}

// --- Props y Constantes de Dimensiones ---
interface ChatWidgetProps {
  mode?: "iframe" | "standalone";
  initialPosition?: { top?: number | string; bottom?: number | string; left?: number | string; right?: number | string };
  draggable?: boolean;
  defaultOpen?: boolean;
  widgetId?: string;
}

const WIDGET_DIMENSIONS = {
  OPEN: { width: "360px", height: "520px" },
  CLOSED: { width: "80px", height: "80px" },
};

// --- Componente ChatWidget Unificado ---
const ChatWidget: React.FC<ChatWidgetProps> = ({
  mode = "standalone",
  initialPosition: initialPosProp = { bottom: 20, right: 20 },
  draggable = true,
  defaultOpen = false,
  widgetId = "chatboc-widget-iframe",
}) => {
  const [isOpen, setIsOpen] = useState(mode === "iframe" ? defaultOpen : defaultOpen ); // En iframe, defaultOpen lo pasa widget.js
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [preguntasUsadas, setPreguntasUsadas] = useState(0);
  const [rubroSeleccionado, setRubroSeleccionado] = useState<string | null>(null);
  const [rubrosDisponibles, setRubrosDisponibles] = useState<{ id: number; nombre: string }[]>([]);
  const [esperandoRubro, setEsperandoRubro] = useState(true);
  const [cargandoRubros, setCargandoRubros] = useState(false);
  const [token, setToken] = useState<string>("");
  const [prefersDark, setPrefersDark] = useState(
    typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const widgetContainerRef = useRef<HTMLDivElement>(null);
  const dragStartPosRef = useRef<{ x: number; y: number; elementX: number; elementY: number } | null>(null);
  
  const [currentPos, setCurrentPos] = useState<CSSProperties>(
    mode === "standalone" ? { position: 'fixed', ...initialPosProp, zIndex: 99998 } : {}
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setPrefersDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const cargarRubros = async () => {
    setCargandoRubros(true);
    try {
      const res = await fetch("https://api.chatboc.ar/rubros");
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      setRubrosDisponibles(data.rubros || []);
    } catch (error) { console.error("Error cargando rubros:", error); setRubrosDisponibles([]); }
    setCargandoRubros(false);
  };

  const recargarTokenYRubro = () => {
    const currentToken = getToken();
    setToken(currentToken);
    if (currentToken && !currentToken.startsWith("demo") && !currentToken.includes("anon")) {
      setPreguntasUsadas(0);
      if (typeof window !== "undefined") localStorage.removeItem("rubroSeleccionado");
      const storedUserItem = typeof window !== "undefined" ? localStorage.getItem("user") : null;
      const user = storedUserItem ? JSON.parse(storedUserItem) : null;
      const userRubro = user?.rubro;
      setRubroSeleccionado(typeof userRubro === 'string' ? userRubro.toLowerCase() : "general");
      setEsperandoRubro(false); return;
    }
    const rubro = typeof window !== "undefined" ? localStorage.getItem("rubroSeleccionado") : null;
    if (!rubro) { setEsperandoRubro(true); setRubroSeleccionado(null); cargarRubros(); } 
    else { setRubroSeleccionado(rubro); setEsperandoRubro(false); }
  };

  useEffect(() => { recargarTokenYRubro(); if (typeof window !== "undefined") window.addEventListener("storage", recargarTokenYRubro); return () => { if (typeof window !== "undefined") window.removeEventListener("storage", recargarTokenYRubro); } }, []);
  useEffect(() => { if (chatContainerRef.current) chatContainerRef.current.scrollTop = chatContainer_Ref.current.scrollHeight; }, [messages, isTyping]);
  
  useEffect(() => {
    if (isOpen && rubroSeleccionado && !esperandoRubro) {
      const welcomeMessageText = "¡Hola! Soy Chatboc, tu asistente virtual. ¿En qué puedo ayudarte hoy?";
      if (messages.length === 0 || messages[messages.length -1]?.text !== welcomeMessageText) {
        setMessages([{ id: `${Date.now()}-welcome`, text: welcomeMessageText, isBot: true, timestamp: new Date() }]);
      }
    } else if (!isOpen && mode === "iframe") { // Limpiar mensajes solo en iframe mode al minimizar
        setMessages([]);
    }
  }, [isOpen, rubroSeleccionado, esperandoRubro, messages.length, mode]); // messages.length para reaccionar si se limpia

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;
    if (!rubroSeleccionado) { setMessages((prev) => [...prev, { id: `${Date.now()}-error`, text: "🛈 Por favor, seleccioná primero el rubro de tu negocio.", isBot: true, timestamp: new Date() }]); return; }
    const esAnonimo = token.startsWith("demo-anon") || token.startsWith("demo-token");
    if (esAnonimo && preguntasUsadas >= 15) { setMessages((prev) => [...prev, { id: `${Date.now()}-limit`, text: `🔒 Alcanzaste el límite de 15 preguntas gratuitas en esta demo.\n\n👉 Creá una cuenta para seguir usando Chatboc: https://chatboc.ar/register`, isBot: true, timestamp: new Date() }]); return; }
    const newUserMessageId = `${Date.now()}-${Math.random().toString(36).substring(2,7)}`;
    const userMessage: Message = { id: newUserMessageId, text, isBot: false, timestamp: new Date() };
    setMessages((prev) => [...prev, userMessage]);
    setIsTyping(true);
    try {
      const data = await apiFetch("/ask", "POST", { pregunta: text, rubro: rubroSeleccionado }, { headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } });
      const respuestaFinal: string = typeof data?.respuesta === "string" ? data.respuesta : data?.respuesta?.text || "❌ No entendí tu mensaje.";
      const botMessageId = `${Date.now()+1}-${Math.random().toString(36).substring(2,7)}`;
      const botMessage: Message = { id: botMessageId, text: respuestaFinal, isBot: true, timestamp: new Date() };
      setMessages((prev) => [...prev.filter(m => m.id !== newUserMessageId), userMessage, botMessage]);
      if (esAnonimo) setPreguntasUsadas((p) => p + 1);
    } catch (err) { console.error(err); setMessages((prev) => [...prev, { id: `${Date.now()}-server-error`, text: "⚠️ No se pudo conectar.", isBot: true, timestamp: new Date() }]);
    } finally { setIsTyping(false); }
  };

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => { /* ... (lógica de handleDragStart sin cambios) ... */ };
  const handleDragging = (e: MouseEvent | TouchEvent) => { /* ... (lógica de handleDragging sin cambios) ... */ };
  const handleDragEnd = () => { /* ... (lógica de handleDragEnd sin cambios) ... */ };

  const toggleChat = () => {
    setIsOpen(prevIsOpen => {
      const nextIsOpen = !prevIsOpen;
      if (nextIsOpen) { 
         if(!rubroSeleccionado) recargarTokenYRubro();
      }
      return nextIsOpen;
    });
  };

  useEffect(() => {
    if (mode === "iframe" && typeof window !== "undefined" && window.parent !== window) {
      const desiredDimensions = isOpen ? WIDGET_DIMENSIONS.OPEN : WIDGET_DIMENSIONS.CLOSED;
      window.parent.postMessage({
        type: "chatboc-resize",
        widgetId: widgetId,
        dimensions: desiredDimensions,
        isOpen: isOpen,
      }, "*");
    }
  }, [isOpen, mode, widgetId]);
  
  // --- Definición Completa de las Vistas de Contenido ---
  const rubroSelectionViewContent = (
    <div className={`w-full h-full flex flex-col items-center justify-center p-4 ${mode === 'standalone' && isOpen ? 'animate-slide-up' : ''}`}>
      <h2 className="text-lg font-semibold mb-3 text-center">👋 ¡Bienvenido!</h2>
      <p className="mb-4 text-sm text-center">¿De qué rubro es tu negocio?</p>
      {cargandoRubros ? ( <div className="text-center text-gray-500 text-sm my-6">Cargando rubros...</div>
      ) : rubrosDisponibles.length === 0 ? ( <div className="text-center text-red-500 text-sm my-6"> No se pudieron cargar los rubros. <br /> <button onClick={cargarRubros} className="mt-2 underline text-blue-600 hover:text-blue-800"> Reintentar </button> </div>
      ) : ( <div className="flex flex-wrap justify-center gap-2"> {rubrosDisponibles.map((rubro) => ( <button key={rubro.id} onClick={() => { if(typeof window !== "undefined") localStorage.setItem("rubroSeleccionado", rubro.nombre); setRubroSeleccionado(rubro.nombre); setEsperandoRubro(false); }} className="px-4 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 text-sm"> {rubro.nombre} </button> ))} </div>
      )}
    </div>
  );

  const mainChatViewContent = (
    <>
      <ChatHeader
        title="Chatboc Asistente"
        showCloseButton={true} 
        onClose={toggleChat} 
        onMouseDownDrag={mode === "standalone" && isOpen && draggable ? handleDragStart : undefined}
        isDraggable={mode === "standalone" && draggable && isOpen}
      />
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3" ref={chatContainerRef}>
        {messages.map((msg) => <ChatMessage key={msg.id} message={msg} /> )}
        {isTyping && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>
      <ChatInput onSendMessage={handleSendMessage} />
    </>
  );
  // --- Fin Definición Vistas de Contenido ---

  const commonWrapperStyle: CSSProperties = {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column", // Cambiado para mainChatViewContent
    color: prefersDark ? "#fff" : "#222",
    overflow: "hidden",
  };

  if (mode === "iframe") {
    return (
      <div style={{
          ...commonWrapperStyle,
          // En modo iframe, el fondo y borderRadius son controlados por el iframe mismo
          // o por el contenido si el iframe es totalmente transparente.
          // Aquí hacemos que el contenido interno se adapte.
          background: prefersDark ? 
                        (isOpen ? "#161c24" : "#2d3748") : // Fondo del globito y ventana en dark
                        (isOpen ? "#fff" : "#fff"),        // Fondo del globito y ventana en light
          // No aplicar borderRadius aquí, ya que el iframe lo manejará con la animación.
          // El contenido se recortará al borderRadius del iframe.
        }}
      >
        {!isOpen && (
          <div
            style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
            onClick={toggleChat}
            role="button" tabIndex={0} aria-label="Abrir chat"
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleChat();}}
          >
            <div className="relative">
              <img src="/chatboc_logo_clean_transparent.png" alt="Chatboc" className="w-8 h-8 rounded" style={{ padding: "2px" }} />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2" style={{ borderColor: prefersDark ? '#2d3748' : '#fff' }} />
            </div>
          </div>
        )}
        {isOpen && (
          esperandoRubro ? rubroSelectionViewContent : mainChatViewContent
        )}
      </div>
    );
  }

  // ---- Renderizado para modo Standalone ----
  return (
    <div ref={widgetContainerRef} style={currentPos} className="chatboc-standalone-widget">
      {!isOpen && (
        <button
          onClick={toggleChat}
          onMouseDown={draggable ? handleDragStart : undefined}
          onTouchStart={draggable ? handleDragStart : undefined}
          className="group w-16 h-16 rounded-full flex items-center justify-center border shadow-lg hover:shadow-xl transition-all duration-300 ease-in-out transform hover:scale-105"
          aria-label="Abrir chat"
          style={{
            borderColor: prefersDark ? "#374151" : "#e5e7eb",
            background: prefersDark ? "#161c24" : "#fff",
            cursor: draggable ? "move" : "pointer",
          }}
        >
          <div className="relative">
            <img src="/chatboc_logo_clean_transparent.png" alt="Chatboc" className="w-8 h-8 rounded" style={{ padding: "2px" }} />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-900" />
          </div>
        </button>
      )}

      {isOpen && (
        <div
          className="w-80 md:w-96 rounded-xl shadow-2xl flex flex-col overflow-hidden animate-slide-up"
          style={{
            height: esperandoRubro ? 'auto' : '500px',
            minHeight: esperandoRubro ? '240px' : '400px',
            background: prefersDark ? "#161c24" : "#fff",
            border: `1px solid ${prefersDark ? "#374151" : "#e5e7eb"}`,
          }}
        >
          {esperandoRubro ? rubroSelectionViewContent : mainChatViewContent}
        </div>
      )}
    </div>
  );
};

export default ChatWidget;