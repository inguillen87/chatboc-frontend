import React, { useState, useRef, useEffect, CSSProperties } from "react";
import { X } from "lucide-react";
import ChatMessage from "./ChatMessage";
import TypingIndicator from "./TypingIndicator";
import ChatInput from "./ChatInput";
import { Message } from "@/types/chat";
import { apiFetch } from "@/utils/api";

// --- Componente ChatHeader Pro ---
const ChatHeader: React.FC<{
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
  const [prefersDark, setPrefersDark] = useState(
    typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setPrefersDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return (
    <div
      className={`
        flex items-center justify-between px-4 py-2 border-b select-none
        bg-gradient-to-r ${prefersDark ? "from-[#1b2230] to-[#182235]" : "from-blue-50 to-white"}
        `}
      style={{
        borderBottomColor: prefersDark ? "#2e3545" : "#e5e7eb",
        cursor: isDraggable && onMouseDownDrag ? "move" : "default",
      }}
      onMouseDown={onMouseDownDrag}
      onTouchStart={onMouseDownDrag}
    >
      <div className="flex items-center pointer-events-none">
        <img src="/chatboc_logo_clean_transparent.png" alt="Chatboc" className="w-7 h-7 mr-2 rounded-xl bg-white shadow" />
        <span className={`font-semibold text-base tracking-tight ${prefersDark ? "text-blue-100" : "text-blue-900"}`}>
          {title}
        </span>
      </div>
      <div className="flex items-center">
        <span
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: prefersDark ? "#6ee7b7" : "#059669",
            marginRight: showCloseButton ? 10 : 0,
          }}
          className="pointer-events-none"
        >
          ● Online
        </span>
        {showCloseButton && onClose && (
          <button
            onClick={onClose}
            className="text-gray-500 dark:text-gray-300 hover:text-red-500 dark:hover:text-red-400 transition focus:outline-none"
            aria-label="Cerrar o minimizar chat"
            tabIndex={0}
          >
            <X size={22} />
          </button>
        )}
      </div>
    </div>
  );
};

// --- Utilidad para Token ---
function getToken(): string {
  if (typeof window === "undefined") return "demo-anon-ssr";
  const params = new URLSearchParams(window.location.search);
  const urlToken = params.get("token");
  if (urlToken) return urlToken;
  const storedUserItem = localStorage.getItem("user");
  const user = storedUserItem ? JSON.parse(storedUserItem) : null;
  if (user && user.token && typeof user.token === "string" && !user.token.startsWith("demo")) return user.token;
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
  widgetId?: string;
}

const WIDGET_DIMENSIONS = {
  OPEN: { width: "360px", height: "520px" },
  CLOSED: { width: "72px", height: "72px" },
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
    mode === "standalone" ? { position: "fixed", ...initialPosProp, zIndex: 99998 } : {}
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
    const token = getToken();
    setToken(token);
    if (token && !token.startsWith("demo")) {
      setPreguntasUsadas(0);
      localStorage.removeItem("rubroSeleccionado");
      const storedUser = localStorage.getItem("user");
      const user = storedUser ? JSON.parse(storedUser) : null;
      setRubroSeleccionado(user?.rubro?.toLowerCase() || "general");
      setEsperandoRubro(false);
      return;
    }
    const rubro = localStorage.getItem("rubroSeleccionado");
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
    window.addEventListener("storage", recargarTokenYRubro);
    return () => window.removeEventListener("storage", recargarTokenYRubro);
  }, []);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  useEffect(() => {
    if (isOpen && rubroSeleccionado) {
      setMessages([
        {
          id: 1,
          text: "¡Hola! Soy Chatboc, tu asistente virtual. ¿En qué puedo ayudarte hoy?",
          isBot: true,
          timestamp: new Date(),
        },
      ]);
    }
  }, [isOpen, rubroSeleccionado]);

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;
    if (!rubroSeleccionado) {
      setMessages((prev) => [
        ...prev,
        {
          id: prev.length + 1,
          text: "🛈 Por favor, seleccioná primero el rubro de tu negocio.",
          isBot: true,
          timestamp: new Date(),
        },
      ]);
      return;
    }
    const esAnonimo = token.startsWith("demo-anon") || token.startsWith("demo-token");
    if (esAnonimo && preguntasUsadas >= 15) {
      setMessages((prev) => [
        ...prev,
        {
          id: prev.length + 1,
          text: `🔒 Alcanzaste el límite de 15 preguntas gratuitas en esta demo.\n\n👉 Creá una cuenta para seguir usando Chatboc: https://chatboc.ar/register`,
          isBot: true,
          timestamp: new Date(),
        },
      ]);
      return;
    }
    const userMessage: Message = {
      id: messages.length + 1,
      text,
      isBot: false,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsTyping(true);
    try {
      const data = await apiFetch(
        "/ask",
        "POST",
        { pregunta: text, rubro: rubroSeleccionado },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const respuestaFinal: string =
        typeof data?.respuesta === "string"
          ? data.respuesta
          : data?.respuesta?.text || "❌ No entendí tu mensaje.";
      const botMessage: Message = {
        id: messages.length + 2,
        text: respuestaFinal,
        isBot: true,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMessage]);
      if (esAnonimo) setPreguntasUsadas((prev) => prev + 1);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: messages.length + 2,
          text: "⚠️ No se pudo conectar con el servidor.",
          isBot: true,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  // --- Drag & Drop handlers ---
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (mode !== "standalone" || !draggable || !widgetContainerRef.current || typeof window === "undefined") return;
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const rect = widgetContainerRef.current.getBoundingClientRect();
    dragStartPosRef.current = { x: clientX, y: clientY, elementX: rect.left, elementY: rect.top };
    document.addEventListener("mousemove", handleDragging);
    document.addEventListener("mouseup", handleDragEnd);
    document.addEventListener("touchmove", handleDragging, { passive: false });
    document.addEventListener("touchend", handleDragEnd);
    if ("preventDefault" in e && e.cancelable) e.preventDefault();
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
    setIsOpen((prevIsOpen) => {
      const nextIsOpen = !prevIsOpen;
      if (nextIsOpen && !rubroSeleccionado) recargarTokenYRubro();
      return nextIsOpen;
    });
  };

  useEffect(() => {
    if (mode === "iframe" && typeof window !== "undefined" && window.parent !== window) {
      const desiredDimensions = isOpen ? WIDGET_DIMENSIONS.OPEN : WIDGET_DIMENSIONS.CLOSED;
      window.parent.postMessage(
        {
          type: "chatboc-resize",
          widgetId: widgetId,
          dimensions: desiredDimensions,
          isOpen: isOpen,
        },
        "*"
      );
    }
  }, [isOpen, mode, widgetId]);

  // --- VISTA Selección de Rubro ---
  const rubroSelectionViewContent = (
    <div
      className="w-full flex flex-col items-center justify-center px-6 py-7"
      style={{
        background: prefersDark ? "#161c24" : "#fff",
        minHeight: 240,
        borderRadius: "1.3rem",
      }}
    >
      <h2 className="text-xl font-bold mb-3 text-center text-blue-700 dark:text-blue-200">👋 ¡Bienvenido!</h2>
      <p className="mb-5 text-sm text-center text-gray-500 dark:text-gray-300">
        ¿De qué rubro es tu negocio?
      </p>
      {cargandoRubros ? (
        <div className="text-center text-gray-400 text-sm my-6">Cargando rubros...</div>
      ) : rubrosDisponibles.length === 0 ? (
        <div className="text-center text-red-500 text-sm my-6">
          No se pudieron cargar los rubros. <br />
          <button
            onClick={cargarRubros}
            className="mt-2 underline text-blue-600 hover:text-blue-800"
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
                    id: 1,
                    text: "¡Hola! Soy Chatboc, tu asistente virtual. ¿En qué puedo ayudarte hoy?",
                    isBot: true,
                    timestamp: new Date(),
                  },
                ]);
              }}
              className="
                px-4 py-2 bg-gradient-to-tr from-blue-500 to-blue-700
                text-white rounded-2xl font-medium hover:scale-105
                hover:bg-blue-700 transition text-sm shadow"
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
      <ChatHeader
        title="Chatboc Asistente"
        showCloseButton={true}
        onClose={toggleChat}
        onMouseDownDrag={mode === "standalone" && isOpen && draggable ? handleDragStart : undefined}
        isDraggable={mode === "standalone" && draggable && isOpen}
      />
      <div
        className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 bg-transparent"
        ref={chatContainerRef}
        style={{ background: "none" }}
      >
        {messages.map((msg) =>
          typeof msg.text === "string" ? <ChatMessage key={msg.id} message={msg} /> : null
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
    color: prefersDark ? "#fff" : "#222",
    overflow: "hidden",
  };

  if (mode === "iframe") {
    return (
      <div
        style={{
          ...commonWrapperStyle,
          background: prefersDark ? (isOpen ? "#161c24" : "#232936") : "#fff",
          borderRadius: "1.5rem",
          boxShadow: isOpen
            ? "0 12px 36px 0 rgba(24, 38, 67, 0.21)"
            : "0 2px 16px 0 rgba(24, 38, 67, 0.13)",
        }}
        className={`transition-all duration-200 ${isOpen ? "shadow-2xl" : "shadow"}`}
      >
        {!isOpen && (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
            onClick={toggleChat}
            role="button"
            tabIndex={0}
            aria-label="Abrir chat"
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") toggleChat();
            }}
          >
            <div className="relative">
              <img
                src="/chatboc_logo_clean_transparent.png"
                alt="Chatboc"
                className="w-10 h-10 rounded-xl bg-white shadow"
                style={{ padding: "2px" }}
              />
              <span
                className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2"
                style={{ borderColor: prefersDark ? "#232936" : "#fff" }}
              />
            </div>
          </div>
        )}
        {isOpen && (esperandoRubro ? rubroSelectionViewContent : mainChatViewContent)}
      </div>
    );
  }

  // ---- Renderizado para modo Standalone ----
  return (
    <div
      ref={widgetContainerRef}
      style={currentPos}
      className={`chatboc-standalone-widget z-[99998]`}
    >
      {!isOpen && (
        <button
          onClick={toggleChat}
          onMouseDown={draggable ? handleDragStart : undefined}
          onTouchStart={draggable ? handleDragStart : undefined}
          className="
            group w-16 h-16 rounded-full flex items-center justify-center
            border-2 shadow-lg hover:shadow-2xl transition-all duration-300 ease-in-out
            transform hover:scale-105 bg-white/95 dark:bg-[#15171b]/90
            border-blue-200 dark:border-blue-900
          "
          aria-label="Abrir chat"
          style={{
            cursor: draggable ? "move" : "pointer",
          }}
        >
          <div className="relative">
            <img src="/chatboc_logo_clean_transparent.png" alt="Chatboc" className="w-9 h-9 rounded-xl bg-white shadow" style={{ padding: "2px" }} />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-900" />
          </div>
        </button>
      )}
      {isOpen && (
        <div
          className="
            w-80 md:w-96 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-slide-up
            border border-blue-100 dark:border-blue-900
            bg-white/90 dark:bg-[#15171b]/90 backdrop-blur-md
          "
          style={{
            height: esperandoRubro ? "auto" : "500px",
            minHeight: esperandoRubro ? "240px" : "400px",
            transition: "box-shadow .2s, background .2s",
          }}
        >
          {esperandoRubro ? rubroSelectionViewContent : mainChatViewContent}
        </div>
      )}
    </div>
  );
};

export default ChatWidget;
