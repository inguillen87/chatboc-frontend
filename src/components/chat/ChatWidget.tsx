import React, { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";
import ChatHeader from "./ChatHeader";
import ChatMessage from "./ChatMessage";
import TypingIndicator from "./TypingIndicator";
import ChatInput from "./ChatInput";
import { Message } from "@/types/chat";
import { apiFetch } from "@/utils/api";

// Utilidad para detectar modo dark real del host
function useDarkMode() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== "undefined") {
      return (
        document.documentElement.classList.contains("dark") ||
        window.matchMedia("(prefers-color-scheme: dark)").matches
      );
    }
    return false;
  });
  useEffect(() => {
    const handler = () => {
      setIsDark(
        document.documentElement.classList.contains("dark") ||
        window.matchMedia("(prefers-color-scheme: dark)").matches
      );
    };
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", handler);
    // Si el sitio cambia la clase "dark" en runtime:
    const observer = new MutationObserver(handler);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => {
      window.matchMedia("(prefers-color-scheme: dark)").removeEventListener("change", handler);
      observer.disconnect();
    };
  }, []);
  return isDark;
}

function getToken() {
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
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
  draggable?: boolean;
}

const POSITIONS = {
  "bottom-right": { bottom: 20, right: 20 },
  "bottom-left": { bottom: 20, left: 20 },
  "top-right": { top: 20, right: 20 },
  "top-left": { top: 20, left: 20 },
};

// ---- INICIO COMPONENTE ----
const ChatWidget: React.FC<ChatWidgetProps> = ({
  position = "bottom-right",
  draggable = true,
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [preguntasUsadas, setPreguntasUsadas] = useState(0);
  const [rubroSeleccionado, setRubroSeleccionado] = useState<string | null>(null);
  const [rubrosDisponibles, setRubrosDisponibles] = useState<{ id: number; nombre: string }[]>([]);
  const [esperandoRubro, setEsperandoRubro] = useState(false);
  const [cargandoRubros, setCargandoRubros] = useState(false);
  const [token, setToken] = useState("");
  const [isVisible, setIsVisible] = useState(true);

  // --- dark mode real del host
  const prefersDark = useDarkMode();

  // --- Drag & Drop logic
  const widgetRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [offset, setOffset] = useState<{ x: number; y: number } | null>(null);

  // Posición inicial según prop
  const initialPos = POSITIONS[position];
  const [pos, setPos] = useState<{ x?: number; y?: number; left?: number; right?: number; top?: number; bottom?: number }>({ ...initialPos });

  // Drag Events
  useEffect(() => {
    if (!drag) return;
    const onMove = (e: MouseEvent) => {
      setPos((prev) => ({
        ...prev,
        left: drag.x + e.clientX - (offset?.x || 0),
        top: drag.y + e.clientY - (offset?.y || 0),
        right: undefined, bottom: undefined,
      }));
    };
    const onUp = () => {
      setDrag(null);
      setOffset(null);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [drag, offset]);

  // ---- Rubros / lógica original ----
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
    // eslint-disable-next-line
  }, []);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
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

  // --- DRAG start
  const startDrag = (e: React.MouseEvent) => {
    if (!draggable) return;
    const rect = widgetRef.current?.getBoundingClientRect();
    setDrag({
      x: rect?.left ?? 0,
      y: rect?.top ?? 0,
    });
    setOffset({
      x: e.clientX,
      y: e.clientY,
    });
    e.preventDefault();
  };

  // --- Mensajes originales del widget ---
  const toggleChat = () => {
    setIsOpen((prev) => !prev);
  };

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
      if (esAnonimo) {
        setPreguntasUsadas((prev) => prev + 1);
      }
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

  // --- Render UI ---
  if (!isVisible) return null;
  if (isOpen && esperandoRubro) {
    return (
      <div
        ref={widgetRef}
        style={{
          position: "fixed",
          ...pos,
          zIndex: 9999,
          background: prefersDark ? "var(--background, #161c24)" : "var(--background, #fff)",
          border: `1px solid ${prefersDark ? "var(--border, #374151)" : "var(--border, #e5e7eb)"}`,
          color: prefersDark ? "var(--foreground, #fff)" : "var(--foreground, #222)",
          borderRadius: 16,
          boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
          width: 360, minHeight: 240,
        }}
        onMouseDown={draggable ? startDrag : undefined}
      >
        <h2 className="text-lg font-semibold mb-3 text-center">👋 ¡Bienvenido!</h2>
        <p className="mb-4 text-sm text-center">¿De qué rubro es tu negocio?</p>
        {cargandoRubros ? (
          <div className="text-center text-gray-500 text-sm my-6">Cargando rubros...</div>
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
                className="px-4 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 text-sm"
              >
                {rubro.nombre}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={widgetRef}
      style={{
        position: "fixed",
        ...pos,
        zIndex: 9999,
        background: "transparent",
      }}
      onMouseDown={draggable ? startDrag : undefined}
    >
      {/* Botón flotante para abrir/cerrar */}
      <button
        onClick={toggleChat}
        aria-label={isOpen ? "Cerrar chat" : "Abrir chat"}
        style={{
          position: "absolute",
          bottom: isOpen ? 510 : 0,
          right: 12,
          width: 52,
          height: 52,
          borderRadius: "50%",
          border: `1px solid ${prefersDark ? "#374151" : "#e5e7eb"}`,
          background: prefersDark ? "#161c24" : "#fff",
          display: isOpen ? "none" : "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
        }}
      >
        <div className="relative">
          <img
            src="/chatboc_logo_clean_transparent.png"
            alt="Chatboc"
            className="w-8 h-8 rounded"
            style={{ padding: "2px" }}
          />
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-900" />
        </div>
      </button>

      {/* CHATBOX visible */}
      {isOpen && !esperandoRubro && (
        <div
          className="rounded-xl shadow-2xl flex flex-col overflow-hidden animate-slide-up"
          style={{
            background: prefersDark ? "var(--background, #161c24)" : "var(--background, #fff)",
            border: `1px solid ${prefersDark ? "var(--border, #374151)" : "var(--border, #e5e7eb)"}`,
            color: prefersDark ? "var(--foreground, #fff)" : "var(--foreground, #222)",
            borderRadius: 16,
            width: 370, // Ajustable
            height: 540,
            boxShadow: "0 8px 32px rgba(0,0,0,0.24)",
            transition: "background 0.2s",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Header draggable */}
          <div
            onMouseDown={draggable ? startDrag : undefined}
            style={{
              cursor: draggable ? "move" : "default",
              userSelect: "none",
              height: 36,
              background: prefersDark ? "rgba(40,48,72,0.98)" : "#f1f5f9",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 18px",
              borderBottom: `1px solid ${prefersDark ? "#283048" : "#e5e7eb"}`,
            }}
          >
            <span style={{ fontWeight: 600, fontSize: 16 }}>
              <img src="/chatboc_logo_clean_transparent.png" alt="Logo" className="inline-block mr-2 w-6 h-6 align-middle" />
              Chatboc <span style={{ fontSize: 12, fontWeight: 400, color: prefersDark ? "#90EE90" : "#24ba53" }}>&nbsp;• Online</span>
            </span>
            <button
              onClick={toggleChat}
              className="text-gray-600 dark:text-gray-300 hover:text-red-500 ml-2"
              style={{
                background: "transparent",
                border: "none",
                fontSize: 22,
                cursor: "pointer",
                padding: 0,
              }}
            >
              <X />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3" ref={chatContainerRef}>
            {messages.map((msg) =>
              typeof msg.text === "string" ? (
                <ChatMessage key={msg.id} message={msg} />
              ) : null
            )}
            {isTyping && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>
          <ChatInput onSendMessage={handleSendMessage} />
        </div>
      )}
    </div>
  );
};

export default ChatWidget;
