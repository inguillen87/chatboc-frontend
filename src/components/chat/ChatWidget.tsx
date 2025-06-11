// src/components/chat/ChatWidget.tsx

import React, { useState, useRef, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import ChatMessage from "./ChatMessage";
import TypingIndicator from "./TypingIndicator";
import ChatInput from "./ChatInput";
import { Message } from "@/types/chat";
import { apiFetch } from "@/utils/api";
import { useIsMobile } from "@/hooks/use-mobile";

// --- Helper tokens ---
const getAuthTokenFromLocalStorage = () => (typeof window === "undefined" ? null : localStorage.getItem("authToken"));
const getAnonToken = () => {
  if (typeof window === "undefined") return "anon-ssr";
  let token = localStorage.getItem("anon_token");
  if (!token) {
    token = `anon-${Math.random().toString(36).substring(2, 12)}`;
    localStorage.setItem("anon_token", token);
  }
  return token;
};

interface ChatWidgetProps {
  mode?: "standalone" | "iframe";
  initialPosition?: { bottom: number; right: number };
  draggable?: boolean;
  defaultOpen?: boolean;
  widgetId?: string;
  authToken?: string | null;
  initialIframeWidth?: string | null;
  initialIframeHeight?: string | null;
}

const CIRCLE_SIZE = 80; // px
const CARD_WIDTH = 360; // px
const CARD_HEIGHT = 520; // px

const ChatWidget: React.FC<ChatWidgetProps> = ({
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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const widgetContainerRef = useRef<HTMLDivElement>(null);
  const dragStartPosRef = useRef<any>(null);

  // Posición/size real del widget flotante
  const [currentPos, setCurrentPos] = useState(
    mode === "standalone"
      ? { position: "fixed", ...initialPosition, zIndex: 99998 }
      : {
          width: initialIframeWidth || `${CIRCLE_SIZE}px`,
          height: initialIframeHeight || `${CIRCLE_SIZE}px`,
          position: "relative",
          zIndex: 1
        }
  );

  const isMobile = useIsMobile();
  const finalAuthToken = mode === "iframe" ? propAuthToken : getAuthTokenFromLocalStorage();
  const esAnonimo = !finalAuthToken;

  // Comunicación con el parent (widget.js) para el resize animado
  const postResizeMessage = useCallback(() => {
    if (mode === "iframe" && typeof window !== "undefined" && window.parent) {
      window.parent.postMessage(
        {
          type: "chatboc-resize",
          widgetId: widgetId,
          dimensions: isOpen
            ? { width: `${CARD_WIDTH}px`, height: `${CARD_HEIGHT}px` }
            : { width: `${CIRCLE_SIZE}px`, height: `${CIRCLE_SIZE}px` },
          isOpen: isOpen,
        },
        "*"
      );
    }
  }, [mode, isOpen, widgetId]);

  // Lógica de bienvenida / rubro
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

  // Scroll al final
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
    if (messagesEndRef.current) {
      (messagesEndRef.current as any).scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isTyping]);

  // Resize
  useEffect(() => {
    postResizeMessage();
  }, [isOpen, messages, isTyping, postResizeMessage]);

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

  const toggleChat = () => setIsOpen((o) => !o);

  // --- Render: burbuja/óvalo flotante grande ---
  if (!isOpen) {
    return (
      <div
        ref={widgetContainerRef}
        style={{
          ...currentPos,
          width: `${CIRCLE_SIZE}px`,
          height: `${CIRCLE_SIZE}px`,
          borderRadius: "50%",
          boxShadow: "0 4px 24px rgba(0,0,0,0.25)",
          background: "#181f2a", // color de fondo oscuro estilo SaaS
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          transition: "all 0.3s cubic-bezier(.4,0,.2,1)",
        }}
        onClick={toggleChat}
        aria-label="Abrir chat"
      >
        <img
          src="/chatboc_logo_clean_transparent.png"
          alt="Chatboc"
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            background: "#fff",
            padding: 4,
            boxShadow: "0 2px 8px rgba(0,0,0,0.09)",
            objectFit: "contain"
          }}
        />
        <span
          style={{
            position: "absolute",
            top: 16,
            right: 18,
            width: 12,
            height: 12,
            background: "#18e36c",
            borderRadius: "50%",
            border: "2px solid #181f2a"
          }}
        />
      </div>
    );
  }

  // --- Card/chat abierto ---
  return (
    <div
      ref={widgetContainerRef}
      style={{
        ...currentPos,
        width: `${CARD_WIDTH}px`,
        height: `${CARD_HEIGHT}px`,
        borderRadius: 24,
        boxShadow: "0 6px 32px rgba(0,0,0,0.28)",
        background: "#181f2a",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        transition: "all 0.3s cubic-bezier(.4,0,.2,1)",
        border: "1.5px solid #353c47"
      }}
    >
      {/* HEADER */}
      <div style={{ background: "#232a38", borderBottom: "1px solid #313742" }}>
        <div style={{ display: "flex", alignItems: "center", padding: "16px 18px 8px 18px" }}>
          <img src="/chatboc_logo_clean_transparent.png" alt="Chatboc" style={{ width: 24, height: 24, marginRight: 10 }} />
          <span style={{ color: "#d1d7e0", fontWeight: 700, fontSize: 15 }}>Chatboc Asistente</span>
          <span style={{ marginLeft: "auto", color: "#36e17e", fontSize: 13, fontWeight: 600 }}>• Online</span>
          <button
            onClick={toggleChat}
            style={{
              marginLeft: 16,
              color: "#8b97ad",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 19
            }}
            aria-label="Cerrar o minimizar chat"
          >
            <X size={22} />
          </button>
        </div>
      </div>
      {/* MAIN CHAT */}
      <div
        ref={chatContainerRef}
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          background: "#181f2a",
          padding: "18px 14px 12px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          color: "#f3f4f7"
        }}
      >
        {/* Mensajes y lógica */}
        {esperandoRubro ? (
          <div style={{ textAlign: "center", width: "100%" }}>
            <h2 style={{ color: "#18e36c", margin: "0 0 10px 0" }}>👋 ¡Bienvenido!</h2>
            <div style={{ color: "#b7bed1", marginBottom: 8 }}>¿De qué rubro es tu negocio?</div>
            {cargandoRubros ? (
              <div style={{ color: "#6e7791", margin: "20px 0" }}>Cargando rubros...</div>
            ) : rubrosDisponibles.length === 0 ? (
              <div style={{ color: "#e85d5d", margin: "20px 0" }}>
                No se pudieron cargar los rubros. <br />
                <button
                  onClick={cargarRubros}
                  style={{
                    marginTop: 10,
                    textDecoration: "underline",
                    color: "#238fff",
                    background: "none",
                    border: "none",
                    cursor: "pointer"
                  }}
                >
                  Reintentar
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 8 }}>
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
                    style={{
                      padding: "8px 18px",
                      borderRadius: 18,
                      fontSize: 14,
                      fontWeight: 600,
                      color: "#fff",
                      background: "#238fff",
                      border: "none",
                      cursor: "pointer",
                      margin: "4px 6px"
                    }}
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
      {!esperandoRubro && <div style={{ padding: "10px 14px", background: "#1d2433" }}>
        <ChatInput onSendMessage={handleSendMessage} />
      </div>}
    </div>
  );
};

export default ChatWidget;
