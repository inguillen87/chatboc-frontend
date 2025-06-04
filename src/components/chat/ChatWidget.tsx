import React, { useState, useRef, useEffect, CSSProperties } from "react";
import { X } from "lucide-react";
// Asegúrate de que estas rutas sean correctas en tu proyecto:
import ChatMessage from "./ChatMessage";
import TypingIndicator from "./TypingIndicator";
import ChatInput from "./ChatInput";
import { Message } from "@/types/chat";
import { apiFetch } from "@/utils/api";

// --- Componente ChatHeader (Integrado para completitud) ---
interface ChatHeaderProps {
  title?: string;
  onMinimize?: () => void; // Callback para cuando se presiona la 'X'
}
const ChatHeader: React.FC<ChatHeaderProps> = ({
  title = "Chatboc Asistente",
  onMinimize,
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
        cursor: "default", // El arrastre es manejado por widget.js en el iframe
      }}
    >
      <div className="flex items-center pointer-events-none">
        <img
          src="/chatboc_logo_clean_transparent.png" // RUTA PÚBLICA A TU LOGO
          alt="Chatboc"
          className="w-6 h-6 mr-2"
        />
        <span className="font-semibold text-sm">{title}</span>
      </div>
      <div className="flex items-center">
        <span style={{ fontSize: 12, fontWeight: 400, color: prefersDarkHeader ? "#90EE90" : "#24ba53", marginRight: onMinimize ? '8px' : '0' }} className="pointer-events-none">
          &nbsp;• Online
        </span>
        {onMinimize && ( // Mostrar 'X' si hay callback onMinimize
          <button
            onClick={onMinimize}
            className="text-gray-600 dark:text-gray-300 hover:text-red-500 focus:outline-none"
            aria-label="Minimizar chat"
          >
            <X size={20} />
          </button>
        )}
      </div>
    </div>
  );
};
// --- Fin Componente ChatHeader ---

// --- Función getToken (Completa) ---
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
// --- Fin Función getToken ---

interface ChatWidgetProps {
  widgetId?: string; // ID del iframe, pasado desde la URL por Iframe.tsx
}

const ChatWidget: React.FC<ChatWidgetProps> = ({
  widgetId = "chatboc-iframe-unknown",
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [preguntasUsadas, setPreguntasUsadas] = useState(0);
  const [rubroSeleccionado, setRubroSeleccionado] = useState<string | null>(null);
  const [rubrosDisponibles, setRubrosDisponibles] = useState<{ id: number; nombre: string }[]>([]);
  const [esperandoRubro, setEsperandoRubro] = useState(true); // Inicia esperando rubro
  const [cargandoRubros, setCargandoRubros] = useState(false);
  const [token, setToken] = useState("");
  const [prefersDark, setPrefersDark] = useState(
    typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

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
      const res = await fetch("https://api.chatboc.ar/rubros"); // URL DE TU API
      const data = await res.json();
      setRubrosDisponibles(data.rubros || []);
    } catch (error) {
      console.error("Error cargando rubros:", error);
      setRubrosDisponibles([]);
    }
    setCargandoRubros(false);
  };

  const recargarTokenYRubro = () => {
    const currentToken = getToken();
    setToken(currentToken);
    if (currentToken && !currentToken.startsWith("demo")) {
      setPreguntasUsadas(0);
      if (typeof window !== "undefined") localStorage.removeItem("rubroSeleccionado");
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
    if (typeof window !== "undefined") {
      window.addEventListener("storage", recargarTokenYRubro);
      return () => window.removeEventListener("storage", recargarTokenYRubro);
    }
  }, []);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  useEffect(() => {
    if (rubroSeleccionado && !esperandoRubro) {
      if (messages.length === 0 || messages[messages.length -1]?.text !== "¡Hola! Soy Chatboc, tu asistente virtual. ¿En qué puedo ayudarte hoy?") {
        setMessages([{ id: Date.now(), text: "¡Hola! Soy Chatboc, tu asistente virtual. ¿En qué puedo ayudarte hoy?", isBot: true, timestamp: new Date() }]);
      }
    }
  }, [rubroSeleccionado, esperandoRubro, messages]); // messages en dep array para re-evaluar si es necesario

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;
    if (!rubroSeleccionado) {
      setMessages((prev) => [...prev, { id: Date.now(), text: "🛈 Por favor, seleccioná primero el rubro de tu negocio.", isBot: true, timestamp: new Date() }]);
      return;
    }
    const esAnonimo = token.startsWith("demo-anon") || token.startsWith("demo-token");
    if (esAnonimo && preguntasUsadas >= 15) {
      setMessages((prev) => [...prev, { id: Date.now(), text: `🔒 Alcanzaste el límite de 15 preguntas gratuitas en esta demo.\n\n👉 Creá una cuenta para seguir usando Chatboc: https://chatboc.ar/register`, isBot: true, timestamp: new Date() }]);
      return;
    }
    const userMessage: Message = { id: Date.now(), text, isBot: false, timestamp: new Date() };
    setMessages((prevMessages) => [...prevMessages, userMessage]);
    setIsTyping(true);
    try {
      const data = await apiFetch("/ask", "POST", { pregunta: text, rubro: rubroSeleccionado }, { headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } });
      const respuestaFinal: string = typeof data?.respuesta === "string" ? data.respuesta : data?.respuesta?.text || "❌ No entendí tu mensaje.";
      const botMessage: Message = { id: Date.now() + 1, text: respuestaFinal, isBot: true, timestamp: new Date() }; // ID ligeramente diferente
      setMessages((prevMessages) => [...prevMessages.filter(m => m.id !== userMessage.id), userMessage, botMessage]);
      if (esAnonimo) setPreguntasUsadas((prev) => prev + 1);
    } catch (error) {
      console.error("Error enviando mensaje:", error);
      setMessages((prevMessages) => [...prevMessages, { id: Date.now(), text: "⚠️ No se pudo conectar con el servidor.", isBot: true, timestamp: new Date() }]);
    } finally {
      setIsTyping(false);
    }
  };

  const requestMinimizeToGlobito = () => {
    if (typeof window !== "undefined" && window.parent !== window) {
      window.parent.postMessage({
        type: "chatboc-minimize-request", // Mensaje para que widget.js minimice
        widgetId: widgetId,
      }, "*"); // IMPORTANTE: En producción, cambia "*" por el origin de la página contenedora
    }
  };
  
  const rubroSelectionViewContent = (
    <div className="w-full h-full flex flex-col items-center justify-center p-4 animate-slide-up">
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
      <ChatHeader title="Chatboc Asistente" onMinimize={requestMinimizeToGlobito} />
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3" ref={chatContainerRef}>
        {messages.map((msg) => <ChatMessage key={msg.id} message={msg} /> )}
        {isTyping && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>
      <ChatInput onSendMessage={handleSendMessage} />
    </>
  );

  const widgetStyle: CSSProperties = {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    background: prefersDark ? "#161c24" : "#fff",
    color: prefersDark ? "#fff" : "#222",
    overflow: "hidden",
    // El iframe en widget.js manejará el borderRadius y boxShadow.
    // Este div interno ocupa el 100% del iframe.
  };

  return (
    <div style={widgetStyle}>
      {esperandoRubro ? rubroSelectionViewContent : mainChatViewContent}
    </div>
  );
};

export default ChatWidget;