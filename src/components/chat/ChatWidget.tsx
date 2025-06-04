import React, { useState, useRef, useEffect, CSSProperties } from "react";
import { X } from "lucide-react"; // Icono para el botón de cierre
import ChatMessage from "./ChatMessage"; // Asegúrate que la ruta sea correcta
import TypingIndicator from "./TypingIndicator"; // Asegúrate que la ruta sea correcta
import ChatInput from "./ChatInput"; // Asegúrate que la ruta sea correcta
import { Message } from "@/types/chat"; // Asegúrate que la ruta sea correcta
import { apiFetch } from "@/utils/api"; // Asegúrate que la ruta sea correcta

// --- Componente ChatHeader (integrado aquí o puede ser importado si ya existe modificado) ---
interface ChatHeaderProps {
  title?: string;
  showCloseButton?: boolean;
  onClose?: () => void;
  onMouseDownDrag?: (e: React.MouseEvent | React.TouchEvent) => void;
  isDraggable?: boolean;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({
  title = "Chatboc Asistente Virtual",
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
        <img
          src="/chatboc_logo_clean_transparent.png" // Verifica esta ruta
          alt="Chatboc"
          className="w-6 h-6 mr-2"
        />
        <span className="font-semibold text-sm">{title}</span>
      </div>
      <div className="flex items-center">
        <span style={{ fontSize: 12, fontWeight: 400, color: prefersDarkHeader ? "#90EE90" : "#24ba53", marginRight: showCloseButton ? '8px' : '0' }} className="pointer-events-none">
          &nbsp;• Online
        </span>
        {showCloseButton && onClose && (
          <button
            onClick={onClose}
            className="text-gray-600 dark:text-gray-300 hover:text-red-500 focus:outline-none"
            aria-label="Cerrar chat"
          >
            <X size={20} />
          </button>
        )}
      </div>
    </div>
  );
};
// --- Fin Componente ChatHeader ---

function getToken() {
  if (typeof window === "undefined") return "demo-anon-ssr";
  const params = new URLSearchParams(window.location.search);
  const urlToken = params.get("token");
  if (urlToken) return urlToken;

  const storedUser = localStorage.getItem("user");
  const user = storedUser ? JSON.parse(storedUser) : null;
  if (user?.token && !user.token.startsWith("demo")) return user.token;

  let anonToken = localStorage.getItem("anon_token");
  if (!anonToken) {
    anonToken = `demo-anon-${Math.random().toString(36).substring(2, 10)}`;
    localStorage.setItem("anon_token", anonToken);
  }
  return anonToken;
}

interface ChatWidgetProps {
  mode?: "iframe" | "standalone";
  initialPosition?: { top?: number | string; bottom?: number | string; left?: number | string; right?: number | string };
  draggable?: boolean;
  defaultOpen?: boolean;
}

const ChatWidget: React.FC<ChatWidgetProps> = ({
  mode = "standalone",
  initialPosition: initialPosProp = { bottom: 20, right: 20 },
  draggable = true,
  defaultOpen = false,
}) => {
  const [isOpen, setIsOpen] = useState(mode === "iframe" ? true : defaultOpen);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [preguntasUsadas, setPreguntasUsadas] = useState(0);
  const [rubroSeleccionado, setRubroSeleccionado] = useState<string | null>(null);
  const [rubrosDisponibles, setRubrosDisponibles] = useState<{ id: number; nombre: string }[]>([]);
  const [esperandoRubro, setEsperandoRubro] = useState(false);
  const [cargandoRubros, setCargandoRubros] = useState(false);
  const [token, setToken] = useState("");

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
      const data = await res.json();
      setRubrosDisponibles(data.rubros || []);
    } catch {
      setRubrosDisponibles([]);
    }
    setCargandoRubros(false);
  };

  const recargarTokenYRubro = () => {
    const currentToken = getToken();
    setToken(currentToken);

    if (currentToken && !currentToken.startsWith("demo")) {
      setPreguntasUsadas(0);
      if(typeof window !== "undefined") localStorage.removeItem("rubroSeleccionado");
      const storedUser = typeof window !== "undefined" ? localStorage.getItem("user") : null;
      const user = storedUser ? JSON.parse(storedUser) : null;
      setRubroSeleccionado(user?.rubro?.toLowerCase() || "general");
      setEsperandoRubro(false);
      return;
    }

    const rubro = typeof window !== "undefined" ? localStorage.getItem("rubroSeleccionado") : null;
    if (!rubro) {
      setEsperandoRubro(true);
      setRubroSeleccionado(null);
      cargarRubros();
    } else {
      setRubroSeleccionado(rubro);
      setEsperandoRubro(false);
    }
  };

  useEffect(() => { 
    recargarTokenYRubro(); 
    if (typeof window !== "undefined") window.addEventListener("storage", recargarTokenYRubro); 
    return () => {
      if (typeof window !== "undefined") window.removeEventListener("storage", recargarTokenYRubro);
    }
  }, []);
  
  useEffect(() => { 
    if (chatContainerRef.current) chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight; 
  }, [messages, isTyping]);
  
  useEffect(() => {
    if (isOpen && rubroSeleccionado) {
      setMessages([{ id: 1, text: "¡Hola! Soy Chatboc, tu asistente virtual. ¿En qué puedo ayudarte hoy?", isBot: true, timestamp: new Date() }]);
    }
  }, [isOpen, rubroSeleccionado]);

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;
    if (!rubroSeleccionado) {
      setMessages((prev) => [...prev, { id: prev.length + 1, text: "🛈 Por favor, seleccioná primero el rubro de tu negocio.", isBot: true, timestamp: new Date() }]);
      return;
    }
    const esAnonimo = token.startsWith("demo-anon") || token.startsWith("demo-token");
    if (esAnonimo && preguntasUsadas >= 15) {
      setMessages((prev) => [...prev, { id: prev.length + 1, text: `🔒 Alcanzaste el límite de 15 preguntas gratuitas en esta demo.\n\n👉 Creá una cuenta para seguir usando Chatboc: https://chatboc.ar/register`, isBot: true, timestamp: new Date() }]);
      return;
    }
    const userMessage: Message = { id: messages.length + 1, text, isBot: false, timestamp: new Date() };
    setMessages((prev) => [...prev, userMessage]);
    setIsTyping(true);
    try {
      const data = await apiFetch("/ask", "POST", { pregunta: text, rubro: rubroSeleccionado }, { headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } });
      const respuestaFinal: string = typeof data?.respuesta === "string" ? data.respuesta : data?.respuesta?.text || "❌ No entendí tu mensaje.";
      const botMessage: Message = { id: messages.length + 2, text: respuestaFinal, isBot: true, timestamp: new Date() };
      setMessages((prev) => [...prev, botMessage]);
      if (esAnonimo) setPreguntasUsadas((prev) => prev + 1);
    } catch {
      setMessages((prev) => [...prev, { id: messages.length + 2, text: "⚠️ No se pudo conectar con el servidor.", isBot: true, timestamp: new Date() }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (mode !== "standalone" || !draggable || !widgetContainerRef.current || typeof window === "undefined") return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const rect = widgetContainerRef.current.getBoundingClientRect();
    dragStartPosRef.current = { x: clientX, y: clientY, elementX: rect.left, elementY: rect.top };
    document.addEventListener("mousemove", handleDragging);
    document.addEventListener("mouseup", handleDragEnd);
    document.addEventListener("touchmove", handleDragging, { passive: false });
    document.addEventListener("touchend", handleDragEnd);
    if ('preventDefault' in e && e.cancelable) e.preventDefault();
  };

  const handleDragging = (e: MouseEvent | TouchEvent) => {
    if (!dragStartPosRef.current || mode !== "standalone" || !draggable || typeof window === "undefined") return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const dx = clientX - dragStartPosRef.current.x;
    const dy = clientY - dragStartPosRef.current.y;
    setCurrentPos(prevPos => ({ ...prevPos, left: dragStartPosRef.current!.elementX + dx, top: dragStartPosRef.current!.elementY + dy, right: undefined, bottom: undefined }));
    if ('preventDefault' in e && e.cancelable) e.preventDefault();
  };

  const handleDragEnd = () => {
    dragStartPosRef.current = null;
    if (typeof window === "undefined") return;
    document.removeEventListener("mousemove", handleDragging);
    document.removeEventListener("mouseup", handleDragEnd);
    document.removeEventListener("touchmove", handleDragging);
    document.removeEventListener("touchend", handleDragEnd);
  };

  const toggleChat = () => {
    if (mode === "standalone") {
      setIsOpen(prevIsOpen => {
        const nextIsOpen = !prevIsOpen;
        if (nextIsOpen) recargarTokenYRubro();
        return nextIsOpen;
      });
    }
  };
  
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
        showCloseButton={mode === "standalone"}
        onClose={toggleChat}
        onMouseDownDrag={mode === "standalone" && isOpen && draggable ? handleDragStart : undefined}
        isDraggable={mode === "standalone" && draggable && isOpen}
      />
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3" ref={chatContainerRef}>
        {messages.map((msg) => typeof msg.text === "string" ? <ChatMessage key={msg.id} message={msg} /> : null )}
        {isTyping && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>
      <ChatInput onSendMessage={handleSendMessage} />
    </>
  );

  if (mode === "iframe") {
    return (
      <div style={{
        width: "100%", height: "100%", display: "flex", flexDirection: "column",
        background: prefersDark ? "#161c24" : "#fff",
        border: `1px solid ${prefersDark ? "#374151" : "#e5e7eb"}`,
        borderRadius: "16px", 
        color: prefersDark ? "#fff" : "#222",
        overflow: "hidden",
      }}>
        {esperandoRubro ? rubroSelectionViewContent : mainChatViewContent}
      </div>
    );
  }

  return (
    <div ref={widgetContainerRef} style={currentPos}>
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
            minHeight: esperandoRubro ? '240px' : undefined,
            background: prefersDark ? "#161c24" : "#fff",
            border: `1px solid ${prefersDark ? "#374151" : "#e5e7eb"}`,
            color: prefersDark ? "#fff" : "#222",
          }}
        >
          {esperandoRubro ? rubroSelectionViewContent : mainChatViewContent}
        </div>
      )}
    </div>
  );
};

export default ChatWidget;