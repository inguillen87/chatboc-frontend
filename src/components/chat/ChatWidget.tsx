import React, { useState, useRef, useEffect, useCallback } from "react";
import ChatHeader from "./ChatHeader";
import ChatMessage from "./ChatMessage";
import TypingIndicator from "./TypingIndicator";
import ChatInput from "./ChatInput";
import { Message } from "@/types/chat";
import { apiFetch } from "@/utils/api";
import { useIsMobile } from "@/hooks/use-mobile";
import ChatbocLogoAnimated from "./ChatbocLogoAnimated";

const CIRCLE_SIZE = 88;
const CARD_WIDTH = 370;
const CARD_HEIGHT = 540;

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

  // Detectar dark mode real
  const prefersDark = typeof window !== "undefined"
    ? window.matchMedia("(prefers-color-scheme: dark)").matches
    : false;

  const isMobile = useIsMobile();
  const finalAuthToken = mode === "iframe" ? propAuthToken : getAuthTokenFromLocalStorage();
  const esAnonimo = !finalAuthToken;

  // Animar sonrisa periódica en la burbuja cerrada
  useEffect(() => {
    if (!isOpen) {
      const timer = setInterval(() => {
        setSmile(true);
        setTimeout(() => setSmile(false), 950);
      }, 2900);
      return () => clearInterval(timer);
    }
  }, [isOpen]);

  // --- Lógica original (bien pegada) ---
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

  // --- Render: burbuja flotante grande (con logo animado exacto) ---
  if (!isOpen) {
    return (
      <div
        style={{
          position: "fixed",
          bottom: 30,
          right: 30,
          width: CIRCLE_SIZE,
          height: CIRCLE_SIZE,
          borderRadius: "50%",
          boxShadow: prefersDark
            ? "0 8px 36px rgba(22,115,255,0.18)"
            : "0 8px 36px rgba(22,115,255,0.28)",
          background: prefersDark ? "#181f2a" : "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          zIndex: 999999,
          border: prefersDark ? "2.2px solid #202a45" : "2.2px solid #e2e8f0",
          transition: "all 0.3s cubic-bezier(.4,0,.2,1)",
        }}
        onClick={() => setIsOpen(true)}
        aria-label="Abrir chat"
      >
        <ChatbocLogoAnimated
          size={56}
          smiling={smile}
        />
        {/* Puntito online */}
        <span
          style={{
            position: "absolute",
            top: 20,
            right: 24,
            width: 13,
            height: 13,
            background: "#18e36c",
            borderRadius: "50%",
            border: prefersDark
              ? "2.2px solid #181f2a"
              : "2.2px solid #fff"
          }}
        />
      </div>
    );
  }

  // --- Card/chat abierto ---
  return (
    <div
      style={{
        position: "fixed",
        bottom: 30,
        right: 30,
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        borderRadius: 24,
        boxShadow: prefersDark
          ? "0 8px 36px rgba(22,115,255,0.10)"
          : "0 8px 36px rgba(22,115,255,0.16)",
        background: prefersDark ? "#181f2a" : "#fff",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        transition: "all 0.3s cubic-bezier(.4,0,.2,1)",
        border: prefersDark ? "1.8px solid #353c47" : "1.8px solid #1673ff33"
      }}
    >
      <ChatHeader onClose={() => setIsOpen(false)} />
      {/* MAIN CHAT */}
      <div
        ref={chatContainerRef}
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          background: prefersDark ? "#181f2a" : "#fff",
          padding: "18px 14px 12px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          color: prefersDark ? "#f3f4f7" : "#212534"
        }}
      >
        {esperandoRubro ? (
          <div style={{ textAlign: "center", width: "100%" }}>
            <h2 style={{ color: "#18e36c", margin: "0 0 10px 0" }}>👋 ¡Bienvenido!</h2>
            <div style={{ color: prefersDark ? "#b7bed1" : "#5060ab", marginBottom: 8 }}>
              ¿De qué rubro es tu negocio?
            </div>
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
                    color: "#1673ff",
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
                      background: "#1673ff",
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
      {!esperandoRubro && <div style={{
        padding: "10px 14px",
        background: prefersDark ? "#202a45" : "#f4f8fe"
      }}>
        <ChatInput onSendMessage={handleSendMessage} />
      </div>}
    </div>
  );
};

export default ChatWidget;
