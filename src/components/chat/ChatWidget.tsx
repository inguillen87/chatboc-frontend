import React, { useState, useRef, useEffect, useCallback, CSSProperties } from "react"; // Añadido useCallback
import { X } from "lucide-react";
import ChatMessage from "./ChatMessage";
import TypingIndicator from "./TypingIndicator";
import ChatInput from "./ChatInput";
import { Message } from "@/types/chat";
import { apiFetch } from "@/utils/api";

// --- Componente WidgetChatHeader (interno de ChatWidget) ---
// Este componente de cabecera es para el widget flotante, no el de la página principal.
const WidgetChatHeader: React.FC<{
  title?: string;
  showCloseButton?: boolean;
  onClose?: () => void;
  onMouseDownDrag?: (e: React.MouseEvent | React.TouchEvent) => void;
  isDraggable?: boolean;
}> = ({
  title = "Chatboc Asistente",
  showCloseButton = false,
  onClose,
  onMouseDownDrag,
  isDraggable,
}) => {
  return (
    // Usa bg-card y text-foreground, y border-border para que se adapte al tema
    <div
      className="flex items-center justify-between p-3 border-b border-border bg-card text-foreground select-none"
      style={{
        cursor: isDraggable && onMouseDownDrag ? "move" : "default",
      }}
      onMouseDown={onMouseDownDrag}
      onTouchStart={onMouseDownDrag}
    >
      <div className="flex items-center pointer-events-none">
        <img src="/chatboc_logo_clean_transparent.png" alt="Chatboc" className="w-6 h-6 mr-2" />
        <span className="font-semibold text-sm text-primary">
          {title}
        </span>
      </div>
      <div className="flex items-center">
        <span
          className="text-green-500 text-xs font-semibold mr-2 pointer-events-none"
        >
          &nbsp;• Online
        </span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground focus:outline-none" aria-label="Cerrar o minimizar chat">
          <X size={20} />
        </button>
      </div>
    </div>
  );
};


// --- Token Management ---
// Función para obtener el token, usada por el componente ChatWidget
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

interface Rubro {
  id: number;
  nombre: string;
}
interface ChatWidgetProps {
  mode?: "iframe" | "standalone";
  initialPosition?: { top?: number | string; bottom?: number | string; left?: number | string; right?: number | string };
  draggable?: boolean;
  defaultOpen?: boolean;
  widgetId?: string;
}

const DEFAULT_WIDGET_RUBRO = "municipios";
const WIDGET_DIMENSIONS = {
  OPEN: { width: "360px", height: "520px" },
  CLOSED: { width: "80px", height: "80px" },
};

const ChatWidget: React.FC<ChatWidgetProps> = ({
  mode = "standalone",
  initialPosition: initialPosProp = { bottom: 20, right: 20 },
  draggable = true,
  defaultOpen = false,
  widgetId = "chatboc-widget-iframe",
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [preguntasUsadas, setPreguntasUsadas] = useState(0);
  const [rubroSeleccionado, setRubroSeleccionado] = useState<string | null>(null);
  const [rubrosDisponibles, setRubrosDisponibles] = useState<Rubro[]>([]);
  const [esperandoRubro, setEsperandoRubro] = useState(false);
  const [cargandoRubros, setCargandoRubros] = useState(false);
  
  // MODIFICADO: Declaración ÚNICA del token con useState
  const [token, setToken] = useState<string>(""); 
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const widgetContainerRef = useRef<HTMLDivElement>(null);
  const dragStartPosRef = useRef<{ x: number; y: number; elementX: number; elementY: number } | null>(null);
  const [currentPos, setCurrentPos] = useState<CSSProperties>(
    mode === "standalone" ? { position: 'fixed', ...initialPosProp, zIndex: 99998 } : {}
  );

  const [prefersDark, setPrefersDark] = useState(
    typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
  );

  // Dark mode listener (sin cambios)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setPrefersDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Lógica para inicializar el token al montar el componente (se ejecuta una sola vez)
  useEffect(() => {
    const fetchedToken = getToken();
    setToken(fetchedToken);
  }, []); // Dependencia vacía

  // -- User detection (sin cambios)
  const getUser = () => {
    if (typeof window === "undefined") return null;
    const storedUser = localStorage.getItem("user");
    return storedUser ? JSON.parse(storedUser) : null;
  };

  // -- Rubros (sin cambios, ya lo arreglamos con la barra final)
  const cargarRubros = async () => {
    setCargandoRubros(true);
    try {
      const res = await fetch("https://api.chatboc.ar/rubros/");
      const data = await res.json();
      setRubrosDisponibles(Array.isArray(data) ? data : []);
    } catch {
      setRubrosDisponibles([]);
    }
    setCargandoRubros(false);
  };


  // -- Init: token y rubro segun tipo usuario (recargarTokenYRubro ahora es useCallback)
  const recargarTokenYRubro = useCallback(() => {
    const currentToken = getToken();
    setToken(currentToken);
    const user = getUser();
    if (user && user.token && typeof user.token === 'string' && !user.token.startsWith("demo") && user.rubro) {
      setRubroSeleccionado(null);
      setEsperandoRubro(false);
      setPreguntasUsadas(0);
      localStorage.removeItem("rubroSeleccionado");
      return;
    }
    let rubro = localStorage.getItem("rubroSeleccionado");
    if (!rubro) {
      setEsperandoRubro(true);
      setRubroSeleccionado(null);
      cargarRubros();
    } else {
      setRubroSeleccionado(rubro);
      setEsperandoRubro(false);
    }
  }, []); // Dependencias: [] porque getToken y getUser no cambian

  useEffect(() => {
    recargarTokenYRubro();
    window.addEventListener("storage", recargarTokenYRubro);
    return () => window.removeEventListener("storage", recargarTokenYRubro);
  }, [recargarTokenYRubro]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  useEffect(() => {
    if (isOpen && (!esperandoRubro || getUser())) { // Asegura que el mensaje inicial se muestra si el chat está abierto
      setMessages([
        {
          id: Date.now() + Math.random(),
          text: "¡Hola! Soy Chatboc, tu asistente virtual. ¿En qué puedo ayudarte hoy?",
          isBot: true,
          timestamp: new Date(),
        },
      ]);
    }
  }, [isOpen, esperandoRubro]);

  // --- MAIN SENDING LOGIC ---
  const handleSendMessage = async (text: string) => {
    if (!text.trim() || !rubroSeleccionado || !token) return; // Asegurarse de que el token esté disponible

    const user = getUser();
    const esAnonimo = !user || !user.token || user.token.startsWith("demo");

    if (esAnonimo && !(rubroSeleccionado || DEFAULT_WIDGET_RUBRO)) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + Math.random(),
          text: "🛈 Por favor, seleccioná primero el rubro de tu negocio.",
          isBot: true,
          timestamp: new Date(),
        },
      ]);
      return;
    }
    if (esAnonimo && preguntasUsadas >= 15) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + Math.random(),
          text: `🔒 Alcanzaste el límite de 15 preguntas gratuitas en esta demo.\n\n👉 Creá una cuenta para seguir usando Chatboc: https://chatboc.ar/register`,
          isBot: true,
          timestamp: new Date(),
        },
      ]);
      return;
    }
    const userMessage: Message = {
      id: Date.now() + Math.random(),
      text,
      isBot: false,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsTyping(true);

    // --- BODY INTELIGENTE ---
    const body: any = { pregunta: text };
    if (esAnonimo) {
      body.rubro = rubroSeleccionado || DEFAULT_WIDGET_RUBRO;
    }

    try {
      const data = await apiFetch("/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      // Lógica robusta para extraer la respuesta del bot
      const respuestaFinal: string =
        typeof data?.respuesta === "string"
          ? data.respuesta
          : (data?.respuesta && typeof data.respuesta === 'object'
              ? (data.respuesta.text || data.respuesta.respuesta || "❌ No entendí tu mensaje.")
              : "❌ No entendí tu mensaje.");

      const botMessage: Message = {
        id: Date.now() + Math.random(),
        text: respuestaFinal,
        isBot: true,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMessage]);
      if (esAnonimo) setPreguntasUsadas((prev) => prev + 1);
    } catch (error) {
      let errorMessageText = "⚠️ No se pudo conectar con el servidor.";
      if (error instanceof Error) {
          errorMessageText = `⚠️ Error: ${error.message}`;
      } else if (typeof error === 'object' && error !== null && 'message' in error) {
          errorMessageText = `⚠️ Error: ${String((error as any).message)}`;
      }
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + Math.random(),
          text: errorMessageText,
          isBot: true,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  // --- Drag & Drop handlers (sin cambios) ---
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
    if (!dragStartPosRef.current) return;
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
    dragStartPosRef.current = null;
    document.removeEventListener("mousemove", handleDragging);
    document.removeEventListener("mouseup", handleDragEnd);
    document.removeEventListener("touchmove", handleDragging);
    document.removeEventListener("touchend", handleDragEnd);
  };

  const toggleChat = () => {
    setIsOpen(prevIsOpen => {
      const nextIsOpen = !prevIsOpen;
      if (nextIsOpen && esperandoRubro) recargarTokenYRubro();
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

  // --- VISTA Selección de Rubro ---
  const rubroSelectionViewContent = (
    // Usa bg-card, text-foreground, y border-border para adaptación al tema
    <div className="w-full flex flex-col items-center justify-center p-6 bg-card text-foreground border border-border rounded-xl" style={{ minHeight: 240 }}>
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
                setMessages([{
                  id: Date.now() + Math.random(),
                  text: "¡Hola! Soy Chatboc, tu asistente virtual. ¿En qué puedo ayudarte hoy?",
                  isBot: true,
                  timestamp: new Date(),
                }]);
              }}
              // rounded-full para mayor redondez en los botones de rubro
              className="px-4 py-2 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 text-sm shadow"
            >
              {rubro.nombre}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const mainChatViewContent = (
    <>
      <WidgetChatHeader
        title="Chatboc Asistente"
        showCloseButton={true}
        onClose={toggleChat}
        onMouseDownDrag={mode === "standalone" && isOpen && draggable ? handleDragStart : undefined}
        isDraggable={mode === "standalone" && draggable && isOpen}
      />
      {/* Fondo del contenedor de mensajes ahora es adaptativo */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 bg-background text-foreground" ref={chatContainerRef}>
        {messages.map((msg) =>
          typeof msg.text === "string" ? (
            <ChatMessage key={msg.id} message={msg} />
          ) : null
        )}
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
    color: prefersDark ? "hsl(var(--foreground))" : "hsl(var(--foreground))",
    overflow: "hidden",
  };

  if (mode === "iframe") {
    return (
      <div style={{
        ...commonWrapperStyle,
        background: isOpen ? "hsl(var(--card))" : "transparent",
      }}>
        {!isOpen && (
          <div
            style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
            onClick={toggleChat}
            role="button" tabIndex={0} aria-label="Abrir chat"
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleChat(); }}
          >
            <div className="relative">
              <img src="/chatboc_logo_clean_transparent.png" alt="Chatboc" className="w-8 h-8 rounded" style={{ padding: "2px" }} />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
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
          // rounded-full para el botón del widget cerrado
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
          // rounded-3xl para el contenedor del widget abierto
          className="w-80 md:w-96 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-slide-up bg-card border border-border"
          style={{
            height: esperandoRubro ? 'auto' : '500px',
            minHeight: esperandoRubro ? '240px' : '400px',
          }}
        >
          {esperandoRubro ? rubroSelectionViewContent : mainChatViewContent}
        </div>
      )}
    </div>
  );
};

export default ChatWidget;