import React, { useState, useRef, useEffect, CSSProperties } from "react";
import { X } from "lucide-react";
import ChatMessage from "./ChatMessage"; // Asegúrate que la ruta sea correcta
import TypingIndicator from "./TypingIndicator"; // Asegúrate que la ruta sea correcta
import ChatInput from "./ChatInput"; // Asegúrate que la ruta sea correcta
import { Message } from "@/types/chat"; // Asegúrate que la ruta sea correcta
import { apiFetch } from "@/utils/api"; // Asegúrate que la ruta sea correcta

// --- Componente ChatHeader ---
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

// --- Función getToken ---
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
  const [isOpen, setIsOpen] = useState(mode === "iframe" ? defaultOpen : defaultOpen ); 
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
  
  useEffect(() => { 
    if (chatContainerRef.current) {
        // Pequeño delay para asegurar que el DOM se haya actualizado con los nuevos mensajes antes de hacer scroll
        setTimeout(() => {
            if(chatContainerRef.current) chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }, 0);
    }
  }, [messages, isTyping]);
  
  useEffect(() => {
    if (isOpen && rubroSeleccionado && !esperandoRubro) {
      const welcomeMessageText = "¡Hola! Soy Chatboc, tu asistente virtual. ¿En qué puedo ayudarte hoy?";
      if (messages.length === 0) { // Solo añadir si no hay NINGÚN mensaje
        setMessages([{ id: `${Date.now()}-welcome-${Math.random()}`, text: welcomeMessageText, isBot: true, timestamp: new Date() }]);
      }
    } else if (!isOpen && mode === "iframe") {
        setMessages([]); // Limpiar mensajes al minimizar en modo iframe
    }
  }, [isOpen, rubroSeleccionado, esperandoRubro, mode]); // Quitado messages.length para evitar bucles si se limpia.

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;
    if (!rubroSeleccionado) { setMessages((prev) => [...prev, { id: `${Date.now()}-error-${Math.random()}`, text: "🛈 Por favor, seleccioná primero el rubro de tu negocio.", isBot: true, timestamp: new Date() }]); return; }
    const esAnonimo = token.startsWith("demo-anon") || token.startsWith("demo-token");
    if (esAnonimo && preguntasUsadas >= 15) { setMessages((prev) => [...prev, { id: `${Date.now()}-limit-${Math.random()}`, text: `🔒 Alcanzaste el límite de 15 preguntas gratuitas en esta demo.\n\n👉 Creá una cuenta para seguir usando Chatboc: https://chatboc.ar/register`, isBot: true, timestamp: new Date() }]); return; }
    
    const newUserMessageId = `${Date.now()}-user-${Math.random().toString(36).substring(2,7)}`;
    const userMessage: Message = { id: newUserMessageId, text, isBot: false, timestamp: new Date() };
    setMessages((prev) => [...prev, userMessage]);
    setIsTyping(true);
    try {
      const data = await apiFetch("/ask", "POST", { pregunta: text, rubro: rubroSeleccionado }, { headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } });
      const respuestaFinal: string = typeof data?.respuesta === "string" ? data.respuesta : data?.respuesta?.text || "❌ No entendí tu mensaje.";
      const botMessageId = `${Date.now()+1}-bot-${Math.random().toString(36).substring(2,7)}`;
      const botMessage: Message = { id: botMessageId, text: respuestaFinal, isBot: true, timestamp: new Date() };
      setMessages((prev) => [...prev.filter(m => m.id !== newUserMessageId), userMessage, botMessage]); // Asegura que el mensaje del usuario esté antes que la respuesta del bot si hay re-renders.
      if (esAnonimo) setPreguntasUsadas((p) => p + 1);
    } catch (err) { console.error("Error enviando mensaje:", err); setMessages((prev) => [...prev, { id: `${Date.now()}-servererr-${Math.random()}`, text: "⚠️ No se pudo conectar con el servidor.", isBot: true, timestamp: new Date() }]);
    } finally { setIsTyping(false); }
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
    if (!dragStartPosRef.current || !isDragging) return; // Añadido chequeo de isDragging
    const clientX = "touches" in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
    const dx = clientX - dragStartPosRef.current.x;
    const dy = clientY - dragStartPosRef.current.y;
    setCurrentPos((prev) => ({
      ...prev,
      left: dragStartPosRef.current!.elementX + dx,
      top: dragStartPosRef.current!.elementY + dy,
      right: undefined,
      bottom: undefined,
    }));
  };
  const handleDragEnd = () => {
    dragStartPosRef.current = null; // Resetear para evitar que handleDragging se ejecute sin un drag activo
    // isDragging = false; // Deberías tener un estado para isDragging si haces este chequeo en handleDragging
    document.removeEventListener("mousemove", handleDragging);
    document.removeEventListener("mouseup", handleDragEnd);
    document.removeEventListener("touchmove", handleDragging);
    document.removeEventListener("touchend", handleDragEnd);
  };

  const toggleChat = () => {
    setIsOpen(prevIsOpen => {
      const nextIsOpen = !prevIsOpen;
      if (nextIsOpen && !rubroSeleccionado) { // Si se abre y no hay rubro (o token cambió y rubro se reseteó)
        recargarTokenYRubro();
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
      }, "*"); // IMPORTANTE: Cambia "*" por el origin de la página contenedora en producción
    }
  }, [isOpen, mode, widgetId]);
  
  const rubroSelectionViewContent = (
    <div className="w-full h-full flex flex-col items-center justify-center p-6 animate-slide-up" style={{ background: prefersDark ? "#161c24" : "#fff", minHeight: 240 }}>
      <h2 className="text-lg font-semibold mb-3 text-center">👋 ¡Bienvenido!</h2>
      <p className="mb-4 text-sm text-center">¿De qué rubro es tu negocio?</p>
      {cargandoRubros ? ( <div className="text-center text-gray-500 text-sm my-6">Cargando rubros...</div>
      ) : rubrosDisponibles.length === 0 ? ( <div className="text-center text-red-500 text-sm my-6"> No se pudieron cargar los rubros. <br /> <button onClick={cargarRubros} className="mt-2 underline text-blue-600 hover:text-blue-800"> Reintentar </button> </div>
      ) : ( <div className="flex flex-wrap justify-center gap-2"> {rubrosDisponibles.map((rubro) => ( <button key={rubro.id} onClick={() => { if(typeof window !== "undefined") localStorage.setItem("rubroSeleccionado", rubro.nombre); setRubroSeleccionado(rubro.nombre); setEsperandoRubro(false); /* El mensaje de bienvenida se activa por useEffect */ }} className="px-4 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 text-sm"> {rubro.nombre} </button> ))} </div>
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
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3" ref={chatContainerRef} style={{ background: "transparent" }}> {/* Fondo transparente para que tome el del wrapper */}
        {messages.map((msg) => <ChatMessage key={msg.id} message={msg} /> )}
        {isTyping && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>
      <ChatInput onSendMessage={handleSendMessage} />
    </>
  );

  const commonWrapperStyle: CSSProperties = {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    color: prefersDark ? "#fff" : "#222",
    overflow: "hidden",
  };

  if (mode === "iframe") {
    return (
      <div style={{
          ...commonWrapperStyle,
          // El iframe se encarga del borde, borderRadius y sombra.
          // El ChatWidget interno solo se preocupa de su contenido y fondo.
          background: prefersDark ? 
                        (isOpen ? "#161c24" : "transparent") : // Globito con fondo transparente para que se vea el del iframe si widget.js lo pone
                        (isOpen ? "#fff" : "transparent"),
          // Si el iframe es redondo y con fondo para el globito, este div debe ser transparente.
          // Si el iframe es transparente, este div debe dar el fondo al globito.
          // Asumiendo que widget.js hace el iframe redondo y le da fondo al globito:
        }}
      >
        {!isOpen && ( // Renderizar el "globito" DENTRO del iframe
          <div
            style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
            onClick={toggleChat}
            role="button" tabIndex={0} aria-label="Abrir chat"
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleChat();}}
          >
            {/* Este es el contenido visual del globito */}
            <div className="relative w-12 h-12 flex items-center justify-center bg-white dark:bg-gray-700 rounded-full shadow-md border dark:border-gray-600">
              <img src="/chatboc_logo_clean_transparent.png" alt="Chatboc" className="w-7 h-7" />
              <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-700" />
            </div>
          </div>
        )}
        {isOpen && ( // Renderizar la ventana de chat completa o selección de rubro
          // El fondo ya está en el div padre de este return.
          // No es necesario un `animate-slide-up` aquí si el iframe se expande con animación.
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
            height: esperandoRubro ? 'auto' : '520px', // Altura de WIDGET_DIMENSIONS.OPEN
            minHeight: esperandoRubro ? '240px' : '400px',
            background: prefersDark ? "#161c24" : "#fff",
            border: `1px solid ${prefersDark ? "#374151" : "#e5e7eb"}`,
            // No es necesario color aquí, ya que los elementos internos lo tendrán.
          }}
        >
          {esperandoRubro ? rubroSelectionViewContent : mainChatViewContent}
        </div>
      )}
    </div>
  );
};

export default ChatWidget;